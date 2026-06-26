-- Regime de casamento (importante para sucessão / proteção patrimonial)
alter table public.clients add column if not exists regime_casamento text;
