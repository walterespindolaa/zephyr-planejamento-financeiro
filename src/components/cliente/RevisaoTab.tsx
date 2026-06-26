import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Client, ClientReport } from "@/lib/types";
import MoneyInput from "@/components/common/MoneyInput";
import { fmtBRL } from "@/lib/cenarios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Inv { id: string; nome: string; valor_atual: number }
interface Obj { id: string; nome: string; valor_acumulado: number }

export default function RevisaoTab({ client }: { client: Client }) {
  const { user } = useAuth();
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [baselineId, setBaselineId] = useState("");
  const [invs, setInvs] = useState<Inv[]>([]);
  const [objs, setObjs] = useState<Obj[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    const [rep, inv, obj] = await Promise.all([
      supabase.from("client_reports").select("*").eq("client_id", client.id).order("created_at", { ascending: false }),
      supabase.from("client_investimentos").select("id, nome, valor_atual").eq("client_id", client.id).order("created_at"),
      supabase.from("client_objetivos").select("id, nome, valor_acumulado").eq("client_id", client.id).order("created_at"),
    ]);
    setReports(((rep.data as ClientReport[]) || []).filter((r) => r.snapshot));
    setInvs((inv.data as Inv[]) || []);
    setObjs((obj.data as Obj[]) || []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const baseline = reports.find((r) => r.id === baselineId);
  const snap: any = baseline?.snapshot || null;

  const invAntes = (nome: string) =>
    Number((snap?.investimentos || []).find((i: any) => i.nome === nome)?.valor || 0);
  const objAntes = (nome: string) =>
    Number((snap?.objetivos || []).find((o: any) => o.nome === nome)?.acumulado || 0);

  const totalInvAgora = useMemo(() => invs.reduce((s, i) => s + Number(i.valor_atual || 0), 0), [invs]);
  const totalInvAntes = Number(snap?.patrimonioFinanceiro || 0);

  const updInv = async (id: string, v: number) => {
    setInvs((x) => x.map((i) => (i.id === id ? { ...i, valor_atual: v } : i)));
    await supabase.from("client_investimentos").update({ valor_atual: v }).eq("id", id);
  };
  const updObj = async (id: string, v: number) => {
    setObjs((x) => x.map((o) => (o.id === id ? { ...o, valor_acumulado: v } : o)));
    await supabase.from("client_objetivos").update({ valor_acumulado: v }).eq("id", id);
  };

  const gerar = async () => {
    if (!baseline) {
      toast.error("Selecione o marco zero (planejamento a comparar).");
      return;
    }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("relatorio-estrategia", {
      body: {
        clientId: client.id,
        modo: "revisao",
        baseline: { snapshot: baseline.snapshot, data: (baseline.created_at || "").slice(0, 10) },
      },
    });
    if (error || (data as any)?.error) {
      setGenerating(false);
      toast.error("Erro ao gerar", { description: (data as any)?.error || error?.message });
      return;
    }
    await supabase.from("client_reports").insert({
      client_id: client.id,
      titulo: `Acompanhamento | ${client.nome} | Zephyr`,
      content_html: (data as any).html,
      snapshot: (data as any).snapshot,
      created_by: user?.id ?? null,
    });
    setGenerating(false);
    toast.success("Acompanhamento gerado e salvo", {
      description: "Abra a aba Relatório para editar e baixar o PDF.",
    });
    load();
  };

  const Delta = ({ antes, agora }: { antes: number; agora: number }) => {
    const d = Math.round(agora - antes);
    return (
      <span className={`text-xs font-bold ${d < 0 ? "text-destructive" : "text-success"}`}>
        {d > 0 ? "+" : ""}
        {fmtBRL(d)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <History className="h-4 w-4 text-primary" /> Revisão / Acompanhamento
              </h3>
              <p className="text-xs text-muted-foreground">
                Escolha o planejamento-base (marco zero), atualize os números que mudaram e gere o
                relatório de evolução.
              </p>
            </div>
            <Select value={baselineId} onValueChange={setBaselineId}>
              <SelectTrigger className="h-9 w-64">
                <SelectValue placeholder="Marco zero (planejamento a comparar)" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {format(new Date(r.created_at), "dd/MM/yy")} · {r.titulo.slice(0, 26)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reports.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ainda não há um planejamento salvo para usar como marco zero. Gere e salve o primeiro
              relatório na aba Relatório.
            </p>
          )}
        </CardContent>
      </Card>

      {baseline && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCmp label="Patrimônio aplicado" antes={totalInvAntes} agora={totalInvAgora} />
            <KpiCmp label="Reserva (marco zero)" antes={Number(snap?.reservaEmergencia || 0)} agora={Number(snap?.reservaEmergencia || 0)} hideAgora />
            <KpiCmp
              label="Objetivos acumulados"
              antes={objs.reduce((s, o) => s + objAntes(o.nome), 0)}
              agora={objs.reduce((s, o) => s + Number(o.valor_acumulado || 0), 0)}
            />
          </div>

          {/* Investimentos */}
          <Card>
            <CardContent className="space-y-2 py-5">
              <h4 className="font-semibold">Saldos de investimentos</h4>
              <p className="text-xs text-muted-foreground">
                Atualize o valor atual de cada investimento. Salva automaticamente.
              </p>
              <div className="hidden gap-2 px-1 text-xs text-muted-foreground sm:flex">
                <div className="flex-1">Investimento</div>
                <div className="w-32 text-right">Marco zero</div>
                <div className="w-40 text-right">Valor atual</div>
                <div className="w-24 text-right">Variação</div>
              </div>
              {invs.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <span className="flex-1 text-sm font-medium">{i.nome || "—"}</span>
                  <span className="w-32 text-right text-sm text-muted-foreground">{fmtBRL(invAntes(i.nome))}</span>
                  <div className="w-40">
                    <MoneyInput value={Number(i.valor_atual) || 0} onCommit={(v) => updInv(i.id, v)} />
                  </div>
                  <span className="w-24 text-right">
                    <Delta antes={invAntes(i.nome)} agora={Number(i.valor_atual) || 0} />
                  </span>
                </div>
              ))}
              {invs.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum investimento cadastrado.</p>}
            </CardContent>
          </Card>

          {/* Objetivos */}
          <Card>
            <CardContent className="space-y-2 py-5">
              <h4 className="font-semibold">Acumulado dos objetivos</h4>
              <p className="text-xs text-muted-foreground">
                Atualize quanto já foi guardado em cada objetivo.
              </p>
              {objs.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <span className="flex-1 text-sm font-medium">{o.nome || "—"}</span>
                  <span className="w-32 text-right text-sm text-muted-foreground">{fmtBRL(objAntes(o.nome))}</span>
                  <div className="w-40">
                    <MoneyInput value={Number(o.valor_acumulado) || 0} onCommit={(v) => updObj(o.id, v)} />
                  </div>
                  <span className="w-24 text-right">
                    <Delta antes={objAntes(o.nome)} agora={Number(o.valor_acumulado) || 0} />
                  </span>
                </div>
              ))}
              {objs.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum objetivo cadastrado.</p>}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={gerar} disabled={generating}>
              {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              {generating ? "Gerando…" : "Gerar relatório de acompanhamento"}
            </Button>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Dica: ajuste também receitas/despesas e bens nas abas Organização e Planejamento, se mudaram.
          </p>
        </>
      )}
    </div>
  );
}

function KpiCmp({ label, antes, agora, hideAgora }: { label: string; antes: number; agora: number; hideAgora?: boolean }) {
  const d = Math.round(agora - antes);
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">{fmtBRL(antes)}</span>
          {!hideAgora && (
            <>
              <span className="text-muted-foreground">→</span>
              <span className="text-lg font-bold">{fmtBRL(agora)}</span>
            </>
          )}
        </div>
        {!hideAgora && (
          <span className={`text-xs font-bold ${d < 0 ? "text-destructive" : "text-success"}`}>
            {d > 0 ? "+" : ""}{fmtBRL(d)} no período
          </span>
        )}
      </CardContent>
    </Card>
  );
}
