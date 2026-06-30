import CrudList from "./CrudList";
import SaveBar from "./SaveBar";
import TabHint from "./TabHint";
import { Card, CardContent } from "@/components/ui/card";

const CAT_RECEITA = [
  "Salário",
  "Pró-labore",
  "Aluguel recebido",
  "Proventos/Investimentos",
  "Comissões",
  "Bônus/13º",
  "Aposentadoria/INSS",
  "Outros",
].map((c) => ({ value: c, label: c }));

const CAT_DESPESA = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Vestuário",
  "Serviços/Assinaturas",
  "Impostos",
  "Dívidas/Financiamentos",
  "Outros",
].map((c) => ({ value: c, label: c }));

export default function OrganizacaoTab({ clientId }: { clientId: string }) {
  return (
    <div className="space-y-4">
      <TabHint>
        Registre as <strong>entradas e saídas</strong> mensais do cliente. A categoria padroniza
        para os relatórios; a descrição é o que aparece para o cliente. Use <strong>"A partir de"</strong> e{" "}
        <strong>"Até"</strong> para itens com <strong>prazo determinado</strong> (ex.: um financiamento que
        termina em 12/2028 ou um salário até certa data) — em branco significa sem prazo. Itens já vencidos
        deixam de contar na capacidade de poupança.
      </TabHint>
      <Card>
        <CardContent className="space-y-3 py-5">
          <div>
            <h3 className="font-semibold">Receitas</h3>
            <p className="text-xs text-muted-foreground">
              Categoria padroniza (para relatórios); a descrição é o que aparece para o cliente.
            </p>
          </div>
          <CrudList
            clientId={clientId}
            table="client_receitas"
            addLabel="Adicionar receita"
            defaults={{ recorrente: true, valor: 0, categoria: "Salário" }}
            fields={[
              {
                key: "categoria",
                label: "Categoria",
                type: "select",
                grow: 1.2,
                options: CAT_RECEITA,
              },
              {
                key: "descricao",
                label: "Descrição (aparece no relatório)",
                type: "text",
                grow: 2,
                placeholder: "Ex.: Salário Empresa X",
              },
              { key: "valor", label: "Valor", type: "money", grow: 1.2 },
              { key: "recorrente", label: "Mensal?", type: "bool", grow: 0.5 },
              { key: "data_inicio", label: "A partir de", type: "date", grow: 1 },
              { key: "data_fim", label: "Até (opcional)", type: "date", grow: 1 },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <div>
            <h3 className="font-semibold">Despesas</h3>
            <p className="text-xs text-muted-foreground">
              Categoria padroniza; a descrição detalha o que aparece para o cliente.
            </p>
          </div>
          <CrudList
            clientId={clientId}
            table="client_despesas"
            addLabel="Adicionar despesa"
            defaults={{ recorrente: true, valor: 0, tipo: "fixa", categoria: "Moradia" }}
            fields={[
              {
                key: "categoria",
                label: "Categoria",
                type: "select",
                grow: 1.2,
                options: CAT_DESPESA,
              },
              {
                key: "descricao",
                label: "Descrição (aparece no relatório)",
                type: "text",
                grow: 2,
                placeholder: "Ex.: Aluguel apartamento",
              },
              {
                key: "tipo",
                label: "Tipo",
                type: "select",
                grow: 1,
                options: [
                  { value: "fixa", label: "Fixa" },
                  { value: "variavel", label: "Variável" },
                  { value: "parcela", label: "Parcela" },
                  { value: "divida", label: "Dívida" },
                ],
              },
              { key: "valor", label: "Valor", type: "money", grow: 1.2 },
              { key: "recorrente", label: "Mensal?", type: "bool", grow: 0.5 },
              { key: "data_inicio", label: "A partir de", type: "date", grow: 1 },
              { key: "data_fim", label: "Até (opcional)", type: "date", grow: 1 },
            ]}
          />
        </CardContent>
      </Card>

      <SaveBar />
    </div>
  );
}
