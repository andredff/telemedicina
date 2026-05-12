import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '@/integrations/supabase/adminClient';
import { logger } from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, FileText, DollarSign, Users as UsersIcon, Eye } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface SubscriptionRow {
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
  if (c.includes('month') || c.includes('mensal')) return 12;
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

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
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
          subscription_plans:plan_id ( name, type, price_monthly ),
          profiles:user_id ( full_name, email )
        `)
        .order('started_at', { ascending: false });

      if (error) throw error;

      const mapped: SubscriptionRow[] = (data || []).map((r: Record<string, unknown>) => {
        const plan = (r.subscription_plans as { name?: string; type?: string; price_monthly?: number }) || {};
        const profile = (r.profiles as { full_name?: string; email?: string }) || {};
        return {
          id: r.id as string,
          user_id: r.user_id as string,
          user_name: profile.full_name || profile.email || '—',
          user_email: profile.email || '—',
          plan_name: plan.name || '—',
          plan_type: plan.type || '—',
          price_monthly: plan.price_monthly || 0,
          billing_cycle: (r.billing_cycle as string) || 'monthly',
          status: r.status as string,
          started_at: r.started_at as string | null,
          expires_at: r.expires_at as string | null,
          cancelled_at: r.cancelled_at as string | null,
        };
      });

      setRows(mapped);
    } catch (error) {
      logger.error('Error fetching subscriptions:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao buscar planos contratados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = rows.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      r.user_name.toLowerCase().includes(term) ||
      r.user_email.toLowerCase().includes(term) ||
      r.plan_name.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesPlan = planFilter === 'all' || r.plan_type === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const activeCount = rows.filter((r) => r.status === 'active').length;
  const totalMRR = rows
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => sum + r.price_monthly, 0);

  const planTypes = Array.from(new Set(rows.map((r) => r.plan_type))).filter(
    (t) => t && t !== '—'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Planos Contratados</h1>
        <p className="text-gray-600">
          Acompanhe assinaturas ativas, usuários, duração, valor total do plano e recorrência de pagamento
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinantes Ativos</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR (ativos)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMRR)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, e-mail ou plano..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
          </SelectContent>
        </Select>

        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos planos</SelectItem>
            {planTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={fetchSubscriptions} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Recorrência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    Carregando planos...
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum plano contratado encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const totalMonths = computeTotalMonths(r.billing_cycle);
                const elapsed = Math.min(computeElapsedMonths(r.started_at), totalMonths);
                const totalValue = r.price_monthly * totalMonths;
                const status = statusLabel(r.status);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.user_name}</div>
                      <div className="text-xs text-muted-foreground">{r.user_email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.plan_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(r.price_monthly)}/mês
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(r.started_at)}</TableCell>
                    <TableCell>{totalMonths} meses</TableCell>
                    <TableCell className="font-medium">{formatCurrency(totalValue)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {elapsed}/{totalMonths}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => navigate(`/admin/planos-contratados/${r.id}`)}
                      >
                        <Eye className="h-3 w-3" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
