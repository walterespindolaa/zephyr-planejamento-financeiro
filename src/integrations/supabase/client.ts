import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Aviso útil em dev — preencha o .env (veja .env.example)
  console.warn(
    "[Zephyr] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY não definidos. Configure o .env."
  );
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_KEY ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
