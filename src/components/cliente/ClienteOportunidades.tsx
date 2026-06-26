import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import MoneyInput from "@/components/common/MoneyInput";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import TabHint from "./TabHint";
import InclusoesRelatorio from "./InclusoesRelatorio";

interface Op {
  id: string;
  tipo: string;
  titulo: string | null;
  responsavel_id: string | null;
  status: string;
  data_evento: string | null;
  valor: number | null;
  incluir_relatorio: boolean;
}

const TIPOS = [
  { v: "consorcio", l: "Consórcio" },
  { v: "seguro", l: "Seguro de vida" },
  { v: "carta_credito", l: "Carta de crédito" },
  { v: "offshore", l: "Off-shore" },
  { v: "previdencia", l: "Previdência" },
  { v: "investimento", l: "Investimento" },
  { v: "reuniao", l: "Reunião" },
  { v: "outro", l: "Outro" },
];
const STATUS = ["pendente", "agendado", "feito", "executado", "cancelado"];
const tipoL = (v: string) => TIPOS.find((t) => t.v === v)?.l ?? v;

export default function ClienteOportunidades({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const { data: team = [] } = useTeam();
  const advisors = team.filter((t) => t.role === "assessor" || t.role === "admin");
  const [ops, setOps] = useState<Op[]>([]);
  const [tipo, setTipo] = useState("consorcio");
  const [titulo, setTitulo] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("client_acompanhamentos")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setOps((data as Op[]) || []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const add = async () => {
    const { data, error } = await supabase
      .from("client_acompanhamentos")
      .insert({ client_id: clientId, tipo, titulo: titulo || null, created_by: user?.id ?? null })
      .select("*")
      .single();
    if (error) return toast.error("Erro", { description: error.message });
    setOps((o) => [data as Op, ...o]);
    setTitulo("");
  };
  const patch = async (id: string, p: Partial<Op>) => {
    setOps((o) => o.map((x) => (x.id === id ? { ...x, ...p } : x)));
    await supabase.from("client_acompanhamentos").update(p).eq("id", id);
  };
  const del = async (id: string) => {
    setOps((o) => o.filter((x) => x.id !== id));
    await supabase.from("client_acompanhamentos").delete().eq("id", id);
  };

  return (
    <div className="space-y-4">
      <TabHint>
        Mapeie <strong>oportunidades</strong> (consórcio, seguro, carta de crédito, off-shore…) e
        configure as <strong>inclusões do relatório</strong> (Proteção Patrimonial e Próximos
        Passos). O que estiver marcado "no relatório" entra como recomendação para o cliente.
      </TabHint>
      <InclusoesRelatorio clientId={clientId} />
      <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h3 className="font-semibold">Oportunidades</h3>
          <p className="text-xs text-muted-foreground">
            Consórcios, seguros, cartas de crédito, off-shore, previdência… Marque "no relatório"
            para entrar como Próximos Passos do cliente.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-9 flex-1 min-w-[180px]"
            placeholder="Título / observação (ex.: Consórcio imóvel R$ 500k)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button size="sm" onClick={add}><Plus className="mr-1.5 h-4 w-4" /> Adicionar</Button>
        </div>

        {ops.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhuma oportunidade ainda.</p>}

        <div className="space-y-2">
          {ops.map((o) => (
            <div key={o.id} className="rounded-lg border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{tipoL(o.tipo)}</span>
                <Input
                  className="h-8 flex-1 min-w-[160px]"
                  value={o.titulo ?? ""}
                  onChange={(e) => setOps((x) => x.map((y) => (y.id === o.id ? { ...y, titulo: e.target.value } : y)))}
                  onBlur={(e) => patch(o.id, { titulo: e.target.value })}
                />
                <button onClick={() => patch(o.id, { status: "executado" })} title="Marcar executado">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground hover:text-success" />
                </button>
                <button onClick={() => del(o.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-40">
                  <span className="text-[10px] text-muted-foreground">Valor</span>
                  <MoneyInput value={Number(o.valor) || 0} onCommit={(v) => patch(o.id, { valor: v })} />
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">Responsável</span>
                  <Select value={o.responsavel_id ?? ""} onValueChange={(v) => patch(o.id, { responsavel_id: v })}>
                    <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {advisors.map((a) => (
                        <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">Data</span>
                  <Input type="date" className="h-9 w-36" value={o.data_evento ?? ""} onChange={(e) => patch(o.id, { data_evento: e.target.value || null })} />
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">Status</span>
                  <Select value={o.status} onValueChange={(v) => patch(o.id, { status: v })}>
                    <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="ml-auto flex items-center gap-2 text-xs">
                  <Switch checked={o.incluir_relatorio} onCheckedChange={(c) => patch(o.id, { incluir_relatorio: c })} />
                  No relatório
                </label>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
