import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MoneyInput from "@/components/common/MoneyInput";
import { fmtBRL } from "@/lib/cenarios";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

interface Cfg {
  incluir_protecao: boolean;
  patrimonio_imobilizado: number;
  patrimonio_financeiro: number;
  itcmd_pct: number;
  advocaticias_pct: number;
  cartorarias_pct: number;
  capital_sucessorio: number;
  prev_observacao: string;
  incluir_proximos_passos: boolean;
}

const DEF: Cfg = {
  incluir_protecao: false,
  patrimonio_imobilizado: 0,
  patrimonio_financeiro: 0,
  itcmd_pct: 8,
  advocaticias_pct: 5,
  cartorarias_pct: 2,
  capital_sucessorio: 0,
  prev_observacao: "",
  incluir_proximos_passos: true,
};

export default function InclusoesRelatorio({ clientId }: { clientId: string }) {
  const [cfg, setCfg] = useState<Cfg>(DEF);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [row, inv, bens] = await Promise.all([
        supabase.from("client_report_inclusoes").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_investimentos").select("valor_atual").eq("client_id", clientId),
        supabase.from("client_bens").select("valor, divida_vinculada").eq("client_id", clientId),
      ]);
      const fin = (inv.data || []).reduce((s, i: any) => s + Number(i.valor_atual || 0), 0);
      const imob = (bens.data || []).reduce((s, b: any) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0);
      if (row.data) {
        const r: any = row.data;
        setCfg({
          ...DEF,
          ...r,
          patrimonio_imobilizado: r.patrimonio_imobilizado ?? imob,
          patrimonio_financeiro: r.patrimonio_financeiro ?? fin,
        });
      } else {
        setCfg({ ...DEF, patrimonio_imobilizado: imob, patrimonio_financeiro: fin });
      }
      setLoaded(true);
    })();
  }, [clientId]);

  const save = async (next: Cfg) => {
    setCfg(next);
    await supabase.from("client_report_inclusoes").upsert(
      { client_id: clientId, ...next, updated_at: new Date().toISOString() },
      { onConflict: "client_id" }
    );
  };
  const set = (patch: Partial<Cfg>) => save({ ...cfg, ...patch });

  const total = cfg.patrimonio_imobilizado + cfg.patrimonio_financeiro;
  const itcmd = total * (cfg.itcmd_pct / 100);
  const advoc = total * (cfg.advocaticias_pct / 100);
  const cart = total * (cfg.cartorarias_pct / 100);
  const custoTotal = itcmd + advoc + cart;

  if (!loaded) return null;

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Proteção Patrimonial (sucessão)
            </h3>
            <p className="text-xs text-muted-foreground">
              Quando ligado, entra no fim do relatório com a estimativa de custos de inventário e o
              capital sugerido em seguro.
            </p>
          </div>
          <Switch checked={cfg.incluir_protecao} onCheckedChange={(v) => set({ incluir_protecao: v })} />
        </div>

        {cfg.incluir_protecao && (
          <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Patrimônio imobilizado</Label>
                <MoneyInput value={cfg.patrimonio_imobilizado} onCommit={(v) => set({ patrimonio_imobilizado: v })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ativo financeiro</Label>
                <MoneyInput value={cfg.patrimonio_financeiro} onCommit={(v) => set({ patrimonio_financeiro: v })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Pct label="ITCMD %" value={cfg.itcmd_pct} onChange={(v) => set({ itcmd_pct: v })} />
              <Pct label="Advocatícias %" value={cfg.advocaticias_pct} onChange={(v) => set({ advocaticias_pct: v })} />
              <Pct label="Cartorárias %" value={cfg.cartorarias_pct} onChange={(v) => set({ cartorarias_pct: v })} />
            </div>

            {/* Preview dos custos */}
            <table className="w-full text-xs">
              <tbody>
                <Row k="ITCMD" pct={cfg.itcmd_pct} v={itcmd} />
                <Row k="Advocatícias" pct={cfg.advocaticias_pct} v={advoc} />
                <Row k="Cartorárias" pct={cfg.cartorarias_pct} v={cart} />
                <tr className="border-t font-bold">
                  <td className="py-1">Total</td>
                  <td className="py-1 text-right">{(cfg.itcmd_pct + cfg.advocaticias_pct + cfg.cartorarias_pct).toFixed(2)}%</td>
                  <td className="py-1 text-right">{fmtBRL(custoTotal)}</td>
                </tr>
              </tbody>
            </table>

            <div className="space-y-1">
              <Label className="text-xs">Capital sugerido em ferramenta sucessória</Label>
              <MoneyInput value={cfg.capital_sucessorio || Math.round(custoTotal)} onCommit={(v) => set({ capital_sucessorio: v })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observação / Previdência (opcional)</Label>
              <Input
                value={cfg.prev_observacao}
                onChange={(e) => setCfg({ ...cfg, prev_observacao: e.target.value })}
                onBlur={(e) => set({ prev_observacao: e.target.value })}
                placeholder="Ex.: PREV R$ 2.000.000 + R$ 800.000 rolagem"
              />
            </div>
          </div>
        )}

        <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
          <span>Incluir <strong>Próximos Passos</strong> (oportunidades marcadas "no relatório")</span>
          <Switch checked={cfg.incluir_proximos_passos} onCheckedChange={(v) => set({ incluir_proximos_passos: v })} />
        </label>
      </CardContent>
    </Card>
  );
}

function Pct({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.1" className="h-9" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
function Row({ k, pct, v }: { k: string; pct: number; v: number }) {
  return (
    <tr>
      <td className="py-1">{k}</td>
      <td className="py-1 text-right text-muted-foreground">{pct.toFixed(2)}%</td>
      <td className="py-1 text-right">{fmtBRL(v)}</td>
    </tr>
  );
}
