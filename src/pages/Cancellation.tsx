import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const Cancellation = () => {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-8">
            Politica de Cancelamento
          </h1>

          <Card className="mb-8">
            <CardContent className="prose prose-slate dark:prose-invert max-w-none p-6 md:p-8">
              <p className="text-muted-foreground mb-6">
                Ultima atualizacao: Janeiro de 2024
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">1. Cancelamento de Assinatura</h2>
              <p>
                Você pode cancelar sua assinatura a qualquer momento através da sua área do
                paciente ou entrando em contato com nosso suporte. O cancelamento será
                processado conforme as regras abaixo.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">2. Planos Mensais</h2>
              <div className="bg-muted/50 p-4 rounded-lg my-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Importante sobre Planos Mensais</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Os planos mensais possuem fidelidade mínima de 12 meses. O cancelamento
                      antecipado implica no pagamento das parcelas restantes.
                    </p>
                  </div>
                </div>
              </div>
              <ul className="list-disc pl-6 mt-2">
                <li>O cancelamento pode ser solicitado a qualquer momento</li>
                <li>Em caso de cancelamento antes de 12 meses, será cobrada multa de 50% das parcelas restantes</li>
                <li>O acesso aos serviços continua até o fim do período já pago</li>
                <li>Não há reembolso de valores já pagos</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">3. Planos Anuais</h2>
              <ul className="list-disc pl-6 mt-2">
                <li>Planos anuais são pagos integralmente no momento da contratação</li>
                <li>O cancelamento pode ser solicitado nos primeiros 7 dias (direito de arrependimento)</li>
                <li>Após 7 dias, não há reembolso proporcional</li>
                <li>O acesso continua até o fim da vigência anual</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">4. Consultas Avulsas</h2>
              <ul className="list-disc pl-6 mt-2">
                <li>Consultas avulsas podem ser canceladas até 2 horas antes do horário agendado</li>
                <li>Cancelamentos dentro de 2 horas não são reembolsáveis</li>
                <li>Em caso de não comparecimento (no-show), não há reembolso</li>
                <li>Reagendamentos são permitidos com até 2 horas de antecedência</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">5. Pedidos de Medicamentos</h2>
              <ul className="list-disc pl-6 mt-2">
                <li>Pedidos podem ser cancelados antes da preparação</li>
                <li>Após início da preparação, o cancelamento não é possível</li>
                <li>Medicamentos controlados não podem ser devolvidos (ANVISA)</li>
                <li>Problemas com produtos devem ser reportados em até 7 dias</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">6. Reembolsos</h2>
              <p>Quando aplicável, os reembolsos são processados da seguinte forma:</p>
              <ul className="list-disc pl-6 mt-2">
                <li><strong>Cartão de crédito:</strong> estorno em até 2 faturas</li>
                <li><strong>PIX:</strong> devolução em até 5 dias úteis</li>
                <li>O prazo pode variar de acordo com a instituição financeira</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">7. Como Cancelar</h2>
              <p>Para solicitar o cancelamento:</p>
              <ol className="list-decimal pl-6 mt-2">
                <li>Acesse sua área do paciente</li>
                <li>Vá em "Meu Plano" → "Gerenciar assinatura"</li>
                <li>Clique em "Cancelar assinatura"</li>
                <li>Confirme o cancelamento</li>
              </ol>
              <p className="mt-4">
                Ou entre em contato com nosso suporte:
              </p>
              <ul className="list-disc pl-6 mt-2">
                <li>E-mail: cancelamento@novitahomecare.com.br</li>
                <li>Telefone: (61) 3041-3218</li>
                <li>WhatsApp: (61) 99999-9999</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">8. Reativação</h2>
              <p>
                Após o cancelamento, você pode reativar sua assinatura a qualquer momento.
                A reativação estará sujeita aos planos e preços vigentes no momento da
                nova contratação.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Cancellation;
