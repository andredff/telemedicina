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
  ArrowRight, 
  Check, 
  Stethoscope,
  Truck,
  HeartPulse,
  Users,
  Award,
  Home,
  Ambulance,
  UserCheck,
  Target,
  Heart,
  Phone,
  Mail,
  MapPin
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const homeCareServices = [
    {
      icon: Users,
      title: "Equipe Multidisciplinar",
      description: "Médicos, enfermeiros, fisioterapeutas, nutricionistas, fonoaudiólogos, psicólogos e terapeutas ocupacionais.",
    },
    {
      icon: Clock,
      title: "Atendimento 24/7",
      description: "Atuamos 24 horas por dia, 7 dias por semana, 365 dias por ano para garantir seu cuidado.",
    },
    {
      icon: Home,
      title: "Internação Domiciliar",
      description: "Pacientes de alta complexidade, desde recém-nascidos até idosos, com todo suporte necessário.",
    },
    {
      icon: Ambulance,
      title: "UTI Móvel",
      description: "Ambulância de suporte avançado totalmente equipada com tecnologia de ponta.",
    },
  ];

  const telemedicinaServices = [
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
      title: "Receitas Digitais",
      description: "Receitas válidas com código de verificação para compra em qualquer farmácia.",
    },
  ];

  const diferenciais = [
    {
      icon: Award,
      title: "Selo de Qualidade ANS",
      description: "Acreditação com 98,3% de conformidade em serviços de atenção domiciliar.",
    },
    {
      icon: UserCheck,
      title: "Profissionais Capacitados",
      description: "Educação continuada com capacitação e reciclagem periódica de toda equipe.",
    },
    {
      icon: Home,
      title: "Sede e Farmácia Próprias",
      description: "Estrutura completa para garantir agilidade e qualidade no atendimento.",
    },
    {
      icon: Ambulance,
      title: "UTI Móvel Avançada",
      description: "Equipamentos de ponta incluindo cardioversor portátil e suporte avançado.",
    },
  ];

  const stats = [
    { value: "2011", label: "Desde" },
    { value: "24/7", label: "Atendimento" },
    { value: "98,3%", label: "Conformidade ANS" },
    { value: "DF", label: "Cobertura" },
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

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-slide-up">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-tight">
                Sejam bem-vindos à{" "}
                <span className="gradient-text">NOVITÀ!</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Agradecemos a sua visita! Para saber mais a respeito da Novità, entre em contato conosco. 
                Será um prazer atendê-lo(a)!
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
              </div>
            </div>

            <div className="relative lg:pl-8">
              <div className="relative">
                <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-20 scale-95" />
                <div className="relative bg-card rounded-3xl shadow-elevated overflow-hidden border border-border/50">
                  <img 
                    src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80"
                    alt="Profissional de saúde"
                    className="w-full h-[400px] lg:h-[500px] object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O Cuidado de Excelência Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80"
                alt="Cuidado domiciliar"
                className="rounded-3xl shadow-elevated w-full h-[400px] object-cover"
              />
            </div>
            
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                O Cuidado de Excelência no{" "}
                <span className="gradient-text">Conforto do Lar</span>
              </h2>
              
              <p className="text-lg text-primary font-medium">
                Bem-Estar, Segurança e Acolhimento Familiar
              </p>
              
              <p className="text-muted-foreground leading-relaxed">
                Reunimos uma equipe multidisciplinar altamente qualificada (médicos, enfermeiros, 
                fisioterapeutas, nutricionistas e mais) e todos os recursos necessários para um 
                tratamento eficaz. Oferecemos um plano de cuidados personalizado que prioriza a 
                qualidade de vida, a recuperação e o calor humano do ambiente familiar.
              </p>

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center p-4 bg-card rounded-xl border border-border/50">
                  <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">Visão</p>
                  <p className="text-sm font-semibold text-foreground">Referência no DF</p>
                </div>
                <div className="text-center p-4 bg-card rounded-xl border border-border/50">
                  <Heart className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">Missão</p>
                  <p className="text-sm font-semibold text-foreground">Excelência</p>
                </div>
                <div className="text-center p-4 bg-card rounded-xl border border-border/50">
                  <Award className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">Valores</p>
                  <p className="text-sm font-semibold text-foreground">Ética e Respeito</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Home Care Section */}
      <section id="homecare" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Home className="h-4 w-4" />
              <span>Home Care</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Internação e Assistência Domiciliar
            </h2>
            <p className="text-muted-foreground text-lg">
              Planejamento, gestão e operacionalização da Internação e Assistência Domiciliar em Saúde, 
              com foco em pacientes de alta complexidade.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {homeCareServices.map((service, index) => (
              <Card 
                key={service.title}
                className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300 group"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <service.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Telemedicina Section */}
      <section id="telemedicina" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Video className="h-4 w-4" />
              <span>Telemedicina</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Consultas Médicas Online
            </h2>
            <p className="text-muted-foreground text-lg">
              Consultas médicas online 24 horas, receitas digitais e medicamentos entregues em casa. 
              A qualidade Novità agora no mundo digital.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {telemedicinaServices.map((service, index) => (
              <Card 
                key={service.title}
                className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300 group"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <service.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button 
              size="lg"
              className="gradient-hero text-primary-foreground shadow-glow"
              onClick={() => navigate("/planos")}
            >
              Ver Planos de Telemedicina
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Nossa História Section */}
      <section id="historia" className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                Nossa <span className="gradient-text">História</span>
              </h2>
              
              <p className="text-muted-foreground leading-relaxed">
                Fundada em 2011, a NOVITÀ nasceu da rica experiência na área da saúde de sua 
                Vice-Presidente, profissional pós-graduada, aliada à vasta experiência de gestão 
                de negócios de seu CEO, jurista especializado em saúde.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Percebendo que o atendimento prestado a pacientes crônicos carecia de qualidade, 
                atenção e contato pessoal, desenvolvemos um modelo focado na gestão de qualidade, 
                humanização e respeito ao ser humano.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Hoje, a NOVITÀ atua em todo o Distrito Federal e região do Entorno, consolidada 
                e acreditada em programa de qualidade de serviços de saúde da ANS, cuidando do 
                paciente com responsabilidade, carinho e respeito.
              </p>
            </div>

            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=800&q=80"
                alt="Equipe médica"
                className="rounded-3xl shadow-elevated w-full h-[400px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Nossos Diferenciais Section */}
      <section id="diferenciais" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Nossos <span className="gradient-text">Diferenciais</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Selo de qualidade com avaliação máxima e acreditação da ANS, 
              com 98,3% de conformidade na prestação de serviços.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {diferenciais.map((item, index) => (
              <Card 
                key={item.title}
                className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300 group"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* UTI Móvel Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-10 scale-95" />
              <img 
                src="https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=800&q=80"
                alt="UTI Móvel"
                className="relative rounded-3xl shadow-elevated w-full h-[400px] object-cover"
              />
            </div>
            
            <div className="space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <Ambulance className="h-4 w-4" />
                <span>UTI Móvel</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                Emergências e Remoções com{" "}
                <span className="gradient-text">Segurança Total</span>
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                Nossa UTI Móvel é equipada com tecnologia de ponta e corpo clínico especializado 
                para garantir a estabilidade e a segurança do paciente em qualquer remoção. 
                Seu cuidado contínuo, onde for preciso.
              </p>

              <ul className="space-y-4">
                {[
                  "Ambulância de suporte avançado totalmente equipada",
                  "Cardioversor portátil e equipamentos de ponta",
                  "Corpo clínico especializado",
                  "Uma das mais modernas do mercado",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Planos Telemedicina Preview */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Planos de <span className="gradient-text">Telemedicina</span>
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
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
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

      {/* Contact Section */}
      <section id="contato" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Entre em <span className="gradient-text">Contato</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Cobrindo todo o DF e o entorno. Estamos prontos para atendê-lo.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-card border-border/50 hover:shadow-card transition-all">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Phone className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground">Telefone</h3>
                <p className="text-muted-foreground">(61) 3041-3218</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 hover:shadow-card transition-all">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground">E-mail</h3>
                <p className="text-muted-foreground text-sm">contato@novitahomecare.com.br</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 hover:shadow-card transition-all">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <MapPin className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground">Endereço</h3>
                <p className="text-muted-foreground text-sm">SRTVN Conjunto P, Sala SS 06 - Asa Norte, Brasília - DF</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
