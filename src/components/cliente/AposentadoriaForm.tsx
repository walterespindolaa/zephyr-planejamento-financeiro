import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import MoneyInput from "@/components/common/MoneyInput";
import PremissasEconomicas from "./PremissasEconomicas";
import { toast } from "sonner";

const DEFAULTS: Record<string, number> = {
  expectativa_vida: 90,
  taxa_retorno_anual: 0.06, // 6%
  inflacao_anual: 0.04, // 4%
};

const NUM_FIELDS = [
  { key: "idade_atual", label: "Idade atual" },
  { key: "idade_aposentadoria", label: "Idade de aposentadoria" },
  { key: "expectativa_vida", label: "Expectativa de vida" },
];
const MONEY_FIELDS = [
  { key: "renda_desejada", label: "Renda mensal desejada" },
  { key: "poupanca_mensal", label: "Poupança mensal atual" },
  { key: "renda_passiva_atual", label: "Renda passiva atual" },
];

export default function AposentadoriaForm({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Record<string, number | null>>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("client_aposentadoria")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row) {
          const obj: Record<string, number | null> = { ...DEFAULTS };
          [...NUM_FIELDS, ...MONEY_FIELDS].forEach((f) => {
            obj[f.key] = row[f.key] ?? null;
          });
          obj.taxa_retorno_anual = row.taxa_retorno_anual ?? DEFAULTS.taxa_retorno_anual;
          obj.inflacao_anual = row.inflacao_anual ?? DEFAULTS.inflacao_anual;
          setData(obj);
        }
        setLoading(false);
      });
  }, [clientId]);

  const setVal = (k: string, v: number | null) => setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("client_aposentadoria")
      .upsert({ client_id: clientId, ...data }, { onConflict: "client_id" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Aposentadoria salva");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <PremissasEconomicas
        nominalPct={Number(data.taxa_retorno_anual ?? 0.06) * 100}
        inflacaoPct={Number(data.inflacao_anual ?? 0.04) * 100}
        onChange={(nom, inf) =>
          setData((d) => ({ ...d, taxa_retorno_anual: nom / 100, inflacao_anual: inf / 100 }))
        }
      />

      <Card>
        <CardContent className="space-y-4 py-5">
          <h4 className="text-sm font-bold">Dados pessoais</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {NUM_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="number"
                  value={data[f.key] ?? ""}
                  onChange={(e) => setVal(f.key, e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
            ))}
            {MONEY_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <MoneyInput value={Number(data[f.key]) || 0} onCommit={(v) => setVal(f.key, v)} />
              </div>
            ))}
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar aposentadoria"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
