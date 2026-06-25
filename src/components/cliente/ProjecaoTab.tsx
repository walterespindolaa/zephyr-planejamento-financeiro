import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  runLifeProjection,
  EVENT_TEMPLATES,
  type LifeEvent,
  type ProjectionInputs,
} from "@/lib/financial_engine/life_projection";
import { fmtBRL, fmtBRLshort } from "@/lib/cenarios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import { Plus, Trash2, Mountain } from "lucide-react";
import { toast } from "sonner";
import MoneyInput from "@/components/common/MoneyInput";

interface EventoRow {
  id: string;
  name: string;
  emoji: string;
  ano: number;
  tipo: string;
  impacto_valor: number;
  impacto_mensal: number;
  duracao_meses: number;
}

export default function ProjecaoTab({ clientId }: { clientId: string }) {
  const [inputs, setInputs] = useState<ProjectionInputs | null>(null);
  const [eventos, setEventos] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [apoR, invR, bensR, recR, despR, evR] = await Promise.all([
      supabase.from("client_aposentadoria").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("client_investimentos").select("valor_atual").eq("client_id", clientId),
      supabase.from("client_bens").select("valor, divida_vinculada").eq("client_id", clientId),
      supabase.from("client_receitas").select("valor, recorrente").eq("client_id", clientId),
      supabase.from("client_despesas").select("valor, recorrente").eq("client_id", clientId),
      supabase.from("client_eventos").select("*").eq("client_id", clientId).order("ano"),
    ]);
    const apo: any = apoR.data || {};
    const sum = (arr: any[] | null, f: (x: any) => number) => (arr || []).reduce((s, x) => s + (f(x) || 0), 0);
    const mensal = (arr: any[] | null, f: (x: any) => number) =>
      sum((arr || []).filter((x) => x.recorrente), f) + sum((arr || []).filter((x) => !x.recorrente), f) / 12;

    const patFin = sum(invR.data, (i) => Number(i.valor_atual));
    const patBens = sum(bensR.data, (b) => Number(b.valor) - Number(b.divida_vinculada || 0));
    const receita = mensal(recR.data, (r) => Number(r.valor));
    const despesa = mensal(despR.data, (d) => Number(d.valor));

    setInputs({
      patrimonioInicial: patFin + patBens,
      rendaMensal: Math.round(receita),
      poupancaMensal: apo.poupanca_mensal ?? Math.max(0, Math.round(receita - despesa)),
      taxaRetornoAnual: Number(apo.taxa_retorno_anual ?? 0.1),
      inflacaoAnual: Number(apo.inflacao_anual ?? 0.04),
      idadeAtual: apo.idade_atual ?? 35,
      idadeAposentadoria: apo.idade_aposentadoria ?? 60,
      expectativaVida: apo.expectativa_vida ?? 90,
      events: [],
    });
    setEventos((evR.data as EventoRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const lifeEvents: LifeEvent[] = useMemo(
    () =>
      eventos.map((e) => ({
        id: e.id,
        name: e.name,
        emoji: e.emoji,
        year: e.ano,
        impactValue: Number(e.impacto_valor) || 0,
        monthlyImpact: Number(e.impacto_mensal) || 0,
        durationMonths: Number(e.duracao_meses) || 0,
        type: e.tipo as LifeEvent["type"],
      })),
    [eventos]
  );

  const { chartData, comEventos, semEventos } = useMemo(() => {
    if (!inputs) return { chartData: [], comEventos: null, semEventos: null };
    const base = runLifeProjection({ ...inputs, events: [] });
    const withEv = runLifeProjection({ ...inputs, events: lifeEvents });
    const data = base.series.map((p, i) => ({
      year: p.year,
      age: p.age,
      "Sem eventos": p.patrimonio,
      "Com eventos": withEv.series[i]?.patrimonio ?? p.patrimonio,
      events: withEv.series[i]?.events ?? [],
    }));
    return { chartData: data, comEventos: withEv, semEventos: base };
  }, [inputs, lifeEvents]);

  const anoAtual = new Date().getFullYear();

  const addEvento = async (tplIdx: number) => {
    const tpl = EVENT_TEMPLATES[tplIdx];
    const { data, error } = await supabase
      .from("client_eventos")
      .insert({
        client_id: clientId,
        name: tpl.name,
        emoji: tpl.emoji,
        tipo: tpl.type,
        ano: anoAtual + 1,
        impacto_valor: tpl.impactValue,
        impacto_mensal: tpl.monthlyImpact ?? 0,
        duracao_meses: tpl.durationMonths ?? 0,
      })
      .select("*")
      .single();
    if (error) {
      toast.error("Erro ao adicionar", { description: error.message });
      return;
    }
    setEventos((e) => [...e, data as EventoRow]);
  };

  const updateEvento = async (id: string, patch: Partial<EventoRow>) => {
    setEventos((e) => e.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)));
    await supabase.from("client_eventos").update(patch).eq("id", id);
  };

  const delEvento = async (id: string) => {
    setEventos((e) => e.filter((ev) => ev.id !== id));
    await supabase.from("client_eventos").delete().eq("id", id);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {comEventos && semEventos && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Kpi label="Patrimônio na aposentadoria" valor={comEventos.patrimonioAposentadoria} />
          <Kpi label={`Patrimônio aos ${inputs!.expectativaVida}`} valor={comEventos.patrimonioFinal} />
          <Kpi
            label="Impacto dos eventos (final)"
            valor={comEventos.patrimonioFinal - semEventos.patrimonioFinal}
            destaque
          />
        </div>
      )}

      {/* Gráfico */}
      <Card className="rounded-2xl">
        <CardContent className="py-5">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Mountain className="h-4 w-4" /> Vista da Montanha — patrimônio ao longo do tempo
          </h4>
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLshort(Number(v))} width={60} />
                <Tooltip formatter={(v) => fmtBRL(Number(v))} labelFormatter={(l) => `Idade ${l}`} />
                <Legend />
                <Line type="monotone" dataKey="Sem eventos" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="Com eventos" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                {lifeEvents.map((ev) => {
                  const pt = chartData.find((d) => d.year === ev.year);
                  if (!pt) return null;
                  return (
                    <ReferenceDot
                      key={ev.id}
                      x={pt.age}
                      y={pt["Com eventos"]}
                      r={5}
                      fill="hsl(var(--accent))"
                      stroke="white"
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Linha tracejada = trajetória sem eventos. Linha verde = com os eventos abaixo.
            Os pontos marcam os anos dos eventos.
          </p>
        </CardContent>
      </Card>

      {/* Editor de eventos */}
      <Card className="rounded-2xl">
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold">Eventos de vida</h4>
              <p className="text-xs text-muted-foreground">
                Adicione eventos e veja o impacto recalcular na hora.
              </p>
            </div>
            <AddEvento onAdd={addEvento} />
          </div>

          {eventos.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">Nenhum evento ainda.</p>
          )}

          <div className="space-y-2">
            {eventos.map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                <span className="text-lg">{ev.emoji}</span>
                <Input
                  className="h-9 w-40"
                  value={ev.name}
                  onChange={(e) => setEventos((x) => x.map((y) => (y.id === ev.id ? { ...y, name: e.target.value } : y)))}
                  onBlur={(e) => updateEvento(ev.id, { name: e.target.value })}
                />
                <LabeledNum label="Ano" value={ev.ano} onCommit={(v) => updateEvento(ev.id, { ano: v })} w="w-24" />
                <div className="w-36">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground">Valor (R$)</span>
                  <MoneyInput value={ev.impacto_valor} onCommit={(v) => updateEvento(ev.id, { impacto_valor: v })} />
                </div>
                <div className="w-36">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground">Mensal (R$)</span>
                  <MoneyInput value={ev.impacto_mensal} onCommit={(v) => updateEvento(ev.id, { impacto_mensal: v })} />
                </div>
                <LabeledNum label="Meses" value={ev.duracao_meses} onCommit={(v) => updateEvento(ev.id, { duracao_meses: v })} w="w-20" />
                <button onClick={() => delEvento(ev.id)} className="ml-auto">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${destaque ? "border-primary/30 bg-primary/5" : "bg-muted/20"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-bold ${destaque && valor < 0 ? "text-destructive" : ""}`}>
        {destaque && valor > 0 ? "+" : ""}
        {fmtBRL(valor)}
      </p>
    </div>
  );
}

function LabeledNum({
  label,
  value,
  onCommit,
  w = "w-28",
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  w?: string;
}) {
  const [local, setLocal] = useState(value ? String(value) : "");
  useEffect(() => setLocal(value ? String(value) : ""), [value]);
  return (
    <div className={w}>
      <span className="mb-0.5 block text-[10px] text-muted-foreground">{label}</span>
      <Input
        className="h-9"
        type="number"
        placeholder="0"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onCommit(local === "" ? 0 : Number(local))}
      />
    </div>
  );
}

function AddEvento({ onAdd }: { onAdd: (idx: number) => void }) {
  return (
    <Select onValueChange={(v) => onAdd(Number(v))}>
      <SelectTrigger className="h-9 w-48">
        <SelectValue placeholder="+ Adicionar evento" />
      </SelectTrigger>
      <SelectContent>
        {EVENT_TEMPLATES.map((t, i) => (
          <SelectItem key={i} value={String(i)}>
            {t.emoji} {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
