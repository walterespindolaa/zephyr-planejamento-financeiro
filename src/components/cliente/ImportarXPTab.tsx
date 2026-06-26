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
import { UploadCloud, Loader2, Trash2, Plus, CheckCircle2, FileSearch } from "lucide-react";
import { toast } from "sonner";

interface Linha { descricao: string; categoria: string; membro?: string; valor: number }
interface Extracted {
  estadoCivil: string | null;
  regimeCasamento: string | null;
  patrimonioFinanceiro: number | null;
  reservaEmergencia: number | null;
  idade: number | null;
  idadeAposentadoria: number | null;
  rendaDesejada: number | null;
  receitas: Linha[];
  despesas: Linha[];
  investimentos: { nome: string; classe: string; valor: number }[];
  bens: { nome: string; tipo: string; valor: number; divida: number }[];
  dependentes: { nome: string; parentesco: string }[];
}

const soma = (arr: { valor: number }[]) => arr.reduce((s, x) => s + (Number(x.valor) || 0), 0);

export default function ImportarXPTab({ clientId }: { clientId: string }) {
  const fin = useClientFinance(clientId);
  const [analyzing, setAnalyzing] = useState(false);
  const [ext, setExt] = useState<Extracted | null>(null);
  const [applying, setApplying] = useState(false);
  const [cur, setCur] = useState({ inv: 0, bens: 0, dep: 0, estadoCivil: "", regime: "" });

  useEffect(() => {
    (async () => {
      const [inv, bens, dep, cli] = await Promise.all([
        supabase.from("client_investimentos").select("id", { count: "exact", head: true }).eq("client_id", clientId),
        supabase.from("client_bens").select("id", { count: "exact", head: true }).eq("client_id", clientId),
        supabase.from("client_dependentes").select("id", { count: "exact", head: true }).eq("client_id", clientId),
        supabase.from("clients").select("estado_civil, regime_casamento").eq("id", clientId).maybeSingle(),
      ]);
      setCur({
        inv: inv.count ?? 0, bens: bens.count ?? 0, dep: dep.count ?? 0,
        estadoCivil: (cli.data as any)?.estado_civil ?? "", regime: (cli.data as any)?.regime_casamento ?? "",
      });
    })();
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
      const e = (data as any).extracted as Partial<Extracted>;
      setExt({
        estadoCivil: e.estadoCivil ?? null,
        regimeCasamento: e.regimeCasamento ?? null,
        patrimonioFinanceiro: e.patrimonioFinanceiro ?? null,
        reservaEmergencia: e.reservaEmergencia ?? null,
        idade: e.idade ?? null,
        idadeAposentadoria: e.idadeAposentadoria ?? null,
        rendaDesejada: e.rendaDesejada ?? null,
        receitas: e.receitas || [],
        despesas: e.despesas || [],
        investimentos: e.investimentos || [],
        bens: e.bens || [],
        dependentes: e.dependentes || [],
      });
      toast.success("Relatório lido", { description: "Confira e edite os dados antes de aplicar." });
    };
    reader.readAsDataURL(file);
  };

  const aplicar = async () => {
    if (!ext) return;
    setApplying(true);
    try {
      // Dados cadastrais
      await supabase.from("clients").update({
        estado_civil: ext.estadoCivil || null,
        regime_casamento: ext.regimeCasamento || null,
      }).eq("id", clientId);

      // Aposentadoria (escalares)
      const apoPatch: any = { client_id: clientId };
      if (ext.idade != null) apoPatch.idade_atual = ext.idade;
      if (ext.idadeAposentadoria != null) apoPatch.idade_aposentadoria = ext.idadeAposentadoria;
      if (ext.rendaDesejada != null) apoPatch.renda_desejada = ext.rendaDesejada;
      if (Object.keys(apoPatch).length > 1) await supabase.from("client_aposentadoria").upsert(apoPatch, { onConflict: "client_id" });

      // Rendas — substitui pelas linhas revisadas
      if (ext.receitas.length) {
        await supabase.from("client_receitas").delete().eq("client_id", clientId);
        await supabase.from("client_receitas").insert(ext.receitas.map((r) => ({
          client_id: clientId,
          categoria: r.categoria || "Outros",
          descricao: r.membro ? `${r.descricao} (${r.membro})` : r.descricao,
          valor: Number(r.valor) || 0, recorrente: true,
        })));
      }
      // Despesas — substitui pelas linhas revisadas
      if (ext.despesas.length) {
        await supabase.from("client_despesas").delete().eq("client_id", clientId);
        await supabase.from("client_despesas").insert(ext.despesas.map((d) => ({
          client_id: clientId,
          categoria: d.categoria || "Outros",
          descricao: d.membro ? `${d.descricao} (${d.membro})` : d.descricao,
          tipo: "fixa", valor: Number(d.valor) || 0, recorrente: true,
        })));
      }

      // Investimentos e bens
      if (ext.investimentos.length) {
        await supabase.from("client_investimentos").delete().eq("client_id", clientId);
        await supabase.from("client_investimentos").insert(ext.investimentos.map((i, idx) => ({
          client_id: clientId, nome: i.nome || `Investimento ${idx + 1}`, classe: i.classe || "outro",
          valor_atual: Number(i.valor) || 0, is_reserva_emergencia: false,
        })));
      }
      if (ext.bens.length) {
        await supabase.from("client_bens").delete().eq("client_id", clientId);
        await supabase.from("client_bens").insert(ext.bens.map((b, idx) => ({
          client_id: clientId, nome: b.nome || `Bem ${idx + 1}`, tipo: b.tipo || "outro",
          valor: Number(b.valor) || 0, divida_vinculada: Number(b.divida) || 0,
        })));
      }
      // Dependentes
      if (ext.dependentes.length) {
        await supabase.from("client_dependentes").delete().eq("client_id", clientId);
        await supabase.from("client_dependentes").insert(ext.dependentes.map((d, idx) => ({
          client_id: clientId, nome: d.nome || `Dependente ${idx + 1}`, parentesco: d.parentesco || "outro",
        })));
      }
      toast.success("Dados aplicados no cliente", { description: "Abas Planejamento, Organização e CRM atualizadas." });
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
        Suba o <strong>relatório da XP</strong> em PDF — a IA lê e extrai estado civil, regime de casamento,
        dependentes, rendas e despesas <strong>linha a linha</strong>, patrimônio, investimentos e idades.
        Você <strong>confere e edita</strong> tudo aqui e, ao aprovar, sobe para o cliente. Os campos que
        diferem do que já existe ficam marcados como <strong>alterado</strong>.
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
              <h4 className="text-sm font-bold">Cadastro e família</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <RevText label="Estado civil" extra={ext.estadoCivil} atual={cur.estadoCivil} onChange={(v) => setField("estadoCivil", v)} />
                <RevText label="Regime de casamento" extra={ext.regimeCasamento} atual={cur.regime} onChange={(v) => setField("regimeCasamento", v)} />
                <RevNum label="Idade atual" extra={ext.idade} atual={fin.idade} onChange={(v) => setField("idade", v)} />
                <RevNum label="Idade de aposentadoria" extra={ext.idadeAposentadoria} atual={fin.idadeAposentadoria} onChange={(v) => setField("idadeAposentadoria", v)} />
                <RevMoney label="Reserva de emergência" extra={ext.reservaEmergencia} atual={fin.reserva} onChange={(v) => setField("reservaEmergencia", v)} />
                <RevMoney label="Renda desejada (aposent.)" extra={ext.rendaDesejada} atual={fin.rendaDesejada} onChange={(v) => setField("rendaDesejada", v)} />
              </div>
            </CardContent>
          </Card>

          <ListaEditavel
            titulo="Rendas (linha a linha)"
            resumo={`Total extraído ${fmtBRL(soma(ext.receitas))} · sistema hoje ${fmtBRL(fin.receitaMensal)}`}
            itens={ext.receitas}
            cols={["descricao", "categoria", "membro", "valor"]}
            novo={{ descricao: "", categoria: "Outros", membro: "", valor: 0 }}
            onChange={(arr) => setField("receitas", arr)}
          />
          <ListaEditavel
            titulo="Despesas (linha a linha)"
            resumo={`Total extraído ${fmtBRL(soma(ext.despesas))} · sistema hoje ${fmtBRL(fin.despesaMensal)}`}
            itens={ext.despesas}
            cols={["descricao", "categoria", "membro", "valor"]}
            novo={{ descricao: "", categoria: "Outros", membro: "", valor: 0 }}
            onChange={(arr) => setField("despesas", arr)}
          />
          <ListaEditavel
            titulo={`Investimentos (${ext.investimentos.length}) · sistema tem ${cur.inv}`}
            itens={ext.investimentos}
            cols={["nome", "classe", "valor"]}
            novo={{ nome: "", classe: "outro", valor: 0 }}
            onChange={(arr) => setField("investimentos", arr)}
          />
          <ListaEditavel
            titulo={`Bens (${ext.bens.length}) · sistema tem ${cur.bens}`}
            itens={ext.bens}
            cols={["nome", "tipo", "valor", "divida"]}
            novo={{ nome: "", tipo: "outro", valor: 0, divida: 0 }}
            onChange={(arr) => setField("bens", arr)}
          />
          <ListaEditavel
            titulo={`Dependentes (${ext.dependentes.length}) · sistema tem ${cur.dep}`}
            itens={ext.dependentes}
            cols={["nome", "parentesco"]}
            novo={{ nome: "", parentesco: "filho" }}
            onChange={(arr) => setField("dependentes", arr)}
          />

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setExt(null)}>Descartar</Button>
            <Button onClick={aplicar} disabled={applying}>
              {applying ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              Aprovar e aplicar no cliente
            </Button>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Ao aplicar, rendas, despesas, investimentos, bens e dependentes do cliente são substituídos pelos revisados acima.
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
      <div className="flex items-center justify-between"><Label className="text-xs">{label}</Label>{mudou && <Badge variant="outline" className="border-amber-400 text-amber-600">alterado</Badge>}</div>
      <MoneyInput value={extra ?? 0} onCommit={onChange} />
      <p className="text-[10px] text-muted-foreground">Sistema hoje: {fmtBRL(atual)}</p>
    </div>
  );
}
function RevNum({ label, extra, atual, onChange }: { label: string; extra: number | null; atual: number; onChange: (v: number) => void }) {
  const mudou = extra != null && extra !== atual;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between"><Label className="text-xs">{label}</Label>{mudou && <Badge variant="outline" className="border-amber-400 text-amber-600">alterado</Badge>}</div>
      <Input type="number" value={extra ?? ""} onChange={(e) => onChange(Number(e.target.value))} />
      <p className="text-[10px] text-muted-foreground">Sistema hoje: {atual}</p>
    </div>
  );
}
function RevText({ label, extra, atual, onChange }: { label: string; extra: string | null; atual: string; onChange: (v: string) => void }) {
  const mudou = (extra ?? "").trim() !== (atual ?? "").trim() && !!(extra ?? "").trim();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between"><Label className="text-xs">{label}</Label>{mudou && <Badge variant="outline" className="border-amber-400 text-amber-600">alterado</Badge>}</div>
      <Input value={extra ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="—" />
      <p className="text-[10px] text-muted-foreground">Sistema hoje: {atual || "—"}</p>
    </div>
  );
}

