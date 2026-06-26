import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";

/**
 * Os campos salvam automaticamente ao sair (blur). Este botão dá a confirmação
 * explícita: força o commit do campo ativo e avisa que está tudo salvo.
 */
export default function SaveBar({ label = "Salvar tudo" }: { label?: string }) {
  const salvar = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setTimeout(() => toast.success("Tudo salvo", { description: "As alterações são salvas automaticamente." }), 150);
  };
  return (
    <div className="sticky bottom-4 z-10 flex justify-end">
      <Button onClick={salvar} className="shadow-elevated">
        <Save className="mr-1.5 h-4 w-4" /> {label}
      </Button>
    </div>
  );
}
