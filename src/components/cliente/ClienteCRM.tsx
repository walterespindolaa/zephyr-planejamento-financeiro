import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Client, ClientNote, ClientTask } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Pin, PinOff, Save, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TIPO_LABEL: Record<string, string> = {
  nota: "Nota",
  ligacao: "Ligação",
  reuniao: "Reunião",
  mensagem: "Mensagem",
  atendimento: "Atendimento",
};

export default function ClienteCRM({ client }: { client: Client }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = client.id;

  const [info, setInfo] = useState(client.info ?? "");
  const [origem, setOrigem] = useState(client.origem ?? "");
  const [estadoCivil, setEstadoCivil] = useState(client.estado_civil ?? "");
  const [regime, setRegime] = useState(client.regime_casamento ?? "");
  const [noteText, setNoteText] = useState("");
  const [noteTipo, setNoteTipo] = useState("nota");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const notes = useQuery({
    queryKey: ["notes", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_notes")
        .select("*")
        .eq("client_id", clientId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      return (data as ClientNote[]) ?? [];
    },
  });

  const tasks = useQuery({
    queryKey: ["tasks", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_tasks")
        .select("*")
        .eq("client_id", clientId)
        .order("done")
        .order("due_date", { nullsFirst: false });
      return (data as ClientTask[]) ?? [];
    },
  });

  const saveInfo = async () => {
    await supabase
      .from("clients")
      .update({
        info: info || null,
        origem: origem || null,
        estado_civil: estadoCivil || null,
        regime_casamento: regime || null,
      })
      .eq("id", clientId);
    qc.invalidateQueries({ queryKey: ["client", clientId] });
    toast.success("Informações salvas");
  };

  const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];
  const REGIMES = [
    "Comunhão parcial de bens",
    "Comunhão universal de bens",
    "Separação total de bens",
    "Separação obrigatória de bens",
    "Participação final nos aquestos",
  ];

  const addNote = async () => {
    if (!noteText.trim()) return;
    await supabase.from("client_notes").insert({
      client_id: clientId,
      author_id: user?.id ?? null,
      content: noteText.trim(),
      tipo: noteTipo,
    });
    setNoteText("");
    notes.refetch();
  };

  const togglePin = async (n: ClientNote) => {
    await supabase.from("client_notes").update({ pinned: !n.pinned }).eq("id", n.id);
    notes.refetch();
  };

  const delNote = async (id: string) => {
    await supabase.from("client_notes").delete().eq("id", id);
    notes.refetch();
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    await supabase.from("client_tasks").insert({
      client_id: clientId,
      author_id: user?.id ?? null,
      title: taskTitle.trim(),
      due_date: taskDue || null,
    });
    setTaskTitle("");
    setTaskDue("");
    tasks.refetch();
  };

  const toggleTask = async (t: ClientTask) => {
    await supabase.from("client_tasks").update({ done: !t.done }).eq("id", t.id);
    tasks.refetch();
  };

  const delTask = async (id: string) => {
    await supabase.from("client_tasks").delete().eq("id", id);
    tasks.refetch();
  };

  const copyWhatsapp = () => {
    const pendentes = (tasks.data ?? []).filter((t) => !t.done);
    if (pendentes.length === 0) {
      toast.error("Sem pendências", { description: "Adicione tarefas para gerar a mensagem." });
      return;
    }
    const primeiroNome = client.nome.split(" ")[0];
    const linhas = pendentes.map((t) => `• ${t.title}`).join("\n");
    const msg = `Olá, ${primeiroNome}! Tudo bem?\n\nPara a nossa próxima reunião de planejamento, preciso que você me envie/atualize:\n\n${linhas}\n\nAssim que possível, me encaminhe por aqui. Qualquer dúvida, estou à disposição. Obrigado(a)! 🙌`;
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada", { description: "Cole no WhatsApp do cliente e ajuste o que quiser." });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Coluna esquerda: info + tarefas */}
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 py-5">
            <h3 className="font-semibold">Informações do cliente</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Estado civil</label>
                <Select value={estadoCivil || undefined} onValueChange={setEstadoCivil}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {ESTADO_CIVIL.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Regime de casamento</label>
                <Select value={regime || undefined} onValueChange={setRegime}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Origem</label>
              <Input value={origem} onChange={(e) => setOrigem(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Anotações gerais</label>
              <Textarea
                rows={10}
                value={info}
                onChange={(e) => setInfo(e.target.value)}
                placeholder="Contexto, perfil, preferências, situação familiar…"
              />
            </div>
            <Button size="sm" onClick={saveInfo}>
              <Save className="mr-1.5 h-4 w-4" /> Salvar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Pendências p/ próxima reunião</h3>
              <Button size="sm" variant="outline" onClick={copyWhatsapp}>
                <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova tarefa…"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <Input
                type="date"
                className="w-40"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
              />
              <Button size="sm" onClick={addTask}>
                +
              </Button>
            </div>
            <div className="space-y-1.5">
              {(tasks.data ?? []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t)} />
                  <span
                    className={`flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}
                  >
                    {t.title}
                  </span>
                  {t.due_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(t.due_date), "dd/MM")}
                    </span>
                  )}
                  <button onClick={() => delTask(t.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              {(tasks.data ?? []).length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">Nenhuma tarefa.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita: histórico de interações */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="font-semibold">Histórico de interações</h3>
          <div className="flex gap-2">
            <Select value={noteTipo} onValueChange={setNoteTipo}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            rows={2}
            placeholder="Registrar interação…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <Button size="sm" onClick={addNote}>
            Adicionar
          </Button>

          <div className="space-y-2 pt-2">
            {(notes.data ?? []).map((n) => (
              <div key={n.id} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {TIPO_LABEL[n.tipo] ?? n.tipo}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(n.created_at), "dd/MM/yy HH:mm")}
                    </span>
                    <button onClick={() => togglePin(n)}>
                      {n.pinned ? (
                        <Pin className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <PinOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <button onClick={() => delNote(n.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm">{n.content}</p>
              </div>
            ))}
            {(notes.data ?? []).length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                Nenhuma interação registrada.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
