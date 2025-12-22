import { useState } from 'react';
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
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { Download, Calendar, Users, ShoppingCart, FileText, DollarSign } from 'lucide-react';

export default function AdminReports() {
  const [reportType, setReportType] = useState('overview');
  const [timeRange, setTimeRange] = useState('month');

  // Mock data for reports
  const userGrowthData = [
    { name: 'Jan', users: 400 },
    { name: 'Fev', users: 600 },
    { name: 'Mar', users: 800 },
    { name: 'Abr', users: 700 },
    { name: 'Mai', users: 900 },
    { name: 'Jun', users: 1100 },
  ];

  const orderData = [
    { name: 'Jan', orders: 240, revenue: 12000 },
    { name: 'Fev', orders: 350, revenue: 18000 },
    { name: 'Mar', orders: 420, revenue: 22000 },
    { name: 'Abr', orders: 380, revenue: 19000 },
    { name: 'Mai', orders: 480, revenue: 25000 },
    { name: 'Jun', orders: 520, revenue: 28000 },
  ];

  const prescriptionData = [
    { name: 'Clínico Geral', value: 45 },
    { name: 'Cardiologia', value: 20 },
    { name: 'Dermatologia', value: 15 },
    { name: 'Pediatria', value: 12 },
    { name: 'Outros', value: 8 },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const generateReport = () => {
    // In a real app, this would generate and download a report
    console.log('Generating report...');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios e Analytics</h1>
        <p className="text-gray-600">Visualize dados e gere relatórios da plataforma</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo de relatório" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overview">Visão Geral</SelectItem>
            <SelectItem value="users">Usuários</SelectItem>
            <SelectItem value="orders">Pedidos</SelectItem>
            <SelectItem value="prescriptions">Receitas</SelectItem>
            <SelectItem value="financial">Financeiro</SelectItem>
          </SelectContent>
        </Select>
        
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

      {/* Report Content */}
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,245</div>
              <p className="text-xs text-muted-foreground">+12% desde o período anterior</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Totais</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2,345</div>
              <p className="text-xs text-muted-foreground">+18% desde o período anterior</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receitas Processadas</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,872</div>
              <p className="text-xs text-muted-foreground">+22% desde o período anterior</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 145.230</div>
              <p className="text-xs text-muted-foreground">+25% desde o período anterior</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Crescimento de Usuários</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} name="Novos Usuários" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Desempenho de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="orders" fill="#3b82f6" name="Pedidos" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Receita (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Especialidades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={prescriptionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {prescriptionData.map((entry, index) => (
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
          
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Engajamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Taxa de Conversão</span>
                    <span className="text-sm font-medium">42.5%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '42.5%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Taxa de Retenção</span>
                    <span className="text-sm font-medium">78.3%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '78.3%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Satisfação do Cliente</span>
                    <span className="text-sm font-medium">4.7/5</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: '94%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Report Section */}
        <Card>
          <CardHeader>
            <CardTitle>Relatório Detalhado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Principais Métricas</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="flex justify-between">
                      <span>Usuários novos:</span>
                      <span className="font-medium">345</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Usuários ativos:</span>
                      <span className="font-medium">1,245</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de crescimento:</span>
                      <span className="font-medium text-green-600">+12%</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span>Pedidos completados:</span>
                      <span className="font-medium">2,134</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor médio de pedido:</span>
                      <span className="font-medium">R$ 112.50</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de conversão:</span>
                      <span className="font-medium text-green-600">+8%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Recomendações</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Aumentar engajamento em saúde mental (baixo desempenho)</li>
                  <li>Promover planos anuais (alta retenção)</li>
                  <li>Melhorar processo de checkout (abandono de carrinho)</li>
                  <li>Expandir conteúdo sobre telemedicina (alta demanda)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}