import { useEffect, useState } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import { getFinancialMetrics, getMonthlyMetricsHistory, type FinancialMetrics, type MonthlyMetrics } from '@/services/financialMetricsService';
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Users,
  ShoppingCart,
  FileText,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  UserMinus,
  UserPlus,
  Percent
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

export default function AdminDashboard() {
  const [basicMetrics, setBasicMetrics] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalPrescriptions: 0,
    activeSubscriptions: 0
  });
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics | null>(null);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Busca métricas básicas do admin
        const metricsData = await AdminQueries.getDashboardMetrics();
        setBasicMetrics(metricsData);

        // Busca métricas financeiras
        const financial = await getFinancialMetrics();
        setFinancialMetrics(financial);

        // Busca histórico mensal
        const history = await getMonthlyMetricsHistory(6);
        setMonthlyHistory(history);

        setLoading(false);
      } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  // Prepara dados do gráfico de pizza para distribuição de planos
  const pieData = financialMetrics ? [
    { name: 'Bronze', value: financialMetrics.planDistribution.bronze },
    { name: 'Prata', value: financialMetrics.planDistribution.prata },
    { name: 'Ouro', value: financialMetrics.planDistribution.ouro },
    { name: 'Platina', value: financialMetrics.planDistribution.platina },
    { name: 'Coletivo', value: financialMetrics.planDistribution.coletivo },
  ].filter(p => p.value > 0) : [];

  // Formata valor em Real
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formata percentual
  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Administrativo</h1>
        <p className="text-gray-600">Visão geral da plataforma Novità Telemedicina</p>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{basicMetrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{financialMetrics?.subscriberGrowth || 0}%</span> desde o último mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Totais</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{basicMetrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Pedidos de medicamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas Totais</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{basicMetrics.totalPrescriptions}</div>
            <p className="text-xs text-muted-foreground">Receitas processadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialMetrics?.activeSubscribers || basicMetrics.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              de {financialMetrics?.totalSubscribers || 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Financeiras */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR (Receita Recorrente)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(financialMetrics?.mrr || 0)}
            </div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              {(financialMetrics?.mrrGrowth || 0) >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatPercent(financialMetrics?.mrrGrowth || 0)} vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inadimplência</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {financialMetrics?.delinquentSubscribers || 0}
            </div>
            <p className="text-xs text-red-600">
              {formatPercent(financialMetrics?.delinquencyRate || 0)} dos assinantes
              <span className="block text-muted-foreground">
                {formatCurrency(financialMetrics?.delinquentAmount || 0)} em atraso
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Churn</CardTitle>
            <UserMinus className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {formatPercent(financialMetrics?.churnRate || 0)}
            </div>
            <p className="text-xs text-amber-600">
              {financialMetrics?.cancelledThisMonth || 0} cancelamentos este mês
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Assinantes</CardTitle>
            <UserPlus className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              +{financialMetrics?.newSubscribersThisMonth || 0}
            </div>
            <p className="text-xs text-blue-600">
              Crescimento líquido: {financialMetrics?.netGrowth || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico de MRR ao longo do tempo */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução do MRR</CardTitle>
            <CardDescription>Receita recorrente mensal</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyHistory}>
                  <defs>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'MRR']}
                  />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorMrr)"
                    name="MRR"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Distribuição de Planos */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Planos</CardTitle>
            <CardDescription>Assinantes por tipo de plano</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Assinantes e Churn */}
      <Card>
        <CardHeader>
          <CardTitle>Assinantes vs Churn</CardTitle>
          <CardDescription>Novos assinantes e cancelamentos por mês</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="newSubscribers" fill="#3b82f6" name="Novos Assinantes" />
                <Bar dataKey="churn" fill="#ef4444" name="Cancelamentos (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Rápido */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR (Receita Anual)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialMetrics?.arr || 0)}</div>
            <p className="text-xs text-muted-foreground">Projeção anual baseada no MRR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialMetrics?.averageTicket || 0)}</div>
            <p className="text-xs text-muted-foreground">Valor médio por assinante</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinantes Inativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialMetrics?.inactiveSubscribers || 0}</div>
            <p className="text-xs text-muted-foreground">Assinaturas pausadas ou canceladas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
