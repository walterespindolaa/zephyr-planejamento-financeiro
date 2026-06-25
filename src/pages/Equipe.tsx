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
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

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

  const addMember = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("team_roster").insert({
      full_name: nome.trim(),
      email: email.trim().toLowerCase(),
      role,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao adicionar", { description: error.message });
      return;
    }
    setNome("");
    setEmail("");
    setRole("assessor");
    roster.refetch();
    toast.success("Membro adicionado ao roster", {
      description: "Agora crie o usuário no Supabase Auth com o mesmo e-mail.",
    });
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
          Adicione os membros aqui (e-mail + papel). Depois crie o usuário no Supabase Auth
          com o <strong>mesmo e-mail</strong> — no primeiro login o papel é aplicado.
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
            {saving ? "Adicionando…" : "Adicionar ao roster"}
          </Button>
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

      <p className="text-xs text-muted-foreground">
        Observação: alterar o papel aqui já vale para quem ainda não fez login. Para quem já
        é “Ativo”, ajuste o papel direto na tabela <code>profiles</code> do Supabase (uma tela
        de gestão de perfis ativos pode ser adicionada depois).
      </p>
    </div>
  );
}
