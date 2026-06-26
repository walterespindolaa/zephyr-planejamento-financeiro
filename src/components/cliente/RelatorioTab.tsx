import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Client, ClientReport } from "@/lib/types";
import ReportEditor from "./ReportEditor";
import CenariosChart from "./CenariosChart";
import TabHint from "./TabHint";
import { exportReportPdf } from "@/lib/exportReportPdf";
import { buildProjectionHtml, fmtBRL, type CenarioInputs } from "@/lib/cenarios";
import { composeFullReport, buildPocketHtml, type PocketOpts } from "@/lib/reportLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { runLifeProjection, type LifeEvent } from "@/lib/financial_engine/life_projection";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Save, FileDown, Plus, FileText, Loader2, Mountain, Eye, Trash2 } from "lucide-react";
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
  const [showPreview, setShowPreview] = useState(false);
  const [baselineId, setBaselineId] = useState<string>("");
  const [showApres, setShowApres] = useState(false);
  const [pocket, setPocket] = useState<PocketOpts>({
    indicadores: true, objetivos: true, saude: true, cenarios: true, evolucao: true, proximos: true, protecao: true,
  });
  const lastSaved = useRef<string>("");

  // Anotações da planejadora (entram no relatório) — persistidas em clients.info
  const [anotacoes, setAnotacoes] = useState(client.info ?? "");
  const [savingNotas, setSavingNotas] = useState(false);

  // Opção: incluir a projeção de vida (eventos) dentro do mesmo relatório
  const [incluirProjecao, setIncluirProjecao] = useState(false);
  const [projData, setProjData] = useState<any>(null); // resumo da projeção (p/ o PDF)

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
    lastSaved.current = "";
    setSnapshot(null);
    setProjData(null);
  };

  const abrir = (r: ClientReport) => {
    setCurrent(r);
    setTitulo(r.titulo);
    setHtml(r.content_html ?? "");
    lastSaved.current = r.content_html ?? "";
    setSnapshot(r.snapshot ?? null);
    setProjData(null);
  };

  // Auto-salva edições (debounce) quando há um relatório atual
  useEffect(() => {
    if (!current || html === lastSaved.current) return;
    const t = setTimeout(async () => {
      await supabase.from("client_reports").update({ content_html: html, titulo }).eq("id", current.id);
      lastSaved.current = html;
    }, 1500);
    return () => clearTimeout(t);
  }, [html, titulo, current]);

  // Calcula o resumo da projeção (eventos) — usado quando "incluir projeção" está ligado
  const computeProjecao = async () => {
    const [apoR, invR, bensR, recR, despR, evR] = await Promise.all([
      supabase.from("client_aposentadoria").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("client_investimentos").select("valor_atual").eq("client_id", client.id),
      supabase.from("client_bens").select("valor, divida_vinculada").eq("client_id", client.id),
      supabase.from("client_receitas").select("valor, recorrente").eq("client_id", client.id),
      supabase.from("client_despesas").select("valor, recorrente").eq("client_id", client.id),
      supabase.from("client_eventos").select("*").eq("client_id", client.id).order("ano"),
    ]);
    const eventos = (evR.data as any[]) || [];
    if (eventos.length === 0) return null;
    const apo: any = apoR.data || {};
    const sum = (arr: any[] | null, f: (x: any) => number) => (arr || []).reduce((s, x) => s + (f(x) || 0), 0);
    const mensal = (arr: any[] | null, f: (x: any) => number) =>
      sum((arr || []).filter((x) => x.recorrente), f) + sum((arr || []).filter((x) => !x.recorrente), f) / 12;
    const inputs = {
      patrimonioInicial: sum(invR.data, (i) => Number(i.valor_atual)) + sum(bensR.data, (b) => Number(b.valor) - Number(b.divida_vinculada || 0)),
      rendaMensal: Math.round(mensal(recR.data, (r) => Number(r.valor))),
      poupancaMensal: Math.max(0, Math.round(mensal(recR.data, (r) => Number(r.valor)) - mensal(despR.data, (d) => Number(d.valor)))),
      taxaRetornoAnual: Number(apo.taxa_retorno_anual ?? 0.06),
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
    return {
      patrimonioFinalSemEventos: base.patrimonioFinal,
      patrimonioFinalComEventos: withEv.patrimonioFinal,
      patrimonioAposentadoria: withEv.patrimonioAposentadoria,
      expectativaVida: inputs.expectativaVida,
      eventos: eventos.map((e) => ({
        name: e.name, ano: e.ano, impactoValor: Number(e.impacto_valor) || 0,
        impactoMensal: Number(e.impacto_mensal) || 0, duracaoMeses: Number(e.duracao_meses) || 0,
      })),
    };
  };

  const gerar = async () => {
    setGenerating(true);
    const tId = toast.loading("Gerando relatório… pode navegar pelo sistema, ele continua em segundo plano.");
    const baselineReport = baselineId ? reports.find((r) => r.id === baselineId) : null;
    let projecao = null;
    if (incluirProjecao && !baselineReport) {
      projecao = await computeProjecao();
      if (!projecao) {
        setGenerating(false);
        toast.error("Sem eventos", { description: "Adicione eventos na aba Projeção ou desligue a projeção." });
        return;
      }
    }
    const body = baselineReport
      ? {
          clientId: client.id,
          modo: "revisao",
          baseline: { snapshot: baselineReport.snapshot, data: (baselineReport.created_at || "").slice(0, 10) },
        }
      : { clientId: client.id, modo: projecao ? "projecao" : "principal", projecao };
    const { data, error } = await supabase.functions.invoke("relatorio-estrategia", { body });
    setGenerating(false);
    if (error || (data as any)?.error) {
      toast.error("Erro ao gerar", { id: tId, description: (data as any)?.error || error?.message });
      return;
    }
    const gHtml = (data as any).html as string;
    const gSnap = (data as any).snapshot ?? null;
    // Auto-salva como rascunho na hora (não perde o crédito gerado)
    const { data: saved } = await supabase
      .from("client_reports")
      .insert({ client_id: client.id, titulo, content_html: gHtml, snapshot: gSnap, created_by: user?.id ?? null })
      .select("*")
      .single();
    setGenerating(false);
    setHtml(gHtml);
    lastSaved.current = gHtml;
    setSnapshot(gSnap);
    setProjData(projecao);
    setCurrent((saved as ClientReport) ?? null);
    loadReports();
    toast.success("Relatório gerado e salvo como rascunho", { id: tId, description: "Disponível em Relatórios salvos." });
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
    lastSaved.current = html;
    loadReports();
  };

  const excluirReport = async (id: string) => {
    await supabase.from("client_reports").delete().eq("id", id);
    if (current?.id === id) novoRelatorio();
    loadReports();
    toast.success("Relatório excluído");
  };

  const gerarApresentacao = async () => {
    const { data } = await supabase
      .from("firm_settings")
      .select("capa_url, contracapa_url")
      .eq("id", 1)
      .maybeSingle();
    exportReportPdf({
      titulo: `Apresentação | ${client.nome} | Zephyr`,
      clienteNome: client.nome,
      contentHtml: buildPocketHtml(snapshot, pocket, client.nome),
      capaUrl: data?.capa_url,
      contracapaUrl: data?.contracapa_url,
    });
    setShowApres(false);
  };

  const getChartSvg = () =>
    (document.querySelector("#zephyr-cenarios-host svg") as SVGElement | null)?.outerHTML;

  const exportarMain = async () => {
    const { data } = await supabase
      .from("firm_settings")
      .select("capa_url, contracapa_url")
      .eq("id", 1)
      .maybeSingle();
    const body =
      composeFullReport({
        titulo,
        nome: client.nome,
        contentHtml: html,
        snapshot,
        chartSvg: getChartSvg(),
      }) + (projData ? buildProjectionHtml(projData) : "");
    exportReportPdf({
      titulo,
      clienteNome: client.nome,
      contentHtml: body,
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
      <TabHint>
        Gere o relatório com IA a partir dos dados do cliente, <strong>edite o texto</strong>, e
        baixe o PDF. Use as <strong>anotações</strong> abaixo para a IA incorporar o contexto de
        vida. Tudo é salvo automaticamente como rascunho ao gerar.
      </TabHint>
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
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} disabled={!html}>
                <Eye className="mr-1.5 h-4 w-4" /> Pré-visualizar
              </Button>
              <Button variant="outline" size="sm" onClick={exportarMain} disabled={!html}>
                <FileDown className="mr-1.5 h-4 w-4" /> PDF completo
              </Button>
              <Button size="sm" onClick={() => setShowApres(true)} disabled={!snapshot}>
                <FileDown className="mr-1.5 h-4 w-4" /> Apresentação
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <Switch checked={incluirProjecao} onCheckedChange={setIncluirProjecao} disabled={!!baselineId} />
              <span className="flex items-center gap-1.5">
                <Mountain className="h-4 w-4 text-primary" /> Incluir projeção de vida
              </span>
            </label>

            {reports.some((r) => r.snapshot) && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Acompanhamento — comparar com:</span>
                <Select value={baselineId || "none"} onValueChange={(v) => setBaselineId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9 w-56">
                    <SelectValue placeholder="Nenhum (novo planejamento)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (novo planejamento)</SelectItem>
                    {reports
                      .filter((r) => r.snapshot)
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {format(new Date(r.created_at), "dd/MM/yy")} · {r.titulo.slice(0, 24)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              {cenarioInputs && (
                <div id="zephyr-cenarios-host">
                  <CenariosChart inputs={cenarioInputs} />
                </div>
              )}
            </div>
          )}

          <ReportEditor value={html} onChange={setHtml} />
          <p className="text-xs text-muted-foreground">
            Este é o relatório oficial do cliente (salvável). Use "Pré-visualizar" para ver o
            layout final (texto + cards por seção), igual ao PDF.
          </p>
        </CardContent>
      </Card>

      {/* Relatórios salvos */}
      {reports.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-5">
            <h3 className="font-semibold">Relatórios salvos</h3>
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 hover:border-primary/40"
              >
                <button onClick={() => abrir(r)} className="flex flex-1 items-center gap-3 text-left">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{r.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.updated_at), "dd/MM/yy HH:mm")}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.status === "finalizado" ? "Finalizado" : "Rascunho"}</Badge>
                  <button onClick={() => excluirReport(r.id)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Modal da apresentação pocket */}
      <Dialog open={showApres} onOpenChange={setShowApres}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apresentação (versão pocket)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Versão enxuta e visual para apresentar ao cliente. Marque o que deve aparecer:
          </p>
          <div className="space-y-2">
            {([
              ["indicadores", "Indicadores principais (KPIs)"],
              ["objetivos", "Objetivos de vida (progresso)"],
              ["saude", "Painel de saúde do planejamento"],
              ["cenarios", "Cenários de aposentadoria"],
              ["evolucao", "Evolução (se for acompanhamento)"],
              ["proximos", "Próximos passos / oportunidades"],
              ["protecao", "Proteção patrimonial"],
            ] as [keyof PocketOpts, string][]).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={pocket[k]} onCheckedChange={(c) => setPocket((p) => ({ ...p, [k]: !!c }))} />
                {label}
              </label>
            ))}
          </div>
          <Button className="w-full" onClick={gerarApresentacao}>
            <FileDown className="mr-1.5 h-4 w-4" /> Gerar apresentação (PDF)
          </Button>
        </DialogContent>
      </Dialog>

      {/* Modal de pré-visualização */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="flex flex-row items-center gap-3 border-b px-4 py-3 pr-12">
            <Button size="sm" onClick={exportarMain}>
              <FileDown className="mr-1.5 h-4 w-4" /> Baixar PDF
            </Button>
            <DialogTitle className="flex-1 truncate text-sm text-muted-foreground">
              Pré-visualização
            </DialogTitle>
          </DialogHeader>
          <div
            className="zephyr-prose max-h-[75vh] overflow-y-auto bg-white p-6"
            dangerouslySetInnerHTML={{
              __html: composeFullReport({
                titulo,
                nome: client.nome,
                contentHtml: html,
                snapshot,
                chartSvg: getChartSvg(),
              }),
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
