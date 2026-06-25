-- Descrição amigável (o que aparece no relatório, ex.: "Salário Empresa X")
-- A categoria fica padronizada (para agrupar e gerar relatórios).
alter table public.client_receitas add column if not exists descricao text;
alter table public.client_despesas add column if not exists descricao text;
