import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Slot = "capa" | "contracapa";

export default function BrandingUpload() {
  const [capa, setCapa] = useState<string | null>(null);
  const [contracapa, setContracapa] = useState<string | null>(null);
  const [busy, setBusy] = useState<Slot | null>(null);

  useEffect(() => {
    supabase
      .from("firm_settings")
      .select("capa_url, contracapa_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCapa(data.capa_url);
          setContracapa(data.contracapa_url);
        }
      });
  }, []);

  const upload = async (slot: Slot, file: File) => {
    setBusy(slot);
    const ext = file.name.split(".").pop() || "png";
    const path = `${slot}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) {
      setBusy(null);
      toast.error("Erro no upload", { description: upErr.message });
      return;
    }
    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    const url = pub.publicUrl;
    const column = slot === "capa" ? "capa_url" : "contracapa_url";
    const { error: dbErr } = await supabase
      .from("firm_settings")
      .update({ [column]: url, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setBusy(null);
    if (dbErr) {
      toast.error("Erro ao salvar", { description: dbErr.message });
      return;
    }
    if (slot === "capa") setCapa(url);
    else setContracapa(url);
    toast.success(`${slot === "capa" ? "Capa" : "Contracapa"} atualizada`);
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h3 className="font-semibold">Capa e contracapa do relatório</h3>
          <p className="text-xs text-muted-foreground">
            Imagens de página inteira (ideal A4 retrato, PNG/JPG, ~1240×1754px ou maior).
            Usadas como primeira e última página do PDF.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Uploader
            label="Capa (1ª página)"
            url={capa}
            busy={busy === "capa"}
            onPick={(f) => upload("capa", f)}
          />
          <Uploader
            label="Contracapa (última página)"
            url={contracapa}
            busy={busy === "contracapa"}
            onPick={(f) => upload("contracapa", f)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Uploader({
  label,
  url,
  busy,
  onPick,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  onPick: (f: File) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex aspect-[1/1.414] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>
      <label className="block">
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.currentTarget.value = "";
          }}
        />
        <Button asChild variant="outline" size="sm" className="w-full" disabled={busy}>
          <span>
            <UploadCloud className="mr-1.5 h-4 w-4" />
            {busy ? "Enviando…" : url ? "Trocar imagem" : "Enviar imagem"}
          </span>
        </Button>
      </label>
    </div>
  );
}
