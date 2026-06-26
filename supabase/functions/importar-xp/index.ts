// Edge Function: importar-xp
// Lê o PDF do relatório da XP (via Claude com suporte a PDF) e extrai as
// variáveis que o sistema usa, retornando um JSON estruturado para revisão.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!KEY) return json({ error: "ANTHROPIC_API_KEY não configurada." }, 500);

    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { clientId, pdfBase64 } = await req.json().catch(() => ({}));
    if (!clientId || !pdfBase64) return json({ error: "clientId e pdfBase64 obrigatórios" }, 400);

    const { data: cliente } = await sb.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!cliente) return json({ error: "Sem acesso a este cliente." }, 403);

    const prompt = `Voce recebe um relatorio de PLANEJAMENTO FINANCEIRO da XP (em PDF). Extraia as variaveis abaixo e retorne APENAS um JSON valido, sem texto antes ou depois, sem markdown.

Mapeie as classes de investimento assim: "Renda Fixa"->"renda_fixa", "Renda Variavel"->"renda_variavel", "FII"/"Fundos Imobiliarios"->"fii", "Internacional"/"Exterior"->"exterior", "Cripto"->"cripto", outros->"outro".
Mapeie tipos de bem: imovel/apartamento/casa->"imovel", carro/veiculo->"veiculo", empresa/participacao/sociedade->"empresa", outros->"outro".
Valores SEMPRE como numero (sem "R$", sem pontos de milhar, use ponto decimal). Use null quando nao encontrar.

Formato:
{
  "receitaMensal": number|null,
  "despesaMensal": number|null,
  "patrimonioFinanceiro": number|null,
  "reservaEmergencia": number|null,
  "idade": number|null,
  "idadeAposentadoria": number|null,
  "rendaDesejada": number|null,
  "investimentos": [{"nome": string, "classe": string, "valor": number}],
  "bens": [{"nome": string, "tipo": string, "valor": number, "divida": number}]
}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2500,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `Erro da IA (${aiRes.status}): ${t.slice(0, 300)}` }, 502);
    }
    const aiJson = await aiRes.json();
    let txt = aiJson?.content?.[0]?.text ?? "";
    txt = txt.replace(/```json|```/g, "").trim();
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    let extracted: any = {};
    try { extracted = JSON.parse(txt.slice(start, end + 1)); }
    catch { return json({ error: "Não consegui interpretar o relatório. Tente novamente." }, 502); }

    return json({ ok: true, extracted }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
