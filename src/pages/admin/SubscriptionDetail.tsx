import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseAdmin } from '@/integrations/supabase/adminClient';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  DollarSign,
  Mail,
  User as UserIcon,
  AlertCircle,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface SubscriptionDetail {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  plan_name: string;
  plan_type: string;
  price_monthly: number;
  billing_cycle: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  payment_id: string | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (date: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR');
};

const computeTotalMonths = (billingCycle: string | null) => {
  if (!billingCycle) return 12;
  const c = billingCycle.toLowerCase();
  if (c.includes('year') || c.includes('anual') || c.includes('yearly')) return 12;
  if (c.includes('semester') || c.includes('semestral')) return 6;
  if (c.includes('quarter') || c.includes('trimestral')) return 3;
  return 12;
};

const computeElapsedMonths = (startedAt: string | null) => {
  if (!startedAt) return 0;
  const start = new Date(startedAt);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    (now.getDate() >= start.getDate() ? 1 : 0);
  return Math.max(months, 1);
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return { label: 'Ativo', variant: 'default' as const };
    case 'cancelled':
      return { label: 'Cancelado', variant: 'destructive' as const };
    case 'expired':
      return { label: 'Expirado', variant: 'secondary' as const };
    case 'pending':
      return { label: 'Pendente', variant: 'outline' as const };
    default:
      return { label: status, variant: 'outline' as const };
  }
};

export default function AdminSubscriptionDetail() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (subscriptionId) fetchSubscription(subscriptionId);
  }, [subscriptionId]);

  const fetchSubscription = async (id: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabaseAdmin
        .from('user_subscriptions')
        .select(`
          id,
          user_id,
          status,
          started_at,
          expires_at,
          cancelled_at,
          billing_cycle,
          payment_id,
          subscription_plans:plan_id ( name, type, price_monthly ),
          profiles:user_id ( full_name, email )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const plan = (data.subscription_plans as { name?: string; type?: string; price_monthly?: number }) || {};
      const profile = (data.profiles as { full_name?: string; email?: string }) || {};

      setSub({
        id: data.id,
        user_id: data.user_id,
        user_name: profile.full_name || profile.email || '—',
        user_email: profile.email || '—',
        plan_name: plan.name || '—',
        plan_type: plan.type || '—',
        price_monthly: plan.price_monthly || 0,
        billing_cycle: data.billing_cycle || 'monthly',
        status: data.status,
        started_at: data.started_at,
        expires_at: data.expires_at,
        cancelled_at: data.cancelled_at,
        payment_id: data.payment_id,
      });
    } catch (error) {
      logger.error('Error fetching subscription:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao buscar detalhes do plano',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!sub) return;
    try {
      setCancelling(true);
      const { error } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', sub.id);

      if (error) throw error;

      toast({
        title: 'Plano cancelado',
        description: 'A assinatura foi cancelada. Não haverá novas cobranças.',
      });
      setCancelDialogOpen(false);
      fetchSubscription(sub.id);
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar o plano.',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/admin/planos-contratados')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p>Plano não encontrado.</p>
      </div>
    );
  }

  const totalMonths = computeTotalMonths(sub.billing_cycle);
  const elapsed = Math.min(computeElapsedMonths(sub.started_at), totalMonths);
  const remainingMonths = Math.max(totalMonths - elapsed, 0);
  const totalValue = sub.price_monthly * totalMonths;
  const paidValue = sub.price_monthly * elapsed;
  const remainingValue = sub.price_monthly * remainingMonths;
  const status = statusLabel(sub.status);
  const isActive = sub.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/planos-contratados')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Detalhes do Plano Contratado</h1>
            <p className="text-gray-600 text-sm">ID: {sub.id}</p>
          </div>
        </div>
        <Badge variant={status.variant} className="text-sm">{status.label}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="h-4 w-4" /> Usuário Contratante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="font-medium">{sub.user_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> E-mail
              </p>
              <p className="font-medium">{sub.user_email}</p>
            </div>
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => navigate(`/admin/usuarios/${sub.user_id}`)}
            >
              Ver perfil do usuário →
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" /> Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Nome do Plano</p>
              <p className="font-medium capitalize">{sub.plan_name} ({sub.plan_type})</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Mensal</p>
              <p className="font-medium">{formatCurrency(sub.price_monthly)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ciclo</p>
              <p className="font-medium">Anual (cobrança mensal)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> Duração e Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Início</p>
                <p className="font-medium">{formatDate(sub.started_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expira em</p>
                <p className="font-medium">{formatDate(sub.expires_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duração total</p>
                <p className="font-medium">{totalMonths} meses</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recorrência atual</p>
                <p className="font-medium font-mono">{elapsed}/{totalMonths}</p>
              </div>
              {sub.cancelled_at && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Cancelado em</p>
                  <p className="font-medium text-red-700">{formatDate(sub.cancelled_at)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" /> Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor total do plano</span>
              <span className="font-medium">{formatCurrency(totalValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Já pago ({elapsed} {elapsed === 1 ? 'mês' : 'meses'})</span>
              <span className="font-medium text-green-700">{formatCurrency(paidValue)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-sm text-muted-foreground">Restante a pagar ({remainingMonths} {remainingMonths === 1 ? 'mês' : 'meses'})</span>
              <span className="font-medium">{formatCurrency(remainingValue)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {isActive && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-base text-red-900">Cancelar Plano</CardTitle>
            <CardDescription>
              O cancelamento interrompe as próximas cobranças. Não há devolução de valores já pagos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
              className="gap-2"
            >
              <Ban className="h-4 w-4" /> Cancelar Plano
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cancelamento</DialogTitle>
            <DialogDescription>
              Esta ação cancela a assinatura de <strong>{sub.user_name}</strong> no plano{' '}
              <strong className="capitalize">{sub.plan_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Política de cancelamento</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p>
                <strong>Sem devolução de valores já pagos.</strong> O pagamento é mensal e recorrente —
                ao cancelar, as próximas cobranças são interrompidas, mas o valor já cobrado dos meses
                utilizados não é restituído.
              </p>
              <div className="bg-white rounded p-3 border space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Meses já pagos:</span>
                  <span className="font-mono">{elapsed} × {formatCurrency(sub.price_monthly)} = {formatCurrency(paidValue)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cobranças futuras que serão interrompidas:</span>
                  <span className="font-mono">{remainingMonths} × {formatCurrency(sub.price_monthly)} = {formatCurrency(remainingValue)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-medium">Valor a devolver:</span>
                  <span className="font-medium">{formatCurrency(0)}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
              Manter plano ativo
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
