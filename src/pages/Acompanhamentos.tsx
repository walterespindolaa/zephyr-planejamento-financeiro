import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClients } from "@/hooks/useClients";
import { useTeam } from "@/hooks/useTeam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Plus, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Acomp {
  id: string;
  client_id: string;
  tipo: string;
  titulo: string | null;
  responsavel_id: string | null;
  status: string;
  data_evento: string | null;
  valor: number | null;
}

const TIPOS = [
  { v: "consorcio", l: "Consórcio" },
  { v: "seguro", l: "Seguro" },
  { v: "previdencia", l: "Previdência" },
  { v: "investimento", l: "Investimento" },
  { v: "reuniao", l: "Reunião" },
  { v: "revisao", l: "Revisão anual" },
  { v: "outro", l: "Outro" },
];
const STATUS = [
  { v: "pendente", l: "Pendente" },
  { v: "agendado", l: "Agendado" },
  { v: "feito", l: "Feito" },
  { v: "executado", l: "Executado" },
  { v: "cancelado", l: "Cancelado" },
];
const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-warning/15 text-warning-foreground border-warning/30",
  agendado: "bg-info/15 text-info border-info/30",
  feito: "bg-primary/10 text-primary border-primary/30",
  executado: "bg-success/15 text-success border-success/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};
const tipoLabel = (v: string) => TIPOS.find((t) => t.v === v)?.l ?? v;

export default function Acompanhamentos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const { data: team = [] } = useTeam();
  const nameById = useMemo(() => Object.fromEntries(team.map((t) => [t.user_id, t.full_name])), [team]);
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.nome])), [clients]);
  const advisors = team.filter((t) => t.role === "assessor" || t.role === "admin");

  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fResp, setFResp] = useState("todos");
  const [fValorMin, setFValorMin] = useState(0);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["acompanhamentos"],
    queryFn: async (): Promise<Acomp[]> => {
      const { data } = await supabase
        .from("client_acompanhamentos")
        .select("*")
        .order("data_evento", { ascending: true, nullsFirst: false });
      return (data as Acomp[]) ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      items.filter((a) => {
        if (fTipo !== "todos" && a.tipo !== fTipo) return false;
        if (fStatus !== "todos" && a.status !== fStatus) return false;
        if (fResp !== "todos" && a.responsavel_id !== fResp) return false;
        if (fValorMin > 0 && Number(a.valor || 0) < fValorMin) return false;
        if (q && !(clientById[a.client_id] ?? "").toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }).sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0)),
    [items, fTipo, fStatus, fResp, fValorMin, q, clientById]
  );

  const counts = useMemo(() => {
    const by = (s: string) => items.filter((a) => a.status === s).length;
    return { pendente: by("pendente"), agendado: by("agendado"), executado: by("executado") };
  }, [items]);

  const patch = async (id: string, p: Partial<Acomp>) => {
    qc.setQueryData<Acomp[]>(["acompanhamentos"], (old) =>
      (old ?? []).map((a) => (a.id === id ? { ...a, ...p } : a))
    );
    await supabase.from("client_acompanhamentos").update(p).eq("id", id);
  };

  const remover = async (id: string) => {
    await supabase.from("client_acompanhamentos").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["acompanhamentos"] });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Acompanhamentos</h1>
          <p className="text-sm text-muted-foreground">
            Consórcios, seguros, reuniões e revisões de toda a base — com filtros e status.
          </p>
        </div>
        <Button onClick={() => setShowAdd((s) => !s)}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo acompanhamento
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Pendentes" value={counts.pendente} />
        <Stat label="Agendados" value={counts.agendado} />
        <Stat label="Executados" value={counts.executado} />
      </div>

      {showAdd && (
        <AddForm
          clients={clients}
          advisors={advisors}
          userId={user?.id}
          onDone={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["acompanhamentos"] });
          }}
        />
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <FilterSelect value={fTipo} onChange={setFTipo} placeholder="Tipo" options={[{ v: "todos", l: "Todos os tipos" }, ...TIPOS]} />
        <FilterSelect value={fStatus} onChange={setFStatus} placeholder="Status" options={[{ v: "todos", l: "Todos status" }, ...STATUS]} />
        <FilterSelect
          value={fResp}
          onChange={setFResp}
          placeholder="Responsável"
          options={[{ v: "todos", l: "Todos responsáveis" }, ...advisors.map((a) => ({ v: a.user_id, l: a.full_name ?? "—" }))]}
        />
        <Input
          type="number"
          className="h-9 w-36"
          placeholder="Valor mín R$"
          value={fValorMin || ""}
          onChange={(e) => setFValorMin(Number(e.target.value) || 0)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum acompanhamento com esses filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <Badge variant="outline" className="shrink-0">{tipoLabel(a.tipo)}</Badge>
                <div className="min-w-[160px] flex-1">
                  <Link to={`/clientes/${a.client_id}`} className="flex items-center gap-1 text-sm font-medium hover:text-primary">
                    {clientById[a.client_id] ?? "Cliente"} <ExternalLink className="h-3 w-3 opacity-50" />
                  </Link>
                  {a.titulo && <p className="text-xs text-muted-foreground">{a.titulo}</p>}
                </div>
                {Number(a.valor) > 0 && (
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {Number(a.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                )}
                <Select value={a.responsavel_id ?? ""} onValueChange={(v) => patch(a.id, { responsavel_id: v })}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {advisors.map((adv) => (
                      <SelectItem key={adv.user_id} value={adv.user_id}>{adv.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  className="h-8 w-36"
                  value={a.data_evento ?? ""}
                  onChange={(e) => patch(a.id, { data_evento: e.target.value || null })}
                />
                <Select value={a.status} onValueChange={(v) => patch(a.id, { status: v })}>
                  <SelectTrigger className={`h-8 w-32 text-xs ${STATUS_STYLE[a.status] ?? ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  title="Marcar como executado"
                  onClick={() => patch(a.id, { status: "executado" })}
                  className="text-muted-foreground hover:text-success"
                >
                  <CheckCircle2 className="h-5 w-5" />
                </button>
                <button title="Remover" onClick={() => remover(a.id)} className="text-muted-foreground hover:text-destructive">
                  ×
                </button>
              </CardContent>
            </Card>
          ))}
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

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddForm({
  clients,
  advisors,
  userId,
  onDone,
}: {
  clients: { id: string; nome: string }[];
  advisors: { user_id: string; full_name: string | null }[];
  userId?: string;
  onDone: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [tipo, setTipo] = useState("consorcio");
  const [titulo, setTitulo] = useState("");
  const [resp, setResp] = useState("");
  const [data, setData] = useState("");
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!clientId) {
      toast.error("Selecione o cliente");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_acompanhamentos").insert({
      client_id: clientId,
      tipo,
      titulo: titulo || null,
      responsavel_id: resp || null,
      data_evento: data || null,
      created_by: userId ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar", { description: error.message });
      return;
    }
    toast.success("Acompanhamento criado");
    onDone();
  };

  return (
    <Card className="mb-4 border-primary/30">
      <CardContent className="space-y-3 py-5">
        <h3 className="text-sm font-semibold">Novo acompanhamento</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Título / observação" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Select value={resp} onValueChange={setResp}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              {advisors.map((a) => (
                <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Criar"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
