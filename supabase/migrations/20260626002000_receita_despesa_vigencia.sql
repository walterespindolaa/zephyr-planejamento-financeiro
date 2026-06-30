-- Receitas e despesas por tempo determinado (vigência)
alter table public.client_receitas add column if not exists data_inicio date;
alter table public.client_receitas add column if not exists data_fim date;
alter table public.client_despesas add column if not exists data_inicio date;
alter table public.client_despesas add column if not exists data_fim date;
