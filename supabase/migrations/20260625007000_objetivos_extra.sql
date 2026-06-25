-- Campos extras dos objetivos (replicando o Atlas: tipo, frequência, aporte auto)
alter table public.client_objetivos
  add column if not exists tipo text default 'viagem_nacional',
  add column if not exists frequencia text default 'unico',
  add column if not exists descricao text,
  add column if not exists aporte_automatico boolean not null default false;

-- recarrega o cache de schema do PostgREST (evita "column not found")
notify pgrst, 'reload schema';
