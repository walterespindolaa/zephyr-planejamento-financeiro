import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Users } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useTeam } from "@/hooks/useTeam";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_LABEL, type ClientStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<ClientStatus, string> = {
  lead: "bg-warning/15 text-warning-foreground border-warning/30",
  ativo: "bg-success/15 text-success border-success/30",
  inativo: "bg-muted text-muted-foreground border-border",
  arquivado: "bg-muted text-muted-foreground border-border",
};

export default function Dashboard() {
  const { role } = useAuth();
  const { data: clients = [], isLoading } = useClients();
  const { data: team = [] } = useTeam();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | ClientStatus>("todos");

  const nameById = useMemo(
    () => Object.fromEntries(team.map((t) => [t.user_id, t.full_name])),
    [team]
  );

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchQ = c.nome.toLowerCase().includes(q.toLowerCase());
      const matchF = filter === "todos" || c.status === filter;
      return matchQ && matchF;
    });
  }, [clients, q, filter]);

  const counts = useMemo(() => {
    const total = clients.length;
    const leads = clients.filter((c) => c.status === "lead").length;
    const ativos = clients.filter((c) => c.status === "ativo").length;
    return { total, leads, ativos };
  }, [clients]);

  return (
    <div className="mx-auto max-w-screen-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {role === "assessor"
              ? "Seus clientes vinculados"
              : "Todos os clientes e leads da Zephyr"}
          </p>
        </div>
        <Button asChild>
          <Link to="/clientes/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Novo cliente
          </Link>
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Leads" value={counts.leads} />
        <StatCard label="Ativos" value={counts.ativos} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        {(["todos", "lead", "ativo", "inativo"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f as ClientStatus]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">Nenhum cliente ainda</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Cadastre o primeiro cliente ou lead.
            </p>
            <Button asChild>
              <Link to="/clientes/novo">
                <Plus className="mr-1.5 h-4 w-4" /> Novo cliente
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link key={c.id} to={`/clientes/${c.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                      {c.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.assessor_id
                          ? `Assessor: ${nameById[c.assessor_id] ?? "—"}`
                          : "Sem assessor"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={STATUS_STYLES[c.status]}>
                    {STATUS_LABEL[c.status]}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
