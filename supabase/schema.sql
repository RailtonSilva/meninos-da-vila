-- Meninos da Vila FC — estrutura do banco (Supabase / PostgreSQL)
-- Rode este arquivo no Supabase: SQL Editor → New query → cole tudo → Run.

create extension if not exists pgcrypto;

-- Alunos da escolinha
create table if not exists public.alunos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (char_length(nome) between 2 and 120),
  data_nascimento  date,
  responsavel      text,
  telefone         text,
  email            text,
  observacoes      text,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- Uma linha por aluno por mês pago (competência no formato AAAA-MM)
create table if not exists public.pagamentos (
  id           uuid primary key default gen_random_uuid(),
  aluno_id     uuid not null references public.alunos(id) on delete cascade,
  competencia  char(7) not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  valor        numeric(10,2) not null default 40.00 check (valor >= 0),
  pago_em      timestamptz not null default now(),
  unique (aluno_id, competencia)
);

create index if not exists pagamentos_competencia_idx on public.pagamentos (competencia);
create index if not exists alunos_nome_idx on public.alunos (nome);

-- Mantém atualizado_em sempre correto
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists alunos_atualizado_em on public.alunos;
create trigger alunos_atualizado_em
  before update on public.alunos
  for each row execute function public.tocar_atualizado_em();

-- Segurança: RLS ligado e SEM políticas públicas.
-- Ninguém acessa as tabelas com a chave pública (anon). Só a API na Vercel,
-- que usa a service_role e confere o login do usuário antes de cada operação.
alter table public.alunos     enable row level security;
alter table public.pagamentos enable row level security;

-- ============================================================
-- Compartilhamento e galeria (mesmo conteúdo de 002_compartilhamento.sql)
-- ============================================================

-- Links de acesso livre (cada link tem um token aleatório e pode ser desativado)
create table if not exists public.links_publicos (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique check (char_length(token) between 20 and 64),
  titulo         text,
  ativo          boolean not null default true,
  nome_completo  boolean not null default false,  -- false = mostra "Arthur S."
  expira_em      timestamptz,
  acessos        integer not null default 0,
  criado_em      timestamptz not null default now()
);

-- Fotos e vídeos da escolinha
create table if not exists public.midias (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('foto', 'video', 'youtube')),
  caminho    text,   -- arquivo no Storage (foto/video)
  url        text,   -- link do YouTube
  legenda    text,
  criado_em  timestamptz not null default now(),
  check ((tipo = 'youtube' and url is not null) or (tipo <> 'youtube' and caminho is not null))
);
create index if not exists midias_criado_em_idx on public.midias (criado_em desc);

alter table public.links_publicos enable row level security;
alter table public.midias         enable row level security;

-- Contador de acessos do link (chamado só pela API)
create or replace function public.registrar_acesso(t text)
returns void language sql as $$
  update public.links_publicos set acessos = acessos + 1 where token = t;
$$;
revoke execute on function public.registrar_acesso(text) from public, anon, authenticated;

-- Bucket público para a galeria (até 50 MB por arquivo — limite do plano gratuito)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('galeria', 'galeria', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- Controle de acesso e histórico (mesmo conteúdo de 003_acesso.sql)
-- ============================================================

-- Perfil de cada usuário da plataforma (1 para 1 com auth.users)
create table if not exists public.perfis (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  nome           text,
  papel          text not null default 'treinador' check (papel in ('admin', 'treinador')),
  status         text not null default 'pendente' check (status in ('pendente', 'ativo', 'bloqueado')),
  aprovado_por   uuid references auth.users(id) on delete set null,
  aprovado_em    timestamptz,
  notificado_em  timestamptz,   -- quando os admins foram avisados do cadastro
  ultimo_acesso  timestamptz,
  criado_em      timestamptz not null default now()
);
create index if not exists perfis_status_idx on public.perfis (status);

-- Quem já existia antes desta atualização (o dono da escolinha) vira administrador ativo
insert into public.perfis (id, email, nome, papel, status, aprovado_em)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)), 'admin', 'ativo', now()
from auth.users u
on conflict (id) do nothing;

-- Todo novo cadastro entra como treinador PENDENTE.
-- Exceção: se ainda não existe nenhum admin, o primeiro cadastro vira admin ativo.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sem_admin boolean;
begin
  select not exists (select 1 from public.perfis where papel = 'admin') into sem_admin;
  insert into public.perfis (id, email, nome, papel, status, aprovado_em)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
    case when sem_admin then 'admin' else 'treinador' end,
    case when sem_admin then 'ativo' else 'pendente' end,
    case when sem_admin then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Histórico de ações (quem fez o quê e quando)
create table if not exists public.auditoria (
  id             bigint generated always as identity primary key,
  criado_em      timestamptz not null default now(),
  usuario_id     uuid references auth.users(id) on delete set null,
  usuario_nome   text,
  acao           text not null,          -- ex.: pagamento.marcar, aluno.excluir
  entidade_id    text,
  descricao      text not null,
  dados          jsonb
);
create index if not exists auditoria_criado_em_idx on public.auditoria (criado_em desc);
create index if not exists auditoria_usuario_idx on public.auditoria (usuario_id, criado_em desc);
create index if not exists auditoria_acao_idx on public.auditoria (acao, criado_em desc);

-- Quem enviou cada foto/vídeo (treinador só pode excluir o que ele mesmo enviou)
alter table public.midias add column if not exists enviado_por uuid references auth.users(id) on delete set null;

-- Mesmo padrão das outras tabelas: RLS ligado, sem políticas públicas. Só a API acessa.
alter table public.perfis    enable row level security;
alter table public.auditoria enable row level security;
