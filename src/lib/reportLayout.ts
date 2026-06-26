import { computeCenarios, fmtBRL, type CenarioInputs } from "@/lib/cenarios";

/** Divide o HTML do relatório em seções por <h2>. */
function splitSections(html: string): { title: string; html: string }[] {
  if (!html) return [];
  const parts = html.split(/(?=<h2)/i).filter((p) => p.trim());
  return parts.map((p) => {
    const m = p.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    return { title: m ? m[1].replace(/<[^>]+>/g, "").trim() : "", html: p };
  });
}

const card = (inner: string) =>
  `<div style="border:1px solid #e3e8e5;border-radius:14px;padding:16px 18px;margin:10px 0 18px;background:#fafbfa;">${inner}</div>`;

const cell = (label: string, value: string, color = "#14633e") =>
  `<td style="text-align:center;padding:6px 10px;">
     <div style="font-size:10px;color:#6b7d74;">${label}</div>
     <div style="font-size:14px;font-weight:700;color:${color};">${value}</div>
   </td>`;

function kpiCard(s: any): string {
  const fin = Number(s.patrimonioFinanceiro) || 0;
  const bens = Number(s.patrimonioBens) || 0;
  return card(
    `<table style="width:100%;border-collapse:collapse;"><tr>
       ${cell("Financeiro", fmtBRL(fin), "#14201a")}
       ${cell("Bens (líquido)", fmtBRL(bens), "#14201a")}
       ${cell("Patrimônio Total", fmtBRL(fin + bens))}
     </tr></table>`
  );
}

function objetivosCard(s: any): string {
  const objs: any[] = s.objetivos || [];
  if (!objs.length) return "";
  const total = objs.reduce((t, o) => t + (Number(o.aporteMensal) || 0), 0);
  const rows = objs
    .map(
      (o) =>
        `<tr>
           <td style="padding:6px 0;font-size:12px;">${o.nome || "Objetivo"}</td>
           <td style="padding:6px 0;font-size:12px;text-align:right;color:#14633e;font-weight:600;">
             ${o.aporteMensal ? fmtBRL(o.aporteMensal) + "/mês" : "—"}
           </td>
         </tr>`
    )
    .join("");
  return card(
    `<div style="display:flex;justify-content:space-between;margin-bottom:6px;">
       <span style="font-size:12px;font-weight:700;">Objetivos de Vida</span>
       <span style="font-size:12px;color:#14633e;font-weight:700;">Total: ${fmtBRL(total)}/mês</span>
     </div>
     <table style="width:100%;border-collapse:collapse;">${rows}</table>`
  );
}

function cenariosCard(s: any): string {
  const inputs: CenarioInputs = {
    idade: s.idade, idadeAposentadoria: s.idadeAposentadoria, expectativaVida: s.expectativaVida,
    patrimonioFinanceiro: s.patrimonioFinanceiro, poupancaMensal: s.poupancaMensal,
    taxaNominalPct: s.taxaNominal, inflacaoPct: s.inflacao, rendaDesejada: s.rendaDesejada,
    rendaPassivaAtual: s.rendaPassivaAtual, rendaPassivaBens: s.rendaPassivaBens,
  };
  const c = computeCenarios(inputs);
  if (!c.ok) return "";
  const col = (cor: string, titulo: string, linhas: [string, string][]) =>
    `<td style="vertical-align:top;width:33%;padding:10px 12px;border-left:3px solid ${cor};">
       <div style="font-size:12px;font-weight:700;color:${cor};margin-bottom:5px;">${titulo}</div>
       ${linhas.map(([k, v]) => `<div style="font-size:10px;color:#6b7d74;">${k}</div><div style="font-size:12px;font-weight:700;margin-bottom:3px;">${v}</div>`).join("")}
     </td>`;
  return card(
    `<div style="font-size:12px;font-weight:700;margin-bottom:8px;">Cenários de Aposentadoria</div>
     <table style="width:100%;border-collapse:collapse;"><tr>
       ${col("#b8860b", "Realidade", [["Poupança/mês", fmtBRL(s.poupancaMensal)], ["Na aposentadoria", fmtBRL(c.patAposentadoria)], [`Aos ${s.expectativaVida}`, fmtBRL(c.patFinalRealidade)]])}
       ${col("#b23b32", "Consumo", [["Poupança nec.", fmtBRL(c.poupancaConsumo) + "/mês"], ["Montante", fmtBRL(c.montanteConsumo)], [`Aos ${s.expectativaVida}`, fmtBRL(c.patFinalConsumo)]])}
       ${col("#1c7a4d", "Viver de Renda", [["Poupança nec.", fmtBRL(c.poupancaViver) + "/mês"], ["Montante", fmtBRL(c.montanteViver)], [`Aos ${s.expectativaVida}`, fmtBRL(c.patFinalViver)]])}
     </tr></table>`
  );
}

