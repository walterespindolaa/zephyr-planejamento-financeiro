import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ZephyrLogo } from "@/components/brand/ZephyrLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function TrocarSenha() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres");
      return;
    }
    if (senha !== confirma) {
      toast.error("As senhas não conferem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setSaving(false);
      toast.error("Erro ao atualizar senha", { description: error.message });
      return;
    }
    if (user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", user.id);
      await refreshProfile();
    }
    setSaving(false);
    toast.success("Senha atualizada");
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <ZephyrLogo variant="light" size={36} />
        </div>
        <div className="rounded-2xl bg-card p-8 shadow-elevated">
          <h1 className="mb-1 text-xl font-bold">Criar nova senha</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Por segurança, defina sua senha pessoal para continuar.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirma">Confirmar senha</Label>
              <Input
                id="confirma"
                type="password"
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Salvando…" : "Salvar e entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
