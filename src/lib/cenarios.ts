/**
 * Motor dos 3 cenários de aposentadoria (Realidade, Consumo, Viver de Renda).
 * Replica a metodologia do CenariosChart do Atlas, em termos reais (descontada inflação).
 */

export interface CenarioInputs {
  idade: number;
  idadeAposentadoria: number;
  expectativaVida: number;
  patrimonioFinanceiro: number;
  poupancaMensal: number;
  taxaNominalPct: number; // ex.: 10 (=10% a.a.)
  inflacaoPct: number; // ex.: 4 (=4% a.a.)
  rendaDesejada: number;
  rendaPassivaAtual: number;
  rendaPassivaBens: number;
}

export interface CenarioResult {
  ok: boolean;
  rMensalReal: number;
  gapMensal: number;
  patAposentadoria: number;
  patFinalRealidade: number;
  poupancaConsumo: number;
  montanteConsumo: number;
  patFinalConsumo: number;
  poupancaViver: number;
  montanteViver: number;
  patFinalViver: number;
  chartData: { idade: number; Realidade: number; Consumo: number; "Viver de Renda": number }[];
}

/** Saldo futuro com aportes mensais (pmt>0 deposita, pmt<0 saca). */
function fvBalance(pv: number, pmt: number, r: number, n: number): number {
  if (n <= 0) return pv;
  if (r === 0) return pv + pmt * n;
  const f = Math.pow(1 + r, n);
  return pv * f + pmt * ((f - 1) / r);
}

/** Aporte mensal necessário para ir de pv até fv em n meses à taxa r. */
function pmtNeeded(pv: number, fv: number, r: number, n: number): number {
  if (n <= 0) return 0;
  if (r === 0) return (fv - pv) / n;
  const f = Math.pow(1 + r, n);
  return ((fv - pv * f) * r) / (f - 1);
}

export function computeCenarios(i: CenarioInputs): CenarioResult {
  const empty: CenarioResult = {
    ok: false, rMensalReal: 0, gapMensal: 0, patAposentadoria: 0, patFinalRealidade: 0,
    poupancaConsumo: 0, montanteConsumo: 0, patFinalConsumo: 0,
    poupancaViver: 0, montanteViver: 0, patFinalViver: 0, chartData: [],
  };
  if (!i.idade || !i.idadeAposentadoria || i.idadeAposentadoria <= i.idade) return empty;

  const nom = (i.taxaNominalPct || 10) / 100;
  const inf = (i.inflacaoPct || 4) / 100;
  const taxaRealAnual = (1 + nom) / (1 + inf) - 1;
  const r = Math.pow(1 + taxaRealAnual, 1 / 12) - 1;

  const pv = i.patrimonioFinanceiro || 0;
  const rendaPassiva = (i.rendaPassivaAtual || 0) + (i.rendaPassivaBens || 0);
  const gapMensal = Math.max(0, (i.rendaDesejada || 0) - rendaPassiva);
  const nAcum = (i.idadeAposentadoria - i.idade) * 12;
  const nUso = Math.max(0, (i.expectativaVida - i.idadeAposentadoria) * 12);

  const montanteViver = r > 0 ? gapMensal / r : gapMensal * nUso;
  const montanteConsumo = r > 0 ? gapMensal * (1 - Math.pow(1 + r, -nUso)) / r : gapMensal * nUso;

  const poupancaConsumo = Math.max(0, pmtNeeded(pv, montanteConsumo, r, nAcum));
  const poupancaViver = Math.max(0, pmtNeeded(pv, montanteViver, r, nAcum));

  const startReal = fvBalance(pv, i.poupancaMensal || 0, r, nAcum);
  const startCons = fvBalance(pv, poupancaConsumo, r, nAcum);
  const startViver = fvBalance(pv, poupancaViver, r, nAcum);

  const totalAnos = i.expectativaVida - i.idade;
  const chartData: CenarioResult["chartData"] = [];
  for (let yr = 0; yr <= totalAnos; yr++) {
    const idade = i.idade + yr;
    const m = yr * 12;
    let real: number, cons: number, viver: number;
    if (m <= nAcum) {
      real = fvBalance(pv, i.poupancaMensal || 0, r, m);
      cons = fvBalance(pv, poupancaConsumo, r, m);
      viver = fvBalance(pv, poupancaViver, r, m);
    } else {
      const t = m - nAcum;
      real = fvBalance(startReal, -gapMensal, r, t);
      cons = fvBalance(startCons, -gapMensal, r, t);
      viver = fvBalance(startViver, -gapMensal, r, t);
    }
    chartData.push({
      idade,
      Realidade: Math.max(0, Math.round(real)),
      Consumo: Math.max(0, Math.round(cons)),
      "Viver de Renda": Math.max(0, Math.round(viver)),
    });
  }

  const at = (idade: number, k: "Realidade" | "Consumo" | "Viver de Renda") =>
    chartData.find((d) => d.idade === idade)?.[k] ?? 0;

  return {
    ok: true,
    rMensalReal: r,
    gapMensal,
    patAposentadoria: at(i.idadeAposentadoria, "Realidade"),
    patFinalRealidade: at(i.expectativaVida, "Realidade"),
    poupancaConsumo,
    montanteConsumo,
    patFinalConsumo: at(i.expectativaVida, "Consumo"),
    poupancaViver,
    montanteViver,
    patFinalViver: at(i.expectativaVida, "Viver de Renda"),
    chartData,
  };
}

