import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runDecisionEngine, type DecisionContext } from "@/lib/financial_engine/decision_engine";
import { taxaRealMensal } from "@/lib/objetivos";
import { fmtBRL } from "@/lib/cenarios";
import MoneyInput from "@/components/common/MoneyInput";
import TabHint from "./TabHint";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, Car, TrendingUp, Plane, Baby, Briefcase, TrendingDown, Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "comprar_imovel", label: "Comprar imóvel", icon: Home, valorLabel: "Valor do imóvel", prazoLabel: "Em quantos meses" },
  { value: "trocar_carro", label: "Trocar carro", icon: Car, valorLabel: "Custo da troca", prazoLabel: "Em quantos meses" },
  { value: "aumentar_padrao", label: "Aumentar padrão", icon: TrendingUp, valorLabel: "Aumento mensal de gasto", prazoLabel: "Por quantos meses" },
  { value: "viagem", label: "Viagem", icon: Plane, valorLabel: "Custo da viagem", prazoLabel: "Em quantos meses" },
  { value: "novo_filho", label: "Novo filho", icon: Baby, valorLabel: "Custo mensal estimado", prazoLabel: "Por quantos meses" },
  { value: "empreender", label: "Abrir negócio", icon: Briefcase, valorLabel: "Investimento inicial", prazoLabel: "Meses até retorno" },
  { value: "reduzir_renda", label: "Reduzir renda/jornada", icon: TrendingDown, valorLabel: "Redução mensal de renda", prazoLabel: "Por quantos meses" },
  { value: "antecipar_aposentadoria", label: "Antecipar aposentadoria", icon: Palmtree, valorLabel: "Renda mensal desejada", prazoLabel: "Anos a antecipar" },
];

export default function SimuladorTab({ clientId }: { clientId: string }) {
  const [ctx, setCtx] = useState<DecisionContext | null>(null);
  const [tipo, setTipo] = useState("comprar_imovel");
  const [valor, setValor] = useState(0);
  const [prazo, setPrazo] = useState(12);
  const [aporte, setAporte] = useState(0);

  useEffect(() => {
    (async () => {
      const [apoR, invR, bensR, recR, despR] = await Promise.all([
        supabase.from("client_aposentadoria").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_investimentos").select("valor_atual, is_reserva_emergencia").eq("client_id", clientId),
        supabase.from("client_bens").select("valor, divida_vinculada").eq("client_id", clientId),
        supabase.from("client_receitas").select("valor, recorrente").eq("client_id", clientId),
        supabase.from("client_despesas").select("valor, recorrente").eq("client_id", clientId),
      ]);
      const apo: any = apoR.data || {};
      const sum = (arr: any[] | null, f: (x: any) => number) => (arr || []).reduce((s, x) => s + (f(x) || 0), 0);
      const mensal = (arr: any[] | null, f: (x: any) => number) =>
        sum((arr || []).filter((x) => x.recorrente), f) + sum((arr || []).filter((x) => !x.recorrente), f) / 12;
      const receita = Math.round(mensal(recR.data, (r) => Number(r.valor)));
      const despesa = Math.round(mensal(despR.data, (d) => Number(d.valor)));
      const patFin = sum(invR.data, (i) => Number(i.valor_atual));
      const patBens = sum(bensR.data, (b) => Number(b.valor) - Number(b.divida_vinculada || 0));
      const reserva = sum((invR.data || []).filter((i: any) => i.is_reserva_emergencia), (i) => Number(i.valor_atual));
      setCtx({
        reservaAtual: reserva,
        despesasMensais: despesa,
        patrimonioAtual: patFin + patBens,
        poupancaMensal: Math.max(0, receita - despesa),
        rendaTotal: receita,
        taxaRealMensal: taxaRealMensal(Number(apo.taxa_retorno_anual ?? 0.06), Number(apo.inflacao_anual ?? 0.04)),
      });
    })();
  }, [clientId]);

  const result = useMemo(
    () => (ctx ? runDecisionEngine(tipo, valor, prazo, ctx, { aporteMensal: aporte }) : null),
    [ctx, tipo, valor, prazo, aporte]
  );

  const cfg = TIPOS.find((t) => t.value === tipo)!;

  if (!ctx) return <p className="text-sm text-muted-foreground">Carregando dados do cliente…</p>;

  return (
    <div className="space-y-4">
      <TabHint>
        Simule o <strong>impacto de uma decisão</strong> (comprar imóvel, trocar carro, novo filho,
        abrir negócio…) usando os dados reais do cliente. Mostra o efeito no patrimônio, na reserva,
        na aposentadoria e o custo de oportunidade.
      </TabHint>

      {/* Tipo de decisão */}
      <Card>
        <CardContent className="py-5">
          <h4 className="mb-3 text-sm font-bold">Qual decisão simular?</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs transition-colors",
                  tipo === t.value ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"
                )}
              >
                <t.icon className="h-5 w-5 text-primary" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{cfg.valorLabel}</Label>
              <MoneyInput value={valor} onCommit={setValor} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{cfg.prazoLabel}</Label>
              <Input type="number" value={prazo} onChange={(e) => setPrazo(Number(e.target.value))} />
            </div>
            {tipo === "empreender" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Aporte mensal no negócio</Label>
                <MoneyInput value={aporte} onCommit={setAporte} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Res label="Impacto no patrimônio" value={result.impactoPatrimonio} />
            <Res label="Impacto mensal no caixa" value={result.impactoMensal} />
            <Res label="Custo de oportunidade" value={-Math.abs(result.custoOportunidade)} />
            <Res label="Renda passiva perdida/mês" value={-Math.abs(result.rendaPassivaPerdida)} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Res label="Impacto na reserva" value={result.impactoReserva} />
            <ResText label="Impacto na aposentadoria" value={`${result.impactoAposentadoriaMeses > 0 ? "+" : ""}${result.impactoAposentadoriaMeses} meses`} negativo={result.impactoAposentadoriaMeses > 0} />
            <Res label="Capital potencial perdido" value={-Math.abs(result.capitalPotencialPerdido)} />
          </div>

          {result.memoriaCalculo?.length > 0 && (
            <Card>
              <CardContent className="py-5">
                <h4 className="mb-2 text-sm font-bold">Memória de cálculo</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.memoriaCalculo.map((m, i) => (
                    <li key={i}>• {m}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Res({ label, value }: { label: string; value: number }) {
  const neg = value < 0;
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold", neg ? "text-destructive" : "text-success")}>
          {value > 0 ? "+" : ""}{fmtBRL(value)}
        </p>
      </CardContent>
    </Card>
  );
}
function ResText({ label, value, negativo }: { label: string; value: string; negativo?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold", negativo ? "text-destructive" : "text-success")}>{value}</p>
      </CardContent>
    </Card>
  );
}
