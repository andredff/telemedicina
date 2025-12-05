import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Video, 
  Pill, 
  Clock, 
  Shield, 
  Star, 
  ArrowRight, 
  Check, 
  Stethoscope,
  Truck,
  CalendarCheck,
  HeartPulse,
  Users
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Video,
      title: "Consultas Online 24h",
      description: "Médicos clínicos gerais disponíveis a qualquer hora do dia ou da noite.",
    },
    {
      icon: Stethoscope,
      title: "Especialistas",
      description: "Acesso a diversas especialidades médicas com agendamento facilitado.",
    },
    {
      icon: Pill,
      title: "Medicamentos em Casa",
      description: "Receba seus medicamentos com desconto e entrega rápida no conforto do seu lar.",
    },
    {
      icon: Shield,
      title: "Segurança Total",
      description: "Seus dados protegidos com criptografia e sigilo médico garantido.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Cadastre-se",
      description: "Crie sua conta em poucos minutos e escolha o plano ideal para você ou sua família.",
    },
    {
      number: "02",
      title: "Agende ou Inicie",
      description: "Consulte um clínico geral imediatamente ou agende com um especialista.",
    },
    {
      number: "03",
      title: "Receba sua Receita",
      description: "Ao final da consulta, receba sua receita digital com código de validação.",
    },
    {
      number: "04",
      title: "Medicamentos em Casa",
      description: "Compre seus medicamentos com desconto e receba em até 24 horas.",
    },
  ];

  const plans = [
    {
      name: "Bronze",
      price: "29,90",
      description: "Consultas ilimitadas com clínico geral",
      features: ["Clínico geral 24h", "Receitas digitais", "Desconto em medicamentos"],
      popular: false,
    },
    {
      name: "Prata",
      price: "49,90",
      description: "Bronze + 1 consulta com especialista/ano",
      features: ["Tudo do Bronze", "1 especialista/ano", "Prioridade no atendimento"],
      popular: false,
    },
    {
      name: "Ouro",
      price: "79,90",
      description: "Prata + 2 consultas com especialista/ano",
      features: ["Tudo do Prata", "2 especialistas/ano", "Desconto maior"],
      popular: true,
    },
    {
      name: "Platina",
      price: "129,90",
      description: "Ouro + check-up anual gratuito",
      features: ["Tudo do Ouro", "3 especialistas/ano", "Check-up anual"],
      popular: false,
    },
  ];

  const stats = [
    { value: "15+", label: "Anos de Experiência" },
    { value: "50k+", label: "Pacientes Atendidos" },
    { value: "24/7", label: "Atendimento" },
    { value: "98%", label: "Satisfação" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                  <HeartPulse className="h-4 w-4" />
                  <span>Telemedicina</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-muted text-muted-foreground px-4 py-2 rounded-full text-sm font-medium">
                  <span>Home Care</span>
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-tight">
                Sejam bem-vindos à{" "}
                <span className="gradient-text">NOVITÀ!</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                O cuidado de excelência no conforto do lar. Reunimos uma equipe multidisciplinar 
                altamente qualificada para oferecer o melhor atendimento em Home Care e Telemedicina.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="gradient-hero text-primary-foreground shadow-glow hover:shadow-elevated transition-all text-base px-8"
                  onClick={() => navigate("/planos")}
                >
                  Fale Conosco
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-base px-8"
                  onClick={() => navigate("/como-funciona")}
                >
                  Conheça Nossos Serviços
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                {stats.slice(0, 2).map((stat) => (
                  <div key={stat.label}>
                    <p className="text-3xl font-heading font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative lg:pl-8">
              <div className="relative">
                <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-20 scale-95" />
                <div className="relative bg-card rounded-3xl shadow-elevated overflow-hidden border border-border/50">
                  <img 
                    src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80"
                    alt="Médico em consulta online"
                    className="w-full h-[400px] lg:h-[500px] object-cover"
                  />
                  <div className="absolute bottom-6 left-6 right-6">
                    <Card className="glass-card">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center">
                          <Video className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Consulta disponível agora</p>
                          <p className="text-sm text-muted-foreground">Clínico geral • 5 min de espera</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Por que escolher a Novità?
            </h2>
            <p className="text-muted-foreground text-lg">
              Oferecemos uma experiência completa de cuidado com sua saúde, do atendimento à entrega dos medicamentos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <Card 
                key={benefit.title}
                className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300 group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <benefit.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Como funciona
            </h2>
            <p className="text-muted-foreground text-lg">
              Em apenas 4 passos simples, você tem acesso a consultas médicas e medicamentos sem sair de casa.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
                )}
                <div className="space-y-4">
                  <div className="text-5xl font-heading font-bold gradient-text opacity-50">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-heading font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button 
              size="lg"
              className="gradient-hero text-primary-foreground shadow-glow"
              onClick={() => navigate("/como-funciona")}
            >
              Saiba mais
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Plans Preview Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Escolha o plano ideal para você
            </h2>
            <p className="text-muted-foreground text-lg">
              Planos a partir de R$ 29,90/mês com consultas ilimitadas com clínico geral.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <Card 
                key={plan.name}
                className={`relative bg-card border-border/50 hover:shadow-card transition-all duration-300 ${
                  plan.popular ? "border-primary shadow-glow" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="gradient-hero text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Mais Popular
                    </span>
                  </div>
                )}
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-xl font-heading font-bold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-heading font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-accent flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className={`w-full ${plan.popular ? "gradient-hero text-primary-foreground" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate("/planos")}
                  >
                    Escolher Plano
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="link" className="text-primary" onClick={() => navigate("/planos")}>
              Ver todos os planos e benefícios
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Medicamento em Casa Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-10 scale-95" />
              <img 
                src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80"
                alt="Medicamentos"
                className="relative rounded-3xl shadow-elevated w-full h-[400px] object-cover"
              />
            </div>
            
            <div className="space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
                <Truck className="h-4 w-4" />
                <span>Medicamento em Casa</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                Receba seus medicamentos sem sair de casa
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                Após sua consulta, compre os medicamentos prescritos diretamente pela plataforma 
                com descontos exclusivos e receba em até 24 horas no conforto do seu lar.
              </p>

              <ul className="space-y-4">
                {[
                  "Descontos exclusivos para assinantes",
                  "Entrega em até 24 horas",
                  "Sem filas, sem deslocamento",
                  "Medicamentos de uso contínuo com entrega programada",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-accent" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <Button 
                size="lg"
                className="gradient-hero text-primary-foreground shadow-glow"
                onClick={() => navigate("/medicamentos")}
              >
                Saiba mais sobre entregas
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl md:text-5xl font-heading font-bold text-primary-foreground">
                  {stat.value}
                </p>
                <p className="text-primary-foreground/80 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-card border-border/50 shadow-elevated overflow-hidden">
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-2">
                <div className="p-8 lg:p-12 space-y-6">
                  <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                    <Users className="h-4 w-4" />
                    <span>Plano Familiar</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                    Cuide de toda sua família com um único plano
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    Com o plano Coletivo/Familiar, você protege até 3 dependentes com todos os benefícios 
                    do plano Platina. Economia e praticidade para quem você mais ama.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                      size="lg"
                      className="gradient-hero text-primary-foreground shadow-glow"
                      onClick={() => navigate("/planos")}
                    >
                      Conhecer Plano Familiar
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="relative h-64 lg:h-auto">
                  <img 
                    src="https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80"
                    alt="Família feliz"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;