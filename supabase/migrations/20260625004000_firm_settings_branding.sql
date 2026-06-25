-- ============================================================================
-- Configurações da empresa (singleton) + storage para capa/contracapa do PDF
-- ============================================================================
create table if not exists public.firm_settings (
  id             int primary key default 1,
  capa_url       text,
  contracapa_url text,
  ai_model       text not null default 'claude-sonnet-4-6',
  updated_at     timestamptz not null default now(),
  constraint firm_settings_singleton check (id = 1)
);
insert into public.firm_settings (id) values (1) on conflict (id) do nothing;

alter table public.firm_settings enable row level security;

-- leitura: qualquer usuário autenticado (front precisa da capa para o PDF)
drop policy if exists firm_settings_read on public.firm_settings;
create policy firm_settings_read on public.firm_settings for select
  using (auth.uid() is not null);

-- escrita: somente admin
drop policy if exists firm_settings_write on public.firm_settings;
create policy firm_settings_write on public.firm_settings for update
  using (public.is_admin()) with check (public.is_admin());

-- ── Storage: bucket público 'branding' para capa/contracapa/logos ───────────
insert into storage.buckets (id, name, public)
  values ('branding', 'branding', true)
  on conflict (id) do nothing;

-- leitura pública dos arquivos de branding
drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects for select
  using (bucket_id = 'branding');

-- upload/atualização/remoção: somente admin
drop policy if exists branding_admin_write on storage.objects;
create policy branding_admin_write on storage.objects for insert
  with check (bucket_id = 'branding' and public.is_admin());
drop policy if exists branding_admin_update on storage.objects;
create policy branding_admin_update on storage.objects for update
  using (bucket_id = 'branding' and public.is_admin());
drop policy if exists branding_admin_delete on storage.objects;
create policy branding_admin_delete on storage.objects for delete
  using (bucket_id = 'branding' and public.is_admin());
