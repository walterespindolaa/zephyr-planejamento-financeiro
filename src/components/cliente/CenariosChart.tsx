import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { computeCenarios, fmtBRL, fmtBRLshort, type CenarioInputs } from "@/lib/cenarios";

const COLORS = {
  Realidade: "hsl(45 90% 45%)",
  Consumo: "hsl(0 70% 50%)",
  "Viver de Renda": "hsl(145 60% 40%)",
};

export default function CenariosChart({ inputs }: { inputs: CenarioInputs }) {
  const c = computeCenarios(inputs);
  if (!c.ok)
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Preencha a aposentadoria (idade atual, idade de aposentadoria, renda desejada) na aba
          Planejamento para visualizar os 3 cenários.
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="py-5">
          <h4 className="mb-3 text-sm font-bold">Projeção de Patrimônio — 3 Cenários</h4>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={c.chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="idade" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLshort(Number(v))} width={60} />
                <Tooltip formatter={(v) => fmtBRL(Number(v))} labelFormatter={(l) => `Idade ${l}`} />
                <Legend />
                <ReferenceLine
                  x={inputs.idadeAposentadoria}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="6 4"
                  label={{ value: "Aposentadoria", position: "top", fontSize: 10 }}
                />
                <Line type="monotone" dataKey="Realidade" stroke={COLORS.Realidade} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Consumo" stroke={COLORS.Consumo} strokeWidth={2} strokeDasharray="6 3" dot={false} />
                <Line type="monotone" dataKey="Viver de Renda" stroke={COLORS["Viver de Renda"]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <CenarioCard
          titulo="Realidade"
          cor={COLORS.Realidade}
          linhas={[
            ["Poupança mensal", fmtBRL(inputs.poupancaMensal)],
            ["Patrimônio na aposentadoria", fmtBRL(c.patAposentadoria)],
            [`Patrimônio aos ${inputs.expectativaVida}`, fmtBRL(c.patFinalRealidade)],
          ]}
        />
        <CenarioCard
          titulo="Consumo do Patrimônio"
          cor={COLORS.Consumo}
          linhas={[
            ["Poupança necessária", fmtBRL(c.poupancaConsumo) + "/mês"],
            ["Montante a acumular", fmtBRL(c.montanteConsumo)],
            [`Patrimônio aos ${inputs.expectativaVida}`, fmtBRL(c.patFinalConsumo)],
          ]}
        />
        <CenarioCard
          titulo="Viver de Renda"
          cor={COLORS["Viver de Renda"]}
          linhas={[
            ["Poupança necessária", fmtBRL(c.poupancaViver) + "/mês"],
            ["Montante necessário", fmtBRL(c.montanteViver)],
            [`Patrimônio aos ${inputs.expectativaVida}`, fmtBRL(c.patFinalViver)],
          ]}
        />
      </div>
    </div>
  );
}

function CenarioCard({
  titulo,
  cor,
  linhas,
}: {
  titulo: string;
  cor: string;
  linhas: [string, string][];
}) {
  return (
    <Card className="rounded-2xl border-l-4" style={{ borderLeftColor: cor }}>
      <CardContent className="space-y-2 py-4">
        <h5 className="text-sm font-bold" style={{ color: cor }}>
          {titulo}
        </h5>
        {linhas.map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="text-sm font-bold">{v}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
