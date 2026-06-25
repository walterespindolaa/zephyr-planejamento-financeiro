# Zephyr | Planejamento Financeiro

Plataforma interna de planejamento financeiro da **Zephyr**. Pilotada pela planejadora
(Eloise), com acesso dos assessores aos seus clientes vinculados e gestão de equipe pelo admin.
Stack idêntica ao Atlas: **Vite + React 18 + TypeScript + shadcn/ui + Supabase**, PWA (web + mobile).
Engine financeiro (projeção de vida e simuladores de eventos) reaproveitado e validado do Atlas.

> Status: **Fundação** entregue (branding, modelo de dados, auth por papel, CRM de cliente).
> Próximos módulos: Organização/Planejamento (input de dados), Projeção (Vista da Montanha),
> Relatório editável + PDF Zephyr com IA (Claude).

---

## 1. Rodar localmente

```bash
npm install
cp .env.example .env     # preencha com seu projeto Supabase
npm run dev              # http://localhost:8080
```

`npm run build` gera a versão de produção (já validado).

## 2. Supabase (banco + auth)

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → API**, copie a URL e a **anon/publishable key** para o `.env`:
   ```
   VITE_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="sua_anon_key"
   ```
3. Rode a migration do schema. No **SQL Editor**, cole e execute o conteúdo de
   `supabase/migrations/20260625000000_zephyr_foundation.sql`.
   (Ou via CLI: `supabase db push`.)
4. **Roster da equipe**: a migration já insere os papéis por e-mail em `team_roster`.
   Ajuste os e-mails reais (a tabela usa placeholders `@zephyr.com.br`, exceto o seu).
   O papel é aplicado automaticamente no **primeiro login** de cada pessoa.
5. **Criar os usuários**: em **Authentication → Users → Add user**, crie cada membro com o
   e-mail que está no `team_roster`. No primeiro login o perfil é criado com o papel correto.
   - `walterjoose@gmail.com` → **admin**
   - Eloise → **planejadora**
   - Os 7 assessores → **assessor**

### Papéis e acesso (já com RLS)
- **admin** (Walter): vê tudo, gerencia equipe (`/equipe`).
- **planejadora** (Eloise): vê e edita todos os clientes.
- **assessor**: vê e edita **apenas** os clientes em que está vinculado (`assessor_id`).

## 3. IA — relatórios com Claude (módulo seguinte)

A chave da IA **não** fica no front. Ela vive como **secret** numa Edge Function do Supabase,
o que permite trocar facilmente a sua chave pela do escritório depois:

```bash
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."   # hoje: sua chave; depois: a do escritório
```

A função de geração de relatório (a ser adicionada no próximo módulo) lê `ANTHROPIC_API_KEY`
do ambiente — basta rodar o comando acima de novo com a chave nova para trocar, sem mexer no código.

## 4. GitHub + Deploy na Vercel

```bash
git init && git add . && git commit -m "Zephyr — fundação"
# crie o repo no GitHub e:
git remote add origin git@github.com:SEU_USUARIO/zephyr-planejamento.git
git push -u origin main
```

Na Vercel: **New Project → importe o repo**. Configure as variáveis de ambiente
`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O `vercel.json` já reescreve as
rotas para o SPA. Build command `npm run build`, output `dist`.

## 5. Logos oficiais (capa do PDF)

A UI usa uma marca Zephyr em SVG (`src/components/brand/ZephyrLogo.tsx`). Para fidelidade
total na capa/contracapa do PDF, coloque seus PNGs oficiais em `public/`:
- `public/zephyr-logo-dark.png` — escrita preta (fundo claro)
- `public/zephyr-logo-light.png` — escrita branca (fundo escuro)

---

## Estrutura

```
src/
  components/
    brand/        ZephyrLogo (marca SVG)
    auth/         ProtectedRoute (acesso por papel)
    layout/       AppLayout (sidebar web + mobile)
    cliente/      ClienteCRM (notas, tarefas, info)
    ui/           primitivos shadcn (reaproveitados do Atlas)
  contexts/       AuthContext (sessão + papel)
  hooks/          useClients, useTeam
  lib/
    financial_engine/   ENGINE VALIDADO DO ATLAS (projeção + decision engine)
    types.ts
  pages/          Login, Dashboard, NovoCliente, ClienteDetalhe, Equipe, NotFound
supabase/
  migrations/     schema + RLS + roster da equipe
```

## Roadmap dos próximos módulos
1. **Organização** — input de receitas/despesas (tabelas `client_receitas` / `client_despesas`).
2. **Planejamento** — objetivos, bens/imóveis, investimentos, aposentadoria.
3. **Projeção · Vista da Montanha** — eventos de vida + impacto patrimonial em tempo real
   (usa `lib/financial_engine/life_projection.ts`).
4. **Relatório** — geração via Claude (Edge Function), editor rich-text (negrito, itálico,
   tópicos, fonte/tamanho via TipTap — deps já instaladas), salvar no cliente, exportar PDF
   com capa e contracapa Zephyr (jsPDF + html2canvas, já instalados).
5. **Acesso do cliente** (futuro) — login próprio para acompanhar o planejamento.
```
