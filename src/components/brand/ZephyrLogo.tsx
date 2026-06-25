import { cn } from "@/lib/utils";

/**
 * Marca Zephyr — listras diagonais verdes em SVG (apenas o símbolo).
 * Usada em telas pequenas/avatares. O lockup completo (símbolo + "zephyr")
 * vem dos PNGs oficiais em /public via <ZephyrLogo />.
 */
export function ZephyrMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zephyr"
    >
      <g stroke="hsl(142 69% 42%)" strokeWidth="9" strokeLinecap="round">
        <line x1="16" y1="40" x2="40" y2="16" />
        <line x1="16" y1="84" x2="58" y2="42" />
        <line x1="34" y1="40" x2="50" y2="24" />
        <line x1="34" y1="86" x2="60" y2="60" />
        <line x1="52" y1="40" x2="68" y2="24" />
        <line x1="52" y1="86" x2="68" y2="70" />
      </g>
    </svg>
  );
}

interface ZephyrLogoProps {
  className?: string;
  /** "light" = logo de escrita branca (fundo escuro) · "dark" = escrita preta (fundo claro) */
  variant?: "light" | "dark";
  /** altura do logo em px */
  size?: number;
}

/**
 * Lockup oficial Zephyr (PNG). Proporção ~5.9:1 (3349×569).
 * Coloque os arquivos em /public:
 *   zephyr-logo-dark.png  (escrita preta)
 *   zephyr-logo-light.png (escrita branca)
 */
export function ZephyrLogo({ className, variant = "dark", size = 32 }: ZephyrLogoProps) {
  const src = variant === "light" ? "/zephyr-logo-light.png" : "/zephyr-logo-dark.png";
  return (
    <img
      src={src}
      alt="Zephyr"
      height={size}
      style={{ height: size, width: "auto" }}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}

export default ZephyrLogo;
