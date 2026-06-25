// Edge Function: relatorio-estrategia
// Reproduz a metodologia do relatório "Estratégia de Subida" (Atlas), agregando
// os dados do cliente e gerando o texto via Claude (Anthropic). Saída em HTML.
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

    // Cliente com o JWT do solicitante — o RLS garante o acesso ao cliente
    const sb = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { clientId } = await req.json().catch(() => ({}));
    if (!clientId) return json({ error: "clientId obrigatório" }, 400);

    // RLS: só retorna se o solicitante tem acesso
    const { data: cliente } = await sb.from("clients").select("*").eq("id", clientId).maybeSingle();
    if (!cliente) return json({ error: "Sem acesso a este cliente." }, 403);

    const [recRes, despRes, objRes, invRes, bensRes, apoRes, depRes, cfgRes] = await Promise.all([
      sb.from("client_receitas").select("*").eq("client_id", clientId),
      sb.from("client_despesas").select("*").eq("client_id", clientId),
      sb.from("client_objetivos").select("*").eq("client_id", clientId),
      sb.from("client_investimentos").select("*").eq("client_id", clientId),
      sb.from("client_bens").select("*").eq("client_id", clientId),
      sb.from("client_aposentadoria").select("*").eq("client_id", clientId).maybeSingle(),
      sb.from("client_dependentes").select("*").eq("client_id", clientId),
      sb.from("firm_settings").select("ai_model").eq("id", 1).maybeSingle(),
    ]);

    const receitas = recRes.data || [];
    const despesas = despRes.data || [];
    const objetivos = objRes.data || [];
    const investimentos = invRes.data || [];
    const bens = bensRes.data || [];
    const apo: any = apoRes.data || {};
    const dependentes = depRes.data || [];
    const aiModel = cfgRes.data?.ai_model || "claude-sonnet-4-6";

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

    const contextData = {
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

    const systemPrompt = `Voce e a inteligencia analitica da Zephyr Investimentos, gerando a analise "Estrategia de Subida" para ${cliente.nome}, no padrao de um planejador financeiro profissional (CFP).

FUNCAO EDITORIAL: avaliar a VIABILIDADE DO PLANO DE VIDA. Foco em objetivos, aposentadoria, renda ideal, capacidade de poupanca e gaps.

REGRAS:
- Use apenas os dados fornecidos. Nunca invente numeros.
- NUNCA repita numeros mecanicamente: sempre INTERPRETE (Observacao -> Interpretacao -> Consequencia -> Recomendacao).
- Use o nome do cliente e dos dependentes.
- Portugues brasileiro. Valores em R$.
- Tom claro, educativo, estrategico e respeitoso.

PRINCIPIOS (aplicar sem citar autores): juros compostos, tempo no mercado > timing, margem de seguranca, frugalidade inteligente, vieses comportamentais.

FORMATO DE SAIDA: HTML simples e limpo, usando APENAS estas tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>. NAO use markdown, NAO use <html>/<body>, NAO use estilos inline.

ESTRUTURA OBRIGATORIA (7 blocos, cada um um <h2>):
1. Panorama do Planejamento — estagio de vida e contexto familiar.
2. Capacidade de Poupanca — receita media (${brl(receitaMensal)}) - despesa media (${brl(despesaMensal)}) = capacidade (${brl(capacidadePoupanca)}).
3. Objetivos de Vida — analisar CADA objetivo (valor, prazo, aporte). Total mensal: ${brl(totalObjMensal)}.
4. Colchao de Seguranca — reserva ideal (6-12 meses) vs. ${brl(reservaEmergencia)} atual.
5. Aposentadoria e Longo Prazo — COMPARAR 3 cenarios: Realidade, Consumo e Viver de Renda.
6. Renda Ideal e Gap Financeiro — Custo de vida + Colchao + Objetivos + Aposentadoria = Renda Ideal vs. renda atual.
7. Reflexao e Viabilidade — o plano de vida e viavel?

Gere a analise completa. INTERPRETE, nao apenas liste.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 4000,
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