function ListaEditavel({ titulo, resumo, itens, cols, novo, onChange }: {
  titulo: string; resumo?: string; itens: any[]; cols: string[]; novo: any; onChange: (arr: any[]) => void;
}) {
  const upd = (i: number, k: string, v: any) => onChange(itens.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const del = (i: number) => onChange(itens.filter((_, idx) => idx !== i));
  const label: Record<string, string> = { descricao: "Descrição", categoria: "Categoria", membro: "Membro", valor: "Valor", nome: "Nome", classe: "Classe", tipo: "Tipo", divida: "Dívida", parentesco: "Parentesco" };
  return (
    <Card>
      <CardContent className="space-y-2 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h4 className="text-sm font-bold">{titulo}</h4>
          {resumo && <span className="text-xs text-muted-foreground">{resumo}</span>}
        </div>
        {itens.length === 0 && <p className="text-sm text-muted-foreground">Nada extraído.</p>}
        {itens.map((it, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border p-2">
            {cols.map((c) => (
              <div key={c} className={c === "descricao" || c === "nome" ? "flex-1 min-w-[130px]" : "w-28"}>
                <span className="block text-[10px] text-muted-foreground">{label[c] ?? c}</span>
                {c === "valor" || c === "divida" ? (
                  <MoneyInput value={Number(it[c]) || 0} onCommit={(v) => upd(i, c, v)} />
                ) : (
                  <Input className="h-9" value={it[c] ?? ""} onChange={(e) => upd(i, c, e.target.value)} />
                )}
              </div>
            ))}
            <button onClick={() => del(i)} className="pb-2"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => onChange([...itens, { ...novo }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar linha
        </Button>
      </CardContent>
    </Card>
  );
}
