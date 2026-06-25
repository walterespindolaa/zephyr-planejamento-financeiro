import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import MoneyInput from "@/components/common/MoneyInput";

export type FieldType = "text" | "number" | "money" | "date" | "bool" | "select";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  /** largura relativa (flex-grow). default 1 */
  grow?: number;
  placeholder?: string;
}

interface Row {
  id: string;
  [k: string]: unknown;
}

interface CrudListProps {
  clientId: string;
  table: string;
  fields: FieldDef[];
  /** valores padrão ao adicionar nova linha */
  defaults?: Record<string, unknown>;
  emptyLabel?: string;
  addLabel?: string;
}

/**
 * Lista CRUD genérica com salvamento automático (onBlur / onChange).
 * Usada nas telas de input do Planejamento e Organização.
 */
export default function CrudList({
  clientId,
  table,
  fields,
  defaults = {},
  emptyLabel = "Nenhum item.",
  addLabel = "Adicionar",
}: CrudListProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from(table)
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, table]);

  const addRow = async () => {
    const { data, error } = await supabase
      .from(table)
      .insert({ client_id: clientId, ...defaults })
      .select("*")
      .single();
    if (error) {
      toast.error("Erro ao adicionar", { description: error.message });
      return;
    }
    setRows((r) => [...r, data as Row]);
  };

  const updateField = async (id: string, key: string, value: unknown) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    const { error } = await supabase.from(table).update({ [key]: value }).eq("id", id);
    if (error) toast.error("Erro ao salvar", { description: error.message });
  };

  const delRow = async (id: string) => {
    await supabase.from(table).delete().eq("id", id);
    setRows((r) => r.filter((row) => row.id !== id));
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-2">
      {/* cabeçalho */}
      {rows.length > 0 && (
        <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:flex">
          {fields.map((f) => (
            <div key={f.key} style={{ flexGrow: f.grow ?? 1, flexBasis: 0 }}>
              {f.label}
            </div>
          ))}
          <div className="w-8" />
        </div>
      )}

      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center"
        >
          {fields.map((f) => (
            <div key={f.key} style={{ flexGrow: f.grow ?? 1, flexBasis: 0 }} className="w-full">
              <span className="mb-1 block text-xs text-muted-foreground sm:hidden">
                {f.label}
              </span>
              <FieldInput
                field={f}
                value={row[f.key]}
                onCommit={(v) => updateField(row.id, f.key, v)}
              />
            </div>
          ))}
          <button onClick={() => delRow(row.id)} className="self-end sm:self-center">
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}

      {rows.length === 0 && <p className="py-2 text-sm text-muted-foreground">{emptyLabel}</p>}

      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 h-4 w-4" /> {addLabel}
      </Button>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onCommit,
}: {
  field: FieldDef;
  value: unknown;
  onCommit: (v: unknown) => void;
}) {
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  useEffect(() => {
    setLocal(value == null ? "" : String(value));
  }, [value]);

  if (field.type === "bool") {
    return (
      <div className="flex h-9 items-center">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(c) => onCommit(Boolean(c))}
        />
      </div>
    );
  }

  if (field.type === "money") {
    return (
      <MoneyInput
        value={typeof value === "number" ? value : Number(value) || 0}
        onCommit={(v) => onCommit(v)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <Select value={String(value ?? "")} onValueChange={(v) => onCommit(v)}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={field.placeholder ?? "Selecione"} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const isNum = field.type === "number" || field.type === "money";
  return (
    <Input
      className="h-9"
      type={field.type === "date" ? "date" : isNum ? "number" : "text"}
      inputMode={isNum ? "decimal" : undefined}
      step={field.type === "money" ? "0.01" : undefined}
      placeholder={field.placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const v = isNum ? (local === "" ? 0 : Number(local)) : local || null;
        onCommit(v);
      }}
    />
  );
}
