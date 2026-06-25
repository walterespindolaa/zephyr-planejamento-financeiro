import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Client, ClientReport } from "@/lib/types";
import ReportEditor from "./ReportEditor";
import CenariosChart from "./CenariosChart";
import { exportReportPdf } from "@/lib/exportReportPdf";
import { buildSummaryHtml, fmtBRL, type CenarioInputs } from "@/lib/cenarios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, FileDown, Plus, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RelatorioTab({ client }: { client: Client }) {
  const { user } = useAuth();
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [current, setCurrent] = useState<ClientReport | null>(null);
  const [titulo, setTitulo] = useState("Estratégia de Subida");
  const [html, setHtml] = useState("");
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadReports = async () => {
    const { data } = await supabase
      .from("client_reports")
      .select("*")
      .eq("client_id", client.id)
      .order("updated_at", { ascending: false });
    setReports((data as ClientReport[]) ?? []);
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const novoRelatorio = () => {
    setCurrent(null);
    setTitulo("Estratégia de Subida");
    setHtml("");
    setSnapshot(null);
  };

  const abrir = (r: ClientReport) => {
    setCurrent(r);
    setTitulo(r.titulo);
    setHtml(r.content_html ?? "");
    setSnapshot(r.snapshot ?? null);
  };

  const gerar = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("relatorio-estrategia", {
      body: { clientId: client.id },
    });
    setGenerating(false);
    if (error || (data as any)?.error) {
      toast.error("Erro ao gerar", { description: (data as any)?.error || error?.message });
      return;
    }
    setHtml((data as any).html);
    setSnapshot((data as any).snapshot ?? null);
    setCurrent(null);
    toast.success("Relatório gerado", { description: "Edite à vontade e clique em Salvar." });
  };

  const salvar = async () => {
    if (!html.trim()) {
      toast.error("Gere ou escreva o conteúdo antes de salvar");
      return;
    }
    setSaving(true);
    if (current) {
      const { error } = await supabase
        .from("client_reports")
        .update({ titulo, content_html: html })
        .eq("id", current.id);
      if (error) toast.error("Erro ao salvar", { description: error.message });
      else toast.success("Relatório atualizado");
    } else {
      const { data, error } = await supabase
        .from("client_reports")
        .insert({
          client_id: client.id,
          titulo,
          content_html: html,
          snapshot,
          created_by: user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) toast.error("Erro ao salvar", { description: error.message });
      else {
        setCurrent(data as ClientReport);
        toast.success("Relatório salvo no cliente");
      }
    }
    setSaving(false);
    loadReports();
  };

  const exportar = async () => {
    const { data } = await supabase
      .from("firm_settings")
      .select("capa_url, contracapa_url")
      .eq("id", 1)
      .maybeSingle();
    exportReportPdf({
      titulo,
      clienteNome: client.nome,
      contentHtml: html,
      summaryHtml: buildSummaryHtml(snapshot),
      capaUrl: data?.capa_url,
      contracapaUrl: data?.contracapa_url,
    });
  };

  const cenarioInputs: CenarioInputs | null = snapshot
    ? {
        idade: Number(snapshot.idade),
        idadeAposentadoria: Number(snapshot.idadeAposentadoria),
        expectativaVida: Number(snapshot.expectativaVida),
        patrimonioFinanceiro: Number(snapshot.patrimonioFinanceiro),
        poupancaMensal: Number(snapshot.poupancaMensal),
        taxaNominalPct: Number(snapshot.taxaNominal),
        inflacaoPct: Number(snapshot.inflacao),
        rendaDesejada: Number(snapshot.rendaDesejada),
        rendaPassivaAtual: Number(snapshot.rendaPassivaAtual),
        rendaPassivaBens: Number(snapshot.rendaPassivaBens),
      }
    : null;

  const kpis: [string, number][] = snapshot
    ? [
        ["Patrimônio financeiro", Number(snapshot.patrimonioFinanceiro) || 0],
        ["Patrimônio em bens", Number(snapshot.patrimonioBens) || 0],
        ["Reserva de emergência", Number(snapshot.reservaEmergencia) || 0],
        ["Receita média/mês", Number(snapshot.receitaMediaMensal) || 0],
        ["Despesa média/mês", Number(snapshot.despesaMediaMensal) || 0],
        ["Capacidade de poupança", Number(snapshot.capacidadePoupanca) || 0],
      ]
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="h-9 max-w-xs font-medium"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={novoRelatorio}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo
              </Button>
              <Button size="sm" onClick={gerar} disabled={generating}>
                {generating ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" />
                )}
                {generating ? "Gerando…" : "Gerar com IA"}
              </Button>
              <Button variant="outline" size="sm" onClick={salvar} disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" /> Salvar
              </Button>
              <Button variant="outline" size="sm" onClick={exportar} disabled={!html}>
                <FileDown className="mr-1.5 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          {generating && (
            <p className="text-sm text-muted-foreground">
              A IA está analisando os dados do cliente… isso leva alguns segundos.
            </p>
          )}

          {snapshot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {kpis.map(([label, val]) => (
                  <div key={label} className="rounded-xl border bg-muted/20 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-base font-bold">{fmtBRL(val)}</p>
                  </div>
                ))}
              </div>
              {cenarioInputs && <CenariosChart inputs={cenarioInputs} />}
            </div>
          )}

          <ReportEditor value={html} onChange={setHtml} />
          <p className="text-xs text-muted-foreground">
            O conteúdo é gerado a partir dos dados das abas Organização e Planejamento. Edite
            livremente (negrito, itálico, tópicos, fonte, tamanho) e salve no cliente.
          </p>
        </CardContent>
      </Card>

      {reports.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-5">
            <h3 className="font-semibold">Relatórios salvos</h3>
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => abrir(r)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{r.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.updated_at), "dd/MM/yy HH:mm")}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{r.status === "finalizado" ? "Finalizado" : "Rascunho"}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
