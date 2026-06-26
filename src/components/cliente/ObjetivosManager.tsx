import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  OBJETIVO_TIPOS,
  FREQUENCIAS,
  getTipoConfig,
  calcPoupancaMensal,
  taxaRealMensal,
} from "@/lib/objetivos";
import MoneyInput from "@/components/common/MoneyInput";
import { fmtBRL } from "@/lib/cenarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Objetivo {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  valor_objetivo: number;
  valor_acumulado: number;
  aporte_mensal: number;
  aporte_automatico: boolean;
  frequencia: string;
  data_objetivo: string | null;
}

export default function ObjetivosManager({ clientId }: { clientId: string }) {
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [taxaReal, setTaxaReal] = useState(0.004);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [obj, apo] = await Promise.all([
      supabase.from("client_objetivos").select("*").eq("client_id", clientId).order("created_at"),
      supabase.from("client_aposentadoria").select("taxa_retorno_anual, inflacao_anual").eq("client_id", clientId).maybeSingle(),
    ]);
    setObjetivos((obj.data as Objetivo[]) || []);
    const a: any = apo.data;
    setTaxaReal(taxaRealMensal(Number(a?.taxa_retorno_anual ?? 0.06), Number(a?.inflacao_anual ?? 0.04)));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const totalMensal = useMemo(
    () => objetivos.reduce((s, o) => s + Number(o.aporte_mensal || 0), 0),
    [objetivos]
  );

  const del = async (id: string) => {
    await supabase.from("client_objetivos").delete().eq("id", id);
    setObjetivos((o) => o.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Total de aportes:{" "}
          <span className="font-semibold text-foreground">{fmtBRL(totalMensal)}/mês</span>
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar objetivo
            </Button>
          </DialogTrigger>
          <NovoObjetivo
            clientId={clientId}
            taxaReal={taxaReal}
            onSaved={() => {
              setOpen(false);
              load();
            }}
          />
        </Dialog>
      </div>

      {objetivos.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">Nenhum objetivo ainda.</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {objetivos.map((o) => {
          const cfg = getTipoConfig(o.tipo);
          const pct = o.valor_objetivo > 0 ? Math.min(100, (o.valor_acumulado / o.valor_objetivo) * 100) : 0;
          return (
            <div key={o.id} className="rounded-2xl border p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <cfg.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{cfg.label}</p>
                    <p className="font-semibold leading-tight">{o.nome || cfg.label}</p>
                  </div>
                </div>
                <button onClick={() => del(o.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{fmtBRL(o.valor_acumulado)} guardados</span>
                <span className="font-semibold">{fmtBRL(o.valor_objetivo)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {o.aporte_automatico ? "Aporte automático" : "Aporte"}
                </span>
                <span className="font-bold text-primary">{fmtBRL(o.aporte_mensal)}/mês</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NovoObjetivo({
  clientId,
  taxaReal,
  onSaved,
}: {
  clientId: string;
  taxaReal: number;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState("viagem_nacional");
  const [nomeCustom, setNomeCustom] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [acumulado, setAcumulado] = useState(0);
  const [frequencia, setFrequencia] = useState("unico");
  const [data, setData] = useState("");
  const [auto, setAuto] = useState(true);
  const [custom, setCustom] = useState(false);
  const [aporteCustom, setAporteCustom] = useState(0);
  const [saving, setSaving] = useState(false);

  const dataFull = data ? `${data}-01` : null; // input é mês/ano (YYYY-MM)
  const sugestao = useMemo(
    () => Math.round(calcPoupancaMensal(valor, frequencia, dataFull, taxaReal)),
    [valor, frequencia, dataFull, taxaReal]
  );

  const salvar = async () => {
    if (valor <= 0) {
      toast.error("Informe o valor do objetivo");
      return;
    }
    setSaving(true);
    const cfg = getTipoConfig(tipo);
    const nome = tipo === "outro" ? nomeCustom || "Objetivo personalizado" : cfg.label;
    const aporte = auto ? (custom ? aporteCustom : sugestao) : 0;
    const { error } = await supabase.from("client_objetivos").insert({
      client_id: clientId,
      tipo,
      nome,
      descricao: descricao || null,
      valor_objetivo: valor,
      valor_acumulado: acumulado,
      aporte_mensal: aporte,
      aporte_automatico: auto,
      frequencia,
      data_objetivo: dataFull,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Objetivo criado");
    onSaved();
  };

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Novo Objetivo de Vida
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label className="text-xs">O que o cliente quer conquistar?</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {OBJETIVO_TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors",
                  tipo === t.value ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"
                )}
              >
                <t.icon className="h-4 w-4 text-primary" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tipo === "outro" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do objetivo</Label>
            <Input value={nomeCustom} onChange={(e) => setNomeCustom(e.target.value)} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Descrição (opcional)</Label>
          <Textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe o sonho… Ex: Viagem para Europa com a família em 2028"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Quanto custa?</Label>
            <MoneyInput value={valor} onCommit={setValor} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Já guardou?</Label>
            <MoneyInput value={acumulado} onCommit={setAcumulado} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frequência</Label>
            <Select value={frequencia} onValueChange={setFrequencia}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIAS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quando quer realizar? (mês/ano)</Label>
            <Input type="month" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Aporte automático mensal</span>
            <Switch checked={auto} onCheckedChange={setAuto} />
          </div>
          {auto && (
            <div className="mt-3 space-y-2">
              <div className="rounded-lg bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Sugestão Zephyr</p>
                <p className="text-lg font-bold text-primary">{fmtBRL(sugestao)} / mês</p>
              </div>
              <button
                onClick={() => setCustom(false)}
                className={cn("flex w-full items-center gap-2 rounded-lg border p-3 text-sm", !custom && "border-primary bg-primary/5")}
              >
                <span className={cn("h-3.5 w-3.5 rounded-full border", !custom && "border-4 border-primary")} />
                Usar valor sugerido
              </button>
              <button
                onClick={() => setCustom(true)}
                className={cn("flex w-full items-center gap-2 rounded-lg border p-3 text-sm", custom && "border-primary bg-primary/5")}
              >
                <span className={cn("h-3.5 w-3.5 rounded-full border", custom && "border-4 border-primary")} />
                Definir aporte próprio
              </button>
              {custom && <MoneyInput value={aporteCustom} onCommit={setAporteCustom} />}
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Cálculo baseado nas premissas econômicas do planejamento.
          </p>
        </div>

        <Button className="w-full" onClick={salvar} disabled={saving}>
          {saving ? "Salvando…" : "Criar objetivo"}
        </Button>
      </div>
    </DialogContent>
  );
}
