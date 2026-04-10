import { useState, useEffect, useRef } from 'react';
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
import { Search, Plus, MessageCircle, CheckCircle2, Clock, AlertCircle, Mail, Save, BookOpen, Loader2, RefreshCw, Edit, Trash2, Eye, Send, User } from 'lucide-react';
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

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_type: string;
  message: string;
  created_at: string;
  profiles?: { full_name: string | null } | null;
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

  // Ticket detail dialog state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // ── Ticket Detail ──────────────────────────────────────────────────

  const openTicketDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowTicketDialog(true);
    setMessagesLoading(true);
    setReplyMessage('');

    try {
      const { data, error } = await AdminQueries.getTicketMessages(ticket.id);
      if (error) throw error;
      setMessages((data as TicketMessage[]) || []);
    } catch (error) {
      logger.error('Error fetching messages:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar mensagens', variant: 'destructive' });
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await AdminQueries.addTicketMessage(
        selectedTicket.id,
        replyMessage.trim(),
        user?.id,
        'support'
      );

      if (error) throw error;

      // If ticket is still "open", move it to "in_progress"
      if (selectedTicket.status === 'open') {
        await AdminQueries.updateTicketStatus(selectedTicket.id, 'in_progress');
        setSelectedTicket({ ...selectedTicket, status: 'in_progress' });
        setTickets(tickets.map(t =>
          t.id === selectedTicket.id ? { ...t, status: 'in_progress' } : t
        ));
      }

      setReplyMessage('');

      // Refresh messages
      const { data: msgs } = await AdminQueries.getTicketMessages(selectedTicket.id);
      setMessages((msgs as TicketMessage[]) || []);

      toast({ title: 'Sucesso', description: 'Resposta enviada!' });
    } catch (error) {
      logger.error('Error sending reply:', error);
      toast({ title: 'Erro', description: 'Falha ao enviar resposta', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  // Auto scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Knowledge Base ─────────────────────────────────────────────────

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

      // Also update selectedTicket if the dialog is open for this ticket
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }

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

  const statusConfig: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
    open: { text: 'Aberto', bg: 'bg-blue-50', textColor: 'text-blue-700', dot: 'bg-blue-500' },
    in_progress: { text: 'Em Progresso', bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: 'bg-yellow-500' },
    closed: { text: 'Fechado', bg: 'bg-green-50', textColor: 'text-green-700', dot: 'bg-green-500' },
    pending: { text: 'Pendente', bg: 'bg-gray-50', textColor: 'text-gray-700', dot: 'bg-gray-500' },
  };

  const priorityConfig: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
    high: { text: 'Alta', bg: 'bg-red-50', textColor: 'text-red-700', dot: 'bg-red-500' },
    medium: { text: 'Média', bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: 'bg-yellow-500' },
    low: { text: 'Baixa', bg: 'bg-green-50', textColor: 'text-green-700', dot: 'bg-green-500' },
  };

  const getStatusLabel = (status: string) => (statusConfig[status] || statusConfig.open).text;

  const StatusChip = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || statusConfig.open;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.textColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.text}
      </span>
    );
  };

  const PriorityChip = ({ priority }: { priority: string }) => {
    const cfg = priorityConfig[priority] || priorityConfig.medium;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.textColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.text}
      </span>
    );
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

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
                      <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openTicketDetail(ticket)}>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={ticket.status}
                            onValueChange={(value) => handleUpdateStatus(ticket.id, value)}
                          >
                            <SelectTrigger className="w-[150px] h-8">
                              <SelectValue>{getStatusLabel(ticket.status)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Aberto</SelectItem>
                              <SelectItem value="in_progress">Em Progresso</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="closed">Fechado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><PriorityChip priority={ticket.priority} /></TableCell>
                        <TableCell>
                          {formatDate(ticket.updated_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTicketDetail(ticket);
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Responder
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
              <CardTitle>Templates de Email Cadastrados</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Templates automáticos configurados no sistema de notificações</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">

                {/* 1 — Bem-vindo */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👋</span>
                      <h4 className="font-medium">Bem-vindo à Novità</h4>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Automático</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">Enviado automaticamente após o cadastro de um novo usuário</p>
                  <div className="bg-gray-50 p-3 rounded text-sm leading-relaxed">
                    <strong>Assunto:</strong> Bem-vindo à Novità Telemedicina! 💛<br /><br />
                    Olá, {`{nome}`}! 👋<br /><br />
                    Sua conta na Novità Telemedicina foi criada com sucesso.
                    Você já pode acessar teleconsultas, receituários digitais e comprar medicamentos — tudo de onde estiver.<br /><br />
                    <strong>E-mail cadastrado:</strong> {`{email}`}<br />
                    <strong>Próximo passo:</strong> Acesse o dashboard e complete seu perfil<br /><br />
                    💡 <em>Dica: Complete seu perfil com CPF e data de nascimento para habilitar todas as funcionalidades.</em><br /><br />
                    <span className="text-blue-600">[Acessar minha conta →]</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{nome}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{email}`}</code>
                  </div>
                </div>

                {/* 2 — Senha alterada */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔐</span>
                      <h4 className="font-medium">Senha Alterada</h4>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Automático</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">Alerta de segurança enviado quando a senha do usuário é alterada</p>
                  <div className="bg-gray-50 p-3 rounded text-sm leading-relaxed">
                    <strong>Assunto:</strong> Sua senha foi alterada — Novità<br /><br />
                    Olá, {`{nome}`}. A senha da sua conta foi alterada recentemente.<br /><br />
                    <strong>Conta:</strong> {`{email}`}<br />
                    <strong>Data/hora:</strong> {`{dataHora}`}<br />
                    <strong>Ação:</strong> Alteração de senha<br /><br />
                    ⚠️ <em>Não foi você? Se você não solicitou esta alteração, redefina sua senha imediatamente.</em><br /><br />
                    <span className="text-red-600">[Redefinir minha senha →]</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{nome}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{email}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{dataHora}`}</code>
                  </div>
                </div>

                {/* 3 — Consulta agendada */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🩺</span>
                      <h4 className="font-medium">Consulta Agendada</h4>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Automático</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">Confirmação enviada quando uma teleconsulta é agendada</p>
                  <div className="bg-gray-50 p-3 rounded text-sm leading-relaxed">
                    <strong>Assunto:</strong> Consulta confirmada — {`{especialidade}`} 🩺<br /><br />
                    Olá, {`{nome}`}. Sua teleconsulta foi confirmada com sucesso.<br /><br />
                    <strong>Especialidade:</strong> {`{especialidade}`}<br />
                    <strong>Profissional:</strong> {`{profissional}`}<br />
                    <strong>Data e hora:</strong> {`{dataHora}`}<br />
                    <strong>Nº da consulta:</strong> #{`{consultaId}`}<br /><br />
                    📌 <em>Lembrete automático: Você receberá um aviso 30 minutos antes da consulta.</em><br /><br />
                    <span className="text-blue-600">[Ver minha consulta →]</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{nome}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{especialidade}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{profissional}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{dataHora}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{consultaId}`}</code>
                  </div>
                </div>

                {/* 4 — Lembrete de consulta */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⏰</span>
                      <h4 className="font-medium">Lembrete de Consulta (30 min)</h4>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Agendado</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">Disparado automaticamente pelo scheduler 30 minutos antes da consulta</p>
                  <div className="bg-gray-50 p-3 rounded text-sm leading-relaxed">
                    <strong>Assunto:</strong> ⏰ Sua consulta começa em 30 minutos — Novità<br /><br />
                    Olá, {`{nome}`}! Sua teleconsulta começa em aproximadamente 30 minutos.<br /><br />
                    <strong>Especialidade:</strong> {`{especialidade}`}<br />
                    <strong>Profissional:</strong> {`{profissional}`}<br />
                    <strong>Horário:</strong> {`{dataHora}`}<br />
                    <strong>Consulta:</strong> #{`{consultaId}`}<br /><br />
                    ✅ <em>Antes de entrar, verifique: câmera e microfone, conexão com internet, ambiente tranquilo.</em><br /><br />
                    <span className="text-blue-600">[Entrar na sala de espera →]</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{nome}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{especialidade}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{profissional}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{dataHora}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{consultaId}`}</code>
                  </div>
                </div>

                {/* 5 — Notificação de pedido */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📦</span>
                      <h4 className="font-medium">Atualização de Pedido</h4>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Manual / Automático</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">Enviado quando o status de um pedido é atualizado (pelo admin ou no checkout)</p>
                  <div className="bg-gray-50 p-3 rounded text-sm leading-relaxed">
                    <strong>Assunto:</strong> {`{icone}`} Pedido #{`{pedidoId}`} — {`{statusLabel}`}<br /><br />
                    Olá, {`{nome}`}. Seu pedido foi atualizado.<br /><br />
                    <strong>Pedido:</strong> #{`{pedidoId}`}<br />
                    <strong>Status:</strong> {`{statusLabel}`}<br />
                    <strong>Código de rastreio:</strong> {`{trackingCode}`} <span className="text-gray-400">(quando enviado)</span><br /><br />
                    <span className="text-blue-600">[Ver meus pedidos →]</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{nome}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{pedidoId}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{status}`}</code>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{trackingCode}`}</code>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    <strong>Status disponíveis:</strong> 📦 Pedido recebido · ⚙️ Em preparação · 🚚 Pedido enviado · ✅ Pedido entregue · ❌ Pedido cancelado
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Ticket Detail Dialog ─────────────────────────────────────── */}
      <Dialog open={showTicketDialog} onOpenChange={(open) => {
        setShowTicketDialog(open);
        if (!open) {
          fetchTickets(); // refresh list when closing
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Ticket {selectedTicket?.ticket_number}</span>
              {selectedTicket && <StatusChip status={selectedTicket.status} />}
            </DialogTitle>
            {selectedTicket && (
              <div className="space-y-1 pt-2">
                <p className="font-medium text-base">{selectedTicket.subject}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {selectedTicket.user_name || selectedTicket.user_email}
                  </span>
                  <span>·</span>
                  <span>{formatDate(selectedTicket.created_at)}</span>
                  {selectedTicket.category && (
                    <>
                      <span>·</span>
                      <span className="capitalize">{selectedTicket.category}</span>
                    </>
                  )}
                </div>
                {/* Status control inside dialog */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-sm text-muted-foreground">Alterar status:</span>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(value) => handleUpdateStatus(selectedTicket.id, value)}
                  >
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue>{getStatusLabel(selectedTicket.status)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="in_progress">Em Progresso</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto border rounded-lg bg-muted/30 p-4 space-y-3 min-h-[200px] max-h-[40vh]">
            {messagesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {selectedTicket?.description ? (
                  <div className="text-left">
                    <p className="font-medium text-foreground mb-1">Descrição do ticket:</p>
                    <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>
                ) : (
                  'Nenhuma mensagem ainda.'
                )}
              </div>
            ) : (
              messages.map((msg) => {
                const isSupport = msg.sender_type === 'support';
                const isSystem = msg.sender_type === 'system';
                return (
                  <div key={msg.id} className={`flex ${isSupport ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`rounded-xl px-4 py-2.5 max-w-[85%] ${
                        isSystem
                          ? 'bg-muted text-muted-foreground text-center w-full text-xs italic'
                          : isSupport
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border shadow-sm'
                      }`}
                    >
                      {!isSystem && (
                        <p className={`text-[11px] font-medium mb-0.5 ${isSupport ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {isSupport ? (msg.profiles?.full_name || 'Suporte') : (selectedTicket?.user_name || 'Cliente')}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${isSupport ? 'text-primary-foreground/50' : 'text-muted-foreground/60'}`}>
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box */}
          <div className="flex gap-2 pt-2">
            <Textarea
              placeholder="Digite sua resposta..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={2}
            />
            <Button
              size="icon"
              onClick={handleSendReply}
              disabled={sending || !replyMessage.trim()}
              className="shrink-0 h-[44px] w-[44px]"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
