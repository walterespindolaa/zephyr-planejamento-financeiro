import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/useTeam";
import { ROLE_LABEL, type UserRole } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, UserPlus, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import BrandingUpload from "@/components/equipe/BrandingUpload";

interface RosterRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  ativo: boolean;
}

const ROLES: UserRole[] = ["assessor", "planejadora", "admin"];

export default function Equipe() {
  const qc = useQueryClient();
  const { data: team = [] } = useTeam();

  const roster = useQuery({
    queryKey: ["roster"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_roster")
        .select("*")
        .order("created_at", { ascending: true });
      return (data as RosterRow[]) ?? [];
    },
  });

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("assessor");
  const [saving, setSaving] = useState(false);
  const [cred, setCred] = useState<{ email: string; senha: string } | null>(null);

  const addMember = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { nome: nome.trim(), email: email.trim().toLowerCase(), role },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error || error?.message || "Erro desconhecido";
      toast.error("Não foi possível criar o usuário", { description: msg });
      return;
    }
    setCred({ email: (data as any).email, senha: (data as any).tempPassword });
    setNome("");
    setEmail("");
    setRole("assessor");
    roster.refetch();
    qc.invalidateQueries({ queryKey: ["team"] });
    toast.success("Usuário criado no Supabase", {
      description: "Copie a senha temporária e envie para a pessoa.",
    });
  };

  const copyCred = () => {
    if (!cred) return;
    navigator.clipboard.writeText(
      `Acesso Zephyr\nE-mail: ${cred.email}\nSenha temporária: ${cred.senha}\n(troque a senha no primeiro acesso)`
    );
    toast.success("Credenciais copiadas");
  };

  const updateRole = async (id: string, newRole: UserRole) => {
    await supabase.from("team_roster").update({ role: newRole }).eq("id", id);
    roster.refetch();
  };

  const removeMember = async (id: string) => {
    await supabase.from("team_roster").delete().eq("id", id);
    roster.refetch();
  };

  // perfis já ativos (que fizeram login)
  const profileByEmail = Object.fromEntries(
    team.map((p) => [(p.email ?? "").toLowerCase(), p])
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Adicione um membro (nome + e-mail + papel) e o sistema cria o acesso no Supabase com
          uma <strong>senha temporária</strong>. A pessoa troca a senha no primeiro acesso.
        </p>
      </div>

      {/* Adicionar membro */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <UserPlus className="h-4 w-4" /> Adicionar membro
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="nome@zephyrinvestimentos.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={addMember} disabled={saving}>
            {saving ? "Criando acesso…" : "Criar usuário"}
          </Button>

          {cred && (
            <div className="rounded-lg border border-success/30 bg-success/10 p-4">
              <div className="mb-2 flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-semibold">Acesso criado</span>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">E-mail:</span> {cred.email}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Senha temporária:</span>{" "}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono">
                  {cred.senha}
                </code>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Envie para a pessoa. No primeiro login ela será obrigada a trocar a senha.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={copyCred}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar credenciais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista do roster */}
      <Card>
        <CardContent className="space-y-2 py-5">
          <h3 className="font-semibold">Membros</h3>
          {(roster.data ?? []).map((m) => {
            const ativo = profileByEmail[m.email.toLowerCase()];
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                    {m.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ativo ? (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success"
                    >
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Aguardando login
                    </Badge>
                  )}
                  <Select
                    value={m.role}
                    onValueChange={(v) => updateRole(m.id, v as UserRole)}
                  >
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {m.role !== "admin" && (
                    <button onClick={() => removeMember(m.id)} title="Remover">
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {(roster.data ?? []).length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">Nenhum membro no roster.</p>
          )}
        </CardContent>
      </Card>

      <BrandingUpload />

      <p className="text-xs text-muted-foreground">
        Observação: alterar o papel aqui já vale para quem ainda não fez login. Para quem já
        é “Ativo”, ajuste o papel direto na tabela <code>profiles</code> do Supabase (uma tela
        de gestão de perfis ativos pode ser adicionada depois).
      </p>
    </div>
  );
}
