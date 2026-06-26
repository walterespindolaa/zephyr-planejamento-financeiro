-- ============================================================================
-- Oportunidades (flag p/ relatório) + Arquivos do cliente (Supabase Storage)
-- ============================================================================

-- Oportunidades aparecem como "Próximos Passos" no relatório quando marcadas
alter table public.client_acompanhamentos
  add column if not exists incluir_relatorio boolean not null default false,
  add column if not exists valor numeric(14,2);

-- ── Arquivos do cliente ─────────────────────────────────────────────────────
create table if not exists public.client_files (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  nome        text not null,
  path        text not null,
  mime        text,
  tamanho     bigint,
  created_by  uuid references public.profiles(user_id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_files_client on public.client_files(client_id);

alter table public.client_files enable row level security;
drop policy if exists client_files_all on public.client_files;
create policy client_files_all on public.client_files for all
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

-- ── Storage privado p/ documentos (path = {client_id}/{arquivo}) ─────────────
insert into storage.buckets (id, name, public)
  values ('client-files', 'client-files', false)
  on conflict (id) do nothing;

drop policy if exists client_files_read on storage.objects;
create policy client_files_read on storage.objects for select
  using (bucket_id = 'client-files' and public.can_access_client(((storage.foldername(name))[1])::uuid));

drop policy if exists client_files_insert on storage.objects;
create policy client_files_insert on storage.objects for insert
  with check (bucket_id = 'client-files' and public.can_access_client(((storage.foldername(name))[1])::uuid));

drop policy if exists client_files_delete on storage.objects;
create policy client_files_delete on storage.objects for delete
  using (bucket_id = 'client-files' and public.can_access_client(((storage.foldername(name))[1])::uuid));

notify pgrst, 'reload schema';