/** Monta o resumo visual (KPIs + cenários) em HTML com estilos inline, para o PDF. */
export function buildSummaryHtml(snapshot: Record<string, any> | null): string {
  if (!snapshot) return "";
  const inputs: CenarioInputs = {
    idade: snapshot.idade,
    idadeAposentadoria: snapshot.idadeAposentadoria,
    expectativaVida: snapshot.expectativaVida,
    patrimonioFinanceiro: snapshot.patrimonioFinanceiro,
    poupancaMensal: snapshot.poupancaMensal,
    taxaNominalPct: snapshot.taxaNominal,
    inflacaoPct: snapshot.inflacao,
    rendaDesejada: snapshot.rendaDesejada,
    rendaPassivaAtual: snapshot.rendaPassivaAtual,
    rendaPassivaBens: snapshot.rendaPassivaBens,
  };
  const c = computeCenarios(inputs);

  const kpi = (label: string, val: string) =>
    `<td style="padding:10px 12px;border:1px solid #e3e8e5;border-radius:8px;">
       <div style="font-size:10px;color:#6b7d74;text-transform:uppercase;letter-spacing:.04em;">${label}</div>
       <div style="font-size:15px;font-weight:700;color:#14201a;">${val}</div>
     </td>`;

  const kpis = `
    <table style="width:100%;border-collapse:separate;border-spacing:6px;margin:8px 0 14px;">
      <tr>
        ${kpi("Patrimônio financeiro", fmtBRL(snapshot.patrimonioFinanceiro || 0))}
        ${kpi("Patrimônio em bens", fmtBRL(snapshot.patrimonioBens || 0))}
        ${kpi("Reserva de emergência", fmtBRL(snapshot.reservaEmergencia || 0))}
      </tr>
      <tr>
        ${kpi("Receita média/mês", fmtBRL(snapshot.receitaMediaMensal || 0))}
        ${kpi("Despesa média/mês", fmtBRL(snapshot.despesaMediaMensal || 0))}
        ${kpi("Capacidade de poupança", fmtBRL(snapshot.capacidadePoupanca || 0))}
      </tr>
    </table>`;

  if (!c.ok) return `<div>${kpis}</div>`;

  const cenarioCol = (cor: string, titulo: string, linhas: [string, string][]) =>
    `<td style="vertical-align:top;padding:10px 12px;border-left:4px solid ${cor};border:1px solid #e3e8e5;border-radius:8px;">
       <div style="font-size:12px;font-weight:700;color:${cor};margin-bottom:6px;">${titulo}</div>
       ${linhas
         .map(
           ([k, v]) =>
             `<div style="font-size:10px;color:#6b7d74;">${k}</div><div style="font-size:12px;font-weight:700;color:#14201a;margin-bottom:4px;">${v}</div>`
         )
         .join("")}
     </td>`;

  const cenarios = `
    <h2 style="font-size:15px;color:#14633e;margin:6px 0;">Cenários de Aposentadoria</h2>
    <table style="width:100%;border-collapse:separate;border-spacing:6px;margin-bottom:8px;">
      <tr>
        ${cenarioCol("#b8860b", "Realidade", [
          ["Poupança mensal", fmtBRL(snapshot.poupancaMensal || 0)],
          ["Na aposentadoria", fmtBRL(c.patAposentadoria)],
          [`Aos ${snapshot.expectativaVida}`, fmtBRL(c.patFinalRealidade)],
        ])}
        ${cenarioCol("#b23b32", "Consumo", [
          ["Poupança necessária", fmtBRL(c.poupancaConsumo) + "/mês"],
          ["Montante", fmtBRL(c.montanteConsumo)],
          [`Aos ${snapshot.expectativaVida}`, fmtBRL(c.patFinalConsumo)],
        ])}
        ${cenarioCol("#1c7a4d", "Viver de Renda", [
          ["Poupança necessária", fmtBRL(c.poupancaViver) + "/mês"],
          ["Montante", fmtBRL(c.montanteViver)],
          [`Aos ${snapshot.expectativaVida}`, fmtBRL(c.patFinalViver)],
        ])}
      </tr>
    </table>`;

  return `<div>${kpis}${cenarios}</div>`;
}

