import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  UserPlus, 
  Video, 
  FileText, 
  Truck, 
  ArrowRight, 
  Check,
  Smartphone,
  Clock,
  Shield,
  CreditCard,
  MessageSquare,
  CalendarCheck
} from "lucide-react";

const HowItWorks = () => {
  const navigate = useNavigate();

  const mainSteps = [
    {
      icon: UserPlus,
      number: "01",
      title: "Cadastre-se na Plataforma",
      description: "Crie sua conta em poucos minutos informando seus dados básicos. Escolha o plano que melhor atende às suas necessidades ou opte por uma consulta avulsa.",
      details: [
        "Cadastro rápido com CPF, e-mail e telefone",
        "Escolha entre planos mensais ou anuais",
        "Adicione dependentes no plano familiar",
        "Pagamento seguro via cartão ou PIX"
      ]
    },
    {
      icon: Video,
      number: "02",
      title: "Realize sua Consulta",
      description: "Acesse a plataforma e inicie uma consulta imediata com clínico geral ou agende horário com especialistas. Atendimento 24 horas, 7 dias por semana.",
      details: [
        "Clínico geral disponível 24h para consulta imediata",
        "Especialistas com agendamento prévio",
        "Videochamada segura e de alta qualidade",
        "Menores de 12 anos com responsável presente"
      ]
    },
    {
      icon: FileText,
      number: "03",
      title: "Receba sua Receita Digital",
      description: "Ao final da consulta, receba sua receita médica digital ou atestado diretamente no celular via SMS e e-mail, com código de validação único.",
      details: [
        "Receita com assinatura digital do médico",
        "QR Code para validação em farmácias",
        "Código de protocolo enviado por SMS",
        "Acesso ao histórico na área do paciente"
      ]
    },
    {
      icon: Truck,
      number: "04",
      title: "Medicamentos em Casa",
      description: "Compre os medicamentos prescritos diretamente pela plataforma com descontos exclusivos e receba em até 24 horas no conforto do seu lar.",
      details: [
        "Descontos exclusivos para assinantes",
        "Entrega em até 24 horas úteis",
        "Pagamento no cartão ou PIX",
        "Opção de entrega programada para uso contínuo"
      ]
    }
  ];

  const features = [
    {
      icon: Clock,
      title: "Atendimento 24/7",
      description: "Consulte um médico a qualquer hora do dia ou da noite, inclusive finais de semana e feriados."
    },
    {
      icon: Shield,
      title: "Sigilo Garantido",
      description: "Seus dados de saúde são protegidos com criptografia e seguem todas as normas da LGPD."
    },
    {
      icon: Smartphone,
      title: "100% Digital",
      description: "Tudo pelo celular ou computador. Sem filas, sem deslocamento, sem burocracia."
    },
    {
      icon: CreditCard,
      title: "Pagamento Facilitado",
      description: "Cartão de crédito com parcelamento ou PIX. Planos mensais ou anuais com desconto."
    },
    {
      icon: MessageSquare,
      title: "Suporte Humanizado",
      description: "Equipe de atendimento disponível para tirar suas dúvidas e auxiliar no que precisar."
    },
    {
      icon: CalendarCheck,
      title: "Entrega Programada",
      description: "Para medicamentos de uso contínuo, programe entregas automáticas mensais."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground">
              Como funciona a{" "}
              <span className="gradient-text">Novità Telemedicina</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Em apenas 4 passos simples, você tem acesso a consultas médicas de qualidade 
              e seus medicamentos entregues em casa. Veja como é fácil cuidar da sua saúde.
            </p>
          </div>
        </div>
      </section>

      {/* Main Steps Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="space-y-24">
            {mainSteps.map((step, index) => (
              <div 
                key={step.number}
                className={`grid lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                <div className={`space-y-6 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-6xl font-heading font-bold gradient-text opacity-50">
                      {step.number}
                    </span>
                    <div className="w-16 h-16 rounded-2xl gradient-hero flex items-center justify-center">
                      <step.icon className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                    {step.title}
                  </h2>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                  <ul className="space-y-3">
                    {step.details.map((detail) => (
                      <li key={detail} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <Check className="h-4 w-4 text-accent" />
                        </div>
                        <span className="text-foreground">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`relative ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                  <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-10 scale-95" />
                  <Card className="relative bg-card border-border/50 shadow-elevated overflow-hidden">
                    <CardContent className="p-0">
                      <img 
                        src={[
                          "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=800&q=80",
                          "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
                          "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80",
                          "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80"
                        ][index]}
                        alt={step.title}
                        className="w-full h-[300px] lg:h-[400px] object-cover"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Vantagens exclusivas
            </h2>
            <p className="text-muted-foreground text-lg">
              Tudo pensado para facilitar o seu cuidado com a saúde.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card 
                key={feature.title}
                className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="gradient-hero border-0 shadow-elevated overflow-hidden">
            <CardContent className="p-8 md:p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground mb-4">
                Pronto para cuidar da sua saúde?
              </h2>
              <p className="text-primary-foreground/90 text-lg max-w-2xl mx-auto mb-8">
                Comece agora mesmo. Cadastre-se, escolha seu plano e tenha acesso a 
                consultas médicas 24 horas por dia.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  className="bg-card text-foreground hover:bg-card/90 shadow-lg"
                  onClick={() => navigate("/planos")}
                >
                  Ver Planos
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={() => navigate("/auth")}
                >
                  Criar Conta Gratuita
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HowItWorks;