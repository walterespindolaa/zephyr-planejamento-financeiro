import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Download, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Arquivo {
  id: string;
  nome: string;
  path: string;
  mime: string | null;
  tamanho: number | null;
  created_at: string;
}

const fmtSize = (b: number | null) => {
  if (!b) return "";
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
  return (b / 1024 / 1024).toFixed(1) + " MB";
};

export default function ClienteArquivos({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("client_files")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setArquivos((data as Arquivo[]) || []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const upload = async (file: File) => {
    setBusy(true);
    const path = `${clientId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("client-files").upload(path, file);
    if (upErr) {
      setBusy(false);
      return toast.error("Erro no upload", { description: upErr.message });
    }
    const { error: dbErr } = await supabase.from("client_files").insert({
      client_id: clientId,
      nome: file.name,
      path,
      mime: file.type,
      tamanho: file.size,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (dbErr) return toast.error("Erro ao registrar", { description: dbErr.message });
    toast.success("Arquivo enviado");
    load();
  };

  const baixar = async (a: Arquivo) => {
    const { data, error } = await supabase.storage.from("client-files").createSignedUrl(a.path, 60);
    if (error || !data) return toast.error("Erro ao gerar link", { description: error?.message });
    window.open(data.signedUrl, "_blank");
  };

  const remover = async (a: Arquivo) => {
    await supabase.storage.from("client-files").remove([a.path]);
    await supabase.from("client_files").delete().eq("id", a.id);
    setArquivos((x) => x.filter((y) => y.id !== a.id));
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Arquivos</h3>
            <p className="text-xs text-muted-foreground">
              Documentos do cliente (IR, extratos, apólices…). Privados, com acesso por papel.
            </p>
          </div>
          <label className="block">
            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
            <Button asChild size="sm" disabled={busy}>
              <span><UploadCloud className="mr-1.5 h-4 w-4" /> {busy ? "Enviando…" : "Enviar arquivo"}</span>
            </Button>
          </label>
        </div>

        {arquivos.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum arquivo ainda.</p>}

        <div className="space-y-2">
          {arquivos.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtSize(a.tamanho)} · {format(new Date(a.created_at), "dd/MM/yy HH:mm")}
                </p>
              </div>
              <button onClick={() => baixar(a)} title="Baixar">
                <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </button>
              <button onClick={() => remover(a)} title="Remover">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
