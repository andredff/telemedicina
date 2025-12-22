import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Truck, 
  ArrowRight, 
  Check,
  Package,
  Clock,
  Percent,
  RefreshCw,
  Shield,
  Search,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mockPrescriptions } from "@/data/mockPrescriptions";

const Medications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prescriptionCode, setPrescriptionCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    if (!prescriptionCode.trim()) {
      toast({
        title: "Código obrigatório",
        description: "Por favor, insira o código da sua receita.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    
    // Search for prescription in mock data
    setTimeout(() => {
      setIsSearching(false);
      
      const foundPrescription = mockPrescriptions.find(
        (prescription) => prescription.id === prescriptionCode.toUpperCase()
      );
      
      if (foundPrescription) {
        // Navigate to prescription detail page with the found prescription
        navigate(`/prescription/${foundPrescription.id}`);
      } else {
        toast({
          title: "Receita não encontrada",
          description: "Verifique o código ou faça login para acessar suas receitas.",
        });
      }
    }, 1500);
  };

  const benefits = [
    {
      icon: Percent,
      title: "Descontos Exclusivos",
      description: "Assinantes têm até 30% de desconto em todos os medicamentos prescritos."
    },
    {
      icon: Clock,
      title: "Entrega Rápida",
      description: "Receba seus medicamentos em até 24 horas úteis após a confirmação do pedido."
    },
    {
      icon: RefreshCw,
      title: "Entrega Programada",
      description: "Para medicamentos de uso contínuo, programe entregas automáticas mensais."
    },
    {
      icon: Package,
      title: "Embalagem Segura",
      description: "Todos os medicamentos são entregues em embalagens adequadas e discretas."
    },
    {
      icon: Shield,
      title: "Medicamentos Originais",
      description: "Trabalhamos apenas com fornecedores certificados e medicamentos de qualidade."
    },
    {
      icon: Truck,
      title: "Frete Grátis",
      description: "Entrega gratuita para assinantes em toda a região do Distrito Federal."
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Faça sua consulta",
      description: "Agende ou inicie uma consulta online com nossos médicos."
    },
    {
      number: "2",
      title: "Receba a receita",
      description: "O médico emitirá uma receita digital com código de validação."
    },
    {
      number: "3",
      title: "Insira o código",
      description: "Digite o código da receita aqui ou acesse sua área do paciente."
    },
    {
      number: "4",
      title: "Finalize a compra",
      description: "Escolha os medicamentos, pague e aguarde a entrega em casa."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
                <Truck className="h-4 w-4" />
                <span>Medicamento em Casa</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-tight">
                Seus medicamentos{" "}
                <span className="gradient-text">entregues em casa</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Após sua consulta online, compre os medicamentos prescritos diretamente 
                pela plataforma e receba em até 24 horas, sem sair de casa.
              </p>

              {/* Prescription Code Search */}
              <Card className="bg-card border-border/50 shadow-card">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <Search className="h-5 w-5 text-primary" />
                    <span>Buscar minha receita</span>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-sm text-muted-foreground">
                      Código da receita (recebido por SMS/e-mail)
                    </Label>
                    <div className="flex gap-3">
                      <Input
                        id="code"
                        placeholder="Ex: RX-2024-XXXXX"
                        value={prescriptionCode}
                        onChange={(e) => setPrescriptionCode(e.target.value)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="gradient-hero text-primary-foreground"
                      >
                        {isSearching ? "Buscando..." : "Buscar"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Este serviço é exclusivo para pacientes da Novità Telemedicina. 
                      <Button 
                        variant="link" 
                        className="h-auto p-0 text-primary"
                        onClick={() => navigate("/auth")}
                      >
                        Faça login
                      </Button>
                      {" "}para acessar suas receitas.
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="relative">
              <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-10 scale-95" />
              <img 
                src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80"
                alt="Medicamentos"
                className="relative rounded-3xl shadow-elevated w-full h-[400px] lg:h-[500px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Como funciona
            </h2>
            <p className="text-muted-foreground text-lg">
              Em 4 passos simples você recebe seus medicamentos em casa.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
                )}
                <Card className="bg-card border-border/50 h-full">
                  <CardContent className="p-6 space-y-4">
                    <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center text-2xl font-heading font-bold text-primary-foreground">
                      {step.number}
                    </div>
                    <h3 className="text-lg font-heading font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Vantagens do programa
            </h2>
            <p className="text-muted-foreground text-lg">
              Muito mais que entrega de medicamentos. Uma experiência completa de cuidado.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit) => (
              <Card 
                key={benefit.title}
                className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all duration-300"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <benefit.icon className="h-7 w-7 text-accent" />
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

      {/* Recurring Delivery Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <RefreshCw className="h-4 w-4" />
                <span>Entrega Programada</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                Medicamentos de uso contínuo? Deixa com a gente
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                Se você usa medicamentos regularmente, ative a entrega programada e receba 
                automaticamente todo mês, sem precisar lembrar de fazer o pedido.
              </p>

              <ul className="space-y-4">
                {[
                  "Escolha a frequência: mensal, bimestral ou trimestral",
                  "Descontos progressivos quanto mais meses contratar",
                  "Cancele ou altere a qualquer momento",
                  "Notificação antes de cada entrega",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <Button 
                size="lg"
                className="gradient-hero text-primary-foreground shadow-glow"
                onClick={() => navigate("/planos")}
              >
                Assine e aproveite
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 gradient-hero rounded-3xl blur-2xl opacity-10 scale-95" />
              <img 
                src="https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80"
                alt="Entrega programada"
                className="relative rounded-3xl shadow-elevated w-full h-[400px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="gradient-hero border-0 shadow-elevated overflow-hidden">
            <CardContent className="p-8 md:p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground mb-4">
                Comece a receber seus medicamentos em casa
              </h2>
              <p className="text-primary-foreground/90 text-lg max-w-2xl mx-auto mb-8">
                Assine um plano Novità Telemedicina e tenha acesso a consultas 24h 
                e medicamentos com desconto entregues no conforto do seu lar.
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
                  Fazer Login
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

export default Medications;