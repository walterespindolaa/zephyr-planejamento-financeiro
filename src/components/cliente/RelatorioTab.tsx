import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Client, ClientReport } from "@/lib/types";
import ReportEditor from "./ReportEditor";
import CenariosChart from "./CenariosChart";
import { exportReportPdf } from "@/lib/exportReportPdf";
import { buildSummaryHtml, buildProjectionHtml, fmtBRL, type CenarioInputs } from "@/lib/cenarios";
import { runLifeProjection, type LifeEvent } from "@/lib/financial_engine/life_projection";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, FileDown, Plus, FileText, Loader2, Mountain, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RelatorioTab({ client }: { client: Client }) {
  const { user } = useAuth();
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [current, setCurrent] = useState<ClientReport | null>(null);
  const tituloPadrao = `Planejamento Financeiro | ${client.nome} | Zephyr`;
  const [titulo, setTitulo] = useState(tituloPadrao);
  const [html, setHtml] = useState("");
  const [snapshot, setSnapshot] = useState<Record<string, any> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Anotações da planejadora (entram no relatório) — persistidas em clients.info
  const [anotacoes, setAnotacoes] = useState(client.info ?? "");
  const [savingNotas, setSavingNotas] = useState(false);

  // Projeção (SIMULAÇÃO efêmera — não salva, some ao trocar de aba / F5)
  const [projGenerating, setProjGenerating] = useState(false);
  const [projHtml, setProjHtml] = useState<string | null>(null);
  const [projData, setProjData] = useState<any>(null);
  const [projSnapshot, setProjSnapshot] = useState<Record<string, any> | null>(null);

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

  const salvarNotas = async () => {
    setSavingNotas(true);
    await supabase.from("clients").update({ info: anotacoes || null }).eq("id", client.id);
    setSavingNotas(false);
    toast.success("Anotações salvas", { description: "Entram na próxima geração do relatório." });
  };

  const novoRelatorio = () => {
    setCurrent(null);
    setTitulo(tituloPadrao);
    setHtml("");
    setSnapshot(null);
    setProjHtml(null);
  };

  const abrir = (r: ClientReport) => {
    setCurrent(r);
    setTitulo(r.titulo);
    setHtml(r.content_html ?? "");
    setSnapshot(r.snapshot ?? null);
    setProjHtml(null);
  };

  const gerar = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("relatorio-estrategia", {
      body: { clientId: client.id, modo: "principal" },
    });
    setGenerating(false);
    if (error || (data as any)?.error) {
      toast.error("Erro ao gerar", { description: (data as any)?.error || error?.message });
      return;
    }
    setHtml((data as any).html);
    setSnapshot((data as any).snapshot ?? null);
    setCurrent(null);
    setProjHtml(null);
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
        .insert({ client_id: client.id, titulo, content_html: html, snapshot, created_by: user?.id ?? null })
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

  const exportar = async (conteudo: string, summary: string) => {
    const { data } = await supabase
      .from("firm_settings")
      .select("capa_url, contracapa_url")
      .eq("id", 1)
      .maybeSingle();
    exportReportPdf({
      titulo,
      clienteNome: client.nome,
      contentHtml: conteudo,
      summaryHtml: summary,
      capaUrl: data?.capa_url,
      contracapaUrl: data?.contracapa_url,
    });
  };

  // ── Projeção (simulação) ───────────────────────────────────────────────
  const gerarProjecao = async () => {
    setProjGenerating(true);
    // 1) agrega dados + eventos para calcular o impacto
    const [apoR, invR, bensR, recR, despR, evR] = await Promise.all([
      supabase.from("client_aposentadoria").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("client_investimentos").select("valor_atual").eq("client_id", client.id),
      supabase.from("client_bens").select("valor, divida_vinculada").eq("client_id", client.id),
      supabase.from("client_receitas").select("valor, recorrente").eq("client_id", client.id),
      supabase.from("client_despesas").select("valor, recorrente").eq("client_id", client.id),
      supabase.from("client_eventos").select("*").eq("client_id", client.id).order("ano"),
    ]);
    const apo: any = apoR.data || {};
    const eventos = (evR.data as any[]) || [];
    if (eventos.length === 0) {
      setProjGenerating(false);
      toast.error("Sem eventos", { description: "Adicione eventos na aba Projeção primeiro." });
      return;
    }
    const sum = (arr: any[] | null, f: (x: any) => number) => (arr || []).reduce((s, x) => s + (f(x) || 0), 0);
    const mensal = (arr: any[] | null, f: (x: any) => number) =>
      sum((arr || []).filter((x) => x.recorrente), f) + sum((arr || []).filter((x) => !x.recorrente), f) / 12;
    const inputs = {
      patrimonioInicial: sum(invR.data, (i) => Number(i.valor_atual)) + sum(bensR.data, (b) => Number(b.valor) - Number(b.divida_vinculada || 0)),
      rendaMensal: Math.round(mensal(recR.data, (r) => Number(r.valor))),
      poupancaMensal: apo.poupanca_mensal ?? Math.max(0, Math.round(mensal(recR.data, (r) => Number(r.valor)) - mensal(despR.data, (d) => Number(d.valor)))),
      taxaRetornoAnual: Number(apo.taxa_retorno_anual ?? 0.1),
      inflacaoAnual: Number(apo.inflacao_anual ?? 0.04),
      idadeAtual: apo.idade_atual ?? 35,
      idadeAposentadoria: apo.idade_aposentadoria ?? 60,
      expectativaVida: apo.expectativa_vida ?? 90,
      events: [] as LifeEvent[],
    };
    const lifeEvents: LifeEvent[] = eventos.map((e) => ({
      id: e.id, name: e.name, emoji: e.emoji, year: e.ano,
      impactValue: Number(e.impacto_valor) || 0, monthlyImpact: Number(e.impacto_mensal) || 0,
      durationMonths: Number(e.duracao_meses) || 0, type: e.tipo,
    }));
    const base = runLifeProjection({ ...inputs, events: [] });
    const withEv = runLifeProjection({ ...inputs, events: lifeEvents });
    const projecao = {
      patrimonioFinalSemEventos: base.patrimonioFinal,
      patrimonioFinalComEventos: withEv.patrimonioFinal,
      patrimonioAposentadoria: withEv.patrimonioAposentadoria,
      expectativaVida: inputs.expectativaVida,
      eventos: eventos.map((e) => ({
        name: e.name, ano: e.ano, impactoValor: Number(e.impacto_valor) || 0,
        impactoMensal: Number(e.impacto_mensal) || 0, duracaoMeses: Number(e.duracao_meses) || 0,
      })),
    };

    // 2) gera o texto da simulação (não salva)
    const { data, error } = await supabase.functions.invoke("relatorio-estrategia", {
      body: { clientId: client.id, modo: "projecao", projecao },
    });
    setProjGenerating(false);
    if (error || (data as any)?.error) {
      toast.error("Erro na projeção", { description: (data as any)?.error || error?.message });
      return;
    }
    setProjHtml((data as any).html);
    setProjSnapshot((data as any).snapshot ?? null);
    setProjData(projecao);
    toast.success("Projeção gerada", { description: "Simulação — não altera o relatório principal." });
  };

  const baixarPdfProjecao = () => {
    if (!projHtml) return;
    exportar(
      projHtml,
      (projSnapshot ? buildSummaryHtml(projSnapshot) : "") + buildProjectionHtml(projData)
    );
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
      {/* Anotações da planejadora */}
      <Card>
        <CardContent className="space-y-2 py-5">
          <h3 className="text-sm font-semibold">Anotações da planejadora (entram no relatório)</h3>
          <p className="text-xs text-muted-foreground">
            Contexto de vida do cliente que a IA deve incorporar ao texto (situação familiar,
            sonhos, preocupações, decisões em andamento…).
          </p>
          <Textarea
            rows={3}
            value={anotacoes}
            onChange={(e) => setAnotacoes(e.target.value)}
            placeholder="Ex.: pretende reduzir a jornada em 3 anos para cuidar dos filhos…"
          />
          <Button size="sm" variant="outline" onClick={salvarNotas} disabled={savingNotas}>
            <Save className="mr-1.5 h-4 w-4" /> Salvar anotações
          </Button>
        </CardContent>
      </Card>

      {/* Relatório principal */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9 max-w-xs font-medium" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={novoRelatorio}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo
              </Button>
              <Button size="sm" onClick={gerar} disabled={generating}>
                {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {generating ? "Gerando…" : "Gerar relatório"}
              </Button>
              <Button variant="outline" size="sm" onClick={salvar} disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" /> Salvar
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportar(html, buildSummaryHtml(snapshot))} disabled={!html}>
                <FileDown className="mr-1.5 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          {snapshot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {kpis.map(([label, val]) => (
                  <div key={label} className="rounded-xl border bg-muted/20 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-base font-bold">{fmtBRL(val)}</p>
                  </div>
                ))}
              </div>
              {cenarioInputs && <CenariosChart inputs={cenarioInputs} />}
            </div>
          )}

          <ReportEditor value={html} onChange={setHtml} />
          <p className="text-xs text-muted-foreground">
            Este é o relatório oficial do cliente (salvável). A projeção abaixo é uma simulação à
            parte.
          </p>
        </CardContent>
      </Card>

      {/* Versão com projeção de vida — SIMULAÇÃO efêmera */}
      <Card className="border-primary/30">
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Mountain className="h-4 w-4 text-primary" /> Versão com projeção de vida (simulação)
              </h3>
              <p className="text-xs text-muted-foreground">
                Usa os eventos da aba Projeção. Não altera nem salva o relatório principal — é só
                para o cliente analisar o impacto. Ao trocar de aba ou recarregar, some.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={gerarProjecao} disabled={projGenerating}>
                {projGenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {projGenerating ? "Gerando…" : "Gerar projeção"}
              </Button>
              {projHtml && (
                <Button size="sm" variant="outline" onClick={baixarPdfProjecao}>
                  <FileDown className="mr-1.5 h-4 w-4" /> Baixar PDF projetado
                </Button>
              )}
            </div>
          </div>

          {projHtml && (
            <div className="space-y-2">
              <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground">
                Simulação — não salva
              </Badge>
              <button
                onClick={() => setProjHtml(null)}
                className="ml-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3 w-3" /> Descartar
              </button>
              <div
                className="zephyr-prose max-h-[420px] overflow-y-auto rounded-lg border bg-muted/10 p-4"
                dangerouslySetInnerHTML={{ __html: projHtml }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relatórios salvos */}
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
