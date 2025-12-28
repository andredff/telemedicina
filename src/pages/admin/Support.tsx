import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Search, Plus, MessageCircle, CheckCircle2, Clock, AlertCircle, Mail } from 'lucide-react';

export default function AdminSupport() {
  const [tickets, setTickets] = useState([
    {
      id: '1',
      subject: 'Problema com login',
      customer: 'joao.silva@email.com',
      status: 'open',
      priority: 'medium',
      createdAt: '2023-07-15T10:30:00',
      lastUpdate: '2023-07-15T14:45:00'
    },
    {
      id: '2',
      subject: 'Receita não encontrada',
      customer: 'maria.oliveira@email.com',
      status: 'in_progress',
      priority: 'high',
      createdAt: '2023-07-14T09:15:00',
      lastUpdate: '2023-07-14T16:20:00'
    },
    {
      id: '3',
      subject: 'Problema com pagamento',
      customer: 'carlos.santos@email.com',
      status: 'closed',
      priority: 'low',
      createdAt: '2023-07-13T14:20:00',
      lastUpdate: '2023-07-13T18:30:00'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.id.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: { text: 'Aberto', color: 'bg-blue-100 text-blue-800' },
      in_progress: { text: 'Em Progresso', color: 'bg-yellow-100 text-yellow-800' },
      closed: { text: 'Fechado', color: 'bg-green-100 text-green-800' },
      pending: { text: 'Pendente', color: 'bg-gray-100 text-gray-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                   statusConfig.open;
    
    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${config.color}`}>
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color.split(' ')[0].replace('bg-', '').replace('text-', '') }}></div>
        {config.text}
      </div>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      high: { text: 'Alta', color: 'bg-red-100 text-red-800' },
      medium: { text: 'Média', color: 'bg-yellow-100 text-yellow-800' },
      low: { text: 'Baixa', color: 'bg-green-100 text-green-800' }
    };
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || 
                   priorityConfig.medium;
    
    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${config.color}`}>
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color.split(' ')[0].replace('bg-', '').replace('text-', '') }}></div>
        {config.text}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suporte ao Cliente</h1>
        <p className="text-gray-600">Gerencie tickets de suporte e comunicação com clientes</p>
      </div>

      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tickets">
            <MessageCircle className="h-4 w-4 mr-2" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpen className="h-4 w-4 mr-2" />
            Base de Conhecimento
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Mail className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Tickets Tab */}
        <TabsContent value="tickets">
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tickets..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abertos</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="closed">Fechados</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
              
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Ticket
              </Button>
            </div>

            {/* Tickets Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Última Atualização</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        Nenhum ticket encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-sm">#{ticket.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{ticket.subject}</div>
                          <div className="text-sm text-gray-500">
                            Criado: {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell>{ticket.customer}</TableCell>
                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                        <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                        <TableCell>
                          {new Date(ticket.lastUpdate).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" className="mr-2">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="flex-1 min-w-[200px]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tickets.length}</div>
                </CardContent>
              </Card>
              
              <Card className="flex-1 min-w-[200px]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Abertos</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tickets.filter(t => t.status === 'open').length}</div>
                </CardContent>
              </Card>
              
              <Card className="flex-1 min-w-[200px]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Em Progresso</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tickets.filter(t => t.status === 'in_progress').length}</div>
                </CardContent>
              </Card>
              
              <Card className="flex-1 min-w-[200px]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fechados</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tickets.filter(t => t.status === 'closed').length}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle>Base de Conhecimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar artigos..."
                      className="pl-10"
                    />
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Artigo
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <h3 className="font-medium">Como criar uma conta na Novità</h3>
                    <p className="text-sm text-gray-500">Guia passo a passo para novos usuários</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <h3 className="font-medium">Como agendar uma consulta</h3>
                    <p className="text-sm text-gray-500">Processo para agendamento de consultas médicas</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <h3 className="font-medium">Problemas com login</h3>
                    <p className="text-sm text-gray-500">Soluções para problemas comuns de autenticação</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Templates de Resposta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-4">Templates Padrão</h3>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">Boas-vindas ao Novo Usuário</h4>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Editar</Button>
                          <Button variant="outline" size="sm">Excluir</Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Template de email enviado para novos usuários após o cadastro</p>
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        Olá {`{nome}`},
                        <br /><br />
                        Bem-vindo à Novità Telemedicina! Estamos felizes em tê-lo conosco.
                        <br /><br />
                        Aqui estão algumas informações para começar:
                        <br />
                        - Acesse sua conta: {`{link_login}`}
                        <br />
                        - Agende sua primeira consulta: {`{link_agendamento}`}
                        <br />
                        - Explore nossos planos: {`{link_planos}`}
                        <br /><br />
                        Se precisar de ajuda, nossa equipe de suporte está disponível 24/7.
                        <br /><br />
                        Atenciosamente,
                        <br />
                        Equipe Novità
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">Confirmação de Pedido</h4>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Editar</Button>
                          <Button variant="outline" size="sm">Excluir</Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Template de email enviado após a confirmação de um pedido</p>
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        Olá {`{nome}`},
                        <br /><br />
                        Seu pedido #{`{pedido_id}`} foi confirmado com sucesso!
                        <br /><br />
                        Detalhes do pedido:
                        <br />
                        - Medicamento: {`{medicamento}`}
                        <br />
                        - Quantidade: {`{quantidade}`}
                        <br />
                        - Valor total: {`{valor}`}
                        <br />
                        - Previsão de entrega: {`{entrega}`}
                        <br /><br />
                        Você pode acompanhar o status do seu pedido em: {`{link_acompanhamento}`}
                        <br /><br />
                        Obrigado por escolher a Novità!
                        <br /><br />
                        Atenciosamente,
                        <br />
                        Equipe Novità
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-4">Criar Novo Template</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="templateName">Nome do Template</Label>
                      <Input id="templateName" placeholder="Ex: Recuperação de Senha" />
                    </div>
                    <div>
                      <Label htmlFor="templateType">Tipo</Label>
                      <Select defaultValue="email">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="push">Push Notification</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="templateContent">Conteúdo</Label>
                      <Textarea
                        id="templateContent"
                        placeholder="Digite o conteúdo do template..."
                        className="min-h-[200px]"
                      />
                    </div>
                    <Button>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Template
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper components
function Select({ children, value, onValueChange, defaultValue }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void; defaultValue?: string }) {
  return (
    <div className="relative">
      <select
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        defaultValue={defaultValue}
      >
        {children}
      </select>
    </div>
  );
}

function SelectTrigger({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
      {children}
    </div>
  );
}

function SelectContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border">
      {children}
    </div>
  );
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <div
      className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
      onClick={() => {
        // This would be handled by the parent select
      }}
    >
      {children}
    </div>
  );
}

function SelectValue({ placeholder }: { placeholder: string }) {
  return (
    <span className="text-gray-500">{placeholder}</span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`font-medium ${className}`}>
      {children}
    </h3>
  );
}

function Save({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}