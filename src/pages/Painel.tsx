import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/useTeam";
import { Card, CardContent } from "@/components/ui/card";
import { fmtBRL } from "@/lib/cenarios";
import { Users, FileText, Handshake, CheckCircle2, CalendarClock, TrendingUp } from "lucide-react";

const TIPO_LABEL: Record<string, string> = {
  consorcio: "Consórcio", seguro: "Seguro", carta_credito: "Carta de crédito",
  offshore: "Off-shore", previdencia: "Previdência", investimento: "Investimento",
  reuniao: "Reunião", revisao: "Revisão", outro: "Outro",
};
const ABERTAS = ["pendente", "agendado", "feito"];

export default function Painel() {
  const { data: team = [] } = useTeam();
  const nameById = useMemo(() => Object.fromEntries(team.map((t) => [t.user_id, t.full_name])), [team]);

  const { data } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const [cli, rep, acomp, tasks, notes] = await Promise.all([
        supabase.from("clients").select("id, status, assessor_id"),
        supabase.from("client_reports").select("client_id"),
        supabase.from("client_acompanhamentos").select("tipo, status, valor, client_id"),
        supabase.from("client_tasks").select("done, due_date"),
        supabase.from("client_notes").select("tipo"),
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
    const clientAssessor: Record<string, string> = {};
    data.clients.forEach((c) => (clientAssessor[c.id] = c.assessor_id || "—"));
    const ativos = data.clients.filter((c) => c.status === "ativo").length;
    const leads = data.clients.filter((c) => c.status === "lead").length;

    const abertas = data.acomp.filter((a) => ABERTAS.includes(a.status));
    const fechadas = data.acomp.filter((a) => a.status === "executado");
    const valorMesa = abertas.reduce((s, a) => s + Number(a.valor || 0), 0);
    const valorFechado = fechadas.reduce((s, a) => s + Number(a.valor || 0), 0);

    const porTipo: Record<string, { n: number; valor: number }> = {};
    data.acomp.forEach((a) => {
      const k = a.tipo || "outro";
      porTipo[k] = porTipo[k] || { n: 0, valor: 0 };
      porTipo[k].n++;
      porTipo[k].valor += Number(a.valor || 0);
    });

    const reunioesPorTipo: Record<string, number> = {};
    data.notes.forEach((n) => {
      reunioesPorTipo[n.tipo] = (reunioesPorTipo[n.tipo] || 0) + 1;
    });

    // por assessor
    const repByClient: Record<string, number> = {};
    data.reports.forEach((r) => (repByClient[r.client_id] = (repByClient[r.client_id] || 0) + 1));
    const porAssessor: Record<string, { clientes: number; planejamentos: number; oport: number; valorMesa: number }> = {};
    data.clients.forEach((c) => {
      const a = c.assessor_id || "—";
      porAssessor[a] = porAssessor[a] || { clientes: 0, planejamentos: 0, oport: 0, valorMesa: 0 };
      porAssessor[a].clientes++;
      porAssessor[a].planejamentos += repByClient[c.id] || 0;
    });
    data.acomp.forEach((a) => {
      const ass = clientAssessor[a.client_id] || "—";
      porAssessor[ass] = porAssessor[ass] || { clientes: 0, planejamentos: 0, oport: 0, valorMesa: 0 };
      porAssessor[ass].oport++;
      if (ABERTAS.includes(a.status)) porAssessor[ass].valorMesa += Number(a.valor || 0);
    });

    const pendentes = data.tasks.filter((t) => !t.done).length;
    const atrasadas = data.tasks.filter((t) => !t.done && t.due_date && new Date(t.due_date) < new Date()).length;

    return {
      totalClientes: data.clients.length, ativos, leads,
      planejamentos: data.reports.length,
      oportAbertas: abertas.length, valorMesa, oportFechadas: fechadas.length, valorFechado,
      porTipo, reunioesPorTipo, porAssessor, pendentes, atrasadas,
    };
  }, [data]);

  if (!agg) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da operação de planejamento.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={Users} label="Clientes" value={String(agg.totalClientes)} sub={`${agg.ativos} ativos · ${agg.leads} leads`} />
        <Kpi icon={FileText} label="Planejamentos" value={String(agg.planejamentos)} />
        <Kpi icon={Handshake} label="Oport. na mesa" value={String(agg.oportAbertas)} sub={fmtBRL(agg.valorMesa)} accent />
        <Kpi icon={CheckCircle2} label="Oport. fechadas" value={String(agg.oportFechadas)} sub={fmtBRL(agg.valorFechado)} />
        <Kpi icon={CalendarClock} label="Atividades" value={String(agg.pendentes)} sub={`${agg.atrasadas} atrasadas`} />
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
                      <td className="py-1.5">{nameById[id] || "Sem assessor"}</td>
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

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
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
}
