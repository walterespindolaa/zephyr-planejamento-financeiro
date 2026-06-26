import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientFinance } from "@/hooks/useClientFinance";
import { fmtBRL } from "@/lib/cenarios";
import MoneyInput from "@/components/common/MoneyInput";
import TabHint from "./TabHint";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, Loader2, Trash2, CheckCircle2, FileSearch } from "lucide-react";
import { toast } from "sonner";

interface Extracted {
  receitaMensal: number | null;
  despesaMensal: number | null;
  patrimonioFinanceiro: number | null;
  reservaEmergencia: number | null;
  idade: number | null;
  idadeAposentadoria: number | null;
  rendaDesejada: number | null;
  investimentos: { nome: string; classe: string; valor: number }[];
  bens: { nome: string; tipo: string; valor: number; divida: number }[];
}

export default function ImportarXPTab({ clientId }: { clientId: string }) {
  const fin = useClientFinance(clientId);
  const [analyzing, setAnalyzing] = useState(false);
  const [ext, setExt] = useState<Extracted | null>(null);
  const [applying, setApplying] = useState(false);
  const [curInv, setCurInv] = useState(0);
  const [curBens, setCurBens] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from("client_investimentos").select("id", { count: "exact", head: true }).eq("client_id", clientId),
      supabase.from("client_bens").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    ]).then(([a, b]) => { setCurInv(a.count ?? 0); setCurBens(b.count ?? 0); });
  }, [clientId]);

  const analisar = (file: File) => {
    setAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(",")[1];
      const { data, error } = await supabase.functions.invoke("importar-xp", { body: { clientId, pdfBase64: b64 } });
      setAnalyzing(false);
      if (error || (data as any)?.error) {
        toast.error("Erro ao analisar", { description: (data as any)?.error || error?.message });
        return;
      }
      const e = (data as any).extracted as Extracted;
      setExt({
        receitaMensal: e.receitaMensal ?? null,
        despesaMensal: e.despesaMensal ?? null,
        patrimonioFinanceiro: e.patrimonioFinanceiro ?? null,
        reservaEmergencia: e.reservaEmergencia ?? null,
        idade: e.idade ?? null,
        idadeAposentadoria: e.idadeAposentadoria ?? null,
        rendaDesejada: e.rendaDesejada ?? null,
        investimentos: e.investimentos || [],
        bens: e.bens || [],
      });
      toast.success("Relatório lido", { description: "Confira e edite os dados antes de aplicar." });
    };
    reader.readAsDataURL(file);
  };

  const aplicar = async () => {
    if (!ext) return;
    setApplying(true);
    try {
      // Aposentadoria (escalares)
      const apoPatch: any = { client_id: clientId };
      if (ext.idade != null) apoPatch.idade_atual = ext.idade;
      if (ext.idadeAposentadoria != null) apoPatch.idade_aposentadoria = ext.idadeAposentadoria;
      if (ext.rendaDesejada != null) apoPatch.renda_desejada = ext.rendaDesejada;
      if (Object.keys(apoPatch).length > 1) await supabase.from("client_aposentadoria").upsert(apoPatch, { onConflict: "client_id" });

      // Receita/Despesa — substitui as entradas importadas
      await supabase.from("client_receitas").delete().eq("client_id", clientId).eq("categoria", "Importado XP");
      await supabase.from("client_despesas").delete().eq("client_id", clientId).eq("categoria", "Importado XP");
      if (ext.receitaMensal != null)
        await supabase.from("client_receitas").insert({ client_id: clientId, categoria: "Importado XP", descricao: "Renda (importada da XP)", valor: ext.receitaMensal, recorrente: true });
      if (ext.despesaMensal != null)
        await supabase.from("client_despesas").insert({ client_id: clientId, categoria: "Importado XP", descricao: "Despesas (importadas da XP)", tipo: "fixa", valor: ext.despesaMensal, recorrente: true });

      // Investimentos e bens — substitui pelos revisados
      if (ext.investimentos.length) {
        await supabase.from("client_investimentos").delete().eq("client_id", clientId);
        await supabase.from("client_investimentos").insert(
          ext.investimentos.map((i, idx) => ({
            client_id: clientId, nome: i.nome || `Investimento ${idx + 1}`, classe: i.classe || "outro",
            valor_atual: Number(i.valor) || 0, is_reserva_emergencia: false,
          }))
        );
      }
      if (ext.bens.length) {
        await supabase.from("client_bens").delete().eq("client_id", clientId);
        await supabase.from("client_bens").insert(
          ext.bens.map((b, idx) => ({
            client_id: clientId, nome: b.nome || `Bem ${idx + 1}`, tipo: b.tipo || "outro",
            valor: Number(b.valor) || 0, divida_vinculada: Number(b.divida) || 0,
          }))
        );
      }
      toast.success("Dados aplicados no cliente", { description: "As abas Planejamento e Organização foram atualizadas." });
      setExt(null);
    } catch (e: any) {
      toast.error("Erro ao aplicar", { description: e?.message });
    }
    setApplying(false);
  };

  const setField = (k: keyof Extracted, v: any) => setExt((p) => (p ? { ...p, [k]: v } : p));

  return (
    <div className="space-y-4">
      <TabHint>
        Suba o <strong>relatório da XP</strong> em PDF — a IA lê e extrai patrimônio, investimentos,
        receitas/despesas e idades. Você <strong>confere e edita</strong> tudo numa tela de revisão e,
        ao aprovar, os dados sobem para o cliente. Numa nova importação, os campos que mudaram ficam
        destacados antes de você aplicar.
      </TabHint>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold"><FileSearch className="h-4 w-4 text-primary" /> Importar relatório XP</h4>
            <p className="text-xs text-muted-foreground">PDF do planejamento financeiro da XP.</p>
          </div>
          <label className="block">
            <input type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) analisar(f); e.currentTarget.value = ""; }} />
            <Button asChild disabled={analyzing}>
              <span>{analyzing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1.5 h-4 w-4" />}{analyzing ? "Analisando…" : "Enviar PDF"}</span>
            </Button>
          </label>
        </CardContent>
      </Card>

      {ext && fin && (
        <>
          <Card>
            <CardContent className="space-y-3 py-5">
              <h4 className="text-sm font-bold">Revisão — dados extraídos</h4>
              <p className="text-xs text-muted-foreground">Edite o que precisar. O valor atual do sistema aparece ao lado; campos diferentes ficam marcados.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <RevMoney label="Receita mensal" extra={ext.receitaMensal} atual={fin.receitaMensal} onChange={(v) => setField("receitaMensal", v)} />
                <RevMoney label="Despesa mensal" extra={ext.despesaMensal} atual={fin.despesaMensal} onChange={(v) => setField("despesaMensal", v)} />
                <RevMoney label="Reserva de emergência" extra={ext.reservaEmergencia} atual={fin.reserva} onChange={(v) => setField("reservaEmergencia", v)} />
                <RevMoney label="Renda desejada (aposent.)" extra={ext.rendaDesejada} atual={fin.rendaDesejada} onChange={(v) => setField("rendaDesejada", v)} />
                <RevNum label="Idade atual" extra={ext.idade} atual={fin.idade} onChange={(v) => setField("idade", v)} />
                <RevNum label="Idade de aposentadoria" extra={ext.idadeAposentadoria} atual={fin.idadeAposentadoria} onChange={(v) => setField("idadeAposentadoria", v)} />
              </div>
            </CardContent>
          </Card>

          <ListaEditavel
            titulo={`Investimentos extraídos (${ext.investimentos.length}) · sistema tem ${curInv}`}
            itens={ext.investimentos}
            cols={["nome", "classe", "valor"]}
            onChange={(arr) => setField("investimentos", arr)}
          />
          <ListaEditavel
            titulo={`Bens extraídos (${ext.bens.length}) · sistema tem ${curBens}`}
            itens={ext.bens}
            cols={["nome", "tipo", "valor", "divida"]}
            onChange={(arr) => setField("bens", arr)}
          />

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setExt(null)}>Descartar</Button>
            <Button onClick={aplicar} disabled={applying}>
              {applying ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              Aprovar e aplicar no cliente
            </Button>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Ao aplicar, investimentos e bens do cliente serão substituídos pelos revisados acima.
          </p>
        </>
      )}
    </div>
  );
}

