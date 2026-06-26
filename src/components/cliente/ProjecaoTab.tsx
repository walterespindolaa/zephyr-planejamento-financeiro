import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  runLifeProjection,
  EVENT_TEMPLATES,
  type LifeEvent,
  type ProjectionInputs,
} from "@/lib/financial_engine/life_projection";
import { fmtBRL, fmtBRLshort } from "@/lib/cenarios";
import MoneyInput from "@/components/common/MoneyInput";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import { Trash2, Mountain, Landmark, Target, TrendingUp, MapPin } from "lucide-react";
import { toast } from "sonner";

interface EventoRow {
  id: string; name: string; emoji: string; ano: number; tipo: string;
  impacto_valor: number; impacto_mensal: number; duracao_meses: number;
}

export default function ProjecaoTab({ clientId }: { clientId: string }) {
  const [inputs, setInputs] = useState<Omit<ProjectionInputs, "events"> | null>(null);
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
    const receita = Math.round(mensal(recR.data, (r) => Number(r.valor)));
    const despesa = Math.round(mensal(despR.data, (d) => Number(d.valor)));
    setInputs({
      patrimonioInicial: sum(invR.data, (i) => Number(i.valor_atual)) + sum(bensR.data, (b) => Number(b.valor) - Number(b.divida_vinculada || 0)),
      rendaMensal: receita,
      poupancaMensal: Math.max(0, receita - despesa), // capacidade real de poupança
      taxaRetornoAnual: Number(apo.taxa_retorno_anual ?? 0.06),
      inflacaoAnual: Number(apo.inflacao_anual ?? 0.04),
      idadeAtual: apo.idade_atual ?? 35,
      idadeAposentadoria: apo.idade_aposentadoria ?? 60,
      expectativaVida: apo.expectativa_vida ?? 90,
    });
    setEventos((evR.data as EventoRow[]) || []);
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const lifeEvents: LifeEvent[] = useMemo(
    () => eventos.map((e) => ({
      id: e.id, name: e.name, emoji: e.emoji, year: e.ano,
      impactValue: Number(e.impacto_valor) || 0, monthlyImpact: Number(e.impacto_mensal) || 0,
      durationMonths: Number(e.duracao_meses) || 0, type: e.tipo as LifeEvent["type"],
    })),
    [eventos]
  );

  const result = useMemo(
    () => (inputs ? runLifeProjection({ ...inputs, events: lifeEvents }) : null),
    [inputs, lifeEvents]
  );

  const setVar = (k: keyof Omit<ProjectionInputs, "events">, v: number) =>
    setInputs((p) => (p ? { ...p, [k]: v } : p));

  const anoAtual = new Date().getFullYear();
  const addEvento = async (idx: number) => {
    const tpl = EVENT_TEMPLATES[idx];
    const { data, error } = await supabase.from("client_eventos").insert({
      client_id: clientId, name: tpl.name, emoji: tpl.emoji, tipo: tpl.type, ano: anoAtual + 1,
      impacto_valor: tpl.impactValue, impacto_mensal: tpl.monthlyImpact ?? 0, duracao_meses: tpl.durationMonths ?? 0,
    }).select("*").single();
    if (error) return toast.error("Erro ao adicionar", { description: error.message });
    setEventos((e) => [...e, data as EventoRow]);
  };
  const updEvento = async (id: string, patch: Partial<EventoRow>) => {
    setEventos((e) => e.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)));
    await supabase.from("client_eventos").update(patch).eq("id", id);
  };
  const delEvento = async (id: string) => {
    setEventos((e) => e.filter((ev) => ev.id !== id));
    await supabase.from("client_eventos").delete().eq("id", id);
  };
  const limparEventos = async () => {
    await supabase.from("client_eventos").delete().eq("client_id", clientId);
    setEventos([]);
    toast.success("Eventos limpos");
  };

  if (loading || !inputs || !result) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Landmark} label="Patrimônio atual" value={fmtBRL(inputs.patrimonioInicial)} />
        <Kpi icon={Target} label="Na aposentadoria" value={fmtBRL(result.patrimonioAposentadoria)} accent />
        <Kpi icon={TrendingUp} label="Consumo na aposent." value={`${fmtBRL(result.rendaPassivaAposentadoria)}/mês`} />
        <Kpi icon={MapPin} label={`Patrimônio aos ${inputs.expectativaVida}`} value={fmtBRL(result.patrimonioFinal)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Variáveis de simulação */}
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 py-5">
            <div>
              <h4 className="text-sm font-bold">Variáveis de Simulação</h4>
              <p className="text-[11px] text-muted-foreground">
                Alterações aqui são simulação — não afetam o planejamento salvo.
              </p>
            </div>
            <Num label="Idade atual" value={inputs.idadeAtual} onChange={(v) => setVar("idadeAtual", v)} />
            <Num label="Aposentadoria" value={inputs.idadeAposentadoria} onChange={(v) => setVar("idadeAposentadoria", v)} />
            <Num label="Expectativa de vida" value={inputs.expectativaVida ?? 90} onChange={(v) => setVar("expectativaVida", v)} />
            <Money label="Patrimônio inicial" value={inputs.patrimonioInicial} onChange={(v) => setVar("patrimonioInicial", v)} />
            <Money label="Renda mensal" value={inputs.rendaMensal} onChange={(v) => setVar("rendaMensal", v)} />
            <Money label="Poupança mensal" value={inputs.poupancaMensal} onChange={(v) => setVar("poupancaMensal", v)} />
            <Pct label="Retorno anual" value={inputs.taxaRetornoAnual} onChange={(v) => setVar("taxaRetornoAnual", v)} />
            <Pct label="Inflação anual" value={inputs.inflacaoAnual} onChange={(v) => setVar("inflacaoAnual", v)} />
          </CardContent>
        </Card>

        {/* Gráfico */}
        <Card className="lg:col-span-2">
          <CardContent className="py-5">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Mountain className="h-4 w-4 text-primary" /> Vista da Montanha
            </h4>
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="patGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLshort(Number(v))} width={62} />
                  <Tooltip
                    formatter={(v) => fmtBRL(Number(v))}
                    labelFormatter={(l) => `Idade ${l}`}
                  />
                  <Area type="monotone" dataKey="patrimonio" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#patGrad)" />
                  {lifeEvents.map((ev) => {
                    const pt = result.series.find((d) => d.year === ev.year);
                    if (!pt) return null;
                    return <ReferenceDot key={ev.id} x={pt.age} y={pt.patrimonio} r={5} fill="hsl(var(--accent))" stroke="white" />;
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Patrimônio projetado ao longo da vida. Os pontos marcam os eventos abaixo.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Eventos */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold">Eventos de vida</h4>
              <p className="text-xs text-muted-foreground">Adicione eventos e veja o impacto recalcular na hora.</p>
            </div>
            <div className="flex gap-2">
              {eventos.length > 0 && (
                <Button variant="outline" size="sm" onClick={limparEventos}>Limpar eventos</Button>
              )}
              <Select onValueChange={(v) => addEvento(Number(v))}>
                <SelectTrigger className="h-9 w-48"><SelectValue placeholder="+ Adicionar evento" /></SelectTrigger>
                <SelectContent>
                  {EVENT_TEMPLATES.map((t, i) => (
                    <SelectItem key={i} value={String(i)}>{t.emoji} {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {eventos.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum evento ainda.</p>}
          <div className="space-y-2">
            {eventos.map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                <span className="text-lg">{ev.emoji}</span>
                <Input
                  className="h-9 w-40"
                  value={ev.name}
                  onChange={(e) => setEventos((x) => x.map((y) => (y.id === ev.id ? { ...y, name: e.target.value } : y)))}
                  onBlur={(e) => updEvento(ev.id, { name: e.target.value })}
                />
                <div className="w-24">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground">Ano</span>
                  <Input className="h-9" type="number" value={ev.ano}
                    onChange={(e) => setEventos((x) => x.map((y) => (y.id === ev.id ? { ...y, ano: Number(e.target.value) } : y)))}
                    onBlur={(e) => updEvento(ev.id, { ano: Number(e.target.value) })} />
                </div>
                <div className="w-36">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground">Valor (R$)</span>
                  <MoneyInput value={ev.impacto_valor} onCommit={(v) => updEvento(ev.id, { impacto_valor: v })} />
                </div>
                <div className="w-36">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground">Mensal (R$)</span>
                  <MoneyInput value={ev.impacto_mensal} onCommit={(v) => updEvento(ev.id, { impacto_mensal: v })} />
                </div>
                <div className="w-20">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground">Meses</span>
                  <Input className="h-9" type="number" placeholder="0" value={ev.duracao_meses || ""}
                    onChange={(e) => setEventos((x) => x.map((y) => (y.id === ev.id ? { ...y, duracao_meses: Number(e.target.value) } : y)))}
                    onBlur={(e) => updEvento(ev.id, { duracao_meses: Number(e.target.value) })} />
                </div>
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

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="flex items-center gap-3 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" className="h-9" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
function Money({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <MoneyInput value={value} onCommit={onChange} />
    </div>
  );
}
function Pct({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  // value é decimal (0.06); exibe em %
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label} (%)</Label>
      <Input
        type="number"
        step="0.1"
        className="h-9"
        value={Number((value * 100).toFixed(2))}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </div>
  );
}
