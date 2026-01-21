import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-8">
            Termos de Uso
          </h1>

          <Card className="mb-8">
            <CardContent className="prose prose-slate dark:prose-invert max-w-none p-6 md:p-8">
              <p className="text-muted-foreground mb-6">
                Última atualização: Janeiro de 2024
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar os serviços da Novità Home Care e Telemedicina, você concorda
                com estes Termos de Uso. Se você não concordar com qualquer parte destes termos,
                não deverá utilizar nossos serviços.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">2. Descrição dos Serviços</h2>
              <p>
                A Novità oferece serviços de telemedicina, incluindo consultas médicas online,
                emissão de receitas digitais e programa de entrega de medicamentos. Nossos serviços
                são destinados a pessoas maiores de 18 anos ou menores acompanhados de responsável legal.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">3. Cadastro e Conta</h2>
              <p>
                Para utilizar nossos serviços, você deverá criar uma conta fornecendo informações
                verdadeiras e completas. Você é responsável por manter a confidencialidade de suas
                credenciais de acesso e por todas as atividades realizadas em sua conta.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">4. Consultas Médicas</h2>
              <p>
                As consultas de telemedicina são realizadas por médicos devidamente registrados no
                Conselho Regional de Medicina (CRM). O atendimento segue as normas estabelecidas
                pela Resolução CFM nº 2.314/2022 e demais regulamentações aplicáveis.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">5. Receitas e Atestados</h2>
              <p>
                As receitas médicas e atestados emitidos são documentos digitais com validade legal,
                assinados eletronicamente conforme padrão ICP-Brasil. A prescrição de medicamentos
                controlados segue a legislação vigente da ANVISA.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">6. Pagamentos</h2>
              <p>
                Os valores dos planos e serviços são informados no momento da contratação.
                O pagamento pode ser realizado por cartão de crédito ou PIX. Planos mensais
                são renovados automaticamente até o cancelamento.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">7. Limitações de Responsabilidade</h2>
              <p>
                A telemedicina não substitui o atendimento presencial em casos de emergência.
                Em situações de urgência médica, procure o pronto-socorro mais próximo ou ligue
                para o SAMU (192).
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">8. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo do site e aplicativo, incluindo textos, imagens, logotipos e
                software, são de propriedade da Novità Home Care ou de seus licenciadores e
                estão protegidos por leis de direitos autorais.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">9. Alterações nos Termos</h2>
              <p>
                A Novità reserva-se o direito de modificar estes Termos de Uso a qualquer momento.
                As alterações entram em vigor imediatamente após a publicação. Recomendamos a
                revisão periódica desta página.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">10. Contato</h2>
              <p>
                Para dúvidas sobre estes Termos de Uso, entre em contato conosco:
              </p>
              <ul className="list-disc pl-6 mt-2">
                <li>E-mail: contato@novitahomecare.com.br</li>
                <li>Telefone: (61) 3041-3218</li>
                <li>Endereço: Edifício Brasília Rádio Center, SRTVN Conjunto P, Sala SS 06, Asa Norte, Brasília - DF</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
