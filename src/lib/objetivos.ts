import {
  Plane,
  Globe,
  CarFront,
  Car,
  Home,
  Heart,
  Baby,
  GraduationCap,
  Stethoscope,
  Palmtree,
  Sparkles,
} from "lucide-react";

export const OBJETIVO_TIPOS = [
  { value: "viagem_nacional", icon: Plane, label: "Viagem nacional" },
  { value: "viagem_internacional", icon: Globe, label: "Viagem internacional" },
  { value: "troca_carro", icon: CarFront, label: "Troca de carro" },
  { value: "compra_carro", icon: Car, label: "Compra de carro" },
  { value: "compra_imovel", icon: Home, label: "Compra de imóvel" },
  { value: "casamento", icon: Heart, label: "Festa de casamento" },
  { value: "ter_filho", icon: Baby, label: "Ter um filho" },
  { value: "faculdade", icon: GraduationCap, label: "Faculdade" },
  { value: "intercambio", icon: Globe, label: "Intercâmbio" },
  { value: "residencia_medica", icon: Stethoscope, label: "Residência médica" },
  { value: "sabatico", icon: Palmtree, label: "Período sabático" },
  { value: "outro", icon: Sparkles, label: "Outros" },
];

export const FREQUENCIAS = [
  { value: "unico", label: "Objetivo único" },
  { value: "1x_ano", label: "1× por ano" },
  { value: "2x_ano", label: "2× por ano" },
  { value: "3x_ano", label: "3× por ano" },
  { value: "4x_ano", label: "4× por ano" },
  { value: "5x_ano", label: "5× por ano" },
  { value: "1x_2anos", label: "1× a cada 2 anos" },
  { value: "1x_3anos", label: "1× a cada 3 anos" },
  { value: "1x_4anos", label: "1× a cada 4 anos" },
  { value: "1x_5anos", label: "1× a cada 5 anos" },
];

export function getTipoConfig(value: string) {
  return OBJETIVO_TIPOS.find((t) => t.value === value) ?? OBJETIVO_TIPOS[OBJETIVO_TIPOS.length - 1];
}

function annualMult(freq: string): number {
  return { "1x_ano": 1, "2x_ano": 2, "3x_ano": 3, "4x_ano": 4, "5x_ano": 5 }[freq] || 0;
}
function multiYearMonths(freq: string): number {
  return { "1x_2anos": 24, "1x_3anos": 36, "1x_4anos": 48, "1x_5anos": 60 }[freq] || 0;
}
function monthsFromNow(data: string | null): number {
  if (!data) return 0;
  const target = new Date(data + "T12:00:00");
  return Math.max(1, Math.round((target.getTime() - Date.now()) / (30.4375 * 24 * 60 * 60 * 1000)));
}
function calcPMT(fv: number, r: number, n: number): number {
  if (n <= 0) return 0;
  if (r <= 0) return fv / Math.max(n, 1);
  return (fv * r) / (Math.pow(1 + r, n) - 1);
}

/** Aporte mensal sugerido (mesma metodologia do Atlas). */
export function calcPoupancaMensal(
  valor: number,
  freq: string | null,
  dataObjetivo: string | null,
  taxaRealMensal: number
): number {
  const f = freq || "unico";
  const am = annualMult(f);
  if (am > 0) return (valor * am) / 12;
  const my = multiYearMonths(f);
  const n = my > 0 ? my : monthsFromNow(dataObjetivo);
  return calcPMT(valor, taxaRealMensal, n);
}

/** Taxa real mensal a partir de nominal/inflação anuais (decimais). */
export function taxaRealMensal(nominalAnual: number, inflacaoAnual: number): number {
  const realAnual = (1 + nominalAnual) / (1 + inflacaoAnual) - 1;
  return Math.pow(1 + realAnual, 1 / 12) - 1;
}