// ── Seções institucionais (estilo XP), geradas dos dados ────────────────────
const secTitle = (t: string) =>
  `<h2 style="font-size:17px;color:#14201a;margin:22px 0 6px;border-bottom:2px solid #16a34a;padding-bottom:4px;">${t}</h2>`;

const tableHtml = (headers: string[], rows: string) =>
  `<table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0 14px;">
     <tr style="background:#4b5563;color:#fff;">${headers.map((h, i) => `<td style="padding:6px 10px;text-align:${i === 0 ? "left" : "right"};">${h}</td>`).join("")}</tr>
     ${rows}
   </table>`;

const tr = (cells: string[]) =>
  `<tr>${cells.map((c, i) => `<td style="padding:5px 10px;border-bottom:1px solid #eef1ef;text-align:${i === 0 ? "left" : "right"};">${c}</td>`).join("")}</tr>`;

export function buildInstitutionalSections(s: Record<string, any> | null): string {
  if (!s) return "";
  const idade = Number(s.idade) || 35;
  const idadeApos = Number(s.idadeAposentadoria) || 60;
  const exp = Number(s.expectativaVida) || 90;
  const receita = Number(s.receitaMediaMensal) || 0;
  const despesa = Number(s.despesaMediaMensal) || 0;
  const inf = (Number(s.inflacao) || 4) / 100;
  const capMensal = receita - despesa;

  // 1) Fluxo Financeiro
  let fluxoRows = "";
  for (let age = idade; age <= exp; age++) {
    const fator = Math.pow(1 + inf, age - idade);
    const ent = age < idadeApos ? receita * 12 * fator : 0;
    const sai = despesa * 12 * fator;
    const cap = ent - sai;
    fluxoRows += tr([
      String(age),
      fmtBRL(ent),
      fmtBRL(sai),
      `<span style="color:${cap < 0 ? "#b23b32" : "#1c7a4d"};">${fmtBRL(cap)}</span>`,
    ]);
  }
  const fluxo =
    secTitle("Fluxo Financeiro") +
    card(
      `<div style="font-size:10px;color:#6b7d74;text-transform:uppercase;">Capacidade de aporte (hoje)</div>
       <table style="width:100%;margin-top:4px;"><tr>
         <td><div style="font-size:10px;color:#6b7d74;">Aporte médio mensal</div><div style="font-size:15px;font-weight:700;color:${capMensal < 0 ? "#b23b32" : "#14633e"};">${fmtBRL(capMensal)}</div></td>
         <td><div style="font-size:10px;color:#6b7d74;">Aporte médio anual</div><div style="font-size:15px;font-weight:700;color:${capMensal < 0 ? "#b23b32" : "#14633e"};">${fmtBRL(capMensal * 12)}</div></td>
       </tr></table>`
    ) +
    tableHtml(["Idade", "Entradas", "Saídas", "Capacidade de aporte"], fluxoRows);

  // 2) Patrimônio por categoria
  const invs: any[] = s.investimentos || [];
  const bens: any[] = s.bens || [];
  const nacional = invs.filter((i) => i.classe !== "exterior").reduce((t, i) => t + Number(i.valor || 0), 0);
  const exterior = invs.filter((i) => i.classe === "exterior").reduce((t, i) => t + Number(i.valor || 0), 0);
  const imoveis = bens.filter((b) => b.tipo === "imovel").reduce((t, b) => t + Number(b.valor || 0), 0);
  const veiculos = bens.filter((b) => b.tipo === "veiculo").reduce((t, b) => t + Number(b.valor || 0), 0);
  const empresa = bens.filter((b) => b.tipo === "empresa").reduce((t, b) => t + Number(b.valor || 0), 0);
  const outros = bens.filter((b) => !["imovel", "veiculo", "empresa"].includes(b.tipo)).reduce((t, b) => t + Number(b.valor || 0), 0);
  const cats: [string, number][] = [
    ["Investimento Nacional", nacional],
    ["Investimento Exterior", exterior],
    ["Imóveis", imoveis],
    ["Veículos", veiculos],
    ["Empresa/Participações", empresa],
    ["Outros bens", outros],
  ].filter(([, v]) => v > 0) as [string, number][];
  const totalPat = cats.reduce((t, [, v]) => t + v, 0) || 1;
  const patRows = cats
    .map(([nome, v]) => tr([nome, fmtBRL(v), ((v / totalPat) * 100).toFixed(1) + "%"]))
    .join("");
  const patrimonio =
    secTitle("Patrimônio por Categoria") +
    tableHtml(["Categoria", "Valor", "% do total"], patRows + tr([`<strong>Total</strong>`, `<strong>${fmtBRL(totalPat)}</strong>`, "100%"]));

  // 3) Projeção do Planejamento (3 cenários, ano a ano)
  const inputs: CenarioInputs = {
    idade, idadeAposentadoria: idadeApos, expectativaVida: exp,
    patrimonioFinanceiro: s.patrimonioFinanceiro, poupancaMensal: s.poupancaMensal,
    taxaNominalPct: s.taxaNominal, inflacaoPct: s.inflacao, rendaDesejada: s.rendaDesejada,
    rendaPassivaAtual: s.rendaPassivaAtual, rendaPassivaBens: s.rendaPassivaBens,
  };
  const c = computeCenarios(inputs);
  let projecao = "";
  if (c.ok) {
    const projRows = c.chartData
      .map((d) => tr([String(d.idade), fmtBRL(d.Realidade), fmtBRL(d.Consumo), fmtBRL(d["Viver de Renda"])]))
      .join("");
    projecao =
      secTitle("Projeção do Planejamento") +
      tableHtml(["Idade", "Realidade", "Consumo do Patrimônio", "Preservação do Patrimônio"], projRows);
  }

  // 4) Termos e Conceitos
  const termo = (t: string, d: string) =>
    `<div style="margin-bottom:8px;"><div style="font-size:12px;font-weight:700;">${t}</div><div style="font-size:11px;color:#4a5650;">${d}</div></div>`;
  const termos =
    secTitle("Termos e Conceitos") +
    termo("Projeção em termos reais", "Valores projetados pela rentabilidade real (retorno esperado descontada a inflação/IPCA). Indica o poder de compra ao longo do tempo.") +
    termo("Capacidade de aporte", "Saldo entre rendas e despesas. É principalmente com ela que o cliente atinge suas metas financeiras.") +
    termo("Objetivos", "Metas de curto, médio e longo prazo (aposentadoria, imóvel, viagem…), com o aporte mensal necessário para cada uma.") +
    termo("Cenário Realidade", "Projeção do patrimônio mantendo a poupança praticada hoje.") +
    termo("Consumo do Patrimônio", "Valor mínimo a acumular para gastar o patrimônio inteiro até a expectativa de vida.") +
    termo("Preservação (Viver de Renda)", "Patrimônio necessário para que os rendimentos cubram a renda desejada sem consumir o principal.") +
    `<div style="font-size:11px;color:#4a5650;margin-top:6px;"><strong>Fórmula resumida:</strong> FV = ([Valor Presente] + Aportes − Resgates) × (1 + Juros)<sup>período</sup></div>`;

  return fluxo + patrimonio + projecao + termos;
}

