import CrudList from "./CrudList";
import AposentadoriaForm from "./AposentadoriaForm";
import ObjetivosManager from "./ObjetivosManager";
import { Card, CardContent } from "@/components/ui/card";

export default function PlanejamentoTab({ clientId }: { clientId: string }) {
  return (
    <div className="space-y-4">
      <Section
        title="Aposentadoria"
        desc="Base dos 3 cenários do relatório (Realidade, Consumo, Viver de Renda)."
      >
        <AposentadoriaForm clientId={clientId} />
      </Section>

      <Section title="Objetivos de vida" desc="Tipos prontos, aporte automático sugerido e progresso.">
        <ObjetivosManager clientId={clientId} />
      </Section>

      <Section
        title="Investimentos"
        desc="Patrimônio financeiro e reserva de emergência (marque a reserva)."
      >
        <CrudList
          clientId={clientId}
          table="client_investimentos"
          addLabel="Adicionar investimento"
          defaults={{ nome: "", valor_atual: 0, is_reserva_emergencia: false }}
          fields={[
            { key: "nome", label: "Nome", type: "text", grow: 2, placeholder: "Tesouro, FII…" },
            {
              key: "classe",
              label: "Classe",
              type: "select",
              options: [
                { value: "renda_fixa", label: "Renda fixa" },
                { value: "renda_variavel", label: "Renda variável" },
                { value: "fii", label: "FII" },
                { value: "exterior", label: "Exterior" },
                { value: "cripto", label: "Cripto" },
                { value: "outro", label: "Outro" },
              ],
            },
            { key: "valor_atual", label: "Valor (R$)", type: "money" },
            { key: "is_reserva_emergencia", label: "Reserva?", type: "bool", grow: 0.6 },
          ]}
        />
      </Section>

      <Section
        title="Bens e imóveis"
        desc="Patrimônio em bens (valor − dívida) e renda passiva de aluguéis."
      >
        <CrudList
          clientId={clientId}
          table="client_bens"
          addLabel="Adicionar bem"
          defaults={{ nome: "", valor: 0, divida_vinculada: 0, gera_renda: false, valor_renda: 0 }}
          fields={[
            { key: "nome", label: "Nome", type: "text", grow: 2, placeholder: "Apartamento…" },
            {
              key: "tipo",
              label: "Tipo",
              type: "select",
              options: [
                { value: "imovel", label: "Imóvel" },
                { value: "veiculo", label: "Veículo" },
                { value: "outro", label: "Outro" },
              ],
            },
            { key: "valor", label: "Valor (R$)", type: "money" },
            { key: "divida_vinculada", label: "Dívida (R$)", type: "money" },
            { key: "gera_renda", label: "Renda?", type: "bool", grow: 0.5 },
            { key: "valor_renda", label: "Renda/mês (R$)", type: "money" },
          ]}
        />
      </Section>

      <Section title="Dependentes" desc="Usados no panorama familiar do relatório.">
        <CrudList
          clientId={clientId}
          table="client_dependentes"
          addLabel="Adicionar dependente"
          defaults={{ nome: "" }}
          fields={[
            { key: "nome", label: "Nome", type: "text", grow: 2 },
            { key: "parentesco", label: "Parentesco", type: "text", placeholder: "Filho(a)…" },
            { key: "data_nascimento", label: "Nascimento", type: "date" },
          ]}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
