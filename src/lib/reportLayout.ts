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

  return header + aviso + body;
}
