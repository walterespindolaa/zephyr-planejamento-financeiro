import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MoneyInput from "@/components/common/MoneyInput";
import { fmtBRL } from "@/lib/cenarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Home, Car, Briefcase, Package } from "lucide-react";
import { toast } from "sonner";

interface Bem {
  id: string;
  nome: string;
  tipo: string;
  valor: number;
  divida_vinculada: number;
  gera_renda: boolean;
  valor_renda: number;
}

const TIPOS = [
  { value: "imovel", label: "Imóvel", icon: Home },
  { value: "veiculo", label: "Veículo", icon: Car },
  { value: "empresa", label: "Empresa", icon: Briefcase },
  { value: "outro", label: "Outro", icon: Package },
];
const tipoCfg = (v: string) => TIPOS.find((t) => t.value === v) ?? TIPOS[3];

export default function BensManager({ clientId }: { clientId: string }) {
  const [bens, setBens] = useState<Bem[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("client_bens").select("*").eq("client_id", clientId).order("created_at");
    setBens((data as Bem[]) || []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const tot = useMemo(() => {
    const valor = bens.reduce((s, b) => s + Number(b.valor || 0), 0);
    const divida = bens.reduce((s, b) => s + Number(b.divida_vinculada || 0), 0);
    const renda = bens.filter((b) => b.gera_renda).reduce((s, b) => s + Number(b.valor_renda || 0), 0);
    return { valor, divida, liquido: valor - divida, renda };
  }, [bens]);

  const del = async (id: string) => {
    await supabase.from("client_bens").delete().eq("id", id);
    setBens((b) => b.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Valor total" value={fmtBRL(tot.valor)} />
        <Kpi label="Dívidas" value={fmtBRL(tot.divida)} danger />
        <Kpi label="Patrimônio líquido" value={fmtBRL(tot.liquido)} accent />
        <Kpi label="Renda passiva/mês" value={fmtBRL(tot.renda)} />
      </div>

      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Novo bem</Button>
          </DialogTrigger>
          <NovoBem clientId={clientId} onSaved={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>

      {bens.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum bem ainda.</p>}

      <div className="space-y-2">
        {bens.map((b) => {
          const cfg = tipoCfg(b.tipo);
          const liquido = Number(b.valor) - Number(b.divida_vinculada || 0);
          return (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <cfg.icon className="h-5 w-5" />
              </div>
              <div className="min-w-[140px] flex-1">
                <p className="font-medium">{b.nome || cfg.label}</p>
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Valor: </span>
                <span className="font-medium">{fmtBRL(b.valor)}</span>
              </div>
              {Number(b.divida_vinculada) > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Dívida: </span>
                  <span className="font-medium text-destructive">{fmtBRL(b.divida_vinculada)}</span>
                </div>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Líquido: </span>
                <span className="font-medium text-primary">{fmtBRL(liquido)}</span>
              </div>
              {b.gera_renda && (
                <Badge variant="outline" className="border-primary/30 text-primary">
                  Renda {fmtBRL(b.valor_renda)}/mês
                </Badge>
              )}
              {Number(b.divida_vinculada) > 0 && (
                <Badge variant="outline" className="border-destructive/30 text-destructive">Com dívida</Badge>
              )}
              <button onClick={() => del(b.id)} className="ml-auto">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, danger, accent }: { label: string; value: string; danger?: boolean; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accent ? "border-primary/30 bg-primary/5" : "bg-muted/20"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function NovoBem({ clientId, onSaved }: { clientId: string; onSaved: () => void }) {
  const [tipo, setTipo] = useState("imovel");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState(0);
  const [divida, setDivida] = useState(0);
  const [geraRenda, setGeraRenda] = useState(false);
  const [valorRenda, setValorRenda] = useState(0);
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do bem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_bens").insert({
      client_id: clientId,
      nome: nome.trim(),
      tipo,
      valor,
      divida_vinculada: divida,
      gera_renda: geraRenda,
      valor_renda: geraRenda ? valorRenda : 0,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Bem adicionado");
    onSaved();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-primary" /> Novo Bem</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label className="text-xs">Tipo</Label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs ${tipo === t.value ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"}`}
              >
                <t.icon className="h-5 w-5 text-primary" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Apartamento Centro" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor</Label>
            <MoneyInput value={valor} onCommit={setValor} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dívida vinculada</Label>
            <MoneyInput value={divida} onCommit={setDivida} />
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Gera renda (aluguel, etc.)</span>
            <Switch checked={geraRenda} onCheckedChange={setGeraRenda} />
          </div>
          {geraRenda && (
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Renda mensal</Label>
              <MoneyInput value={valorRenda} onCommit={setValorRenda} />
            </div>
          )}
        </div>
        <Button className="w-full" onClick={salvar} disabled={saving}>
          {saving ? "Salvando…" : "Adicionar bem"}
        </Button>
      </div>
    </DialogContent>
  );
}
