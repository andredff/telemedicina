import { useState, useEffect } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import { getFinancialMetrics, getMonthlyMetricsHistory, type FinancialMetrics, type MonthlyMetrics } from '@/services/financialMetricsService';
import { logger } from "@/lib/logger";
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AreaChart,
  Area
} from 'recharts';
import { Download, Users, ShoppingCart, FileText, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export default function AdminReports() {
  const [timeRange, setTimeRange] = useState('month');
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
        setLoading(true);
        
        // Busca métricas básicas do admin
        const metricsData = await AdminQueries.getDashboardMetrics();
        setBasicMetrics(metricsData);

        // Busca métricas financeiras
        const financial = await getFinancialMetrics();
        setFinancialMetrics(financial);

        // Busca histórico mensal
        const history = await getMonthlyMetricsHistory(6);
        setMonthlyHistory(history);
        
      } catch (error) {
        logger.error('Error fetching report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  // Prepara dados do gráfico de pizza para distribuição de planos
  const pieData = financialMetrics ? [
    { name: 'Bronze', value: financialMetrics.planDistribution.bronze },
    { name: 'Prata', value: financialMetrics.planDistribution.prata },
    { name: 'Ouro', value: financialMetrics.planDistribution.ouro },
    { name: 'Diamante', value: financialMetrics.planDistribution.diamante },
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

  const generateReport = () => {
    // Exporta dados como CSV
    const csvContent = [
      ['Relatório da Novità Telemedicina'],
      ['Período: Últimos 6 meses'],
      [''],
      ['Métricas Gerais'],
      ['Usuários Totais', basicMetrics.totalUsers],
      ['Pedidos Totais', basicMetrics.totalOrders],
      ['Receitas Processadas', basicMetrics.totalPrescriptions],
      ['Assinaturas Ativas', basicMetrics.activeSubscriptions],
      [''],
      ['Métricas Financeiras'],
      ['MRR', formatCurrency(financialMetrics?.mrr || 0)],
      ['ARR', formatCurrency(financialMetrics?.arr || 0)],
      ['Ticket Médio', formatCurrency(financialMetrics?.averageTicket || 0)],
      ['Taxa de Churn', formatPercent(financialMetrics?.churnRate || 0)],
      [''],
      ['Histórico Mensal'],
      ['Mês', 'MRR', 'Assinantes', 'Churn (%)', 'Novos Assinantes'],
      ...monthlyHistory.map(m => [m.month, m.mrr, m.subscribers, m.churn, m.newSubscribers])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-novita-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
        <h1 className="text-2xl font-bold">Painel Financeiro</h1>
        <p className="text-gray-600">Acompanhe MRR, churn, inadimplência, ticket médio e distribuição de planos</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mês</SelectItem>
            <SelectItem value="quarter">Último trimestre</SelectItem>
            <SelectItem value="year">Último ano</SelectItem>
          </SelectContent>
        </Select>
        
        <Button onClick={generateReport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Relatórios
        </Button>
      </div>

      {/* Summary Cards */}
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
            <CardTitle className="text-sm font-medium">Receita Total (MRR)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialMetrics?.mrr || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {financialMetrics && (financialMetrics.mrrGrowth >= 0 ? (
                <span className="text-green-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{formatPercent(financialMetrics.mrrGrowth)}
                </span>
              ) : (
                <span className="text-red-600 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {formatPercent(financialMetrics.mrrGrowth)}
                </span>
              ))} vs mês anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução do MRR</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <YAxis tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'MRR']} />
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
        
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Planos</CardTitle>
          </CardHeader>
          <CardContent>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assinantes vs Cancelamentos</CardTitle>
          </CardHeader>
          <CardContent>
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
        
        <Card>
          <CardHeader>
            <CardTitle>Métricas de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Taxa de Churn</span>
                  <span className="text-sm font-medium">{formatPercent(financialMetrics?.churnRate || 0)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-red-500 h-3 rounded-full" 
                    style={{ width: `${Math.min((financialMetrics?.churnRate || 0) * 10, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {financialMetrics?.cancelledThisMonth || 0} cancelamentos este mês
                </p>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Assinantes Ativos</span>
                  <span className="text-sm font-medium">{financialMetrics?.activeSubscribers || 0}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full" 
                    style={{ width: `${financialMetrics?.activeSubscribers ? Math.min((financialMetrics.activeSubscribers / (financialMetrics.totalSubscribers || 1)) * 100, 100) : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  de {financialMetrics?.totalSubscribers || 0} total
                </p>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Inadimplência</span>
                  <span className="text-sm font-medium">{formatPercent(financialMetrics?.delinquencyRate || 0)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-yellow-500 h-3 rounded-full" 
                    style={{ width: `${(financialMetrics?.delinquencyRate || 0) * 10}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(financialMetrics?.delinquentAmount || 0)} em atraso
                </p>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Ticket Médio</span>
                  <span className="text-sm font-medium">{formatCurrency(financialMetrics?.averageTicket || 0)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-green-600 h-3 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 font-medium">MRR (Receita Recorrente)</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(financialMetrics?.mrr || 0)}</p>
              <p className="text-xs text-green-600 mt-1">
                {financialMetrics?.mrrGrowth >= 0 ? '+' : ''}{formatPercent(financialMetrics?.mrrGrowth || 0)} crescimento
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600 font-medium">ARR (Receita Anual)</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(financialMetrics?.arr || 0)}</p>
              <p className="text-xs text-blue-600 mt-1">Projeção baseada no MRR</p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-600 font-medium">Novos Assinantes</p>
              <p className="text-2xl font-bold text-purple-700">+{financialMetrics?.newSubscribersThisMonth || 0}</p>
              <p className="text-xs text-purple-600 mt-1">
                Crescimento líquido: {financialMetrics?.netGrowth || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
