-- ============================================================================
-- Inclusões opcionais do relatório: Proteção Patrimonial (sucessão) + Próximos Passos
-- ============================================================================
create table if not exists public.client_report_inclusoes (
  client_id               uuid primary key references public.clients(id) on delete cascade,
  incluir_protecao        boolean not null default false,
  patrimonio_imobilizado  numeric(14,2),
  patrimonio_financeiro   numeric(14,2),
  itcmd_pct               numeric(6,2) default 8,
  advocaticias_pct        numeric(6,2) default 5,
  cartorarias_pct         numeric(6,2) default 2,
  capital_sucessorio      numeric(14,2),
  prev_observacao         text,
  incluir_proximos_passos boolean not null default true,
  updated_at              timestamptz not null default now()
);

alter table public.client_report_inclusoes enable row level security;
drop policy if exists report_inclusoes_all on public.client_report_inclusoes;
create policy report_inclusoes_all on public.client_report_inclusoes for all
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

notify pgrst, 'reload schema';
