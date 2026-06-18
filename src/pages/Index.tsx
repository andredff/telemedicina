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
  Users,
  Award,
  Home,
  Ambulance,
  Target,
  Heart,
  Phone,
  Mail,
  MapPin,
  Building,
  Building2,
  FileCheck,
  Star,
  Calendar,
  BadgePercent,
  Activity,
  LucideIcon,
  Truck,
  Crown,
  Gem,
} from "lucide-react";
import {
  HERO_CONTENT,
  SOBRE_EMPRESA,
  QUEM_SOMOS,
  DIFERENCIAIS,
  ESPECIALIDADES,
  POR_QUE_NOVITA,
  MISSAO_VISAO_VALORES,
  CONTATO,
} from "@/data/landingContent";
import { INDIVIDUAL_PLANS, COLETIVO_PLANS, formatPrice, getPlanColor } from "@/data/plansData";
import ambulanciaImage from "@/assets/ambulancia-novita.jpg";

// Icon mapping for dynamic icon rendering
const ICON_MAP: Record<string, LucideIcon> = {
  Award,
  Clock,
  Building,
  FileCheck,
  Shield,
  Star,
  Calendar,
  Truck,
  Building2,
  Heart,
  BadgePercent,
};

function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Award;
}

// Ícone do plano baseado no tipo
const getPlanIcon = (planType: string): LucideIcon => {
  if (planType.includes('diamante')) return Gem;
  if (planType.includes('ouro')) return Crown;
  if (planType.includes('prata')) return Star;
  if (planType.includes('bronze')) return Shield;
  return Shield;
};

