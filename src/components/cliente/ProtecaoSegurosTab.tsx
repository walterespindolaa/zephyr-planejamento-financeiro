import { useMemo, useState } from "react";
import { useClientFinance } from "@/hooks/useClientFinance";
import { fmtBRL } from "@/lib/cenarios";
import MoneyInput from "@/components/common/MoneyInput";
import TabHint from "./TabHint";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Heart, Landmark } from "lucide-react";

export default function ProtecaoSegurosTab({ clientId }: { clientId: string }) {
  const fin = useClientFinance(clientId);
  const [anosProtecao, setAnosProtecao] = useState(10);
  const [itcmd, setItcmd] = useState(8);
  const [advoc, setAdvoc] = useState(5);
  const [cartor, setCartor] = useState(2);
  const [rendaBrutaAnual, setRendaBrutaAnual] = useState(0);
  const [aliquotaIR, setAliquotaIR] = useState(27.5);

  const r = useMemo(() => {
    if (!fin) return null;
    const patrimonio = fin.patrimonioTotal;
    const custoInventario = patrimonio * ((itcmd + advoc + cartor) / 100);
    const substituicaoRenda = fin.despesaMensal * 12 * anosProtecao;
    const seguroIdeal = substituicaoRenda + fin.dividas + custoInventario;
    const rendaBase = rendaBrutaAnual || fin.receitaMensal * 12;
    const pgblMax = rendaBase * 0.12;
    const economiaIR = pgblMax * (aliquotaIR / 100);
    const mesesReserva = fin.despesaMensal > 0 ? fin.reserva / fin.despesaMensal : 0;

    // índice de proteção (0–10)
    let score = 0;
    if (mesesReserva >= 6) score += 3; else if (mesesReserva >= 3) score += 1.5;
    if (fin.dividas < patrimonio * 0.3) score += 2.5; else if (fin.dividas < patrimonio * 0.5) score += 1;
    score += 2.5; // base por ter planejamento
    if (fin.rendaPassiva > 0) score += 2;
    score = Math.min(10, Math.round(score * 10) / 10);

    return { patrimonio, custoInventario, substituicaoRenda, seguroIdeal, pgblMax, economiaIR, mesesReserva, score, rendaBase };
  }, [fin, anosProtecao, itcmd, advoc, cartor, rendaBrutaAnual, aliquotaIR]);

  if (!fin || !r) return <p className="text-sm text-muted-foreground">Carregando dados do cliente…</p>;

  return (
    <div className="space-y-4">
      <TabHint>
        Avalie a <strong>proteção patrimonial e familiar</strong>: capital ideal de seguro de vida,
        custos de inventário/sucessão e o benefício fiscal do PGBL — tudo com os dados do cliente.
      </TabHint>

      {/* Índice de proteção */}
      <Card>
        <CardContent className="py-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-primary" /> Índice de Proteção Financeira</h4>
            <span className="text-sm font-bold">{r.score}/10</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${r.score * 10}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Baseado em reserva ({r.mesesReserva.toFixed(1)} meses), endividamento, planejamento e renda passiva.
          </p>
        </CardContent>
      </Card>

      {/* Seguro de vida ideal */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <h4 className="flex items-center gap-2 text-sm font-bold"><Heart className="h-4 w-4 text-primary" /> Seguro de Vida Ideal</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Anos de proteção (substituição de renda)"><Input type="number" value={anosProtecao} onChange={(e) => setAnosProtecao(Number(e.target.value))} /></Field>
            <Field label="ITCMD (%)"><Input type="number" step="0.1" value={itcmd} onChange={(e) => setItcmd(Number(e.target.value))} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Advocatícias (%)"><Input type="number" step="0.1" value={advoc} onChange={(e) => setAdvoc(Number(e.target.value))} /></Field>
              <Field label="Cartorárias (%)"><Input type="number" step="0.1" value={cartor} onChange={(e) => setCartor(Number(e.target.value))} /></Field>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Substituição de renda" v={fmtBRL(r.substituicaoRenda)} />
            <Kpi label="Dívidas a quitar" v={fmtBRL(fin.dividas)} />
            <Kpi label="Custos de inventário" v={fmtBRL(r.custoInventario)} />
            <Kpi label="Capital ideal de seguro" v={fmtBRL(r.seguroIdeal)} destaque />
          </div>
        </CardContent>
      </Card>

      {/* PGBL */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <h4 className="flex items-center gap-2 text-sm font-bold"><Landmark className="h-4 w-4 text-primary" /> PGBL — Dedução de IR</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Renda bruta tributável anual"><MoneyInput value={rendaBrutaAnual || Math.round(r.rendaBase)} onCommit={setRendaBrutaAnual} /></Field>
            <Field label="Alíquota de IR (%)"><Input type="number" step="0.5" value={aliquotaIR} onChange={(e) => setAliquotaIR(Number(e.target.value))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Aporte PGBL máximo dedutível (12%)" v={fmtBRL(r.pgblMax)} />
            <Kpi label="Economia de IR estimada/ano" v={fmtBRL(r.economiaIR)} destaque />
          </div>
          <p className="text-[11px] text-muted-foreground">
            O PGBL permite deduzir até 12% da renda bruta tributável anual. A economia é o valor que
            deixa de ir para o IR no ano (estimativa pela alíquota informada).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Kpi({ label, v, destaque }: { label: string; v: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${destaque ? "border-primary/30 bg-primary/5" : "bg-muted/20"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-bold">{v}</p>
    </div>
  );
}
