// Edge Function: admin-create-user
// Cria um usuário no Supabase Auth com senha temporária e papel definido,
// somente quando o solicitante é admin. Força troca de senha no 1º acesso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function gerarSenhaTemporaria(): string {
  // 12 chars: letras + números + símbolo, fácil de digitar uma vez
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = "abcdefghijkmnpqrstuvwxyz";
  const n = "23456789";
  const s = "!@#$%";
  const pick = (set: string, k: number) =>
    Array.from({ length: k }, () => set[Math.floor(Math.random() * set.length)]).join("");
  return pick(a, 3) + pick(b, 4) + pick(n, 3) + pick(s, 2);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente com o JWT do solicitante (para verificar quem é)
    const caller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await caller.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Unauthorized" }, 401);

    // Cliente admin (service role) para operações privilegiadas
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verifica se o solicitante é admin
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();
    if (callerProfile?.role !== "admin") {
      return json({ error: "Apenas o administrador pode criar usuários." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const nome = (body.nome ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role ?? "assessor";
    if (!nome || !email) return json({ error: "Informe nome e e-mail." }, 400);
    if (!["admin", "planejadora", "assessor"].includes(role)) {
      return json({ error: "Papel inválido." }, 400);
    }

    // 1) garante o papel no roster (o trigger aplica no perfil)
    await admin
      .from("team_roster")
      .upsert({ email, full_name: nome, role }, { onConflict: "email" });

    // 2) cria o usuário com senha temporária
    const tempPassword = gerarSenhaTemporaria();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // já pode logar sem confirmar e-mail
      user_metadata: { full_name: nome },
    });
    if (createErr) {
      const msg = createErr.message.includes("already")
        ? "Já existe um usuário com esse e-mail."
        : createErr.message;
      return json({ error: msg }, 400);
    }

    // 3) marca para trocar senha no 1º acesso e garante papel
    await admin
      .from("profiles")
      .update({ role, full_name: nome, must_change_password: true })
      .eq("user_id", created.user!.id);

    return json({ ok: true, email, tempPassword }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
