-- Meninos da Vila FC — link público para responsáveis + galeria de fotos e vídeos
-- Já rodou o schema.sql antes? Rode SÓ este arquivo no SQL Editor do Supabase.
-- (Instalação nova: o schema.sql já inclui tudo isto.)

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
