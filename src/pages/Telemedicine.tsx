import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  History,
  Stethoscope,
  ArrowLeft,
  Heart,
  LogOut,
  Settings,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TelemedicineIframe,
  AccessBlockedModal,
  SpecialtyCard,
  ConsultationCard,
} from "@/components/telemedicine";
import { useTelemedicine } from "@/hooks/use-telemedicine";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Specialty } from "@/integrations/assemed";

interface UserProfile {
  full_name: string;
  cpf: string;
  email: string;
  phone: string;
  birth_date: string;
  gender: "M" | "F";
}

const Telemedicine = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [activeTab, setActiveTab] = useState("nova-consulta");
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);

  // Hook de telemedicina
  const {
    subscription,
    isSubscriptionLoading,
    canAccessTelemedicine,
    specialties,
    isSpecialtiesLoading,
    consultations,
    isConsultationsLoading,
    startNewConsultation,
    isStartingConsultation,
    cancelActiveConsultation,
    activeConsultation,
    setActiveConsultation,
    activeConsultationStatus,
    iframeUrl,
  } = useTelemedicine({
    userId: user?.id || null,
    userProfile: profile,
  });

  // Busca o perfil do usuário
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, cpf, email, phone, birth_date, gender")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setProfile(data as UserProfile);
      }
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);
    }
  };

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/auth");
        } else if (session.user) {
          fetchProfile(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Mostra modal de bloqueio se não pode acessar
  useEffect(() => {
    if (!isSubscriptionLoading && !canAccessTelemedicine && !loading) {
      setShowBlockedModal(true);
    }
  }, [isSubscriptionLoading, canAccessTelemedicine, loading]);

  // Muda para aba de consulta ativa quando inicia uma consulta
  useEffect(() => {
    if (activeConsultation?.success) {
      setActiveTab("consulta-ativa");
    }
  }, [activeConsultation]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSelectSpecialty = async (specialty: Specialty) => {
    if (!canAccessTelemedicine) {
      setShowBlockedModal(true);
      return;
    }

    setSelectedSpecialty(specialty);

    const result = await startNewConsultation(
      specialty.id,
      specialty.tipoProfissionalId
    );

    if (!result.success) {
      // Mostrar erro via toast ou alert
      console.error("Erro ao iniciar consulta:", result.error);
    }
  };

  const handleCancelConsultation = async (consultationId: number) => {
    await cancelActiveConsultation(consultationId);
    setActiveTab("nova-consulta");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-md border-b border-border/50 shadow-soft">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="gradient-hero rounded-xl p-2">
                <Heart className="h-5 w-5 text-primary-foreground" fill="currentColor" />
              </div>
              <div>
                <h1 className="text-lg font-heading font-bold text-foreground">Telemedicina</h1>
                <p className="text-xs text-primary -mt-0.5">Novità Home Care</p>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/cart")}>
              <ShoppingCart className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Status da assinatura */}
        {isSubscriptionLoading ? (
          <Skeleton className="h-20 w-full mb-6" />
        ) : canAccessTelemedicine ? (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Assinatura Ativa</AlertTitle>
            <AlertDescription>
              Plano {subscription?.planType?.toUpperCase()} •
              {subscription?.consultationsRemaining
                ? ` ${subscription.consultationsRemaining} consultas disponíveis`
                : " Consultas ilimitadas"}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Restrito</AlertTitle>
            <AlertDescription>
              Você precisa de uma assinatura ativa para acessar a telemedicina.
              <Button
                variant="link"
                className="p-0 h-auto ml-2"
                onClick={() => navigate("/planos")}
              >
                Ver planos
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="nova-consulta" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Consulta</span>
              <span className="sm:hidden">Nova</span>
            </TabsTrigger>
            <TabsTrigger value="consulta-ativa" className="gap-2" disabled={!activeConsultation}>
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Consulta Ativa</span>
              <span className="sm:hidden">Ativa</span>
              {activeConsultation && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  1
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
              <span className="sm:hidden">Histórico</span>
            </TabsTrigger>
          </TabsList>

          {/* Nova Consulta */}
          <TabsContent value="nova-consulta">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-heading font-semibold mb-2">
                  Escolha uma Especialidade
                </h2>
                <p className="text-muted-foreground">
                  Selecione o tipo de consulta que deseja realizar
                </p>
              </div>

              {isSpecialtiesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-64" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {specialties.map((specialty) => (
                    <SpecialtyCard
                      key={specialty.id}
                      specialty={specialty}
                      onSelect={handleSelectSpecialty}
                      isLoading={
                        isStartingConsultation &&
                        selectedSpecialty?.id === specialty.id
                      }
                      disabled={!canAccessTelemedicine || isStartingConsultation}
                    />
                  ))}
                </div>
              )}

              {/* Fallback se não houver especialidades */}
              {!isSpecialtiesLoading && specialties.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      Nenhuma especialidade disponível no momento
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Consulta Ativa */}
          <TabsContent value="consulta-ativa">
            {activeConsultation?.success ? (
              <div className="space-y-4">
                {/* Status da consulta */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Consulta #{activeConsultation.consultationId}</CardTitle>
                        <CardDescription>
                          {selectedSpecialty?.nome || "Clínico Geral"}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          activeConsultationStatus === "EM_ATENDIMENTO"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {activeConsultationStatus === "EM_ATENDIMENTO"
                          ? "Em Atendimento"
                          : activeConsultationStatus === "CONCLUIDO"
                          ? "Concluída"
                          : "Aguardando"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleCancelConsultation(activeConsultation.consultationId!)
                      }
                    >
                      Cancelar Consulta
                    </Button>
                    {activeConsultation.waitingRoomUrl && (
                      <Button
                        onClick={() =>
                          window.open(activeConsultation.waitingRoomUrl, "_blank")
                        }
                      >
                        Abrir em Nova Aba
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* iFrame da consulta */}
                {activeConsultation.waitingRoomUrl && (
                  <div className="relative bg-card rounded-lg border overflow-hidden">
                    <TelemedicineIframe
                      url={activeConsultation.waitingRoomUrl}
                      title="Sala de Consulta"
                      className="min-h-[600px]"
                    />
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Video className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center mb-4">
                    Você não possui nenhuma consulta ativa no momento
                  </p>
                  <Button onClick={() => setActiveTab("nova-consulta")}>
                    Iniciar Nova Consulta
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-heading font-semibold mb-2">
                  Histórico de Consultas
                </h2>
                <p className="text-muted-foreground">
                  Veja todas as suas consultas anteriores
                </p>
              </div>

              {isConsultationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              ) : consultations.length > 0 ? (
                <div className="space-y-4">
                  {consultations.map((consultation) => (
                    <ConsultationCard
                      key={consultation.id}
                      consultation={consultation}
                      onJoin={(c) => {
                        setActiveConsultation({
                          success: true,
                          consultationId: c.id,
                          waitingRoomUrl: `${iframeUrl}sala-espera-externa/${c.id}?token=${c.pacienteToken}`,
                          pacienteToken: c.pacienteToken,
                        });
                        setActiveTab("consulta-ativa");
                      }}
                      onCancel={handleCancelConsultation}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <History className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      Você ainda não realizou nenhuma consulta
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal de acesso bloqueado */}
      <AccessBlockedModal
        open={showBlockedModal}
        onOpenChange={setShowBlockedModal}
        reason={subscription?.isActive === false ? "no_subscription" : "no_subscription"}
      />
    </div>
  );
};

export default Telemedicine;
