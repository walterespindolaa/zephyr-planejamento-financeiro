import { Info } from "lucide-react";

/** Caixa de dica/informativo no topo de cada aba, pra instruir quem usa. */
export default function TabHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-xs leading-relaxed text-foreground/75">{children}</p>
    </div>
  );
}
