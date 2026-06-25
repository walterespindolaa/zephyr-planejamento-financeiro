export type UserRole = "admin" | "planejadora" | "assessor" | "pendente";
export type ClientStatus = "lead" | "ativo" | "inativo" | "arquivado";
export type ReportStatus = "rascunho" | "finalizado";

export interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  avatar_url: string | null;
  ativo: boolean;
  must_change_password?: boolean;
}

export interface Client {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  profissao: string | null;
  estado_civil: string | null;
  status: ClientStatus;
  assessor_id: string | null;
  planejadora_id: string | null;
  created_by: string | null;
  origem: string | null;
  endereco: string | null;
  info: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  author_id: string | null;
  content: string;
  tipo: string;
  pinned: boolean;
  created_at: string;
}

export interface ClientTask {
  id: string;
  client_id: string;
  author_id: string | null;
  title: string;
  done: boolean;
  due_date: string | null;
  created_at: string;
}

export interface ClientReport {
  id: string;
  client_id: string;
  titulo: string;
  content_html: string | null;
  snapshot: Record<string, unknown> | null;
  status: ReportStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  planejadora: "Planejadora",
  assessor: "Assessor",
  pendente: "Pendente",
};

export const STATUS_LABEL: Record<ClientStatus, string> = {
  lead: "Lead",
  ativo: "Ativo",
  inativo: "Inativo",
  arquivado: "Arquivado",
};
