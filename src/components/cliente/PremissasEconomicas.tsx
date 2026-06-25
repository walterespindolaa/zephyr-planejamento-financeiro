import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

/**
 * Premissas econômicas: taxa nominal e inflação (% a.a.) + taxas derivadas
 * (real anual, real mensal, nominal mensal, inflação mensal). Espelha o Atlas.
 */
export default function PremissasEconomicas({
  nominalPct,
  inflacaoPct,
  onChange,
}: {
  nominalPct: number;
  inflacaoPct: number;
  onChange: (nominalPct: number, inflacaoPct: number) => void;
}) {
  const nom = (nominalPct || 0) / 100;
  const inf = (inflacaoPct || 0) / 100;
  const realAnual = (1 + nom) / (1 + inf) - 1;
  const realMensal = Math.pow(1 + realAnual, 1 / 12) - 1;
  const nominalMensal = Math.pow(1 + nom, 1 / 12) - 1;
  const inflacaoMensal = Math.pow(1 + inf, 1 / 12) - 1;
  const pct = (n: number) => (n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h4 className="mb-3 text-sm font-bold">Premissas Econômicas</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Taxa nominal (% a.a.)</Label>
          <Input
            type="number"
            step="0.1"
            value={nominalPct}
            onChange={(e) => onChange(Number(e.target.value), inflacaoPct)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Inflação esperada (% a.a.)</Label>
          <Input
            type="number"
            step="0.1"
            value={inflacaoPct}
            onChange={(e) => onChange(nominalPct, Number(e.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        <Cell label="Taxa real anual" value={pct(realAnual)} strong />
        <Cell label="Taxa real mensal" value={pct(realMensal)} />
        <Cell label="Taxa nominal mensal" value={pct(nominalMensal)} />
        <Cell label="Inflação mensal" value={pct(inflacaoMensal)} />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" /> Premissas conservadoras e ajustáveis. Resultados
        são estimativas, não garantia.
      </p>
    </div>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base ${strong ? "font-bold text-primary" : "font-semibold"}`}>{value}</p>
    </div>
  );
}