function RevMoney({ label, extra, atual, onChange }: { label: string; extra: number | null; atual: number; onChange: (v: number) => void }) {
  const mudou = extra != null && Math.round(extra) !== Math.round(atual);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {mudou && <Badge variant="outline" className="border-warning/40 text-warning-foreground">alterado</Badge>}
      </div>
      <MoneyInput value={extra ?? 0} onCommit={onChange} />
      <p className="text-[10px] text-muted-foreground">Sistema hoje: {fmtBRL(atual)}</p>
    </div>
  );
}
function RevNum({ label, extra, atual, onChange }: { label: string; extra: number | null; atual: number; onChange: (v: number) => void }) {
  const mudou = extra != null && extra !== atual;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {mudou && <Badge variant="outline" className="border-warning/40 text-warning-foreground">alterado</Badge>}
      </div>
      <Input type="number" value={extra ?? ""} onChange={(e) => onChange(Number(e.target.value))} />
      <p className="text-[10px] text-muted-foreground">Sistema hoje: {atual}</p>
    </div>
  );
}

function ListaEditavel({ titulo, itens, cols, onChange }: { titulo: string; itens: any[]; cols: string[]; onChange: (arr: any[]) => void }) {
  const upd = (i: number, k: string, v: any) => onChange(itens.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const del = (i: number) => onChange(itens.filter((_, idx) => idx !== i));
  return (
    <Card>
      <CardContent className="space-y-2 py-5">
        <h4 className="text-sm font-bold">{titulo}</h4>
        {itens.length === 0 && <p className="text-sm text-muted-foreground">Nada extraído.</p>}
        {itens.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            {cols.map((c) => (
              <div key={c} className={c === "nome" ? "flex-1 min-w-[140px]" : "w-32"}>
                <span className="block text-[10px] capitalize text-muted-foreground">{c}</span>
                {c === "valor" || c === "divida" ? (
                  <MoneyInput value={Number(it[c]) || 0} onCommit={(v) => upd(i, c, v)} />
                ) : (
                  <Input className="h-9" value={it[c] ?? ""} onChange={(e) => upd(i, c, e.target.value)} />
                )}
              </div>
            ))}
            <button onClick={() => del(i)} className="self-end pb-2"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
