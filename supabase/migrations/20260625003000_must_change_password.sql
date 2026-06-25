-- Força troca de senha no primeiro acesso (usuários criados pela plataforma).
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
