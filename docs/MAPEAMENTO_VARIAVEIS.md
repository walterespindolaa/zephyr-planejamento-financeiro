# Mapeamento — variáveis do relatório × onde a Eloise preenche

O relatório **"Estratégia de Subida"** usa as variáveis abaixo. Cada uma é alimentada
por um campo numa aba da ficha do cliente. Onde houver soma/derivação, está indicado.

| Variável (relatório)        | Aba → Seção            | Campo de input                         | Observação |
|-----------------------------|------------------------|----------------------------------------|------------|
| `nome`                      | (cabeçalho do cliente) | Nome                                   | Cadastro do cliente |
| `idade`                     | Planejamento → Aposentadoria | Idade atual                       | |
| `idadeAposentadoria`        | Planejamento → Aposentadoria | Idade de aposentadoria            | |
| `expectativaVida`           | Planejamento → Aposentadoria | Expectativa de vida               | |
| `rendaDesejada`             | Planejamento → Aposentadoria | Renda mensal desejada             | |
| `poupancaMensal`            | Planejamento → Aposentadoria | Poupança mensal atual             | |
| `rendaPassivaAtual`         | Planejamento → Aposentadoria | Renda passiva atual               | |
| `taxaNominal`               | Planejamento → Aposentadoria | Taxa de retorno anual             | 0.10 = 10% |
| `inflacao`                  | Planejamento → Aposentadoria | Inflação anual                    | 0.05 = 5% |
| `patrimonioFinanceiro`      | Planejamento → Investimentos | **Soma** dos "Valor"              | |
| `reservaEmergencia`         | Planejamento → Investimentos | Soma dos que têm "Reserva?" ✓     | |
| `patrimonioBens`            | Planejamento → Bens    | **Soma** (Valor − Dívida)              | |
| `rendaPassivaBens`          | Planejamento → Bens    | Soma de "Renda/mês" dos com "Renda?" ✓ | |
| `objetivos[]`               | Planejamento → Objetivos | Objetivo, Valor, Acumulado, Aporte/mês, Prazo | cada linha = 1 objetivo |
| `totalAporteMensalObjetivos`| Planejamento → Objetivos | **Soma** dos "Aporte/mês"         | |
| `receitaMediaMensal`        | Organização → Receitas | **Média mensal** dos valores           | |
| `despesaMediaMensal`        | Organização → Despesas | **Média mensal** dos valores           | |
| `capacidadePoupanca`        | (derivada)             | Receita média − Despesa média          | calculada |
| `dependentes[]`             | Planejamento → Dependentes | Nome, Parentesco, Nascimento       | |
| `indicadoresEconomicos`     | (fonte de mercado)     | — não é input da Eloise                | Selic/IPCA puxados por API/constante na geração |

## Onde isso é montado no código
- **Telas de input**: `src/components/cliente/OrganizacaoTab.tsx` e `PlanejamentoTab.tsx`
  (lista genérica em `CrudList.tsx`, aposentadoria em `AposentadoriaForm.tsx`).
- **Tabelas**: `client_receitas`, `client_despesas`, `client_objetivos`,
  `client_investimentos`, `client_bens`, `client_aposentadoria`, `client_dependentes`.
- **Agregação + prompt** (próximo módulo): a Edge Function `relatorio-estrategia` vai ler
  essas tabelas, montar o mesmo `contextData` do Atlas e enviar pro Claude.
