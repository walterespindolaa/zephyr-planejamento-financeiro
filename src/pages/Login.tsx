import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseConfigured } from "@/integrations/supabase/client";
import { ZephyrLogo } from "@/components/brand/ZephyrLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error });
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <ZephyrLogo variant="light" size={40} />
        </div>
        <div className="rounded-2xl bg-card p-8 shadow-elevated">
          <h1 className="mb-1 text-xl font-bold text-foreground">Entrar</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Plataforma de planejamento financeiro Zephyr
          </p>
          {!supabaseConfigured && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              Configuração ausente: defina <strong>VITE_SUPABASE_URL</strong> e{" "}
              <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong> nas Environment Variables da Vercel
              e refaça o deploy.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-sidebar-foreground/50">
          Acesso restrito à equipe Zephyr
        </p>
      </div>
    </div>
  );
}
