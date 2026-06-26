import { useClientFinance } from "@/hooks/useClientFinance";
import { computeCenarios } from "@/lib/cenarios";
import { fmtBRL } from "@/lib/cenarios";
import TabHint from "./TabHint";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, TrendingUp, Target, Mountain } from "lucide-react";

export default function AnaliseTab({ clientId }: { clientId: string }) {
  const fin = useClientFinance(clientId);
  if (!fin) return <p className="text-sm text-muted-foreground">Carregando dados do cliente…</p>;

  const mesesReserva = fin.despesaMensal > 0 ? fin.reserva / fin.despesaMensal : 0;
  const metaReserva = fin.despesaMensal * 6;
  const indep = fin.despesaMensal > 0 ? (fin.rendaPassiva / fin.despesaMensal) * 100 : 0;
  const faltaIndep = Math.max(0, fin.despesaMensal - fin.rendaPassiva);

  const cen = computeCenarios({
    idade: fin.idade, idadeAposentadoria: fin.idadeAposentadoria, expectativaVida: fin.expectativaVida,
    patrimonioFinanceiro: fin.patrimonioFinanceiro, poupancaMensal: fin.capacidade,
    taxaNominalPct: fin.taxaNominalAnual * 100, inflacaoPct: fin.inflacaoAnual * 100,
    rendaDesejada: fin.rendaDesejada, rendaPassivaAtual: fin.rendaPassiva, rendaPassivaBens: 0,
  });
  const aporteNecessario = cen.ok ? cen.poupancaViver : 0;
  const gapAposentadoria = Math.max(0, aporteNecessario - fin.capacidade);

  const totalObjMeta = fin.objetivos.reduce((s, o) => s + o.valor, 0);
  const totalObjAcum = fin.objetivos.reduce((s, o) => s + o.acumulado, 0);

  return (
    <div className="space-y-4">
      <TabHint>
        Visão rápida da <strong>saúde do planejamento</strong> do cliente: reserva, independência
        financeira, progresso dos objetivos e o gap da aposentadoria. Atualiza com os dados atuais.
      </TabHint>

      <div className="grid gap-4 md:grid-cols-2">
        <AnaliseCard
          icon={ShieldCheck}
          titulo="A reserva aguenta?"
          leitura={mesesReserva >= 6 ? "Reserva sólida." : mesesReserva >= 3 ? "Reserva razoável — ideal chegar a 6 meses." : "Reserva abaixo do recomendado."}
          ok={mesesReserva >= 6}
          metrics={[
            ["Hoje", `${mesesReserva.toFixed(1)} meses`],
            ["Meta (6 meses)", fmtBRL(metaReserva)],
            ["Reserva atual", fmtBRL(fin.reserva)],
          ]}
        />
        <AnaliseCard
          icon={TrendingUp}
          titulo="Independência financeira"
          leitura={indep >= 100 ? "Renda passiva já cobre o custo de vida!" : `A renda passiva cobre ${indep.toFixed(0)}% do custo de vida.`}
          ok={indep >= 100}
          metrics={[
            ["Renda passiva", `${fmtBRL(fin.rendaPassiva)}/mês`],
            ["Independência", `${indep.toFixed(0)}%`],
            ["Falta cobrir", `${fmtBRL(faltaIndep)}/mês`],
          ]}
        />
        <AnaliseCard
          icon={Target}
          titulo="Progresso dos objetivos"
          leitura={totalObjMeta > 0 ? `${((totalObjAcum / totalObjMeta) * 100).toFixed(0)}% do total dos objetivos já acumulado.` : "Nenhum objetivo cadastrado."}
          ok={totalObjMeta > 0 && totalObjAcum / totalObjMeta >= 0.5}
          metrics={[
            ["Acumulado", fmtBRL(totalObjAcum)],
            ["Meta total", fmtBRL(totalObjMeta)],
            ["Objetivos", String(fin.objetivos.length)],
          ]}
        />
        <AnaliseCard
          icon={Mountain}
          titulo="A aposentadoria cabe no mês?"
          leitura={gapAposentadoria <= 0 ? "A capacidade atual já cobre o aporte necessário." : `Gap de ${fmtBRL(gapAposentadoria)}/mês — revise o plano ou abra espaço no orçamento.`}
          ok={gapAposentadoria <= 0}
          metrics={[
            ["Plano exige", `${fmtBRL(aporteNecessario)}/mês`],
            ["Capacidade atual", `${fmtBRL(fin.capacidade)}/mês`],
            ["Gap", `${fmtBRL(gapAposentadoria)}/mês`],
          ]}
        />
      </div>
    </div>
  );
}

function AnaliseCard({
  icon: Icon, titulo, leitura, ok, metrics,
}: {
  icon: any; titulo: string; leitura: string; ok: boolean; metrics: [string, string][];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <h4 className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4 text-primary" /> {titulo}</h4>
        <div className="grid grid-cols-3 gap-2">
          {metrics.map(([k, v], i) => (
            <div key={k} className={`rounded-xl border px-3 py-2.5 ${i === 2 ? "bg-muted/30" : "bg-muted/10"}`}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
              <p className="text-sm font-bold">{v}</p>
            </div>
          ))}
        </div>
        <div className={`rounded-lg px-3 py-2 text-xs ${ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}`}>
          <strong>Leitura:</strong> {leitura}
        </div>
      </CardContent>
    </Card>
  );
}
