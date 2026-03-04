import { useState, useEffect } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import { supabase } from '@/integrations/supabase/client';
import { logger } from "@/lib/logger";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, MessageCircle, CheckCircle2, Clock, AlertCircle, Mail, Save, BookOpen, Loader2, RefreshCw, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description?: string;
  user_email: string;
  user_name?: string;
  status: string;
  priority: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

interface KnowledgeArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category: string;
  status: string;
  views: number;
  created_at: string;
  updated_at: string;
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  // Knowledge Base state
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articleSearchTerm, setArticleSearchTerm] = useState('');
  const [showArticleDialog, setShowArticleDialog] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: 'geral',
    status: 'draft',
  });
  const [savingArticle, setSavingArticle] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await AdminQueries.getAllTickets();
      
      if (error) throw error;
      
      const formattedTickets = (data || []).map((ticket: Record<string, unknown>) => ({
        id: ticket.id as string,
        ticket_number: ticket.ticket_number as string,
        subject: ticket.subject as string,
        description: ticket.description as string,
        user_email: ticket.user_email as string,
        user_name: ticket.user_name as string,
        status: ticket.status as string,
        priority: ticket.priority as string,
        category: ticket.category as string,
        created_at: ticket.created_at as string,
        updated_at: ticket.updated_at as string,
      }));
      
      setTickets(formattedTickets);
    } catch (error) {
      logger.error('Error fetching tickets:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar tickets',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Knowledge Base functions
  const fetchArticles = async () => {
    try {
      setArticlesLoading(true);
      const { data, error } = await AdminQueries.getAllKnowledgeArticles();
      
      if (error) throw error;
      
      const formattedArticles = (data || []).map((article: Record<string, unknown>) => ({
        id: article.id as string,
        title: article.title as string,
        slug: article.slug as string,
        content: article.content as string,
        excerpt: article.excerpt as string,
        category: article.category as string,
        status: article.status as string,
        views: article.views as number,
        created_at: article.created_at as string,
        updated_at: article.updated_at as string,
      }));
      
      setArticles(formattedArticles);
    } catch (error) {
      logger.error('Error fetching articles:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar artigos',
        variant: 'destructive'
      });
    } finally {
      setArticlesLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleOpenArticleDialog = (article?: KnowledgeArticle) => {
    if (article) {
      setEditingArticle(article);
      setArticleForm({
        title: article.title,
        content: article.content,
        excerpt: article.excerpt || '',
        category: article.category,
        status: article.status,
      });
    } else {
      setEditingArticle(null);
      setArticleForm({
        title: '',
        content: '',
        excerpt: '',
        category: 'geral',
        status: 'draft',
      });
    }
    setShowArticleDialog(true);
  };

  const handleSaveArticle = async () => {
    if (!articleForm.title || !articleForm.content) {
      toast({
        title: 'Erro',
        description: 'Título e conteúdo são obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    setSavingArticle(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingArticle) {
        // Update existing article
        const { error } = await AdminQueries.updateKnowledgeArticle(editingArticle.id, {
          title: articleForm.title,
          slug: generateSlug(articleForm.title),
          content: articleForm.content,
          excerpt: articleForm.excerpt,
          category: articleForm.category,
          status: articleForm.status,
        });
        
        if (error) throw error;
        
        toast({ title: 'Sucesso', description: 'Artigo atualizado!' });
      } else {
        // Create new article
        const { error } = await AdminQueries.createKnowledgeArticle({
          title: articleForm.title,
          slug: generateSlug(articleForm.title),
          content: articleForm.content,
          excerpt: articleForm.excerpt,
          category: articleForm.category,
          status: articleForm.status,
          author_id: user?.id,
        });
        
        if (error) throw error;
        
        toast({ title: 'Sucesso', description: 'Artigo criado!' });
      }
      
      setShowArticleDialog(false);
      fetchArticles();
    } catch (error) {
      logger.error('Error saving article:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar artigo',
        variant: 'destructive'
      });
    } finally {
      setSavingArticle(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este artigo?')) return;
    
    try {
      const { error } = await AdminQueries.deleteKnowledgeArticle(id);
      
      if (error) throw error;
      
      setArticles(articles.filter(a => a.id !== id));
      toast({ title: 'Sucesso', description: 'Artigo excluído!' });
    } catch (error) {
      logger.error('Error deleting article:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao excluir artigo',
        variant: 'destructive'
      });
    }
  };

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(articleSearchTerm.toLowerCase()) ||
    article.excerpt?.toLowerCase().includes(articleSearchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchTickets();
    fetchArticles();
  }, []);

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await AdminQueries.updateTicketStatus(ticketId, newStatus);
      
      if (error) throw error;
      
      setTickets(tickets.map(ticket => 
        ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
      ));
      
      toast({
        title: 'Sucesso',
        description: 'Status atualizado com sucesso'
      });
    } catch (error) {
      logger.error('Error updating ticket status:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar status',
        variant: 'destructive'
      });
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.ticket_number.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: { text: 'Aberto', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
      in_progress: { text: 'Em Progresso', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
      closed: { text: 'Fechado', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
      pending: { text: 'Pendente', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                   statusConfig.open;
    
    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${config.color}`}>
        <div className={`h-2 w-2 rounded-full ${config.dot}`}></div>
        {config.text}
      </div>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      high: { text: 'Alta', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
      medium: { text: 'Média', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
      low: { text: 'Baixa', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' }
    };
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || 
                   priorityConfig.medium;
    
    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${config.color}`}>
        <div className={`h-2 w-2 rounded-full ${config.dot}`}></div>
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
              
              <Button onClick={fetchTickets}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            {/* Tickets Table */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
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
                        <TableCell className="font-mono text-sm">{ticket.ticket_number}</TableCell>
                        <TableCell>
                          <div className="font-medium">{ticket.subject}</div>
                          <div className="text-sm text-gray-500">
                            Criado: {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{ticket.user_name || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{ticket.user_email}</div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ticket.status}
                            onValueChange={(value) => handleUpdateStatus(ticket.id, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              {getStatusBadge(ticket.status)}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Aberto</SelectItem>
                              <SelectItem value="in_progress">Em Progresso</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="closed">Fechado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                        <TableCell>
                          {new Date(ticket.updated_at).toLocaleString('pt-BR', {
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
            )}

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
                      value={articleSearchTerm}
                      onChange={(e) => setArticleSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => fetchArticles()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                  <Button onClick={() => handleOpenArticleDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Artigo
                  </Button>
                </div>
                
                {articlesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredArticles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum artigo encontrado
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredArticles.map((article) => (
                      <div 
                        key={article.id} 
                        className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium">{article.title}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                article.status === 'published' 
                                  ? 'bg-green-100 text-green-800' 
                                  : article.status === 'draft'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {article.status === 'published' ? 'Publicado' : article.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{article.excerpt || 'Sem descrição'}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                              <span>Categoria: {article.category}</span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" /> {article.views} visualizações
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenArticleDialog(article)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteArticle(article.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Article Dialog */}
          <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingArticle ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="articleTitle">Título</Label>
                  <Input
                    id="articleTitle"
                    value={articleForm.title}
                    onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                    placeholder="Título do artigo"
                  />
                </div>
                <div>
                  <Label htmlFor="articleExcerpt">Resumo</Label>
                  <Input
                    id="articleExcerpt"
                    value={articleForm.excerpt}
                    onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })}
                    placeholder="Breve descrição do artigo"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="articleCategory">Categoria</Label>
                    <Select
                      value={articleForm.category}
                      onValueChange={(value) => setArticleForm({ ...articleForm, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="geral">Geral</SelectItem>
                        <SelectItem value="conta">Conta</SelectItem>
                        <SelectItem value="consultas">Consultas</SelectItem>
                        <SelectItem value="pedidos">Pedidos</SelectItem>
                        <SelectItem value="planos">Planos</SelectItem>
                        <SelectItem value="pagamentos">Pagamentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="articleStatus">Status</Label>
                    <Select
                      value={articleForm.status}
                      onValueChange={(value) => setArticleForm({ ...articleForm, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="published">Publicado</SelectItem>
                        <SelectItem value="archived">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="articleContent">Conteúdo (HTML)</Label>
                  <Textarea
                    id="articleContent"
                    value={articleForm.content}
                    onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                    placeholder="<h2>Título</h2><p>Conteúdo do artigo...</p>"
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowArticleDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveArticle} disabled={savingArticle}>
                  {savingArticle ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
