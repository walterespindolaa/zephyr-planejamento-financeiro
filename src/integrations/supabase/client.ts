import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** true quando as variáveis de ambiente estão presentes (local .env ou Vercel). */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (!supabaseConfigured) {
  console.error(
    "[Zephyr] Variáveis ausentes: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY " +
      "(no .env local e nas Environment Variables da Vercel)."
  );
}

// Placeholders evitam que o createClient lance erro na inicialização (tela branca).
// Se não configurado, as chamadas falham de forma controlada e a UI mostra um aviso.
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_KEY || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
