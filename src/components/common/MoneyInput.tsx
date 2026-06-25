import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Campo monetário em R$ (ex.: R$ 12.529,90). Digite só os números — a formatação
 * é automática (centavos da direita pra esquerda). Comita no blur.
 */
export default function MoneyInput({
  value,
  onCommit,
  className,
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
}) {
  const [local, setLocal] = useState<number>(value || 0);
  useEffect(() => setLocal(value || 0), [value]);

  return (
    <Input
      className={cn("h-9 text-right", className)}
      inputMode="numeric"
      value={fmt(local)}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "");
        setLocal(raw ? parseInt(raw, 10) / 100 : 0);
      }}
      onBlur={() => onCommit(local)}
    />
  );
}
