-- ============================================================================
-- Zephyr | Planejamento Financeiro — Fundação do banco de dados
-- Papéis: admin (Walter), planejadora (Eloise), assessor (equipe)
-- Modelo: clientes/leads vinculados a 1 assessor + 1 planejadora, com CRM,
--         dados financeiros, eventos (Vista da Montanha) e relatórios editáveis.
-- Segurança: RLS por papel.
-- ============================================================================

-- ── Tipos ──────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('admin', 'planejadora', 'assessor', 'pendente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_status as enum ('lead', 'ativo', 'inativo', 'arquivado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('rascunho', 'finalizado');
exception when duplicate_object then null; end $$;

-- ── Roster da equipe (define o papel no 1º login pelo e-mail) ───────────────
create table if not exists public.team_roster (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,
  full_name   text not null,
  role        user_role not null default 'assessor',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Perfis (1:1 com auth.users) ─────────────────────────────────────────────
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        user_role not null default 'pendente',
  avatar_url  text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Clientes / Leads ────────────────────────────────────────────────────────
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  email          text,
  telefone       text,
  data_nascimento date,
  profissao      text,
  estado_civil   text,
  status         client_status not null default 'lead',
  -- Vínculos
  assessor_id    uuid references public.profiles(user_id) on delete set null,
  planejadora_id uuid references public.profiles(user_id) on delete set null,
  created_by     uuid references public.profiles(user_id) on delete set null,
  -- CRM
  origem         text,
  endereco       text,
  info           text,
  tags           text[] default '{}',
  -- auditoria
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_clients_assessor on public.clients(assessor_id);
create index if not exists idx_clients_planejadora on public.clients(planejadora_id);
create index if not exists idx_clients_status on public.clients(status);

-- ── CRM: notas e tarefas ────────────────────────────────────────────────────
create table if not exists public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  author_id   uuid references public.profiles(user_id) on delete set null,
  content     text not null,
  tipo        text not null default 'nota', -- nota | ligacao | reuniao | mensagem | atendimento
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notes_client on public.client_notes(client_id);

create table if not exists public.client_tasks (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  author_id   uuid references public.profiles(user_id) on delete set null,
  title       text not null,
  done        boolean not null default false,
  due_date    date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tasks_client on public.client_tasks(client_id);

-- ── Organização financeira: receitas e despesas ─────────────────────────────
create table if not exists public.client_receitas (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  categoria   text,
  valor       numeric(14,2) not null default 0,
  data        date,
  recorrente  boolean not null default false,
  responsavel text, -- pessoa1 | pessoa2 (casal)
  created_at  timestamptz not null default now()
);
create index if not exists idx_receitas_client on public.client_receitas(client_id);

create table if not exists public.client_despesas (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  categoria     text,
  valor         numeric(14,2) not null default 0,
  tipo          text, -- fixa | variavel | parcela | divida
  data          date,
  recorrente    boolean not null default false,
  is_parcelada  boolean not null default false,
  total_parcelas int,
  parcela_atual  int,
  responsavel   text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_despesas_client on public.client_despesas(client_id);

-- ── Planejamento: objetivos, bens/imóveis, investimentos, aposentadoria ─────
create table if not exists public.client_objetivos (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  nome             text not null,
  valor_objetivo   numeric(14,2) not null default 0,
  valor_acumulado  numeric(14,2) not null default 0,
  aporte_mensal    numeric(14,2) not null default 0,
  data_objetivo    date,
  created_at       timestamptz not null default now()
);
create index if not exists idx_objetivos_client on public.client_objetivos(client_id);

create table if not exists public.client_bens (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  nome             text not null,
  tipo             text, -- imovel | veiculo | outro
  valor            numeric(14,2) not null default 0,
  divida_vinculada numeric(14,2) default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_bens_client on public.client_bens(client_id);

create table if not exists public.client_investimentos (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  nome                text not null,
  tipo                text,
  classe              text, -- renda_fixa | renda_variavel | fii | exterior | cripto ...
  valor_atual         numeric(14,2) not null default 0,
  is_reserva_emergencia boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists idx_invest_client on public.client_investimentos(client_id);

create table if not exists public.client_aposentadoria (
  client_id           uuid primary key references public.clients(id) on delete cascade,
  idade_atual         int,
  idade_aposentadoria int,
  expectativa_vida    int default 95,
  renda_desejada      numeric(14,2),
  poupanca_mensal     numeric(14,2),
  taxa_retorno_anual  numeric(6,4) default 0.06,
  inflacao_anual      numeric(6,4) default 0.04,
  updated_at          timestamptz not null default now()
);

-- ── Vista da Montanha: eventos de vida (projeção no tempo) ───────────────────
create table if not exists public.client_eventos (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  name            text not null,
  emoji           text default '📌',
  ano             int not null,
  tipo            text not null default 'outro', -- imovel|filho|educacao|viagem|carro|aposentadoria|negocio|outro
  impacto_valor   numeric(14,2) not null default 0,  -- lump sum
  impacto_mensal  numeric(14,2) default 0,
  duracao_meses   int default 0,
  ordem           int default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_eventos_client on public.client_eventos(client_id);

-- ── Relatórios editáveis (salvos por cliente) ───────────────────────────────
create table if not exists public.client_reports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  titulo        text not null default 'Relatório de Planejamento Financeiro',
  content_html  text,            -- conteúdo editável (TipTap HTML)
  snapshot      jsonb,           -- KPIs/projeções congelados no momento da geração
  status        report_status not null default 'rascunho',
  created_by    uuid references public.profiles(user_id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_reports_client on public.client_reports(client_id);

-- ============================================================================
-- Funções auxiliares (SECURITY DEFINER) — evitam recursão de RLS
-- ============================================================================
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where user_id = auth.uid()), false);
$$;

create or replace function public.is_planner_or_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','planejadora') from public.profiles where user_id = auth.uid()), false);
$$;

-- Acesso a um cliente: admin/planejadora veem tudo; assessor vê os seus.
create or replace function public.can_access_client(c_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_planner_or_admin()
    or exists (
      select 1 from public.clients c
      where c.id = c_id
        and (c.assessor_id = auth.uid() or c.created_by = auth.uid())
    );
$$;

-- ============================================================================
-- Trigger: cria perfil no signup e define papel a partir do roster
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r_role user_role;
  r_name text;
begin
  select role, full_name into r_role, r_name
  from public.team_roster
  where lower(email) = lower(new.email) and ativo = true
  limit 1;

  insert into public.profiles (user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(r_name, new.raw_user_meta_data->>'full_name', new.email),
    coalesce(r_role, 'pendente')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        role = case when public.profiles.role = 'pendente' then excluded.role else public.profiles.role end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── updated_at automático ───────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists t_clients_updated on public.clients;
create trigger t_clients_updated before update on public.clients
  for each row execute function public.touch_updated_at();
drop trigger if exists t_reports_updated on public.client_reports;
create trigger t_reports_updated before update on public.client_reports
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.team_roster         enable row level security;
alter table public.clients             enable row level security;
alter table public.client_notes        enable row level security;
alter table public.client_tasks        enable row level security;
alter table public.client_receitas     enable row level security;
alter table public.client_despesas     enable row level security;
alter table public.client_objetivos    enable row level security;
alter table public.client_bens         enable row level security;
alter table public.client_investimentos enable row level security;
alter table public.client_aposentadoria enable row level security;
alter table public.client_eventos      enable row level security;
alter table public.client_reports      enable row level security;

-- profiles: cada um vê o próprio; planejadora/admin veem todos; admin gerencia
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (user_id = auth.uid() or public.is_planner_or_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (user_id = auth.uid() or public.is_admin());

-- team_roster: somente admin
drop policy if exists roster_admin on public.team_roster;
create policy roster_admin on public.team_roster for all
  using (public.is_admin()) with check (public.is_admin());

-- clients
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select
  using (public.is_planner_or_admin() or assessor_id = auth.uid() or created_by = auth.uid());
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert
  with check (auth.uid() is not null);
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update
  using (public.can_access_client(id));
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete
  using (public.is_planner_or_admin());

-- Macro para tabelas-filhas de cliente: acesso = can_access_client(client_id)
do $$
declare t text;
begin
  foreach t in array array[
    'client_notes','client_tasks','client_receitas','client_despesas',
    'client_objetivos','client_bens','client_investimentos','client_eventos','client_reports'
  ] loop
    execute format('drop policy if exists %1$s_all on public.%1$s;', t);
    execute format(
      'create policy %1$s_all on public.%1$s for all
         using (public.can_access_client(client_id))
         with check (public.can_access_client(client_id));', t);
  end loop;
end $$;

-- aposentadoria (PK = client_id)
drop policy if exists client_aposentadoria_all on public.client_aposentadoria;
create policy client_aposentadoria_all on public.client_aposentadoria for all
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

-- ============================================================================
-- Seed do roster — somente o admin master.
-- Os demais membros (assessores, planejadora) são adicionados pelo admin
-- DENTRO da plataforma (tela Equipe), que grava aqui o e-mail + papel.
-- Depois basta criar o usuário no Supabase Auth com o mesmo e-mail:
-- no 1º login o papel definido aqui é aplicado automaticamente.
-- ============================================================================
insert into public.team_roster (email, full_name, role) values
  ('walter.espindola@zinvestimentos.com', 'Walter Espindola', 'admin')
on conflict (email) do nothing;
