import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import type { ClientStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function NovoCliente() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: team = [] } = useTeam();

  const advisors = team.filter((t) => t.role === "assessor" || t.role === "admin");
  const planners = team.filter((t) => t.role === "planejadora");

  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    profissao: "",
    status: "lead" as ClientStatus,
    assessor_id: role === "assessor" ? (user?.id ?? "") : "",
    planejadora_id: planners[0]?.user_id ?? "",
    origem: "",
    info: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        nome: form.nome.trim(),
        email: form.email || null,
        telefone: form.telefone || null,
        profissao: form.profissao || null,
        status: form.status,
        assessor_id: form.assessor_id || null,
        planejadora_id: form.planejadora_id || null,
        origem: form.origem || null,
        info: form.info || null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success("Cliente cadastrado");
    navigate(`/clientes/${data!.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Novo cliente / lead</h1>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-5 py-6">
            <Field label="Nome completo *">
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.telefone}
                  onChange={(e) => set("telefone", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Profissão">
                <Input
                  value={form.profissao}
                  onChange={(e) => set("profissao", e.target.value)}
                />
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Assessor responsável">
                <Select
                  value={form.assessor_id}
                  onValueChange={(v) => set("assessor_id", v)}
                  disabled={role === "assessor"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {advisors.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id}>
                        {a.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Planejadora">
                <Select
                  value={form.planejadora_id}
                  onValueChange={(v) => set("planejadora_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {planners.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Origem (como chegou)">
              <Input value={form.origem} onChange={(e) => set("origem", e.target.value)} />
            </Field>

            <Field label="Observações iniciais">
              <Textarea
                rows={3}
                value={form.info}
                onChange={(e) => set("info", e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Cadastrar cliente"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
