import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import {
  Crown,
  Star,
  Users,
  Check,
  ArrowUp,
  ArrowDown,
  Loader2,
  Calendar,
  CreditCard,
  Gem,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { User as SupabaseUser } from "@supabase/supabase-js";
import {
  INDIVIDUAL_PLANS,
  COLETIVO_PLANS,
  ALL_PLANS,
  formatPrice,
  getPlanColor,
  PlanData,
  ANNUAL_DISCOUNT,
} from "@/data/plansData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserSubscription {
  id: string;
  status: string;
  expires_at: string | null;
  billing_cycle: string;
  plan_id: string;
  plan: {
    id: string;
    name: string;
    type: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
    max_dependents: number;
  } | null;
}

interface Dependent {
  id: string;
  full_name: string;
  cpf: string;
  birth_date: string;
  relationship: string | null;
  subscription_id: string;
  created_at: string;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'conjuge', label: 'Cônjuge' },
  { value: 'filho', label: 'Filho(a)' },
  { value: 'pai_mae', label: 'Pai/Mãe' },
  { value: 'irmao', label: 'Irmão(ã)' },
  { value: 'outro', label: 'Outro' },
];

// Ordem de hierarquia dos planos (para upgrade/downgrade)
const PLAN_HIERARCHY: Record<string, number> = {
  'bronze': 1,
  'prata': 2,
  'ouro': 3,
  'diamante': 4,
  'bronze-coletivo': 5,
  'prata-coletivo': 6,
  'ouro-coletivo': 7,
  'diamante-coletivo': 8,
};

const getPlanLevel = (type: string): number => {
  return PLAN_HIERARCHY[type] || 0;
};

