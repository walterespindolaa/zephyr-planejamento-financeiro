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
    const modo = body.modo === "projecao" ? "projecao" : "principal";
    const projecao = body.projecao || null;
    if (!clientId) return json({ error: "clientId obrigatório" }, 400);

    const { data: cliente } = await sb.from("clients").select("*").eq("id", clientId).maybeSingle();
    if (!cliente) return json({ error: "Sem acesso a este cliente." }, 403);

    const [recRes, despRes, objRes, invRes, bensRes, apoRes, depRes, cfgRes, notesRes] = await Promise.all([
      sb.from("client_receitas").select("*").eq("client_id", clientId),
      sb.from("client_despesas").select("*").eq("client_id", clientId),
      sb.from("client_objetivos").select("*").eq("client_id", clientId),
      sb.from("client_investimentos").select("*").eq("client_id", clientId),
      sb.from("client_bens").select("*").eq("client_id", clientId),
      sb.from("client_aposentadoria").select("*").eq("client_id", clientId).maybeSingle(),
      sb.from("client_dependentes").select("*").eq("client_id", clientId),
      sb.from("firm_settings").select("ai_model").eq("id", 1).maybeSingle(),
      sb.from("client_notes").select("content, pinned").eq("client_id", clientId).order("pinned", { ascending: false }).limit(20),
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
        nome: o.nome, valor: o.valor_objetivo, acumulado: o.valor_acumulado,
        prazo: o.data_objetivo, aporteMensal: o.aporte_mensal,
      })),
      dependentes: dependentes.map((d) => ({ nome: d.nome, parentesco: d.parentesco, nascimento: d.data_nascimento })),
    };
    if (anotacoes) contextData.anotacoesPlanejadora = anotacoes;
    if (modo === "projecao" && projecao) contextData.projecao = projecao;

    let systemPrompt = `Voce e o planejador financeiro senior da Zephyr Investimentos (padrao CFP), escrevendo a analise "Estrategia de Subida" que sera ENTREGUE AO CLIENTE ${cliente.nome}. E um documento de consultoria premium, nao um relatorio automatico.

OBJETIVO: avaliar a viabilidade do plano de vida do cliente — objetivos, aposentadoria, renda ideal, capacidade de poupanca e gaps — e mostrar o caminho de subida ate la.

VOZ E ESTILO (o mais importante):
- Escreva como um consultor humano conversando com o cliente: caloroso, confiante, consultivo. Use "voce".
- TEXTO CORRIDO e fluido. Cada bloco tem 1 a 3 paragrafos que se conectam numa narrativa — NAO despeje listas de numeros nem encha de bullets. Use <ul> no maximo 1 vez no documento inteiro.
- VARIE a estrutura das frases. Interprete cada numero (o que revela, o que permite, o que muda se agir) em vez de repeti-lo.
- Use a metafora da MONTANHA/SUBIDA com leveza (base, trilha, topo, ritmo de subida).
- Use o nome do cliente e dos dependentes naturalmente. Portugues brasileiro. Valores em R$.
- Principios aplicados sem citar autores: juros compostos, tempo no mercado, margem de seguranca, frugalidade inteligente, vieses comportamentais.

FORMATO DE SAIDA: HTML limpo, APENAS com <h2>, <h3>, <p>, <strong> (no maximo um <ul><li>). Sem markdown, sem <html>/<body>, sem estilos inline. Os KPIs e o grafico ja aparecem fora do texto — NAO recrie tabelas de numeros; INTERPRETE.

ESTRUTURA (cada secao um <h2>, fluindo como um documento unico):
Abertura — paragrafo curto e pessoal, dando boas-vindas a ${cliente.nome}.
1. Panorama — estagio de vida, familia, contexto.
2. Capacidade de Poupanca — o motor da subida (receita ~${brl(receitaMensal)}/mes, despesa ~${brl(despesaMensal)}/mes, sobra ~${brl(capacidadePoupanca)}/mes).
3. Objetivos de Vida — cada objetivo como marco da trilha. Aportes hoje: ${brl(totalObjMensal)}/mes.
4. Colchao de Seguranca — reserva ideal (6-12 meses) vs. ${brl(reservaEmergencia)} atuais.
5. Aposentadoria — o topo. Compare os 3 cenarios (Realidade, Consumo, Viver de Renda) de forma narrativa.
6. Renda Ideal e Gap — custo de vida + colchao + objetivos + aposentadoria vs. renda atual.
7. Reflexao e Viabilidade — fechamento honesto e encorajador; proximo movimento concreto.`;

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
