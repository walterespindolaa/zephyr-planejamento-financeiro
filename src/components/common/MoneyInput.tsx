import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Campo monetário em R$ (ex.: R$ 15.529,90). Digite só os números — vão preenchendo
 * da direita pra esquerda (centavos). Fica vazio quando zero. Comita no blur.
 */
export default function MoneyInput({
  value,
  onCommit,
  className,
  placeholder = "R$ 0,00",
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
  placeholder?: string;
}) {
  // guarda os centavos como string de dígitos
  const [digits, setDigits] = useState<string>(value ? String(Math.round(value * 100)) : "");

  useEffect(() => {
    setDigits(value ? String(Math.round(value * 100)) : "");
  }, [value]);

  const display = digits ? fmt(parseInt(digits, 10)) : "";

  return (
    <Input
      className={cn("h-9 text-right", className)}
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
        setDigits(d);
      }}
      onBlur={() => onCommit(digits ? parseInt(digits, 10) / 100 : 0)}
    />
  );
}
