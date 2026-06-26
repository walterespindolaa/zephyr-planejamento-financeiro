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
  `<div class="pdf-card" style="border:1px solid #e3e8e5;border-radius:14px;padding:16px 18px;margin:10px 0 18px;background:#fafbfa;">${inner}</div>`;

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

// ── Bloco de comparação (revisão / acompanhamento) ──────────────────────────
function buildComparacao(comp: any): string {
  if (!comp) return "";
  const linha = (label: string, item: any) => {
    const delta = Number(item?.delta) || 0;
    const cor = delta < 0 ? "#b23b32" : "#1c7a4d";
    return `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #eef1ef;font-size:11px;">${label}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eef1ef;font-size:11px;text-align:right;color:#6b7d74;">${fmtBRL(item?.antes || 0)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eef1ef;font-size:11px;text-align:right;">${fmtBRL(item?.agora || 0)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eef1ef;font-size:11px;text-align:right;font-weight:700;color:${cor};">${delta > 0 ? "+" : ""}${fmtBRL(delta)}</td>
    </tr>`;
  };
  const objLinhas = (comp.objetivos || [])
    .map((o: any) => linha(`Objetivo: ${o.nome}`, { antes: o.acumuladoAntes, agora: o.acumuladoAgora, delta: o.poupadoNoPeriodo }))
    .join("");
  const de = comp.periodo?.de ? new Date(comp.periodo.de + "T12:00:00").toLocaleDateString("pt-BR") : "—";
  return card(
    `<div style="font-size:12px;font-weight:700;color:#14633e;margin-bottom:4px;">Acompanhamento — Evolução no período</div>
     <div style="font-size:10px;color:#6b7d74;margin-bottom:8px;">Comparado ao marco zero de ${de}.</div>
     <table style="width:100%;border-collapse:collapse;">
       <tr style="background:#f3f6f4;">
         <td style="padding:5px 8px;font-size:10px;color:#6b7d74;">Indicador</td>
         <td style="padding:5px 8px;font-size:10px;color:#6b7d74;text-align:right;">Antes</td>
         <td style="padding:5px 8px;font-size:10px;color:#6b7d74;text-align:right;">Agora</td>
         <td style="padding:5px 8px;font-size:10px;color:#6b7d74;text-align:right;">Evolução</td>
       </tr>
       ${linha("Patrimônio financeiro", comp.patrimonioFinanceiro)}
       ${linha("Patrimônio em bens", comp.patrimonioBens)}
       ${linha("Reserva de emergência", comp.reservaEmergencia)}
       ${linha("Capacidade de poupança/mês", comp.capacidadePoupanca)}
       ${objLinhas}
     </table>`
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
  const investTotal = nacional + exterior;
  const cats: [string, number][] = [
    ["Investimentos", investTotal],
    ["Imóveis", imoveis],
    ["Veículos", veiculos],
    ["Empresa/Participações", empresa],
    ["Outros bens", outros],
  ].filter(([, v]) => v > 0) as [string, number][];
  const totalPat = cats.reduce((t, [, v]) => t + v, 0) || 1;

  const bar = (label: string, value: number, total: number) => {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return `<div style="margin:7px 0;">
      <div style="display:flex;justify-content:space-between;font-size:11px;"><span>${label}</span><span style="color:#6b7d74;">${fmtBRL(value)} · ${pct.toFixed(1)}%</span></div>
      <div style="height:7px;background:#eef1ef;border-radius:99px;margin-top:3px;"><div style="height:7px;width:${pct.toFixed(1)}%;background:#16a34a;border-radius:99px;"></div></div>
    </div>`;
  };

  // por classe (investimentos)
  const classeLabels: Record<string, string> = {
    renda_fixa: "Renda Fixa", renda_variavel: "Renda Variável", fii: "Fundos Imobiliários",
    exterior: "Exterior", cripto: "Cripto", outro: "Outros",
  };
  const porClasse: Record<string, number> = {};
  invs.forEach((i) => {
    const k = i.classe || "outro";
    porClasse[k] = (porClasse[k] || 0) + Number(i.valor || 0);
  });
  const classeBars = Object.entries(porClasse)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => bar(classeLabels[k] || k, v, investTotal))
    .join("");

  const patrimonio =
    secTitle("Patrimônio") +
    card(
      `<div style="font-size:20px;font-weight:800;color:#14201a;">${fmtBRL(totalPat)} <span style="font-size:11px;color:#6b7d74;font-weight:400;">patrimônio total</span></div>
       <div style="font-size:10px;color:#6b7d74;text-transform:uppercase;margin:12px 0 4px;">Por categoria</div>
       ${cats.map(([n, v]) => bar(n, v, totalPat)).join("")}
       ${investTotal > 0 ? `<div style="font-size:10px;color:#6b7d74;text-transform:uppercase;margin:14px 0 4px;">Investimentos por classe</div>${classeBars}` : ""}`
    );

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

// ── Apresentação "pocket" (versão enxuta e visual para o cliente) ───────────
export interface PocketOpts {
  indicadores: boolean;
  saude: boolean;
  cenarios: boolean;
  evolucao: boolean;
  proximos: boolean;
  protecao: boolean;
}

export function buildPocketHtml(s: Record<string, any> | null, opts: PocketOpts, nome: string): string {
  if (!s) return "<p>Gere o relatório primeiro para criar a apresentação.</p>";
  const primeiro = (nome || "Cliente").split(" ")[0];
  const fin = Number(s.patrimonioFinanceiro) || 0;
  const bens = Number(s.patrimonioBens) || 0;
  const total = fin + bens;
  const cap = Number(s.capacidadePoupanca) || 0;
  const reserva = Number(s.reservaEmergencia) || 0;
  const despMes = Number(s.despesaMediaMensal) || 0;

  const hero = `
    <div style="background:#14201a;border-radius:16px;padding:22px 24px;color:#fff;margin-bottom:14px;">
      <div style="font-size:11px;color:#9fb3a6;text-transform:uppercase;letter-spacing:.08em;">Apresentação do Planejamento</div>
      <div style="font-size:22px;font-weight:800;margin:4px 0;">${primeiro}</div>
      <div style="font-size:13px;color:#cfe0d6;">Patrimônio total <strong style="color:#7fe0a3;">${fmtBRL(total)}</strong> · capacidade de poupança <strong style="color:#7fe0a3;">${fmtBRL(cap)}/mês</strong></div>
    </div>`;

  const kpi = (label: string, val: string) =>
    `<td style="padding:12px 14px;border:1px solid #e3e8e5;border-radius:12px;vertical-align:top;">
       <div style="font-size:10px;color:#6b7d74;text-transform:uppercase;">${label}</div>
       <div style="font-size:17px;font-weight:800;color:#14201a;">${val}</div>
     </td>`;
  const indicadores = !opts.indicadores ? "" :
    `<table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:14px;"><tr>
       ${kpi("Patrimônio total", fmtBRL(total))}
       ${kpi("Financeiro", fmtBRL(fin))}
       ${kpi("Reserva", fmtBRL(reserva))}
       ${kpi("Capacidade/mês", fmtBRL(cap))}
     </tr></table>`;

  const dot = (cor: string) => `<span style="display:inline-block;width:9px;height:9px;border-radius:99px;background:${cor};margin-right:6px;"></span>`;
  const GREEN = "#16a34a", AMBER = "#d99a00", RED = "#b23b32";
  const linhaSaude = (label: string, status: string, cor: string) =>
    `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eef1ef;font-size:12px;">
       <span>${label}</span><span style="font-weight:600;">${dot(cor)}${status}</span></div>`;
  const reservaOk = despMes > 0 ? reserva >= 6 * despMes : reserva > 0;
  const saude = !opts.saude ? "" : card(
    `<div style="font-size:11px;color:#6b7d74;text-transform:uppercase;margin-bottom:6px;">Painel de Saúde do Planejamento</div>
     ${linhaSaude("Capacidade de aporte", cap > 0 ? "Dentro da meta" : "Atenção", cap > 0 ? GREEN : AMBER)}
     ${linhaSaude("Reserva de emergência", reservaOk ? "Adequada" : "Abaixo do ideal", reservaOk ? GREEN : AMBER)}
     ${linhaSaude("Evolução patrimonial", s.comparacao ? (Number(s.comparacao.patrimonioFinanceiro?.delta) >= 0 ? "Acima da projeção" : "Abaixo") : "Marco inicial", s.comparacao ? (Number(s.comparacao.patrimonioFinanceiro?.delta) >= 0 ? GREEN : RED) : AMBER)}
     ${linhaSaude("Proteção patrimonial", s.protecao ? "Configurada" : "A revisar", s.protecao ? GREEN : AMBER)}
     ${linhaSaude("Aposentadoria", "Em acompanhamento", GREEN)}`
  );

  const cenarios = !opts.cenarios ? "" : cenariosCard(s);
  const evolucao = opts.evolucao && s.comparacao ? buildComparacao(s.comparacao) : "";
  const protecao = opts.protecao ? buildProtecao(s) : "";

  const passos = (s.proximosPassos || []) as any[];
  const proximos = !opts.proximos || !passos.length ? "" : card(
    `<div style="font-size:11px;color:#6b7d74;text-transform:uppercase;margin-bottom:6px;">Próximos Passos</div>
     ${passos.map((p) => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #eef1ef;">→ <strong>${p.titulo || p.tipo}</strong>${p.valor ? ` · ${fmtBRL(p.valor)}` : ""}</div>`).join("")}`
  );

  return hero + indicadores + saude + cenarios + evolucao + protecao + proximos;
}

export function buildProtecao(s: Record<string, any> | null): string {
  const p = s?.protecao;
  if (!p) return "";
  const linha = (nome: string, pct: number, valor: number, bold = false) =>
    `<tr style="${bold ? "font-weight:700;" : ""}">
       <td style="padding:6px 10px;border:1px solid #d8ddd8;font-size:11px;">${nome}</td>
       <td style="padding:6px 10px;border:1px solid #d8ddd8;font-size:11px;text-align:center;">${pct.toFixed(2)}%</td>
       <td style="padding:6px 10px;border:1px solid #d8ddd8;font-size:11px;text-align:right;">${fmtBRL(valor)}</td>
     </tr>`;
  return (
    secTitle("Proteção Patrimonial") +
    `<p style="font-size:12px;line-height:1.6;margin:6px 0;">Em caso de falecimento inesperado, os herdeiros podem enfrentar custos de sucessão e inventário. Uma estratégia de proteção patrimonial com seguro de vida pode evitar essa pressão e preservar o legado familiar. Considerando um patrimônio estimado em <strong>${fmtBRL(p.imobilizado)}</strong> (imobilizado) + <strong>${fmtBRL(p.financeiro)}</strong> (ativo financeiro), estimamos os custos abaixo para a sucessão:</p>` +
    `<table style="width:100%;border-collapse:collapse;margin:10px 0;">
       <tr style="background:#f3f6f4;font-weight:700;">
         <td style="padding:6px 10px;border:1px solid #d8ddd8;font-size:11px;">Despesa</td>
         <td style="padding:6px 10px;border:1px solid #d8ddd8;font-size:11px;text-align:center;">Custo (%)</td>
         <td style="padding:6px 10px;border:1px solid #d8ddd8;font-size:11px;text-align:right;">Custo (R$)</td>
       </tr>
       ${linha("ITCMD", p.itcmd.pct, p.itcmd.valor)}
       ${linha("Advocatícias", p.advocaticias.pct, p.advocaticias.valor)}
       ${linha("Cartorárias", p.cartorarias.pct, p.cartorarias.valor)}
       ${linha("Total", p.custoTotalPct, p.custoTotal, true)}
     </table>` +
    `<p style="font-size:12px;margin:8px 0;"><strong>Capital sugerido em ferramenta sucessória: ${fmtBRL(p.capitalSucessorio)}</strong></p>` +
    (p.prevObservacao ? `<p style="font-size:12px;margin:4px 0;">${p.prevObservacao}</p>` : "") +
    `<p style="font-size:10px;color:#6b7d74;margin-top:8px;">Estimativas simplificadas para fins de planejamento. As aliquotas de ITCMD variam por estado e a estrutura sucessoria deve ser validada com assessoria juridica especializada.</p>`
  );
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
    <div style="margin-top:24px;border:1px solid #e3e8e5;border-radius:14px;padding:20px;background:#f3f6f4;text-align:center;">
      <div style="font-size:14px;font-style:italic;color:#14201a;">"O sucesso financeiro não é sobre quanto você ganha, mas sobre o que você faz crescer com constância."</div>
      <div style="font-size:11px;color:#14633e;font-weight:700;margin-top:8px;">— Zephyr · Planejamento Financeiro</div>
    </div>
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
    <div style="text-align:center;padding:14px 18px;margin-bottom:14px;">
      <div style="font-size:19px;font-weight:800;color:#14201a;">${titulo}</div>
      <div style="font-size:13px;color:#6b7d74;margin-top:4px;">${hoje}</div>
    </div>`;

  const primeiroNome = (nome || "o cliente").split(" ")[0];
  const sintese = card(
    `<div style="font-size:12px;font-weight:700;color:#14633e;margin-bottom:4px;">✦ Síntese Executiva</div>
     <div style="font-size:11px;color:#4a5650;line-height:1.6;">Avaliação da viabilidade do plano de vida de ${primeiroNome}: capacidade de poupança, objetivos, aposentadoria e renda ideal. Este relatório identifica os gaps entre o que ${primeiroNome} deseja e o que é possível hoje, e aponta os ajustes para viabilizar o planejamento.</div>`
  );

  const comparacaoBloco = snapshot?.comparacao ? buildComparacao(snapshot.comparacao) : "";

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

  return header + sintese + comparacaoBloco + body + buildInstitutionalSections(snapshot) + buildProtecao(snapshot) + buildDisclaimerPage();
}
