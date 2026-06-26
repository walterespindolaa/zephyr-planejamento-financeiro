import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  ClipboardList,
  Wallet,
  Target,
  Mountain,
  FileText,
  Handshake,
  FolderOpen,
  History,
  Calculator,
  Scale,
  ShieldCheck,
  Activity,
  FileSearch,
} from "lucide-react";
import { useClient } from "@/hooks/useClients";
import { useTeam } from "@/hooks/useTeam";
import { STATUS_LABEL } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ClienteVisaoGeral from "@/components/cliente/ClienteVisaoGeral";
import ClienteCRM from "@/components/cliente/ClienteCRM";
import OrganizacaoTab from "@/components/cliente/OrganizacaoTab";
import PlanejamentoTab from "@/components/cliente/PlanejamentoTab";
import ProjecaoTab from "@/components/cliente/ProjecaoTab";
import RelatorioTab from "@/components/cliente/RelatorioTab";
import ClienteOportunidades from "@/components/cliente/ClienteOportunidades";
import ClienteArquivos from "@/components/cliente/ClienteArquivos";
import RevisaoTab from "@/components/cliente/RevisaoTab";
import SimuladorTab from "@/components/cliente/SimuladorTab";
import ConsorcioTab from "@/components/cliente/ConsorcioTab";
import ProtecaoSegurosTab from "@/components/cliente/ProtecaoSegurosTab";
import AnaliseTab from "@/components/cliente/AnaliseTab";
import ImportarXPTab from "@/components/cliente/ImportarXPTab";

const SECTIONS = [
  { key: "visao", label: "Visão Geral", icon: LayoutDashboard },
  { key: "crm", label: "CRM", icon: ClipboardList },
  { key: "importar", label: "Importar XP", icon: FileSearch },
  { key: "organizacao", label: "Organização", icon: Wallet },
  { key: "planejamento", label: "Planejamento", icon: Target },
  { key: "analise", label: "Análise mensal", icon: Activity },
  { key: "projecao", label: "Projeção", icon: Mountain },
  { key: "simulador", label: "Simulador", icon: Calculator },
  { key: "consorcio", label: "Consórcio × Financ.", icon: Scale },
  { key: "protecao", label: "Proteção e Seguros", icon: ShieldCheck },
  { key: "oportunidades", label: "Oportunidades", icon: Handshake },
  { key: "arquivos", label: "Arquivos", icon: FolderOpen },
  { key: "relatorio", label: "Relatório", icon: FileText },
  { key: "revisao", label: "Revisão", icon: History },
];

export default function ClienteDetalhe() {
  const { id } = useParams();
  const { data: client, isLoading } = useClient(id);
  const { data: team = [] } = useTeam();
  const [active, setActive] = useState("visao");
  const nameById = useMemo(() => Object.fromEntries(team.map((t) => [t.user_id, t.full_name])), [team]);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!client)
    return (
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
        <p className="mt-4">Cliente não encontrado ou sem acesso.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-screen-2xl">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
            {client.nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{client.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {client.email || "sem e-mail"} ·{" "}
              {client.assessor_id ? nameById[client.assessor_id] : "sem assessor"}
            </p>
          </div>
        </div>
        <Badge variant="outline">{STATUS_LABEL[client.status]}</Badge>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Menu lateral por cliente */}
        <nav className="flex gap-2 overflow-x-auto md:w-52 md:shrink-0 md:flex-col md:overflow-visible">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                active === s.key
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-muted"
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        {/* Conteúdo da seção */}
        <div className="min-w-0 flex-1">
          {active === "visao" && <ClienteVisaoGeral client={client} />}
          {active === "crm" && <ClienteCRM client={client} />}
          {active === "importar" && <ImportarXPTab clientId={client.id} />}
          {active === "organizacao" && <OrganizacaoTab clientId={client.id} />}
          {active === "planejamento" && <PlanejamentoTab clientId={client.id} />}
          {active === "analise" && <AnaliseTab clientId={client.id} />}
          {active === "projecao" && <ProjecaoTab clientId={client.id} />}
          {active === "simulador" && <SimuladorTab clientId={client.id} />}
          {active === "consorcio" && <ConsorcioTab />}
          {active === "protecao" && <ProtecaoSegurosTab clientId={client.id} />}
          {active === "oportunidades" && <ClienteOportunidades clientId={client.id} />}
          {active === "arquivos" && <ClienteArquivos clientId={client.id} />}
          {active === "relatorio" && <RelatorioTab client={client} />}
          {active === "revisao" && <RevisaoTab client={client} />}
        </div>
      </div>
    </div>
  );
}
