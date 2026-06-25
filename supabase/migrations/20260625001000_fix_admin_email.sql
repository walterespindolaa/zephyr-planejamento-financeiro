-- Correção: alinhar o e-mail do admin com o usuário realmente criado
-- (walter.espindola@zinvestimentos.com) e promover o perfil a admin.

-- 1) roster com o e-mail correto
update public.team_roster
  set email = 'walter.espindola@zinvestimentos.com'
  where role = 'admin';

insert into public.team_roster (email, full_name, role)
  values ('walter.espindola@zinvestimentos.com', 'Walter Espindola', 'admin')
  on conflict (email) do update set role = 'admin';

-- 2) promove o perfil já criado (caso tenha entrado como 'pendente')
update public.profiles
  set role = 'admin'
  where email = 'walter.espindola@zinvestimentos.com';
