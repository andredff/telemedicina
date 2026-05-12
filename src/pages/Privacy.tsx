import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-8">
            Politica de Privacidade
          </h1>

          <Card className="mb-8">
            <CardContent className="prose prose-slate dark:prose-invert max-w-none p-6 md:p-8">
              <p className="text-muted-foreground mb-6">
                Ultima atualizacao: Janeiro de 2024
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">1. Introducao</h2>
              <p>
                A Novità Home Care e Telemedicina ("Novità", "nós" ou "nosso") está comprometida
                em proteger a privacidade de seus usuários. Esta Política de Privacidade descreve
                como coletamos, usamos, armazenamos e protegemos suas informações pessoais.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">2. Dados Coletados</h2>
              <p>Coletamos os seguintes tipos de informações:</p>
              <ul className="list-disc pl-6 mt-2">
                <li><strong>Dados de identificação:</strong> nome completo, CPF, data de nascimento, gênero</li>
                <li><strong>Dados de contato:</strong> e-mail, telefone, endereço</li>
                <li><strong>Dados de saúde:</strong> histórico médico, sintomas relatados, receitas e atestados</li>
                <li><strong>Dados de pagamento:</strong> informações do cartão (processadas de forma segura)</li>
                <li><strong>Dados de uso:</strong> informações sobre como você utiliza nossos serviços</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">3. Uso dos Dados</h2>
              <p>Utilizamos suas informações para:</p>
              <ul className="list-disc pl-6 mt-2">
                <li>Prestar os serviços de telemedicina contratados</li>
                <li>Processar pagamentos e gerenciar sua assinatura</li>
                <li>Enviar comunicações sobre consultas e receitas</li>
                <li>Melhorar nossos serviços e experiência do usuário</li>
                <li>Cumprir obrigações legais e regulatórias</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">4. Compartilhamento de Dados</h2>
              <p>
                Seus dados de saúde são confidenciais e protegidos pelo sigilo médico. Compartilhamos
                informações apenas com:
              </p>
              <ul className="list-disc pl-6 mt-2">
                <li>Médicos e profissionais de saúde envolvidos em seu atendimento</li>
                <li>Farmácias parceiras (apenas para dispensação de medicamentos)</li>
                <li>Processadores de pagamento (dados financeiros)</li>
                <li>Autoridades, quando exigido por lei</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">5. Segurança dos Dados</h2>
              <p>
                Implementamos medidas técnicas e organizacionais para proteger suas informações,
                incluindo:
              </p>
              <ul className="list-disc pl-6 mt-2">
                <li>Criptografia de dados em trânsito e em repouso</li>
                <li>Controle de acesso baseado em função</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups regulares</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">6. Seus Direitos (LGPD)</h2>
              <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
              <ul className="list-disc pl-6 mt-2">
                <li>Confirmar a existência de tratamento de dados</li>
                <li>Acessar seus dados pessoais</li>
                <li>Corrigir dados incompletos ou desatualizados</li>
                <li>Solicitar a eliminação de dados desnecessários</li>
                <li>Revogar o consentimento</li>
                <li>Portabilidade dos dados</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">7. Retenção de Dados</h2>
              <p>
                Mantemos seus dados pelo tempo necessário para prestar os serviços e cumprir
                obrigações legais. Dados médicos são mantidos conforme exigências do CFM e
                legislação de saúde.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">8. Cookies</h2>
              <p>
                Utilizamos cookies para melhorar a experiência de navegação e analisar o uso
                do site. Você pode configurar seu navegador para recusar cookies, mas isso
                pode afetar algumas funcionalidades.
              </p>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">9. Contato do DPO</h2>
              <p>
                Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em
                contato com nosso Encarregado de Proteção de Dados:
              </p>
              <ul className="list-disc pl-6 mt-2">
                <li>E-mail: privacidade@novitahomecare.com.br</li>
                <li>Telefone: (61) 3041-3218</li>
              </ul>

              <h2 className="text-xl font-heading font-semibold mt-8 mb-4">10. Alterações</h2>
              <p>
                Esta política pode ser atualizada periodicamente. Notificaremos sobre alterações
                significativas por e-mail ou através de aviso em nosso site.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