export function buildDisclaimerPage(): string {
  return `<div style="page-break-before:always;padding-top:18mm;">
    <h2 style="font-size:17px;color:#14201a;border-bottom:2px solid #16a34a;padding-bottom:4px;">Disclaimer</h2>
    <p style="font-size:10px;color:#4a5650;line-height:1.6;text-align:justify;">
      Este material foi elaborado pela <strong>Zephyr</strong> e possui caráter meramente informativo e educacional,
      não constituindo recomendação de investimento, consultoria financeira, oferta de compra ou venda de qualquer
      ativo, promessa de rentabilidade ou garantia de resultados. As projeções e informações apresentadas são
      hipotéticas, baseadas nas informações fornecidas pelo cliente, e podem variar ao longo do tempo. Investir
      envolve risco, incluindo possível perda do principal investido. O desempenho passado não é garantia de
      resultados futuros e a rentabilidade não é líquida de impostos. As projeções em termos reais consideram a
      inflação com base no IPCA. Todas as medidas pressupõem rebalanceamento periódico e reinvestimento de proventos.
      A Zephyr não se responsabiliza por decisões tomadas com base neste material.
    </p>
  </div>`;
}

/**
 * Compõe o relatório no padrão Atlas: cabeçalho + aviso + cada seção do texto
 * seguida do card de dados correspondente. HTML com estilos inline (serve para
 * a pré-visualização na tela e para o PDF). `chartSvg` opcional embute o gráfico.
 */
