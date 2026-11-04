-- Meninos da Vila FC — controle de acesso (administrador / treinador),
-- cadastro com aprovação e histórico de ações.
--
-- Rode no painel do Supabase: SQL Editor → New query → cole tudo → Run.
-- (Instalação nova: o schema.sql já inclui tudo isto.)

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
