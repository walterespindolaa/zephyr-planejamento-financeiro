import { useMemo, useState } from "react";
import { fmtBRL } from "@/lib/cenarios";
import MoneyInput from "@/components/common/MoneyInput";
import TabHint from "./TabHint";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale } from "lucide-react";

/** Parcela Price (sistema francês). */
function pricePMT(valor: number, jurosMes: number, n: number) {
  if (n <= 0) return 0;
  if (jurosMes <= 0) return valor / n;
  const f = Math.pow(1 + jurosMes, n);
  return (valor * jurosMes * f) / (f - 1);
}

export default function ConsorcioTab() {
  const [valor, setValor] = useState(500000);
  const [entrada, setEntrada] = useState(100000);
  const [prazo, setPrazo] = useState(120);
  const [jurosAno, setJurosAno] = useState(11);
  const [taxaAdm, setTaxaAdm] = useState(18);
  const [fundoReserva, setFundoReserva] = useState(2);
  const [lance, setLance] = useState(0);

  const r = useMemo(() => {
    const financiado = Math.max(0, valor - entrada);
    const jm = Math.pow(1 + jurosAno / 100, 1 / 12) - 1;

    // Price (parcela fixa)
    const parcFin = pricePMT(financiado, jm, prazo);
    const totalFin = parcFin * prazo + entrada;
    const jurosFin = totalFin - valor;

    // SAC (amortização constante)
    const amort = prazo > 0 ? financiado / prazo : 0;
    const parcInicialSAC = amort + financiado * jm;
    const parcFinalSAC = amort + amort * jm;
    const jurosSAC = jm * financiado * (prazo + 1) / 2;
    const totalSAC = financiado + jurosSAC + entrada;

    // Consórcio
    const custoConsorcio = valor * (1 + (taxaAdm + fundoReserva) / 100);
    const parcConsorcio = (custoConsorcio - lance) / prazo;
    const totalConsorcio = custoConsorcio;
    const custoExtraConsorcio = totalConsorcio - valor;

    const melhorFin = Math.min(totalFin, totalSAC);
    const diff = melhorFin - totalConsorcio;
    return { financiado, parcFin, totalFin, jurosFin, amort, parcInicialSAC, parcFinalSAC, jurosSAC, totalSAC, custoConsorcio, parcConsorcio, totalConsorcio, custoExtraConsorcio, diff };
  }, [valor, entrada, prazo, jurosAno, taxaAdm, fundoReserva, lance]);

  const consorcioMelhor = r.diff > 0;

  return (
    <div className="space-y-4">
      <TabHint>
        Compare <strong>consórcio × financiamento</strong> para a mesma aquisição: parcelas, custo
        total e qual sai mais barato. Útil pra decidir como o cliente vai adquirir um imóvel, veículo
        ou cota.
      </TabHint>

      <Card>
        <CardContent className="space-y-4 py-5">
          <h4 className="flex items-center gap-2 text-sm font-bold"><Scale className="h-4 w-4 text-primary" /> Parâmetros</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valor do bem"><MoneyInput value={valor} onCommit={setValor} /></Field>
            <Field label="Entrada (financiamento)"><MoneyInput value={entrada} onCommit={setEntrada} /></Field>
            <Field label="Prazo (meses)"><Input type="number" value={prazo} onChange={(e) => setPrazo(Number(e.target.value))} /></Field>
            <Field label="Juros financiamento (% a.a.)"><Input type="number" step="0.1" value={jurosAno} onChange={(e) => setJurosAno(Number(e.target.value))} /></Field>
            <Field label="Taxa de administração consórcio (%)"><Input type="number" step="0.1" value={taxaAdm} onChange={(e) => setTaxaAdm(Number(e.target.value))} /></Field>
            <Field label="Fundo de reserva (%)"><Input type="number" step="0.1" value={fundoReserva} onChange={(e) => setFundoReserva(Number(e.target.value))} /></Field>
            <Field label="Lance (consórcio)"><MoneyInput value={lance} onCommit={setLance} /></Field>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-2xl border-l-4" style={{ borderLeftColor: "#b8860b" }}>
          <CardContent className="space-y-2 py-4">
            <h5 className="text-sm font-bold" style={{ color: "#b8860b" }}>Financiamento — Price</h5>
            <Linha k="Valor financiado" v={fmtBRL(r.financiado)} />
            <Linha k="Parcela (fixa)" v={`${fmtBRL(r.parcFin)}/mês`} />
            <Linha k="Total pago" v={fmtBRL(r.totalFin)} forte />
            <Linha k="Juros pagos" v={fmtBRL(r.jurosFin)} cor="#b23b32" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-l-4" style={{ borderLeftColor: "#c8861a" }}>
          <CardContent className="space-y-2 py-4">
            <h5 className="text-sm font-bold" style={{ color: "#c8861a" }}>Financiamento — SAC</h5>
            <Linha k="Amortização" v={`${fmtBRL(r.amort)}/mês`} />
            <Linha k="1ª parcela" v={fmtBRL(r.parcInicialSAC)} />
            <Linha k="Última parcela" v={fmtBRL(r.parcFinalSAC)} />
            <Linha k="Total pago" v={fmtBRL(r.totalSAC)} forte />
            <Linha k="Juros pagos" v={fmtBRL(r.jurosSAC)} cor="#b23b32" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-l-4" style={{ borderLeftColor: "#1c7a4d" }}>
          <CardContent className="space-y-2 py-4">
            <h5 className="text-sm font-bold" style={{ color: "#1c7a4d" }}>Consórcio</h5>
            <Linha k="Crédito" v={fmtBRL(valor)} />
            <Linha k="Parcela (após lance)" v={`${fmtBRL(r.parcConsorcio)}/mês`} />
            <Linha k="Total pago" v={fmtBRL(r.totalConsorcio)} forte />
            <Linha k="Custo extra (taxas)" v={fmtBRL(r.custoExtraConsorcio)} cor="#b23b32" />
          </CardContent>
        </Card>
      </div>

      <Card className={consorcioMelhor ? "border-primary/30 bg-primary/5" : "border-warning/30 bg-warning/5"}>
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            {consorcioMelhor ? "O consórcio sai mais barato" : "O financiamento sai mais barato"} em
          </p>
          <p className="text-2xl font-bold">{fmtBRL(Math.abs(r.diff))}</p>
          <p className="text-xs text-muted-foreground">
            Comparando o custo total. O consórcio não tem juros, mas tem taxa de administração; o
            financiamento dá posse imediata. Considere também o prazo de contemplação.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Linha({ k, v, forte, cor }: { k: string; v: string; forte?: boolean; cor?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={forte ? "font-bold" : "font-medium"} style={cor ? { color: cor } : undefined}>{v}</span>
    </div>
  );
}
