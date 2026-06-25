import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useClient } from "@/hooks/useClients";
import { useTeam } from "@/hooks/useTeam";
import { STATUS_LABEL } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import ClienteCRM from "@/components/cliente/ClienteCRM";
import OrganizacaoTab from "@/components/cliente/OrganizacaoTab";
import PlanejamentoTab from "@/components/cliente/PlanejamentoTab";
import { useMemo } from "react";

export default function ClienteDetalhe() {
  const { id } = useParams();
  const { data: client, isLoading } = useClient(id);
  const { data: team = [] } = useTeam();
  const nameById = useMemo(
    () => Object.fromEntries(team.map((t) => [t.user_id, t.full_name])),
    [team]
  );

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!client)
    return (
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <p className="mt-4">Cliente não encontrado ou sem acesso.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
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

      <Tabs defaultValue="crm">
        <TabsList className="mb-4 flex w-full flex-wrap justify-start">
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="organizacao">Organização</TabsTrigger>
          <TabsTrigger value="planejamento">Planejamento</TabsTrigger>
          <TabsTrigger value="projecao">Projeção</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
        </TabsList>

        <TabsContent value="crm">
          <ClienteCRM client={client} />
        </TabsContent>

        <TabsContent value="organizacao">
          <OrganizacaoTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="planejamento">
          <PlanejamentoTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="projecao">
          <Placeholder
            title="Projeção · Vista da Montanha"
            desc="Eventos de vida no tempo e impacto patrimonial em tempo real, usando o life_projection engine reaproveitado do Atlas."
          />
        </TabsContent>
        <TabsContent value="relatorio">
          <Placeholder
            title="Relatório editável + PDF Zephyr"
            desc="Geração via IA (Claude), edição rich-text (negrito, itálico, tópicos, fontes), salvar no cliente e exportar PDF com capa e contracapa Zephyr."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="py-10">
        <h3 className="mb-1 font-semibold">{title}</h3>
        <p className="max-w-2xl text-sm text-muted-foreground">{desc}</p>
        <Badge variant="outline" className="mt-4 border-primary/30 text-primary">
          Em construção
        </Badge>
      </CardContent>
    </Card>
  );
}
