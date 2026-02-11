import { Video, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { useNavigate } from "react-router-dom";
import { POR_QUE_NOVITA } from "@/data/landingContent";
import { LucideIcon, Award, Clock, Building, FileCheck, Shield, Star, Calendar, BadgePercent, Building2, Heart, Truck } from "lucide-react";

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

const Sobre = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Video className="h-4 w-4" />
              <span>Telemedicina Novità</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-tight">
              Por que utilizar os serviços de <span className="gradient-text">telemedicina da Novità</span>?
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed">
              Somos uma empresa de home care com 15 anos de experiência, oferecendo
              telemedicina com a mesma excelência e humanização de nossos atendimentos presenciais.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                className="gradient-hero text-primary-foreground shadow-glow hover:shadow-elevated transition-all"
                onClick={() => navigate("/planos")}
              >
                Ver Planos
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Por que usar Novità Section */}
      <section className="py-20 section-bg-light">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              {POR_QUE_NOVITA.title}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {POR_QUE_NOVITA.items.map((item, index) => {
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

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
              Comece sua consulta online agora
            </h2>
            <p className="text-lg text-muted-foreground">
              Assine um de nossos planos e tenha acesso ilimitado a consultas médicas
              24 horas por dia, 7 dias por semana.
            </p>
            <Button
              size="lg"
              className="gradient-hero text-primary-foreground shadow-glow hover:shadow-elevated transition-all"
              onClick={() => navigate("/planos")}
            >
              Ver Planos
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Sobre;
