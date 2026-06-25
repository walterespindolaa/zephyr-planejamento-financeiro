import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FIELDS: { key: string; label: string; suffix?: string }[] = [
  { key: "idade_atual", label: "Idade atual" },
  { key: "idade_aposentadoria", label: "Idade de aposentadoria" },
  { key: "expectativa_vida", label: "Expectativa de vida" },
  { key: "renda_desejada", label: "Renda mensal desejada (R$)" },
  { key: "poupanca_mensal", label: "Poupança mensal atual (R$)" },
  { key: "renda_passiva_atual", label: "Renda passiva atual (R$)" },
  { key: "taxa_retorno_anual", label: "Taxa de retorno anual", suffix: "ex.: 0.06 = 6%" },
  { key: "inflacao_anual", label: "Inflação anual", suffix: "ex.: 0.04 = 4%" },
];

export default function AposentadoriaForm({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("client_aposentadoria")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const obj: Record<string, string> = {};
          FIELDS.forEach((f) => (obj[f.key] = data[f.key] == null ? "" : String(data[f.key])));
          setData(obj);
        }
        setLoading(false);
      });
  }, [clientId]);

  const save = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = { client_id: clientId };
    FIELDS.forEach((f) => {
      payload[f.key] = data[f.key] === "" || data[f.key] == null ? null : Number(data[f.key]);
    });
    const { error } = await supabase
      .from("client_aposentadoria")
      .upsert(payload, { onConflict: "client_id" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Aposentadoria salva");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type="number"
                step="0.01"
                value={data[f.key] ?? ""}
                onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}
              />
              {f.suffix && <p className="text-[11px] text-muted-foreground">{f.suffix}</p>}
            </div>
          ))}
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar aposentadoria"}
        </Button>
      </CardContent>
    </Card>
  );
}
