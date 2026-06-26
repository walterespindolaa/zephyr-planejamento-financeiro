// Edge Function: relatorio-estrategia
// Gera o relatório "Estratégia de Subida" (metodologia Atlas) via Claude.
// modo 'principal' = relatório oficial (salvável).
// modo 'projecao' = SIMULAÇÃO que incorpora eventos de vida + anotações da
//   planejadora; não substitui o principal (o front trata como efêmero).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const brl = (n: number) =>
  "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada no Supabase." }, 500);

    const sb = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => ({}));
    const clientId = body.clientId;
    const modo = ["projecao", "revisao"].includes(body.modo) ? body.modo : "principal";
    const projecao = body.projecao || null;
    const baseline = body.baseline || null; // { snapshot, data } — marco zero p/ revisão
    if (!clientId) return json({ error: "clientId obrigatório" }, 400);

    const { data: cliente } = await sb.from("clients").select("*").eq("id", clientId).maybeSingle();
    if (!cliente) return json({ error: "Sem acesso a este cliente." }, 403);

    const [recRes, despRes, objRes, invRes, bensRes, apoRes, depRes, cfgRes, notesRes, opsRes, inclRes] = await Promise.all([
      sb.from("client_receitas").select("*").eq("client_id", clientId),
      sb.from("client_despesas").select("*").eq("client_id", clientId),
      sb.from("client_objetivos").select("*").eq("client_id", clientId),
      sb.from("client_investimentos").select("*").eq("client_id", clientId),
      sb.from("client_bens").select("*").eq("client_id", clientId),
      sb.from("client_aposentadoria").select("*").eq("client_id", clientId).maybeSingle(),
      sb.from("client_dependentes").select("*").eq("client_id", clientId),
      sb.from("firm_settings").select("ai_model").eq("id", 1).maybeSingle(),
      sb.from("client_notes").select("content, pinned").eq("client_id", clientId).order("pinned", { ascending: false }).limit(20),
      sb.from("client_acompanhamentos").select("tipo, titulo, status, data_evento, valor").eq("client_id", clientId).eq("incluir_relatorio", true),
      sb.from("client_report_inclusoes").select("*").eq("client_id", clientId).maybeSingle(),
    ]);

    const receitas = recRes.data || [];
    const despesas = despRes.data || [];
    const objetivos = objRes.data || [];
    const investimentos = invRes.data || [];
    const bens = bensRes.data || [];
    const apo: any = apoRes.data || {};
    const dependentes = depRes.data || [];
    const aiModel = cfgRes.data?.ai_model || "claude-sonnet-4-6";
    const notes = notesRes.data || [];
    const proximosPassos = (opsRes.data || []).map((o: any) => ({
      tipo: o.tipo, titulo: o.titulo, status: o.status, data: o.data_evento, valor: o.valor,
    }));

    const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + (f(x) || 0), 0);
    const mensal = (arr: any[], val: (x: any) => number) =>
      sum(arr.filter((x) => x.recorrente), val) + sum(arr.filter((x) => !x.recorrente), val) / 12;

    const receitaMensal = Math.round(mensal(receitas, (r) => Number(r.valor)));
    const despesaMensal = Math.round(mensal(despesas, (d) => Number(d.valor)));
    const capacidadePoupanca = receitaMensal - despesaMensal;
    const patrimonioFinanceiro = sum(investimentos, (i) => Number(i.valor_atual));
    const reservaEmergencia = sum(investimentos.filter((i) => i.is_reserva_emergencia), (i) => Number(i.valor_atual));
    const patrimonioBens = sum(bens, (b) => Number(b.valor) - Number(b.divida_vinculada || 0));
    const rendaPassivaBens = sum(bens.filter((b) => b.gera_renda), (b) => Number(b.valor_renda || 0));
    const totalObjMensal = sum(objetivos, (o) => Number(o.aporte_mensal));

    // Anotações da planejadora (campo info + notas fixadas do CRM)
    const anotacoes = [
      cliente.info?.trim(),
      ...notes.filter((n: any) => n.pinned).map((n: any) => n.content),
    ].filter(Boolean).join("\n• ");

    const contextData: Record<string, any> = {
      nome: cliente.nome,
      idade: apo.idade_atual ?? null,
      idadeAposentadoria: apo.idade_aposentadoria ?? 60,
      expectativaVida: apo.expectativa_vida ?? 90,
      rendaDesejada: apo.renda_desejada ?? 0,
      poupancaMensal: apo.poupanca_mensal ?? 0,
      rendaPassivaAtual: apo.renda_passiva_atual ?? 0,
      taxaNominal: Number(apo.taxa_retorno_anual ?? 0.1) * 100,
      inflacao: Number(apo.inflacao_anual ?? 0.04) * 100,
      patrimonioFinanceiro,
      patrimonioBens,
      rendaPassivaBens,
      reservaEmergencia,
      receitaMediaMensal: receitaMensal,
      despesaMediaMensal: despesaMensal,
      capacidadePoupanca,
      totalAporteMensalObjetivos: totalObjMensal,
      objetivos: objetivos.map((o) => ({
        nome: o.nome, tipo: o.tipo, valor: o.valor_objetivo, acumulado: o.valor_acumulado,
        prazo: o.data_objetivo, aporteMensal: o.aporte_mensal, frequencia: o.frequencia,
      })),
      investimentos: investimentos.map((i) => ({ nome: i.nome, classe: i.classe, tipo: i.tipo, valor: i.valor_atual, reserva: i.is_reserva_emergencia })),
      receitas: receitas.map((r) => ({ categoria: r.categoria, descricao: r.descricao, valor: r.valor, mensal: r.recorrente })),
      despesas: despesas.map((d) => ({ categoria: d.categoria, descricao: d.descricao, valor: d.valor, tipo: d.tipo, mensal: d.recorrente })),
      bens: bens.map((b) => ({
        nome: b.nome, tipo: b.tipo, valor: b.valor, divida: b.divida_vinculada,
        liquido: Number(b.valor) - Number(b.divida_vinculada || 0), geraRenda: b.gera_renda, renda: b.valor_renda,
      })),
      dependentes: dependentes.map((d) => ({ nome: d.nome, parentesco: d.parentesco, nascimento: d.data_nascimento })),
    };
    const incl: any = inclRes.data || {};
    if (anotacoes) contextData.anotacoesPlanejadora = anotacoes;
    if (proximosPassos.length && incl.incluir_proximos_passos !== false) contextData.proximosPassos = proximosPassos;

    // Proteção Patrimonial (sucessão) — bloco deterministico no relatorio
    if (incl.incluir_protecao) {
      const imob = Number(incl.patrimonio_imobilizado ?? patrimonioBens) || 0;
      const fin = Number(incl.patrimonio_financeiro ?? patrimonioFinanceiro) || 0;
      const tot = imob + fin;
      const p = (x: number) => (Number(x) || 0) / 100;
      const itcmd = tot * p(incl.itcmd_pct ?? 8);
      const advoc = tot * p(incl.advocaticias_pct ?? 5);
      const cart = tot * p(incl.cartorarias_pct ?? 2);
      const custoTotal = itcmd + advoc + cart;
      contextData.protecao = {
        imobilizado: imob,
        financeiro: fin,
        total: tot,
        itcmd: { pct: Number(incl.itcmd_pct ?? 8), valor: Math.round(itcmd) },
        advocaticias: { pct: Number(incl.advocaticias_pct ?? 5), valor: Math.round(advoc) },
        cartorarias: { pct: Number(incl.cartorarias_pct ?? 2), valor: Math.round(cart) },
        custoTotalPct: Number(incl.itcmd_pct ?? 8) + Number(incl.advocaticias_pct ?? 5) + Number(incl.cartorarias_pct ?? 2),
        custoTotal: Math.round(custoTotal),
        capitalSucessorio: Number(incl.capital_sucessorio) || Math.round(custoTotal),
        prevObservacao: incl.prev_observacao || null,
      };
    }
    if (modo === "projecao" && projecao) contextData.projecao = projecao;

    if (modo === "revisao" && baseline?.snapshot) {
      const b = baseline.snapshot;
      const delta = (a: number, c: number) => Math.round((a || 0) - (c || 0));
      contextData.comparacao = {
        periodo: { de: baseline.data || null, ate: new Date().toISOString().slice(0, 10) },
        patrimonioFinanceiro: { antes: b.patrimonioFinanceiro || 0, agora: patrimonioFinanceiro, delta: delta(patrimonioFinanceiro, b.patrimonioFinanceiro) },
        patrimonioBens: { antes: b.patrimonioBens || 0, agora: patrimonioBens, delta: delta(patrimonioBens, b.patrimonioBens) },
        reservaEmergencia: { antes: b.reservaEmergencia || 0, agora: reservaEmergencia, delta: delta(reservaEmergencia, b.reservaEmergencia) },
        capacidadePoupanca: { antes: b.capacidadePoupanca || 0, agora: capacidadePoupanca, delta: delta(capacidadePoupanca, b.capacidadePoupanca) },
        receitaMediaMensal: { antes: b.receitaMediaMensal || 0, agora: receitaMensal, delta: delta(receitaMensal, b.receitaMediaMensal) },
        despesaMediaMensal: { antes: b.despesaMediaMensal || 0, agora: despesaMensal, delta: delta(despesaMensal, b.despesaMediaMensal) },
        objetivos: objetivos.map((o) => {
          const ob = (b.objetivos || []).find((x: any) => x.nome === o.nome);
          return {
            nome: o.nome,
            acumuladoAntes: ob?.acumulado || 0,
            acumuladoAgora: o.valor_acumulado || 0,
            poupadoNoPeriodo: Math.round((o.valor_acumulado || 0) - (ob?.acumulado || 0)),
          };
        }),
      };
    }

    let systemPrompt = `Voce e o planejador financeiro senior da Zephyr (padrao CFP), redigindo o relatorio de PLANEJAMENTO FINANCEIRO que sera ENTREGUE AO CLIENTE ${cliente.nome}. E um documento de consultoria patrimonial profissional e institucional, no padrao de wealth management / private banking.

OBJETIVO: avaliar a viabilidade do planejamento financeiro do cliente — organizacao, objetivos, aposentadoria, renda ideal, protecao e sucessao patrimonial.

VOZ E ESTILO (o mais importante):
- Tom INSTITUCIONAL, profissional, sobrio e consultivo. Trate o cliente na 2a pessoa ("voce"), com clareza e objetividade.
- NAO use analogias, metaforas nem linguagem figurada. PROIBIDO usar termos como "montanha", "subida", "trilha", "topo", "degrau", "motor", "jornada", "caminho ate la", "estrategia de subida". Linguagem direta, tecnica porem acessivel.
- NAO escreva saudacoes do tipo "Bem-vindo a sua...". A abertura deve ser uma apresentacao profissional e neutra do documento.
- TEXTO CORRIDO, porem ENXUTO. Cada secao com 1 a 2 paragrafos CURTOS (3 a 5 frases cada). Seja direto e objetivo — NAO encha linguica, evite redundancia e frases de efeito desnecessarias. Sem listas longas (no maximo um <ul> no documento).
- Interprete cada numero (o que revela, o que permite, o que ajustar) de forma concisa. Use o nome do cliente e dos dependentes com naturalidade. Portugues brasileiro, valores em R$.
- Principios aplicados sem citar autores: juros compostos, diversificacao, margem de seguranca, eficiencia tributaria, protecao e sucessao patrimonial.

FORMATO DE SAIDA: HTML limpo, APENAS com <h2>, <h3>, <p>, <strong> (no maximo um <ul><li>). Sem markdown, sem <html>/<body>, sem estilos inline. Os KPIs, graficos e tabelas ja aparecem fora do texto — NAO recrie tabelas de numeros; INTERPRETE.

ESTRUTURA (cada secao um <h2>):
Apresentacao — paragrafo profissional e neutro sobre o proposito do documento e o contexto patrimonial do cliente.
1. Panorama Patrimonial — estagio de vida, familia, contexto e situacao atual.
2. Capacidade de Poupanca — receita ~${brl(receitaMensal)}/mes, despesa ~${brl(despesaMensal)}/mes, sobra ~${brl(capacidadePoupanca)}/mes; interprete a folga e o que ela viabiliza.
3. Objetivos de Vida — analise CADA objetivo pelo NOME, citando valor, prazo e o aporte mensal (campo aporteMensal). Aportes hoje: ${brl(totalObjMensal)}/mes.
4. Reserva de Emergencia — reserva ideal (6-12 meses) vs. ${brl(reservaEmergencia)} atuais.

USE OS DADOS ESPECIFICOS: cite as principais receitas pela descricao (campo receitas), os bens relevantes pelo nome (campo bens, com valor/divida/liquido e renda) e cada objetivo pelo nome com seu aporte. NAO generalize quando ha dado concreto.
5. Aposentadoria e Longo Prazo — compare os 3 cenarios (Realidade, Consumo do Patrimonio, Preservacao/Viver de Renda) de forma analitica.
6. Renda Ideal e Gap Financeiro — custo de vida + reserva + objetivos + aposentadoria vs. renda atual.
7. Conclusao e Proximos Passos — fechamento profissional, parecer de viabilidade e recomendacoes concretas.${
      proximosPassos.length
        ? ` Inclua aqui, de forma consultiva, as oportunidades mapeadas pela planejadora (campo proximosPassos: consorcio, seguro, carta de credito, off-shore, previdencia…), explicando o porque de cada uma.`
        : ""
    }`;

    if (modo === "revisao" && contextData.comparacao) {
      systemPrompt += `

ESTE E UM RELATORIO DE ACOMPANHAMENTO (REVISAO PERIODICA), nao um planejamento inicial. Use o campo "comparacao" para confrontar o planejamento anterior (marco zero, periodo ${contextData.comparacao.periodo.de}) com a situacao ATUAL. Logo apos a Apresentacao, adicione uma secao <h2>Acompanhamento — Evolucao no Periodo</h2> destacando, de forma analitica e institucional: (1) a EVOLUCAO PATRIMONIAL (patrimonio antes -> agora, com a variacao em R$ e o significado), (2) quanto foi EFETIVAMENTE POUPADO/ACUMULADO no periodo vs o planejado, (3) o PROGRESSO de cada objetivo (acumulado antes -> agora, citando pelo nome), (4) os GAPS que surgiram ou foram fechados, e (5) um PLANO DE ACAO concreto para o proximo periodo. O restante do documento segue a estrutura normal, ja considerando os dados atualizados.`;
    }

    if (anotacoes) {
      systemPrompt += `

ANOTACOES DA PLANEJADORA sobre a vida do cliente — incorpore esse contexto humano NATURALMENTE ao longo do texto (ele tem peso real e foi observado pela planejadora):
"${anotacoes}"`;
    }

    if (modo === "projecao" && projecao) {
      systemPrompt += `

ESTA E UMA VERSAO COM PROJECAO DE VIDA (simulacao). Alem da estrutura acima, REESCREVA o documento considerando os eventos de vida projetados e adicione, ANTES da Reflexao (bloco 7), uma secao <h2>Impacto da Projecao de Vida</h2> que:
- Apresente cada evento projetado e seu efeito no plano.
- Compare o patrimonio final SEM eventos (${brl(projecao.patrimonioFinalSemEventos)}) com o patrimonio final COM os eventos (${brl(projecao.patrimonioFinalComEventos)}), interpretando a diferenca de ${brl((projecao.patrimonioFinalComEventos || 0) - (projecao.patrimonioFinalSemEventos || 0))}.
- Deixe claro, com leveza, que e uma SIMULACAO para o cliente refletir sobre escolhas de vida — nao uma mudanca do plano oficial.
Eventos projetados: ${JSON.stringify(projecao.eventos || [])}.`;
    }

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 5000,
        system: systemPrompt,
        messages: [
          { role: "user", content: `Dados do planejamento do cliente:\n${JSON.stringify(contextData)}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `Erro da IA (${aiRes.status}): ${t.slice(0, 300)}` }, 502);
    }

    const aiJson = await aiRes.json();
    const html = aiJson?.content?.[0]?.text ?? "";
    return json({ ok: true, html, snapshot: contextData }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
