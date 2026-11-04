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
