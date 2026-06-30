import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { taxaRealMensal } from "@/lib/objetivos";

export interface ClientFinance {
  patrimonioFinanceiro: number;
  patrimonioBens: number;
  patrimonioTotal: number;
  receitaMensal: number;
  despesaMensal: number;
  capacidade: number;
  reserva: number;
  rendaPassiva: number;
  dividas: number;
  idade: number;
  idadeAposentadoria: number;
  expectativaVida: number;
  rendaDesejada: number;
  taxaNominalAnual: number;
  inflacaoAnual: number;
  taxaRealMensal: number;
  objetivos: { nome: string; valor: number; acumulado: number; aporte: number; prazo: string | null }[];
}

export function useClientFinance(clientId: string) {
  const [data, setData] = useState<ClientFinance | null>(null);

  useEffect(() => {
    (async () => {
      const [apoR, invR, bensR, recR, despR, objR] = await Promise.all([
        supabase.from("client_aposentadoria").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_investimentos").select("valor_atual, is_reserva_emergencia, classe").eq("client_id", clientId),
        supabase.from("client_bens").select("valor, divida_vinculada, gera_renda, valor_renda").eq("client_id", clientId),
        supabase.from("client_receitas").select("valor, recorrente, data_inicio, data_fim").eq("client_id", clientId),
        supabase.from("client_despesas").select("valor, recorrente, data_inicio, data_fim").eq("client_id", clientId),
        supabase.from("client_objetivos").select("nome, valor_objetivo, valor_acumulado, aporte_mensal, data_objetivo").eq("client_id", clientId),
      ]);
      const apo: any = apoR.data || {};
      const hoje = new Date().toISOString().slice(0, 10);
      const vigente = (x: any) =>
        (!x.data_inicio || x.data_inicio <= hoje) && (!x.data_fim || x.data_fim >= hoje);
      const sum = (arr: any[] | null, f: (x: any) => number) => (arr || []).reduce((s, x) => s + (f(x) || 0), 0);
      const mensal = (arr: any[] | null, f: (x: any) => number) => {
        const a = (arr || []).filter(vigente);
        return sum(a.filter((x) => x.recorrente), f) + sum(a.filter((x) => !x.recorrente), f) / 12;
      };
      const receita = Math.round(mensal(recR.data, (r) => Number(r.valor)));
      const despesa = Math.round(mensal(despR.data, (d) => Number(d.valor)));
      const patFin = sum(invR.data, (i) => Number(i.valor_atual));
      const patBens = sum(bensR.data, (b) => Number(b.valor) - Number(b.divida_vinculada || 0));
      const reserva = sum((invR.data || []).filter((i: any) => i.is_reserva_emergencia), (i) => Number(i.valor_atual));
      const rendaPassiva = Number(apo.renda_passiva_atual || 0) + sum((bensR.data || []).filter((b: any) => b.gera_renda), (b) => Number(b.valor_renda || 0));
      const dividas = sum(bensR.data, (b) => Number(b.divida_vinculada || 0));
      const nom = Number(apo.taxa_retorno_anual ?? 0.06);
      const inf = Number(apo.inflacao_anual ?? 0.04);

      setData({
        patrimonioFinanceiro: patFin,
        patrimonioBens: patBens,
        patrimonioTotal: patFin + patBens,
        receitaMensal: receita,
        despesaMensal: despesa,
        capacidade: Math.max(0, receita - despesa),
        reserva,
        rendaPassiva,
        dividas,
        idade: apo.idade_atual ?? 35,
        idadeAposentadoria: apo.idade_aposentadoria ?? 60,
        expectativaVida: apo.expectativa_vida ?? 90,
        rendaDesejada: Number(apo.renda_desejada || 0),
        taxaNominalAnual: nom,
        inflacaoAnual: inf,
        taxaRealMensal: taxaRealMensal(nom, inf),
        objetivos: (objR.data || []).map((o: any) => ({
          nome: o.nome, valor: Number(o.valor_objetivo || 0), acumulado: Number(o.valor_acumulado || 0),
          aporte: Number(o.aporte_mensal || 0), prazo: o.data_objetivo,
        })),
      });
    })();
  }, [clientId]);

  return data;
}
