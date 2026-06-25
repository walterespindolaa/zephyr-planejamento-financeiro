import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/useTeam";
import type { Client } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { fmtBRL } from "@/lib/cenarios";
import { useMemo } from "react";

export default function ClienteVisaoGeral({ client }: { client: Client }) {
  const { data: team = [] } = useTeam();
  const nameById = useMemo(() => Object.fromEntries(team.map((t) => [t.user_id, t.full_name])), [team]);

  const { data } = useQuery({
    queryKey: ["visao-geral", client.id],
    queryFn: async () => {
      const [inv, bens, obj, ev, rel, acomp] = await Promise.all([
        supabase.from("client_investimentos").select("valor_atual").eq("client_id", client.id),
        supabase.from("client_bens").select("valor, divida_vinculada").eq("client_id", client.id),
        supabase.from("client_objetivos").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("client_eventos").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("client_reports").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("client_acompanhamentos").select("id", { count: "exact", head: true }).eq("client_id", client.id),
      ]);
      const patFin = (inv.data || []).reduce((s, i: any) => s + Number(i.valor_atual || 0), 0);
      const patBens = (bens.data || []).reduce((s, b: any) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0);
      return {
        patFin,
        patBens,
        patTotal: patFin + patBens,
        nObj: obj.count ?? 0,
        nEv: ev.count ?? 0,
        nRel: rel.count ?? 0,
        nAcomp: acomp.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Patrimônio total" value={fmtBRL(data?.patTotal ?? 0)} accent />
        <Kpi label="Financeiro" value={fmtBRL(data?.patFin ?? 0)} />
        <Kpi label="Bens (líquido)" value={fmtBRL(data?.patBens ?? 0)} />
      </div>

      <Card>
        <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
          <Info label="E-mail" value={client.email || "—"} />
          <Info label="Telefone" value={client.telefone || "—"} />
          <Info label="Profissão" value={client.profissao || "—"} />
          <Info label="Estado civil" value={client.estado_civil || "—"} />
          <Info label="Assessor" value={client.assessor_id ? nameById[client.assessor_id] ?? "—" : "—"} />
          <Info label="Planejadora" value={client.planejadora_id ? nameById[client.planejadora_id] ?? "—" : "—"} />
          <Info label="Origem" value={client.origem || "—"} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label="Objetivos" n={data?.nObj ?? 0} />
        <Count label="Eventos de vida" n={data?.nEv ?? 0} />
        <Count label="Relatórios" n={data?.nRel ?? 0} />
        <Count label="Acompanhamentos" n={data?.nAcomp ?? 0} />
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
function Count({ label, n }: { label: string; n: number }) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-2xl font-bold">{n}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
