import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ExternalLink, CalendarClock } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";

interface Task {
  id: string;
  client_id: string;
  title: string;
  done: boolean;
  due_date: string | null;
}

export default function Atividades() {
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.nome])), [clients]);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"pendentes" | "feitas" | "todas">("pendentes");

  const { data: tasks = [] } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data } = await supabase
        .from("client_tasks")
        .select("id, client_id, title, done, due_date")
        .order("due_date", { ascending: true, nullsFirst: false });
      return (data as Task[]) ?? [];
    },
  });

  const toggle = async (t: Task) => {
    qc.setQueryData<Task[]>(["all-tasks"], (old) => (old ?? []).map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await supabase.from("client_tasks").update({ done: !t.done }).eq("id", t.id);
  };

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (filtro === "pendentes" && t.done) return false;
        if (filtro === "feitas" && !t.done) return false;
        if (q && !(clientById[t.client_id] ?? "").toLowerCase().includes(q.toLowerCase()) && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [tasks, filtro, q, clientById]
  );

  const pendentes = tasks.filter((t) => !t.done).length;
  const atrasadas = tasks.filter((t) => !t.done && t.due_date && isBefore(new Date(t.due_date), startOfDay(new Date()))).length;

  return (
    <div className="mx-auto max-w-screen-2xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Atividades</h1>
        <p className="text-sm text-muted-foreground">
          Todas as pendências para as próximas reuniões, de todos os clientes.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Pendentes" value={pendentes} />
        <Stat label="Atrasadas" value={atrasadas} />
        <Stat label="Total" value={tasks.length} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cliente ou tarefa…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        {(["pendentes", "feitas", "todas"] as const).map((f) => (
          <Button key={f} variant={filtro === f ? "default" : "outline"} size="sm" onClick={() => setFiltro(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Nenhuma atividade com esses filtros.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const atrasada = !t.done && t.due_date && isBefore(new Date(t.due_date), startOfDay(new Date()));
            return (
              <Card key={t.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} />
                  <span className={`flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
                  <Link to={`/clientes/${t.client_id}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    {clientById[t.client_id] ?? "Cliente"} <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                  {t.due_date && (
                    <span className={`flex items-center gap-1 text-xs ${atrasada ? "text-destructive" : "text-muted-foreground"}`}>
                      <CalendarClock className="h-3.5 w-3.5" /> {format(new Date(t.due_date), "dd/MM/yy")}
                    </span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
