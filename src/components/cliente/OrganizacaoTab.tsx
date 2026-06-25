import CrudList from "./CrudList";
import { Card, CardContent } from "@/components/ui/card";

export default function OrganizacaoTab({ clientId }: { clientId: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-5">
          <div>
            <h3 className="font-semibold">Receitas</h3>
            <p className="text-xs text-muted-foreground">
              Entradas do cliente. Alimentam receita média mensal e capacidade de poupança.
            </p>
          </div>
          <CrudList
            clientId={clientId}
            table="client_receitas"
            addLabel="Adicionar receita"
            defaults={{ recorrente: true, valor: 0 }}
            fields={[
              { key: "categoria", label: "Categoria", type: "text", grow: 2, placeholder: "Salário, aluguel…" },
              { key: "valor", label: "Valor (R$)", type: "money" },
              { key: "data", label: "Data", type: "date" },
              { key: "recorrente", label: "Mensal?", type: "bool", grow: 0.6 },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <div>
            <h3 className="font-semibold">Despesas</h3>
            <p className="text-xs text-muted-foreground">
              Saídas do cliente. Alimentam despesa média mensal e custo de vida.
            </p>
          </div>
          <CrudList
            clientId={clientId}
            table="client_despesas"
            addLabel="Adicionar despesa"
            defaults={{ recorrente: true, valor: 0, tipo: "fixa" }}
            fields={[
              { key: "categoria", label: "Categoria", type: "text", grow: 2, placeholder: "Moradia, alimentação…" },
              {
                key: "tipo",
                label: "Tipo",
                type: "select",
                options: [
                  { value: "fixa", label: "Fixa" },
                  { value: "variavel", label: "Variável" },
                  { value: "parcela", label: "Parcela" },
                  { value: "divida", label: "Dívida" },
                ],
              },
              { key: "valor", label: "Valor (R$)", type: "money" },
              { key: "recorrente", label: "Mensal?", type: "bool", grow: 0.6 },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