const MyPlan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanData | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [planAction, setPlanAction] = useState<'upgrade' | 'downgrade' | 'subscribe'>('subscribe');
  const { accessToken } = useAssemedToken();
  
  // Dependentes
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loadingDependents, setLoadingDependents] = useState(false);
  const [showDependentDialog, setShowDependentDialog] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [savingDependent, setSavingDependent] = useState(false);
  const [dependentForm, setDependentForm] = useState({
    full_name: '',
    cpf: '',
    birth_date: '',
    relationship: '',
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          navigate("/auth");
          return;
        }

        setUser(user);

        // Buscar assinatura atual
        const { data: subscriptionData, error } = await supabase
          .from("user_subscriptions")
          .select(`
            id,
            status,
            expires_at,
            billing_cycle,
            plan_id,
            plan:subscription_plans (
              id,
              name,
              type,
              description,
              price_monthly,
              price_yearly,
              max_dependents
            )
          `)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (error) {
          logger.error("Error fetching subscription:", error);
        }

        setSubscription(subscriptionData as UserSubscription | null);
        
        // Buscar dependentes se tiver subscrição
        if (subscriptionData?.id) {
          fetchDependents(subscriptionData.id);
        }
      } catch (error) {
        logger.error("Error fetching user data:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus dados.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ── Dependentes CRUD ──────────────────────────────────────────────────────
  
  const fetchDependents = useCallback(async (subscriptionId: string) => {
    setLoadingDependents(true);
    try {
      const { data, error } = await supabase
        .from("dependents")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      setDependents(data || []);
    } catch (error) {
      logger.error("Error fetching dependents:", error);
    } finally {
      setLoadingDependents(false);
    }
  }, []);

  const openAddDependentDialog = () => {
    setEditingDependent(null);
    setDependentForm({
      full_name: '',
      cpf: '',
      birth_date: '',
      relationship: '',
    });
    setShowDependentDialog(true);
  };

  const openEditDependentDialog = (dependent: Dependent) => {
    setEditingDependent(dependent);
    setDependentForm({
      full_name: dependent.full_name,
      cpf: dependent.cpf,
      birth_date: dependent.birth_date,
      relationship: dependent.relationship || '',
    });
    setShowDependentDialog(true);
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleSaveDependent = async () => {
    if (!subscription?.id) return;
    
    // Validações
    if (!dependentForm.full_name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    const cpfDigits = dependentForm.cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      toast({ title: "Erro", description: "CPF inválido", variant: "destructive" });
      return;
    }
    if (!dependentForm.birth_date) {
      toast({ title: "Erro", description: "Data de nascimento é obrigatória", variant: "destructive" });
      return;
    }
    
    setSavingDependent(true);
    try {
      if (editingDependent) {
        // Atualizar
        const { error } = await supabase
          .from("dependents")
          .update({
            full_name: dependentForm.full_name.trim(),
            cpf: cpfDigits,
            birth_date: dependentForm.birth_date,
            relationship: dependentForm.relationship || null,
          })
          .eq("id", editingDependent.id);
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Dependente atualizado com sucesso" });
      } else {
        // Criar
        const { error } = await supabase
          .from("dependents")
          .insert({
            subscription_id: subscription.id,
            full_name: dependentForm.full_name.trim(),
            cpf: cpfDigits,
            birth_date: dependentForm.birth_date,
            relationship: dependentForm.relationship || null,
          });
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Dependente adicionado com sucesso" });
      }
      
      setShowDependentDialog(false);
      fetchDependents(subscription.id);
    } catch (error: any) {
      logger.error("Error saving dependent:", error);
      toast({
        title: "Erro",
        description: error.message?.includes("duplicate") 
          ? "Este CPF já está cadastrado"
          : "Não foi possível salvar o dependente",
        variant: "destructive",
      });
    } finally {
      setSavingDependent(false);
    }
  };

  const handleDeleteDependent = async (dependentId: string) => {
    if (!subscription?.id) return;
    
    if (!confirm("Tem certeza que deseja remover este dependente?")) return;
    
    try {
      const { error } = await supabase
        .from("dependents")
        .delete()
        .eq("id", dependentId);
      
      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Dependente removido" });
      fetchDependents(subscription.id);
    } catch (error) {
      logger.error("Error deleting dependent:", error);
      toast({ title: "Erro", description: "Não foi possível remover o dependente", variant: "destructive" });
    }
  };

  const getRelationshipLabel = (value: string | null) => {
    const option = RELATIONSHIP_OPTIONS.find(o => o.value === value);
    return option?.label || value || '—';
  };

  const maxDependents = subscription?.plan?.max_dependents || 0;
  const canAddDependent = dependents.length < maxDependents;

  // ── Planos ────────────────────────────────────────────────────────────────

  const getCurrentPlanType = (): string => {
    return subscription?.plan?.type || '';
  };

  const getPlanRelation = (plan: PlanData): 'current' | 'upgrade' | 'downgrade' | 'same-category' => {
    const currentType = getCurrentPlanType();
    if (!currentType) return 'upgrade'; // Sem plano = qualquer um é "assinar"
    
    if (plan.type === currentType) return 'current';
    
    const currentLevel = getPlanLevel(currentType);
    const targetLevel = getPlanLevel(plan.type);
    
    // Se mudar de categoria (individual <-> coletivo), considerar como upgrade/downgrade baseado no preço
    const currentIsColetivo = currentType.includes('coletivo');
    const targetIsColetivo = plan.type.includes('coletivo');
    
    if (currentIsColetivo !== targetIsColetivo) {
      // Mudança de categoria - comparar por preço
      const currentPrice = subscription?.plan?.price_monthly || 0;
      if (plan.price_monthly > currentPrice) return 'upgrade';
      if (plan.price_monthly < currentPrice) return 'downgrade';
      return 'same-category';
    }
    
    if (targetLevel > currentLevel) return 'upgrade';
    if (targetLevel < currentLevel) return 'downgrade';
    return 'current';
  };

  const handlePlanSelect = (plan: PlanData) => {
    const relation = getPlanRelation(plan);
    if (relation === 'current') return;
    
    setSelectedPlan(plan);
    setPlanAction(relation === 'downgrade' ? 'downgrade' : 'upgrade');
    setShowConfirmDialog(true);
  };

  const handleConfirmPlanChange = () => {
    if (!selectedPlan) return;
    
    setShowConfirmDialog(false);
    
    // Redirecionar para checkout com o plano selecionado
    navigate(`/checkout/subscription?plan=${selectedPlan.type}`);
  };

  const formatExpirationDate = (dateStr: string | null) => {
    if (!dateStr) return "Sem data definida";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  const renderPlanCard = (plan: PlanData) => {
    const relation = getPlanRelation(plan);
    const isCurrent = relation === 'current';
    const isUpgrade = relation === 'upgrade';
    const isDowngrade = relation === 'downgrade';
    
    const planColors = getPlanColor(plan.type);
    
    return (
      <Card
        key={plan.id}
        className={`relative overflow-hidden transition-all ${
          isCurrent 
            ? 'border-2 border-primary ring-2 ring-primary/20' 
            : 'hover:border-primary/50 hover:shadow-lg cursor-pointer'
        }`}
        onClick={() => !isCurrent && handlePlanSelect(plan)}
      >
        {isCurrent && (
          <div className="absolute top-0 right-0">
            <Badge className="rounded-none rounded-bl-lg bg-primary">
              Plano Atual
            </Badge>
          </div>
        )}
        
        {plan.highlight && !isCurrent && (
          <div className="absolute top-0 right-0">
            <Badge className="rounded-none rounded-bl-lg bg-accent">
              Mais Popular
            </Badge>
          </div>
        )}
        
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${planColors} flex items-center justify-center`}>
              {plan.type.includes('diamante') ? (
                <Gem className="h-5 w-5 text-white" />
              ) : plan.type.includes('ouro') ? (
                <Crown className="h-5 w-5 text-white" />
              ) : plan.type.includes('coletivo') ? (
                <Users className="h-5 w-5 text-white" />
              ) : (
                <Star className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <CardDescription className="text-sm">{plan.shortDescription}</CardDescription>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">R$ {formatPrice(plan.price_monthly)}</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ou R$ {formatPrice(plan.price_yearly)}/ano (10% off)
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          <ul className="space-y-2 mb-6">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          
          {isCurrent ? (
            <Button disabled className="w-full" variant="outline">
              <Check className="mr-2 h-4 w-4" />
              Plano Atual
            </Button>
          ) : isUpgrade ? (
            <Button className="w-full gradient-hero text-white">
              <ArrowUp className="mr-2 h-4 w-4" />
              Fazer Upgrade
            </Button>
          ) : isDowngrade ? (
            <Button className="w-full" variant="outline">
              <ArrowDown className="mr-2 h-4 w-4" />
              Fazer Downgrade
            </Button>
          ) : (
            <Button className="w-full">
              Assinar Plano
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        isAuthenticated 
        onLogout={handleLogout}
        title="Meu Plano"
      />

      <main className="container mx-auto px-4 py-8">
        <BackLink />
        {/* Current Plan Summary */}
        {subscription?.plan ? (
          <Card className={`mb-8 border-0 text-white bg-gradient-to-br ${getPlanColor(subscription.plan.type)}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Crown className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Plano {subscription.plan.name}</CardTitle>
                    <CardDescription className="text-white/80">
                      {subscription.plan.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {subscription.status === 'active' ? 'Ativo' : subscription.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-white/70" />
                  <div>
                    <p className="text-sm text-white/70">Valor</p>
                    <p className="font-semibold">
                      R$ {formatPrice(subscription.plan.price_monthly)}/mês
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-white/70" />
                  <div>
                    <p className="text-sm text-white/70">Ciclo</p>
                    <p className="font-semibold capitalize">
                      {subscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-white/70" />
                  <div>
                    <p className="text-sm text-white/70">Válido até</p>
                    <p className="font-semibold">
                      {formatExpirationDate(subscription.expires_at)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8 border-dashed">
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Você ainda não tem um plano ativo</h3>
              <p className="text-muted-foreground mb-4">
                Escolha um dos planos abaixo para começar a usar todos os benefícios da Novità.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Dependentes/Beneficiários - só aparece para planos coletivos */}
        {subscription?.plan && maxDependents > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Beneficiários do Plano</CardTitle>
                    <CardDescription>
                      {dependents.length} de {maxDependents} dependentes cadastrados
                    </CardDescription>
                  </div>
                </div>
                {canAddDependent && (
                  <Button onClick={openAddDependentDialog} size="sm" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Adicionar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingDependents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : dependents.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-2">Nenhum dependente cadastrado</p>
                  <p className="text-sm text-muted-foreground/70 mb-4">
                    Você pode adicionar até {maxDependents} dependente{maxDependents > 1 ? 's' : ''} ao seu plano
                  </p>
                  <Button onClick={openAddDependentDialog} variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar primeiro dependente
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dependents.map((dep) => (
                    <div 
                      key={dep.id} 
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {dep.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{dep.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {getRelationshipLabel(dep.relationship)} • CPF: {formatCpf(dep.cpf)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDependentDialog(dep)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteDependent(dep.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {canAddDependent && (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2" 
                      onClick={openAddDependentDialog}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar mais um dependente ({dependents.length}/{maxDependents})
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-2">
            {subscription?.plan ? 'Alterar Plano' : 'Escolha seu Plano'}
          </h1>
          <p className="text-muted-foreground">
            {subscription?.plan 
              ? 'Compare os planos e faça upgrade ou downgrade conforme sua necessidade'
              : 'Selecione o plano ideal para você ou sua família'}
          </p>
        </div>

        {/* Plans Tabs */}
        <Tabs defaultValue="individual" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="familiar">Familiar</TabsTrigger>
          </TabsList>

          <TabsContent value="individual">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {INDIVIDUAL_PLANS.map(renderPlanCard)}
            </div>
          </TabsContent>

          <TabsContent value="familiar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {COLETIVO_PLANS.map(renderPlanCard)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Info Section */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Sobre mudanças de plano</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Upgrade:</strong> A diferença será cobrada proporcionalmente ao período restante.</li>
                  <li>• <strong>Downgrade:</strong> O novo valor passa a valer na próxima renovação.</li>
                  <li>• Todas as mudanças são processadas de forma segura pela Cielo.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Dialog de Dependente */}
      <Dialog open={showDependentDialog} onOpenChange={setShowDependentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDependent ? 'Editar Dependente' : 'Adicionar Dependente'}
            </DialogTitle>
            <DialogDescription>
              {editingDependent 
                ? 'Atualize as informações do dependente'
                : 'Preencha os dados do novo beneficiário do plano'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dep-name">Nome completo *</Label>
              <Input
                id="dep-name"
                value={dependentForm.full_name}
                onChange={(e) => setDependentForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nome do dependente"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dep-cpf">CPF *</Label>
              <Input
                id="dep-cpf"
                value={formatCpf(dependentForm.cpf)}
                onChange={(e) => setDependentForm(prev => ({ ...prev, cpf: e.target.value.replace(/\D/g, '') }))}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dep-birth">Data de nascimento *</Label>
              <Input
                id="dep-birth"
                type="date"
                value={dependentForm.birth_date}
                onChange={(e) => setDependentForm(prev => ({ ...prev, birth_date: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dep-relationship">Parentesco</Label>
              <Select
                value={dependentForm.relationship}
                onValueChange={(value) => setDependentForm(prev => ({ ...prev, relationship: value }))}
              >
                <SelectTrigger id="dep-relationship">
                  <SelectValue placeholder="Selecione o parentesco" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDependentDialog(false)}
              disabled={savingDependent}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveDependent} disabled={savingDependent}>
              {savingDependent ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingDependent ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {planAction === 'upgrade' ? 'Confirmar Upgrade' : 
               planAction === 'downgrade' ? 'Confirmar Downgrade' : 'Assinar Plano'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPlan && (
                <>
                  Você está prestes a {planAction === 'upgrade' ? 'fazer upgrade para' : 
                                        planAction === 'downgrade' ? 'fazer downgrade para' : 'assinar'} o{' '}
                  <strong>Plano {selectedPlan.name}</strong> por{' '}
                  <strong>R$ {formatPrice(selectedPlan.price_monthly)}/mês</strong>.
                  <br /><br />
                  {planAction === 'upgrade' 
                    ? 'A diferença será cobrada proporcionalmente.'
                    : planAction === 'downgrade'
                    ? 'O novo valor será aplicado na próxima renovação.'
                    : 'Você será redirecionado para o checkout.'}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPlanChange}>
              {planAction === 'upgrade' ? 'Fazer Upgrade' : 
               planAction === 'downgrade' ? 'Fazer Downgrade' : 'Continuar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ActiveConsultationBanner accessToken={accessToken} />
    </div>
  );
};

export default MyPlan;
