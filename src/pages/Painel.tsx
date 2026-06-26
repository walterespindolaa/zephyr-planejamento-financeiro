import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/useTeam";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtBRL } from "@/lib/cenarios";
import { Users, FileText, Handshake, CheckCircle2, CalendarClock, TrendingUp, CalendarRange } from "lucide-react";
import {
  subDays, subMonths, startOfMonth, endOfMonth, startOfYear,
} from "date-fns";

const PERIODOS = [
  { v: "7d", l: "Últimos 7 dias" },
  { v: "15d", l: "Últimos 15 dias" },
  { v: "30d", l: "Últimos 30 dias" },
  { v: "mes", l: "Este mês" },
  { v: "mes_passado", l: "Mês passado" },
  { v: "3m", l: "3 meses" },
  { v: "6m", l: "6 meses" },
  { v: "12m", l: "12 meses" },
  { v: "ano", l: "Este ano" },
  { v: "inicio", l: "Desde o início" },
  { v: "personalizado", l: "Personalizado" },
];

function calcRange(p: string, cFrom: string, cTo: string): { from: Date | null; to: Date } {
  const now = new Date();
  switch (p) {
    case "7d": return { from: subDays(now, 7), to: now };
    case "15d": return { from: subDays(now, 15), to: now };
    case "30d": return { from: subDays(now, 30), to: now };
    case "mes": return { from: startOfMonth(now), to: now };
    case "mes_passado": { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    case "3m": return { from: subMonths(now, 3), to: now };
    case "6m": return { from: subMonths(now, 6), to: now };
    case "12m": return { from: subMonths(now, 12), to: now };
    case "ano": return { from: startOfYear(now), to: now };
    case "personalizado":
      return { from: cFrom ? new Date(cFrom + "T00:00:00") : null, to: cTo ? new Date(cTo + "T23:59:59") : now };
    default: return { from: null, to: now }; // início
  }
}

const TIPO_LABEL: Record<string, string> = {
  consorcio: "Consórcio", seguro: "Seguro", carta_credito: "Carta de crédito",
  offshore: "Off-shore", previdencia: "Previdência", investimento: "Investimento",
  reuniao: "Reunião", revisao: "Revisão", outro: "Outro",
};
const ABERTAS = ["pendente", "agendado", "feito"];

/** Se o "nome" vier como e-mail, formata a partir do trecho antes do @. */
function prettyName(n?: string | null): string {
  if (!n) return "Sem assessor";
  if (!n.includes("@")) return n;
  return n
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Painel() {
  const { data: team = [] } = useTeam();
  const nameById = useMemo(() => Object.fromEntries(team.map((t) => [t.user_id, t.full_name])), [team]);
  const [periodo, setPeriodo] = useState("mes");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const range = useMemo(() => calcRange(periodo, cFrom, cTo), [periodo, cFrom, cTo]);

  const { data } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const [cli, rep, acomp, tasks, notes] = await Promise.all([
        supabase.from("clients").select("id, status, assessor_id"),
        supabase.from("client_reports").select("client_id, created_at"),
        supabase.from("client_acompanhamentos").select("tipo, status, valor, client_id, created_at"),
        supabase.from("client_tasks").select("done, due_date, created_at"),
        supabase.from("client_notes").select("tipo, created_at"),
      ]);
      return {
        clients: (cli.data as any[]) || [],
        reports: (rep.data as any[]) || [],
        acomp: (acomp.data as any[]) || [],
        tasks: (tasks.data as any[]) || [],
        notes: (notes.data as any[]) || [],
      };
    },
  });

  const agg = useMemo(() => {
    if (!data) return null;
    const inRange = (d: string | null) => {
      if (!d) return false;
      const t = new Date(d);
      return (!range.from || t >= range.from) && t <= range.to;
    };
    const reports = data.reports.filter((r) => inRange(r.created_at));
    const acompAll = data.acomp.filter((a) => inRange(a.created_at));
    const tasks = data.tasks.filter((t) => inRange(t.created_at));
    const notes = data.notes.filter((n) => inRange(n.created_at));

    const clientAssessor: Record<string, string> = {};
    data.clients.forEach((c) => (clientAssessor[c.id] = c.assessor_id || "—"));
    const ativos = data.clients.filter((c) => c.status === "ativo").length;
    const leads = data.clients.filter((c) => c.status === "lead").length;

    const abertas = acompAll.filter((a) => ABERTAS.includes(a.status));
    const fechadas = acompAll.filter((a) => a.status === "executado");
    const valorMesa = abertas.reduce((s, a) => s + Number(a.valor || 0), 0);
    const valorFechado = fechadas.reduce((s, a) => s + Number(a.valor || 0), 0);

    const porTipo: Record<string, { n: number; valor: number }> = {};
    acompAll.forEach((a) => {
      const k = a.tipo || "outro";
      porTipo[k] = porTipo[k] || { n: 0, valor: 0 };
      porTipo[k].n++;
      porTipo[k].valor += Number(a.valor || 0);
    });

    const reunioesPorTipo: Record<string, number> = {};
    notes.forEach((n) => {
      reunioesPorTipo[n.tipo] = (reunioesPorTipo[n.tipo] || 0) + 1;
    });

    // por assessor
    const repByClient: Record<string, number> = {};
    reports.forEach((r) => (repByClient[r.client_id] = (repByClient[r.client_id] || 0) + 1));
    const porAssessor: Record<string, { clientes: number; planejamentos: number; oport: number; valorMesa: number }> = {};
    data.clients.forEach((c) => {
      const a = c.assessor_id || "—";
      porAssessor[a] = porAssessor[a] || { clientes: 0, planejamentos: 0, oport: 0, valorMesa: 0 };
      porAssessor[a].clientes++;
      porAssessor[a].planejamentos += repByClient[c.id] || 0;
    });
    acompAll.forEach((a) => {
      const ass = clientAssessor[a.client_id] || "—";
      porAssessor[ass] = porAssessor[ass] || { clientes: 0, planejamentos: 0, oport: 0, valorMesa: 0 };
      porAssessor[ass].oport++;
      if (ABERTAS.includes(a.status)) porAssessor[ass].valorMesa += Number(a.valor || 0);
    });

    const pendentes = tasks.filter((t) => !t.done).length;
    const atrasadas = tasks.filter((t) => !t.done && t.due_date && new Date(t.due_date) < new Date()).length;

    return {
      totalClientes: data.clients.length, ativos, leads,
      planejamentos: reports.length,
      oportAbertas: abertas.length, valorMesa, oportFechadas: fechadas.length, valorFechado,
      porTipo, reunioesPorTipo, porAssessor, pendentes, atrasadas,
    };
  }, [data, range]);

  if (!agg) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da operação de planejamento.</p>
        </div>
        <div className="flex items-center gap-2">
          {periodo === "personalizado" && (
            <>
              <Input type="date" className="h-9 w-36" value={cFrom} onChange={(e) => setCFrom(e.target.value)} />
              <span className="text-muted-foreground">→</span>
              <Input type="date" className="h-9 w-36" value={cTo} onChange={(e) => setCTo(e.target.value)} />
            </>
          )}
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-9 w-44">
              <CalendarRange className="mr-1.5 h-4 w-4 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={Users} label="Clientes" value={String(agg.totalClientes)} sub={`${agg.ativos} ativos · ${agg.leads} leads`} to="/" />
        <Kpi icon={FileText} label="Planejamentos" value={String(agg.planejamentos)} to="/" />
        <Kpi icon={Handshake} label="Oport. na mesa" value={String(agg.oportAbertas)} sub={fmtBRL(agg.valorMesa)} accent to="/acompanhamentos" />
        <Kpi icon={CheckCircle2} label="Oport. fechadas" value={String(agg.oportFechadas)} sub={fmtBRL(agg.valorFechado)} to="/acompanhamentos" />
        <Kpi icon={CalendarClock} label="Atividades" value={String(agg.pendentes)} sub={`${agg.atrasadas} atrasadas`} to="/atividades" />
        <Kpi icon={TrendingUp} label="Reuniões" value={String(agg.reunioesPorTipo["reuniao"] || 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Por assessor */}
        <Card>
          <CardContent className="py-5">
            <h3 className="mb-3 font-semibold">Por assessor</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <td className="pb-2">Assessor</td>
                  <td className="pb-2 text-right">Clientes</td>
                  <td className="pb-2 text-right">Planej.</td>
                  <td className="pb-2 text-right">Oport.</td>
                  <td className="pb-2 text-right">Na mesa</td>
                </tr>
              </thead>
              <tbody>
                {Object.entries(agg.porAssessor)
                  .sort((a, b) => b[1].clientes - a[1].clientes)
                  .map(([id, v]) => (
                    <tr key={id} className="border-t">
                      <td className="py-1.5">{id === "—" ? "Sem assessor" : prettyName(nameById[id])}</td>
                      <td className="py-1.5 text-right">{v.clientes}</td>
                      <td className="py-1.5 text-right">{v.planejamentos}</td>
                      <td className="py-1.5 text-right">{v.oport}</td>
                      <td className="py-1.5 text-right font-medium">{fmtBRL(v.valorMesa)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Oportunidades por tipo */}
        <Card>
          <CardContent className="py-5">
            <h3 className="mb-3 font-semibold">Oportunidades por tipo</h3>
            <div className="space-y-2">
              {Object.entries(agg.porTipo)
                .sort((a, b) => b[1].valor - a[1].valor)
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{TIPO_LABEL[k] || k}</span>
                    <span className="text-muted-foreground">
                      {v.n} · <span className="font-medium text-foreground">{fmtBRL(v.valor)}</span>
                    </span>
                  </div>
                ))}
              {Object.keys(agg.porTipo).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma oportunidade cadastrada.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent, to }: { icon: any; label: string; value: string; sub?: string; accent?: boolean; to?: string }) {
  const inner = (
    <Card className={`${accent ? "border-primary/30 bg-primary/5" : ""} ${to ? "cursor-pointer transition-colors hover:border-primary/40" : ""}`}>
      <CardContent className="py-4">
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
