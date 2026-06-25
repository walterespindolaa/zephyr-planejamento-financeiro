-- ============================================================================
-- Acompanhamentos por cliente (consórcio, seguro, reunião, previdência…)
-- Permite à planejadora ver toda a base com filtros e status.
-- ============================================================================
create table if not exists public.client_acompanhamentos (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  tipo           text not null default 'outro',   -- consorcio|seguro|previdencia|investimento|reuniao|revisao|outro
  titulo         text,
  descricao      text,
  responsavel_id uuid references public.profiles(user_id) on delete set null,
  status         text not null default 'pendente', -- pendente|agendado|feito|executado|cancelado
  data_evento    date,
  created_by     uuid references public.profiles(user_id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_acomp_client on public.client_acompanhamentos(client_id);
create index if not exists idx_acomp_tipo on public.client_acompanhamentos(tipo);
create index if not exists idx_acomp_status on public.client_acompanhamentos(status);
create index if not exists idx_acomp_resp on public.client_acompanhamentos(responsavel_id);

drop trigger if exists t_acomp_updated on public.client_acompanhamentos;
create trigger t_acomp_updated before update on public.client_acompanhamentos
  for each row execute function public.touch_updated_at();

alter table public.client_acompanhamentos enable row level security;
drop policy if exists acomp_all on public.client_acompanhamentos;
create policy acomp_all on public.client_acompanhamentos for all
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));