// Reusable service card data type
interface ServiceItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Reusable service card component
function ServiceCard({ service }: { service: ServiceItem }): JSX.Element {
  const IconComponent = service.icon;
  return (
    <Card className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300 group">
      <CardContent className="p-6 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <IconComponent className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-heading font-semibold text-foreground">
          {service.title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {service.description}
        </p>
      </CardContent>
    </Card>
  );
}

// Service data arrays
const HOME_CARE_SERVICES: ServiceItem[] = [
  {
    icon: Home,
    title: "Atenção Domiciliar",
    description: "Desde atendimentos pontuais a internações domiciliares de alta complexidade, sejam recém-nascidos ou em estágio final de vida, com todo o suporte necessário.",
  },
  {
    icon: Users,
    title: "Equipe Multidisciplinar",
    description: "Médicos, enfermeiros, fisioterapeutas, nutricionistas, fonoaudiólogos, psicólogos e outros profissionais de saúde.",
  },
  {
    icon: Clock,
    title: "Atendimento 24/7",
    description: "Atuamos 24 horas por dia, 7 dias por semana, 365 dias por ano para garantir seu cuidado.",
  },
  {
    icon: Ambulance,
    title: "UTI Móvel",
    description: "Ambulância de suporte avançado totalmente equipada com tecnologia de ponta.",
  },
];

const TELEMEDICINA_SERVICES: ServiceItem[] = [
  {
    icon: Video,
    title: "Consultas Online 24h",
    description: "Médicos clínicos gerais disponíveis a qualquer hora do dia ou da noite, sem agendamento.",
  },
  {
    icon: Stethoscope,
    title: "Especialistas",
    description: "Acesso a 15 especialidades médicas com agendamento facilitado.",
  },
  {
    icon: Pill,
    title: "Medicamentos em Casa",
    description: "Programa 'Medicamento em Casa' com descontos progressivos e entrega grátis no DF.",
  },
  {
    icon: Shield,
    title: "Receitas Digitais",
    description: "Receitas com assinatura digital ICP-Brasil, válidas em qualquer farmácia do país.",
  },
];

const STATS = [
  { value: "2011", label: "Desde" },
  { value: "24/7", label: "Atendimento" },
  { value: "98,3%", label: "Conformidade ANS" },
  { value: "15+", label: "Especialidades" },
];

const UTI_FEATURES = [
  "Ambulância de suporte avançado totalmente equipada",
  "Cardioversor portátil e equipamentos de ponta",
  "Corpo clínico especializado 24h",
  "Cobertura em todo DF e região do entorno",
];

function Index(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section - Atualizado conforme briefing */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg-ond-scaled.jpg')" }} />
        <div className="absolute inset-0 bg-white/60" />

        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-slide-up">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-primary leading-tight">
                {HERO_CONTENT.title.split('Novità').map((part, i, arr) => (
                  i < arr.length - 1 ? (
                    <span key={i}>{part}<span>Novità</span></span>
                  ) : part
                ))}
              </h1>

              <div className="space-y-3">
                {HERO_CONTENT.subtitles.map((subtitle, index) => (
                  <p key={index} className="text-lg text-muted-foreground flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    {subtitle}
                  </p>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="gradient-hero text-primary-foreground shadow-glow hover:shadow-elevated transition-all text-base px-8"
                  onClick={() => navigate("/planos")}
                >
                  {HERO_CONTENT.cta}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8"
                  onClick={() => navigate("/planos")}
                >
                  {HERO_CONTENT.ctaSecondary}
                </Button>
              </div>
            </div>

            <div className="relative lg:pl-8">
              <div className="relative">
                <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-20 scale-95" />
                <div className="relative rounded-3xl overflow-hidden border border-border/50">
                  <img
                    src="/medica-nvt.png"
                    alt="Profissional de saúde"
                    className="w-full h-[400px] lg:h-[500px] object-contain object-bottom"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sobre a Empresa Section - Briefing */}
      <section className="py-20 section-bg-light">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <img
                src="/cuidado-nvt.jpg"
                alt="Cuidado domiciliar"
                className="rounded-3xl shadow-elevated w-full h-[400px] object-cover"
              />
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary">
                {SOBRE_EMPRESA.title}
              </h2>

              <p className="text-muted-foreground leading-relaxed text-lg">
                {SOBRE_EMPRESA.text.split('{{planos_link}}').map((part, index, arr) => (
                  <>
                    {part}
                    {index < arr.length - 1 && (
                      <a
                        href="/planos"
                        className="font-semibold hover:underline inline-flex items-center gap-1"
                        onClick={(e) => { e.preventDefault(); navigate('/planos'); }}
                      >
                        {SOBRE_EMPRESA.planosLinkText}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    )}
                  </>
                ))}
              </p>

              {/* Missão, Visão, Valores */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                                <div className="text-center p-4 bg-card rounded-xl border border-border/50">
                  <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground mb-2">{MISSAO_VISAO_VALORES.visao.title}</p>
                  <p className="text-xs font-medium text-muted-foreground">Ser Referência nacional em assistência à saúde.</p>
                </div>
              <div className="text-center p-4 bg-card rounded-xl border border-border/50">
                  <Heart className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground mb-2">{MISSAO_VISAO_VALORES.missao.title}</p>
                  <p className="text-xs font-medium text-muted-foreground">Proporcionar atendimento de excelência, promovendo o bem-estar e a qualidade de vida das pessoas.</p>
                </div>
                <div className="text-center p-4 bg-card rounded-xl border border-border/50">
                  <Award className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground mb-2">{MISSAO_VISAO_VALORES.valores.title}</p>
                  <p className="text-xs font-medium text-muted-foreground">Humanização, ética, empatia, comprometimento, respeito ao ser humano.</p>

                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quem Somos Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
                {QUEM_SOMOS.title}
              </h2>
            </div>

            <div className="space-y-6">
              {QUEM_SOMOS.paragraphs.slice(0, 4).map((paragraph, index) => (
                <p key={index} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Home Care Section */}
      <section id="homecare" className="py-20 section-bg-light">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Home className="h-4 w-4" />
              <span>Home Care</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
              Internação e Assistência Domiciliar
            </h2>
            <p className="text-muted-foreground text-lg">
              Planejamento, gestão e operacionalização da Internação e Assistência Domiciliar em Saúde,
              com foco em pacientes de alta complexidade.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOME_CARE_SERVICES.map((service) => (
              <ServiceCard key={service.title} service={service} />
            ))}
          </div>
        </div>
      </section>

      {/* Nossos Diferenciais Section - Briefing */}
      <section id="diferenciais" className="py-20 section-bg-light">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
              {DIFERENCIAIS.title}
            </h2>
            <p className="text-muted-foreground text-lg">
              Excelência e experiência aliadas à tecnologia de ponta.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DIFERENCIAIS.items.map((item, index) => {
              const IconComponent = getIcon(item.icon);
              return (
                <Card
                  key={item.title}
                  className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300 group"
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <IconComponent className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-heading font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Por que utilizar a Novità Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
              {POR_QUE_NOVITA.title}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {POR_QUE_NOVITA.items.map((item) => {
              const IconComponent = getIcon(item.icon);
              return (
                <Card
                  key={item.title}
                  className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300 group"
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <IconComponent className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-heading font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Especialidades Médicas Section - Nova seção do briefing */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Stethoscope className="h-4 w-4" />
              <span>Especialidades</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
              {ESPECIALIDADES.title}
            </h2>
            <p className="text-muted-foreground text-lg">
              Contamos com médicos especialistas em diversas áreas da saúde para atender você e sua família. Confira abaixo algumas especialidades.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {ESPECIALIDADES.items.map((especialidade, index) => (
              <div
                key={especialidade}
                className="bg-card border border-border/50 rounded-xl p-4 text-center hover:shadow-card hover:border-primary/20 transition-all duration-300"
              >
                <Activity className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">{especialidade}</p>
              </div>
            ))}
          </div>
          
        </div>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">

            <Button
              size="lg"
              className="gradient-hero text-primary-foreground shadow-glow hover:shadow-elevated transition-all"
              onClick={() => navigate("/planos")}
            >
              Ver Planos de Telemedicina
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      </section>
      

      {/* Planos Telemedicina Preview - Atualizado com dados do briefing */}
      <section className="py-20 section-bg-light">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
              Planos de <span className="">Telemedicina</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Planos a partir de R$ {formatPrice(INDIVIDUAL_PLANS[0].price_monthly)}/mês com consultas ilimitadas com clínico geral 24h.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {INDIVIDUAL_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`relative bg-card border-border/50 hover:shadow-card transition-all duration-300 h-full flex flex-col ${
                  plan.highlight ? "border-primary shadow-glow" : ""
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="gradient-hero text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Mais Popular
                    </span>
                  </div>
                )}
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${getPlanColor(plan.type)} flex items-center justify-center text-white`}>
                        {(() => {
                          const IconComponent = getPlanIcon(plan.type);
                          return <IconComponent className="h-6 w-6" />;
                        })()}
                      </div>
                      <div>
                        <h3 className="text-xl font-heading font-bold text-primary">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">{plan.shortDescription}</p>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <span className="text-4xl font-heading font-bold text-primary">{formatPrice(plan.price_monthly)}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">(*) DF e região do entorno. Outras regiões em breve.</p>
                  </div>

                  <Button
                    className={`w-full mt-6 ${plan.highlight ? "gradient-hero text-primary-foreground" : ""}`}
                    variant={plan.highlight ? "default" : "outline"}
                    onClick={() => navigate("/planos")}
                  >
                    Escolher Plano
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Planos Familiares */}
          <div className="mt-16 pt-12 border-t border-border/50">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h3 className="text-2xl md:text-3xl font-heading font-bold text-primary mb-4">
                Planos <span className="">Familiares</span>
              </h3>
              <p className="text-muted-foreground text-lg">
                Proteja você e sua família com até 3 pessoas pelos mesmos preços acessíveis
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {COLETIVO_PLANS.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative bg-card border-border/50 hover:shadow-card transition-all duration-300 h-full flex flex-col ${
                    plan.highlight ? "border-primary shadow-glow" : ""
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="gradient-hero text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                        Mais Popular
                      </span>
                    </div>
                  )}
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex-1 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${getPlanColor(plan.type)} flex items-center justify-center text-white`}>
                          {(() => {
                            const IconComponent = getPlanIcon(plan.type);
                            return <IconComponent className="h-6 w-6" />;
                          })()}
                        </div>
                        <div>
                          <h3 className="text-xl font-heading font-bold text-primary">{plan.name}</h3>
                          <p className="text-sm text-muted-foreground">{plan.shortDescription}</p>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-muted-foreground">R$</span>
                        <span className="text-4xl font-heading font-bold text-primary">{formatPrice(plan.price_monthly)}</span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>

                      <ul className="space-y-3">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">(*) DF e região do entorno. Outras regiões em breve.</p>
                    </div>

                    <Button
                      className={`w-full mt-6 ${plan.highlight ? "gradient-hero text-primary-foreground" : ""}`}
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => navigate("/planos")}
                    >
                      Escolher Plano
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="text-center mt-8 space-y-4">
            <Button
              variant="outline"
              onClick={() => navigate("/planos")}
            >
              Ver Todos os Planos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>* O plano tem vigência anual, com cobrança mensal recorrente: 12 parcelas iguais do valor apresentado, sem juros (vide política de cancelamento).</p>
              <p>** Consulta avulsa com médico especialista (R$ 149,90) disponível apenas para assinantes.</p>
            </div>
          </div>
        </div>
      </section>


      {/* UTI Móvel Section */}
      <section className="py-0 pb-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-10 scale-95" />
              <img
                src={ambulanciaImage}
                alt="UTI Móvel"
                className="relative rounded-3xl shadow-elevated w-full h-[400px] object-cover"
              />
            </div>

            <div className="space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <Ambulance className="h-4 w-4" />
                <span>UTI Móvel</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary">
                Emergências e Remoções com{" "}
                <span className="">Segurança Total</span>
              </h2>

              <p className="text-lg text-muted-foreground leading-relaxed">
                Nossa UTI Móvel é equipada com tecnologia de ponta e corpo clínico especializado
                para garantir a estabilidade e a segurança do paciente em qualquer remoção.
                Uma das mais modernas do mercado.
              </p>

              <ul className="space-y-4">
                {UTI_FEATURES.map((item) => (
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


      {/* Stats Section */}
      {/* <section className="py-16 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl md:text-5xl font-heading font-bold text-primary-foreground">
                  {stat.value}
                </p>
                <p className="text-primary-foreground/80 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Contact Section - Atualizado com dados do briefing */}
      {/* <section id="contato" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
              Entre em <span className="">Contato</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Cobrindo todo o DF e região do entorno. Estamos prontos para atendê-lo.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-card border-border/50 hover:shadow-card transition-all">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Phone className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground">Telefone</h3>
                <p className="text-muted-foreground">{CONTATO.telefone}</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 hover:shadow-card transition-all">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground">E-mail</h3>
                <p className="text-muted-foreground text-sm">{CONTATO.email}</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 hover:shadow-card transition-all">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <MapPin className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground">Endereço</h3>
                <p className="text-muted-foreground text-sm">
                  {CONTATO.endereco.logradouro}<br />
                  {CONTATO.endereco.complemento}<br />
                  {CONTATO.endereco.bairro}, {CONTATO.endereco.cidade} - {CONTATO.endereco.estado}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Google Maps Embed */}
          {/* <div className="mt-12 max-w-4xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-card border border-border/50">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3839.3!2d-47.8832!3d-15.7891!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935a3ae5f36d9bf9%3A0xb6a4e0de7b3ed3c3!2sEd.%20Bras%C3%ADlia%20R%C3%A1dio%20Center!5e0!3m2!1spt-BR!2sbr!4v1704729600000!5m2!1spt-BR!2sbr"
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização Novità Home Care"
              />
            </div>
          </div>
        </div> */}
      {/* </section>  */}

      <Footer />
    </div>
  );
};

export default Index;