/** Bloco visual dos eventos da projeção (para o PDF projetado). */
export function buildProjectionHtml(projecao: {
  patrimonioFinalSemEventos: number;
  patrimonioFinalComEventos: number;
  eventos: { name: string; ano: number; impactoValor: number; impactoMensal: number; duracaoMeses: number }[];
} | null): string {
  if (!projecao) return "";
  const dif = (projecao.patrimonioFinalComEventos || 0) - (projecao.patrimonioFinalSemEventos || 0);
  const cor = dif < 0 ? "#b23b32" : "#1c7a4d";
  const linhas = (projecao.eventos || [])
    .map(
      (e) =>
        `<tr>
           <td style="padding:5px 8px;border-bottom:1px solid #eef1ef;font-size:11px;">${e.ano}</td>
           <td style="padding:5px 8px;border-bottom:1px solid #eef1ef;font-size:11px;">${e.name}</td>
           <td style="padding:5px 8px;border-bottom:1px solid #eef1ef;font-size:11px;text-align:right;">${e.impactoValor ? fmtBRL(e.impactoValor) : "—"}</td>
           <td style="padding:5px 8px;border-bottom:1px solid #eef1ef;font-size:11px;text-align:right;">${e.impactoMensal ? fmtBRL(e.impactoMensal) + "/mês" : "—"}</td>
         </tr>`
    )
    .join("");
  return `
    <h2 style="font-size:15px;color:#14633e;margin:10px 0 6px;">Projeção de Vida — Simulação</h2>
    <p style="font-size:11px;color:#6b7d74;margin:0 0 6px;">
      Patrimônio final sem eventos: <strong>${fmtBRL(projecao.patrimonioFinalSemEventos)}</strong> ·
      com eventos: <strong>${fmtBRL(projecao.patrimonioFinalComEventos)}</strong> ·
      impacto: <strong style="color:${cor};">${dif > 0 ? "+" : ""}${fmtBRL(dif)}</strong>
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr style="background:#f3f6f4;">
        <td style="padding:5px 8px;font-size:10px;color:#6b7d74;">Ano</td>
        <td style="padding:5px 8px;font-size:10px;color:#6b7d74;">Evento</td>
        <td style="padding:5px 8px;font-size:10px;color:#6b7d74;text-align:right;">Valor</td>
        <td style="padding:5px 8px;font-size:10px;color:#6b7d74;text-align:right;">Mensal</td>
      </tr>
      ${linhas}
    </table>`;
}

export const fmtBRL = (n: number) =>
  "R$ " + Math.round(n || 0).toLocaleString("pt-BR");
export const fmtBRLshort = (n: number) => {
  const v = Math.abs(n);
  if (v >= 1_000_000) return "R$ " + (n / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return "R$ " + (n / 1_000).toFixed(0) + "k";
  return "R$ " + Math.round(n);
};
