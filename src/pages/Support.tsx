import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HelpCircle,
  Plus,
  MessageCircle,
  Clock,
  CheckCircle2,
  Loader2,
  Send,
  ArrowLeft,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTickets, Ticket, TicketMessage } from '@/hooks/useTickets';
import { User, Session } from '@supabase/supabase-js';

const STATUS_CONFIG: Record<string, { label: string; bg: string; textColor: string; dot: string }> = {
  open: { label: 'Aberto', bg: 'bg-blue-50', textColor: 'text-blue-700', dot: 'bg-blue-500' },
  in_progress: { label: 'Em andamento', bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: 'bg-yellow-500' },
  pending: { label: 'Pendente', bg: 'bg-gray-100', textColor: 'text-gray-700', dot: 'bg-gray-500' },
  closed: { label: 'Resolvido', bg: 'bg-green-50', textColor: 'text-green-700', dot: 'bg-green-500' },
};

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'Geral' },
  { value: 'conta', label: 'Minha Conta' },
  { value: 'consultas', label: 'Consultas' },
  { value: 'pedidos', label: 'Pedidos' },
  { value: 'planos', label: 'Planos' },
  { value: 'pagamentos', label: 'Pagamentos' },
  { value: 'receitas', label: 'Receitas' },
];

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.textColor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Support() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Ticket list
  const { tickets, loading, fetchTickets, createTicket, getTicketMessages, sendMessage } = useTickets();
  const [filterStatus, setFilterStatus] = useState('all');

  // Create ticket dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', category: 'general' });

  // Ticket detail / chat
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth check
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess) navigate('/auth');
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess) navigate('/auth');
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Filtered tickets
  const filteredTickets = filterStatus === 'all'
    ? tickets
    : tickets.filter((t) => t.status === filterStatus);

  // Open ticket detail
  const openTicketDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMessagesLoading(true);
    const msgs = await getTicketMessages(ticket.id);
    setMessages(msgs);
    setMessagesLoading(false);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create new ticket
  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) return;
    setCreating(true);
    const ticket = await createTicket(newTicket.subject, newTicket.description, newTicket.category);
    setCreating(false);
    if (ticket) {
      setShowCreateDialog(false);
      setNewTicket({ subject: '', description: '', category: 'general' });
      openTicketDetail(ticket);
    }
  };

  // Send message in chat
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    setSending(true);
    const ok = await sendMessage(selectedTicket.id, newMessage.trim());
    if (ok) {
      setNewMessage('');
      const msgs = await getTicketMessages(selectedTicket.id);
      setMessages(msgs);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Ticket Detail View ────────────────────────────────────────────
  if (selectedTicket) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated={!!session} />
        <main className="container mx-auto px-4 py-6 max-w-3xl">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 gap-1.5"
            onClick={() => {
              setSelectedTicket(null);
              fetchTickets();
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos tickets
          </Button>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-mono text-muted-foreground">{selectedTicket.ticket_number}</p>
                  <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Criado em {formatDate(selectedTicket.created_at)}</span>
                    {selectedTicket.category && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{CATEGORY_OPTIONS.find(c => c.value === selectedTicket.category)?.label || selectedTicket.category}</span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={selectedTicket.status} />
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Messages */}
              <div className="border rounded-lg bg-muted/30 p-4 space-y-4 max-h-[50vh] overflow-y-auto mb-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Nenhuma mensagem ainda.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isCustomer = msg.sender_type === 'customer';
                    const isSystem = msg.sender_type === 'system';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`rounded-xl px-4 py-2.5 max-w-[85%] ${
                            isSystem
                              ? 'bg-muted text-muted-foreground text-center w-full text-xs italic'
                              : isCustomer
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border shadow-sm'
                          }`}
                        >
                          {!isSystem && (
                            <p className={`text-[11px] font-medium mb-0.5 ${isCustomer ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {isCustomer ? 'Você' : (msg.profiles?.full_name || 'Suporte')}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${isCustomer ? 'text-primary-foreground/50' : 'text-muted-foreground/60'}`}>
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Send message */}
              {selectedTicket.status !== 'closed' ? (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[44px] max-h-[120px] resize-none"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="shrink-0 h-[44px] w-[44px]"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Este ticket foi resolvido.
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ── Ticket List View ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated={!!session} />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <PageHeader
          title="Suporte"
          subtitle="Abra e acompanhe seus tickets de suporte"
          icon={HelpCircle}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          actions={
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Ticket
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterStatus('all')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tickets.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setFilterStatus('open')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-blue-500/10 rounded-lg p-2">
                <AlertCircle className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tickets.filter((t) => t.status === 'open').length}</p>
                <p className="text-xs text-muted-foreground">Abertos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-yellow-500/50 transition-colors" onClick={() => setFilterStatus('in_progress')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-yellow-500/10 rounded-lg p-2">
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tickets.filter((t) => t.status === 'in_progress').length}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => setFilterStatus('closed')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-green-500/10 rounded-lg p-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tickets.filter((t) => t.status === 'closed').length}</p>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter tabs */}
        <Tabs value={filterStatus} onValueChange={setFilterStatus} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="open">Abertos</TabsTrigger>
            <TabsTrigger value="in_progress">Em andamento</TabsTrigger>
            <TabsTrigger value="closed">Resolvidos</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Ticket list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-muted rounded-full p-4 mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">
                {filterStatus === 'all' ? 'Nenhum ticket ainda' : 'Nenhum ticket encontrado'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {filterStatus === 'all'
                  ? 'Precisa de ajuda? Abra um ticket e nossa equipe vai te ajudar.'
                  : 'Nenhum ticket com este status no momento.'}
              </p>
              {filterStatus === 'all' && (
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Abrir Ticket
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                onClick={() => openTicketDetail(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {ticket.ticket_number}
                        </span>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <h3 className="font-medium truncate">{ticket.subject}</h3>
                      {ticket.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                          {ticket.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(ticket.created_at)}
                        </span>
                        {ticket.category && (
                          <span className="capitalize">
                            {CATEGORY_OPTIONS.find(c => c.value === ticket.category)?.label || ticket.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <MessageCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Ticket Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Ticket de Suporte</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="ticket-subject">Assunto</Label>
                <Input
                  id="ticket-subject"
                  placeholder="Descreva brevemente o problema"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ticket-category">Categoria</Label>
                <Select
                  value={newTicket.category}
                  onValueChange={(val) => setNewTicket({ ...newTicket, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ticket-description">Descrição</Label>
                <Textarea
                  id="ticket-description"
                  placeholder="Explique o que está acontecendo com o máximo de detalhes possível..."
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  className="min-h-[120px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateTicket}
                disabled={creating || !newTicket.subject.trim() || !newTicket.description.trim()}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Criar Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