export function composeFullReport(opts: {
  titulo: string;
  nome: string;
  contentHtml: string;
  snapshot: Record<string, any> | null;
  chartSvg?: string;
}): string {
  const { titulo, nome, contentHtml, snapshot, chartSvg } = opts;
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const header = `
    <div style="text-align:center;padding:18px;border:1px solid #e3e8e5;border-radius:16px;background:#f3f6f4;margin-bottom:14px;">
      <div style="font-size:18px;font-weight:800;color:#14201a;">${titulo}</div>
      <div style="font-size:13px;color:#6b7d74;margin-top:4px;">${hoje}</div>
      <div style="display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;background:#e1efe7;color:#14633e;font-size:11px;font-weight:600;">✦ Gerado com IA · Zephyr</div>
    </div>`;

  const aviso = `
    <div style="border:1px solid #f0d9a0;background:#fdf6e6;border-radius:12px;padding:12px 14px;font-size:11px;color:#7a6320;margin-bottom:16px;">
      <strong>ATENÇÃO:</strong> Este relatório é gerado com apoio de inteligência artificial com base nas informações fornecidas. Possui caráter informativo e educacional e não constitui recomendação de investimento, consultoria financeira ou garantia de resultados.
    </div>`;

  let body = "";
  for (const sec of splitSections(contentHtml)) {
    body += sec.html;
    const t = sec.title.toLowerCase();
    if (t.includes("capacidade")) body += kpiCard(snapshot);
    else if (t.includes("objetivo")) body += objetivosCard(snapshot);
    else if (t.includes("aposentad")) {
      body += cenariosCard(snapshot);
      if (chartSvg) body += card(`<div style="font-size:12px;font-weight:700;margin-bottom:8px;">Projeção de Patrimônio — 3 Cenários</div>${chartSvg}`);
    }
  }

  return header + aviso + body + buildInstitutionalSections(snapshot) + buildDisclaimerPage();
}
