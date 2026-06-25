-- ============================================================================
-- Alinhamento das variáveis do relatório "Estratégia de Subida"
-- Adiciona campos/tabelas que faltavam para alimentar 100% das variáveis.
-- ============================================================================

-- Aposentadoria: renda passiva já existente hoje
alter table public.client_aposentadoria
  add column if not exists renda_passiva_atual numeric(14,2) default 0;

-- Bens que geram renda (aluguel, etc.)
alter table public.client_bens
  add column if not exists gera_renda boolean not null default false,
  add column if not exists valor_renda numeric(14,2) default 0;

-- Dependentes (usados no relatório: nome + parentesco + nascimento)
create table if not exists public.client_dependentes (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  nome         text not null,
  parentesco   text,                 -- filho(a), cônjuge, etc.
  data_nascimento date,
  tipo         text,                 -- dependente | sucessao | outro
  observacoes  text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_dependentes_client on public.client_dependentes(client_id);

alter table public.client_dependentes enable row level security;
drop policy if exists client_dependentes_all on public.client_dependentes;
create policy client_dependentes_all on public.client_dependentes for all
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));
