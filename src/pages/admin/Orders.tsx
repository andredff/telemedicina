import { useEffect, useState } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import {
  sendOrderStatusNotification,
  sendLogisticsServiceOrder,
  getOrderNotificationHistory,
  type OrderStatus
} from '@/services/notificationService';
import { logger } from "@/lib/logger";
import {
  normalizeCorreiosTrackingCode,
  saveOrderTracking,
  validateCorreiosTrackingCode,
  type TrackingEvent,
} from '@/services/trackingService';
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
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Bell,
  Mail,
  History,
  FileText,
  ExternalLink,
  ClipboardCheck,
  CheckCheck,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { cieloClient } from '@/integrations/cielo';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { formatOrderStatus } from '@/lib/labels';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customer: string;
  customer_email?: string;
  customer_phone?: string;
  delivery_address?: string;
  date: string;
  status: string;
  total: number;
  subtotal?: number;
  shipping?: number;
  payment_method?: string;
  payment_status?: string;
  items: OrderItem[];
  prescription_id?: string;
  tracking_code?: string;
  tracking_carrier?: string | null;
  tracking_status?: string | null;
  tracking_status_label?: string | null;
  tracking_last_event_at?: string | null;
  tracking_last_checked_at?: string | null;
  tracking_estimated_delivery?: string | null;
  tracking_events?: TrackingEvent[] | null;
  receita_id?: string;
  receita_url_pdf?: string;
  consulta_id?: string;
  receita_review_status?: 'approved' | 'rejected' | null;
  receita_review_notes?: string | null;
  receita_reviewed_at?: string | null;
}

interface NotificationHistory {
  id: string;
  status: string;
  sentAt: string;
  subject: string;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistory[]>([]);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Dialog de rastreio ao mudar status para "shipped"
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [shippingTrackingCode, setShippingTrackingCode] = useState('');
  const [shippingEstimatedDelivery, setShippingEstimatedDelivery] = useState('');
  const [confirmingShipping, setConfirmingShipping] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const normalizeStatus = (status: string | null | undefined) => {
    if (!status) return "pending";
    if (status === "in_transit") return "shipped";
    if (status === "confirmed") return "processing";
    return status;
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await AdminQueries.getAllOrders();

      logger.info("[AdminOrders] fetchOrders", { count: data?.length, error });

      if (error) throw error;

      const formattedOrders = (data || []).map((order: Record<string, unknown>) => {
        // Parse items if it's a string or null
        const itemsData = order.items 
          ? (typeof order.items === "string" ? JSON.parse(order.items) : order.items)
          : [];
        return {
          id: order.id as string,
          customer: (order.customer as string) || 'Cliente Desconhecido',
          customer_email: (order.customer_email as string) || 'email@exemplo.com',
          customer_phone: (order.customer_phone as string) || '',
          delivery_address: (order.delivery_address as string) || '',
          date: (order.date as string) || (order.created_at as string),
          status: normalizeStatus(order.status as string) || 'pending',
          total: (order.total as number) || 0,
          subtotal: (order.subtotal as number) || undefined,
          shipping: (order.shipping as number) || undefined,
          payment_method: (order.payment_method as string) || undefined,
          payment_status: (order.payment_status as string) || undefined,
          items: itemsData as OrderItem[],
          prescription_id: order.prescription_id as string,
          tracking_code: order.tracking_code as string,
          tracking_carrier: order.tracking_carrier as string | null,
          tracking_status: order.tracking_status as string | null,
          tracking_status_label: order.tracking_status_label as string | null,
          tracking_last_event_at: order.tracking_last_event_at as string | null,
          tracking_last_checked_at: order.tracking_last_checked_at as string | null,
          tracking_estimated_delivery: order.tracking_estimated_delivery as string | null,
          tracking_events: (order.tracking_events as TrackingEvent[] | null) || [],
          receita_id: order.receita_id as string | undefined,
          receita_url_pdf: order.receita_url_pdf as string | undefined,
          consulta_id: order.consulta_id as string | undefined,
          receita_review_status: order.receita_review_status as 'approved' | 'rejected' | null | undefined,
          receita_review_notes: order.receita_review_notes as string | null | undefined,
          receita_reviewed_at: order.receita_reviewed_at as string | null | undefined,
        };
      });

      setOrders(formattedOrders);
      setLoading(false);
    } catch (error) {
      logger.error('Error fetching orders:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao buscar pedidos',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_email && order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const trackingValidation = trackingCode
    ? validateCorreiosTrackingCode(trackingCode)
    : { valid: true, code: '', message: '' };

  const getStatusBadge = (status: string, reviewStatus?: string | null) => {
    // Pedido pendente com receita e ainda não revisado → badge especial
    if (status === 'pending' && reviewStatus === undefined) {
      // sem receita, badge normal
    }
    const statusConfig = {
      pending: { text: 'Pedido Pago', color: 'bg-slate-100 text-slate-800', icon: <Clock className="h-4 w-4" /> },
      processing: { text: 'Pedido em Separação', color: 'bg-yellow-100 text-yellow-800', icon: <Package className="h-4 w-4" /> },
      shipped: { text: 'Pedido Enviado', color: 'bg-purple-100 text-purple-800', icon: <Truck className="h-4 w-4" /> },
      delivered: { text: 'Pedido Entregue', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-4 w-4" /> },
      cancelled: { text: 'Pedido Cancelado', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> }
    };

    const config = statusConfig[status as keyof typeof statusConfig] ||
      statusConfig.pending;

    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${config.color}`}>
        {config.icon}
        {config.text}
      </div>
    );
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // Valida se houve mudança real de status — evita spam de notificação
      if (order.status === newStatus) return;

      // Ao marcar como "Enviado": pergunta o código de rastreio antes de
      // persistir e disparar o email. O dialog cuida do resto do fluxo.
      if (newStatus === 'shipped') {
        setShippingOrder(order);
        setShippingTrackingCode(order.tracking_code || '');
        setShippingEstimatedDelivery('');
        return;
      }

      // Atualiza no banco de dados
      const { error: updateError } = await AdminQueries.updateOrderStatus(orderId, newStatus);
      if (updateError) {
        throw new Error('Falha ao atualizar status no banco de dados');
      }

      // Atualiza status localmente
      setOrders(orders.map(o =>
        o.id === orderId ? { ...o, status: newStatus } : o
      ));

      // Envia notificação por e-mail
      const notificationResult = await sendOrderStatusNotification({
        orderId,
        customerEmail: order.customer_email || 'email@exemplo.com',
        customerName: order.customer,
        status: newStatus as OrderStatus,
        trackingCode: order.tracking_code,
      });

      // Se o pedido está sendo processado, cria ordem de serviço para logística
      if (newStatus === 'processing') {
        await sendLogisticsServiceOrder(
          orderId,
          {
            name: order.customer,
            email: order.customer_email || '',
            phone: order.customer_phone || '',
            address: order.delivery_address || 'Endereço não informado',
          },
          order.items.map(item => ({ name: item.name, quantity: item.quantity }))
        );
      }

      toast({
        title: 'Status atualizado',
        description: notificationResult.success
          ? `Status alterado e notificação enviada para ${order.customer_email}`
          : 'Status alterado (notificação não enviada)',
      });
    } catch (error) {
      logger.error('Error updating order status:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar status do pedido',
        variant: 'destructive'
      });
    }
  };

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsDialog(true);

    // Busca histórico de notificações
    const history = await getOrderNotificationHistory(order.id);
    setNotificationHistory(history);
  };

  const handleSendNotification = async () => {
    if (!selectedOrder) return;

    const pendingTrackingValidation = trackingCode.trim()
      ? validateCorreiosTrackingCode(trackingCode)
      : null;

    if (pendingTrackingValidation && !pendingTrackingValidation.valid) {
      toast({
        title: 'Código de rastreio inválido',
        description: pendingTrackingValidation.message,
        variant: 'destructive',
      });
      return;
    }

    setSendingNotification(true);

    try {
      let trackingCodeToSend = selectedOrder.tracking_code;
      let estimatedDeliveryToSend = estimatedDelivery;
      let statusToSend = selectedOrder.status as OrderStatus;

      if (pendingTrackingValidation?.valid) {
        const trackingResult = await saveOrderTracking(selectedOrder.id, pendingTrackingValidation.code);
        trackingCodeToSend = trackingResult.tracking.trackingCode;
        estimatedDeliveryToSend =
          estimatedDelivery ||
          trackingResult.tracking.trackingEstimatedDelivery ||
          '';

        const orderPatch: Partial<Order> = {
          tracking_code: trackingResult.order.tracking_code || trackingCodeToSend,
          tracking_carrier: trackingResult.order.tracking_carrier,
          tracking_status: trackingResult.order.tracking_status,
          tracking_status_label: trackingResult.order.tracking_status_label,
          tracking_last_event_at: trackingResult.order.tracking_last_event_at,
          tracking_last_checked_at: trackingResult.order.tracking_last_checked_at,
          tracking_estimated_delivery: trackingResult.order.tracking_estimated_delivery,
          tracking_events: trackingResult.order.tracking_events,
          status: trackingResult.order.status || selectedOrder.status,
        };
        statusToSend = (trackingResult.order.status || selectedOrder.status) as OrderStatus;

        setOrders(orders.map(o =>
          o.id === selectedOrder.id ? { ...o, ...orderPatch } : o
        ));
        setSelectedOrder({ ...selectedOrder, ...orderPatch });

        if (!trackingResult.configured) {
          toast({
            title: 'Rastreio salvo',
            description: 'Código validado. A consulta automática aguardará as credenciais da API Rastro dos Correios.',
          });
        }
      }

      const result = await sendOrderStatusNotification({
        orderId: selectedOrder.id,
        customerEmail: selectedOrder.customer_email || 'email@exemplo.com',
        customerName: selectedOrder.customer,
        status: statusToSend,
        trackingCode: trackingCodeToSend || undefined,
        estimatedDelivery: estimatedDeliveryToSend || undefined,
      });

      if (result.success) {
        toast({
          title: 'Notificação enviada',
          description: `E-mail enviado para ${selectedOrder.customer_email}`,
        });

        // Atualiza histórico
        const history = await getOrderNotificationHistory(selectedOrder.id);
        setNotificationHistory(history);
      } else {
        toast({
          title: 'Erro',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Error sending notification:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao enviar notificação',
        variant: 'destructive',
      });
    } finally {
      setSendingNotification(false);
      setShowNotificationDialog(false);
      setTrackingCode('');
      setEstimatedDelivery('');
    }
  };

  const shippingTrackingValidation = shippingTrackingCode.trim()
    ? validateCorreiosTrackingCode(shippingTrackingCode)
    : { valid: true, code: '', message: '' };

  const handleConfirmShipping = async () => {
    if (!shippingOrder) return;

    const code = shippingTrackingCode.trim();
    if (code && !shippingTrackingValidation.valid) {
      toast({
        title: 'Código de rastreio inválido',
        description: shippingTrackingValidation.message,
        variant: 'destructive',
      });
      return;
    }

    setConfirmingShipping(true);
    const orderId = shippingOrder.id;

    try {
      const trackingCodeToUse = code ? shippingTrackingValidation.code : (shippingOrder.tracking_code || undefined);
      const estimatedDeliveryToUse = shippingEstimatedDelivery || undefined;
      const orderPatch: Partial<Order> = { status: 'shipped' };

      // Persiste status + tracking_code direto na tabela `orders` via service role.
      // Não dependemos do endpoint do cielo-server que consulta a API dos Correios
      // — essa consulta enriquece os dados depois, mas não é pré-requisito.
      if (code) {
        const { error: trackingError } = await AdminQueries.updateOrderTracking(orderId, shippingTrackingValidation.code);
        if (trackingError) throw new Error('Falha ao salvar código de rastreio');
        orderPatch.tracking_code = shippingTrackingValidation.code;
      }

      const { error: updateError } = await AdminQueries.updateOrderStatus(orderId, 'shipped');
      if (updateError) throw new Error('Falha ao atualizar status no banco de dados');

      // Tenta enriquecer com a consulta aos Correios em background (não bloqueia).
      // Falha silenciosa: o que importa para o cliente é o status + código.
      if (code) {
        saveOrderTracking(orderId, shippingTrackingValidation.code)
          .then((trackingResult) => {
            setOrders((prev) => prev.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    tracking_carrier: trackingResult.order.tracking_carrier,
                    tracking_status: trackingResult.order.tracking_status,
                    tracking_status_label: trackingResult.order.tracking_status_label,
                    tracking_last_event_at: trackingResult.order.tracking_last_event_at,
                    tracking_last_checked_at: trackingResult.order.tracking_last_checked_at,
                    tracking_estimated_delivery: trackingResult.order.tracking_estimated_delivery,
                    tracking_events: trackingResult.order.tracking_events,
                  }
                : o
            ));
          })
          .catch((err) => logger.warn('[AdminOrders] Consulta Correios falhou (ignorado):', err));
      }

      setOrders(orders.map(o => (o.id === orderId ? { ...o, ...orderPatch } : o)));

      const notificationResult = await sendOrderStatusNotification({
        orderId,
        customerEmail: shippingOrder.customer_email || 'email@exemplo.com',
        customerName: shippingOrder.customer,
        status: 'shipped',
        trackingCode: trackingCodeToUse,
        estimatedDelivery: estimatedDeliveryToUse,
      });

      toast({
        title: 'Pedido marcado como enviado',
        description: notificationResult.success
          ? `Notificação enviada para ${shippingOrder.customer_email}${code ? ' com código de rastreio' : ''}`
          : 'Status atualizado (notificação não enviada)',
      });

      setShippingOrder(null);
      setShippingTrackingCode('');
      setShippingEstimatedDelivery('');
    } catch (err) {
      logger.error('Error confirming shipping:', err);
      toast({
        title: 'Erro',
        description: 'Falha ao confirmar envio do pedido',
        variant: 'destructive',
      });
    } finally {
      setConfirmingShipping(false);
    }
  };

  const loadPdfViaProxy = async (pdfUrl: string) => {
    setLoadingPdf(true);
    setPdfBlobUrl(null);
    try {
      const LOCAL_SERVER = import.meta.env.VITE_LOCAL_SERVER_URL || 'http://localhost:5174';
      const res = await fetch(
        `${LOCAL_SERVER}/api/proxy/pdf?url=${encodeURIComponent(pdfUrl)}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      setPdfBlobUrl(URL.createObjectURL(blob));
    } catch (err) {
      logger.error('[AdminOrders] Erro ao carregar PDF via proxy:', err);
      // Fallback: tenta direto (pode falhar por CORS)
      setPdfBlobUrl(pdfUrl);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleReview = async (decision: 'approved' | 'rejected') => {
    if (!reviewOrder) return;
    setSubmittingReview(true);
    try {
      const { error } = await AdminQueries.reviewOrder(reviewOrder.id, decision, reviewNotes);
      if (error) throw error;

      const newStatus = decision === 'approved' ? 'processing' : 'cancelled';

      // Estorno automático ao rejeitar
      if (decision === 'rejected' && reviewOrder.payment_id) {
        try {
          await cieloClient.cancelSale(reviewOrder.payment_id);
          logger.info('[AdminOrders] Estorno realizado para payment_id:', reviewOrder.payment_id);
          await AdminQueries.updateOrderPaymentStatus(reviewOrder.id, 'refunded');
        } catch (refundErr) {
          logger.error('[AdminOrders] Falha no estorno:', refundErr);
          // Não bloqueia o fluxo — pedido segue cancelado, estorno manual necessário
          toast({ title: 'Aviso', description: 'Pedido cancelado, mas o estorno automático falhou. Verifique manualmente.', variant: 'destructive' });
        }
      }

      setOrders(orders.map(o =>
        o.id === reviewOrder.id
          ? { ...o, status: newStatus, receita_review_status: decision, receita_review_notes: reviewNotes, receita_reviewed_at: new Date().toISOString() }
          : o
      ));

      await sendOrderStatusNotification({
        orderId: reviewOrder.id,
        customerEmail: reviewOrder.customer_email || '',
        customerName: reviewOrder.customer,
        status: newStatus as OrderStatus,
      });

      toast({
        title: decision === 'approved' ? 'Pedido aprovado' : 'Pedido rejeitado',
        description: decision === 'approved'
          ? 'Medicamentos confirmados. Pedido movido para Processando.'
          : 'Pedido cancelado e estorno iniciado.',
      });
      setReviewOrder(null);
      setReviewNotes('');
    } catch (err) {
      logger.error('Error reviewing order:', err);
      toast({ title: 'Erro', description: 'Não foi possível salvar a revisão.', variant: 'destructive' });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerenciamento de Pedidos</h1>
        <p className="text-gray-600">Gerencie todos os pedidos de medicamentos e notifique clientes</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedidos por ID ou usuário..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pedido Pago</SelectItem>
            <SelectItem value="processing">Pedido em Separação</SelectItem>
            <SelectItem value="shipped">Pedido Enviado</SelectItem>
            <SelectItem value="delivered">Pedido Entregue</SelectItem>
            <SelectItem value="cancelled">Pedido Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID do Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Receita</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    Carregando pedidos...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">#{order.id}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.customer}</div>
                      {order.customer_email && (
                        <div className="text-sm text-muted-foreground">{order.customer_email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.receita_url_pdf ? (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setPdfPreviewUrl(order.receita_url_pdf!)}
                          className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                          title="Visualizar receita"
                        >
                          <FileText className="h-4 w-4" />
                          Consulta #{order.receita_id ?? order.consulta_id ?? order.prescription_id ?? 'N/A'}
                        </button>
                        {order.receita_review_status === 'approved' && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCheck className="h-3 w-3" />Aprovada
                          </span>
                        )}
                        {order.receita_review_status === 'rejected' && (
                          <span className="flex items-center gap-1 text-[11px] text-red-600 font-medium">
                            <XCircle className="h-3 w-3" />Rejeitada
                          </span>
                        )}
                        {!order.receita_review_status && (
                          <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                            <ShieldAlert className="h-3 w-3" />Aguarda revisão
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {order.receita_id ?? order.consulta_id ?? order.prescription_id ?? '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'itens'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(order.date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(order.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="w-[120px] text-sm">
                          <SelectValue placeholder="Alterar status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pedido Pago</SelectItem>
                          <SelectItem value="processing">Pedido em Separação</SelectItem>
                          <SelectItem value="shipped">Pedido Enviado</SelectItem>
                          <SelectItem value="delivered">Pedido Entregue</SelectItem>
                          <SelectItem value="cancelled">Pedido Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                      {order.receita_url_pdf && !order.receita_review_status && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => {
                            setReviewOrder(order);
                            setReviewNotes('');
                            if (order.receita_url_pdf) loadPdfViaProxy(order.receita_url_pdf);
                          }}
                          title="Revisar receita"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Revisar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/admin/pedidos/${order.id}/os`, '_blank')}
                        title="Ver Ordem de Serviço"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(order)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Separação</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {orders.filter(o => o.status === 'processing').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviados</CardTitle>
            <Truck className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {orders.filter(o => o.status === 'shipped').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {orders.filter(o => o.status === 'delivered').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido #{selectedOrder?.id}</DialogTitle>
            <DialogDescription>
              Informações completas e histórico de notificações
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{selectedOrder.customer}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">E-mail</Label>
                  <p className="font-medium">{selectedOrder.customer_email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data do Pedido</Label>
                  <p className="font-medium">
                    {new Date(selectedOrder.date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {selectedOrder.tracking_code && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Código de Rastreio</Label>
                    <p className="font-mono font-medium">{selectedOrder.tracking_code}</p>
                    {selectedOrder.tracking_status_label && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Correios: {selectedOrder.tracking_status_label}
                      </p>
                    )}
                    {selectedOrder.tracking_last_checked_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Consultado em {new Date(selectedOrder.tracking_last_checked_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}
                {(selectedOrder.receita_id || selectedOrder.consulta_id) && (
                  <div className="col-span-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-1.5">
                          <FileText className="h-4 w-4" />
                          Receita Vinculada
                        </Label>
                        <p className="font-medium mt-0.5">
                          Consulta #{selectedOrder.receita_id ?? selectedOrder.consulta_id}
                        </p>
                      </div>
                      {selectedOrder.receita_url_pdf && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setPdfPreviewUrl(selectedOrder.receita_url_pdf!)}
                          >
                            <FileText className="h-4 w-4" />
                            Ver Receita
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(selectedOrder.receita_url_pdf!, '_blank')}
                            title="Abrir em nova aba"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Order Items */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4" />
                    Itens do Pedido ({selectedOrder.items.length})
                  </Label>
                  <div className="border rounded-lg divide-y">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                        </div>
                        <span className="font-medium text-sm">R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="p-3 flex items-center justify-between bg-muted/50">
                      <span className="font-semibold text-sm">Total</span>
                      <span className="font-bold text-primary">R$ {selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Ordem de Serviço Logística */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  <div>
                    <p className="text-sm font-medium">Ordem de Serviço</p>
                    <p className="text-xs text-muted-foreground">
                      Documento para separação e entrega — pronto para impressão ou PDF
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => window.open(`/admin/pedidos/${selectedOrder.id}/os`, '_blank')}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Ver OS
                </Button>
              </div>

              {/* Notification History */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico de Notificações
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTrackingCode(selectedOrder.tracking_code || '');
                      setShowNotificationDialog(true);
                    }}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Enviar Notificação
                  </Button>
                </div>

                {notificationHistory.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {notificationHistory.map((notification) => (
                      <div key={notification.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{notification.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(notification.sentAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <Badge variant="outline">{formatOrderStatus(notification.status)}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma notificação enviada ainda</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Revisão Farmacêutica ──────────────────────────────────────────── */}
      <Dialog open={!!reviewOrder} onOpenChange={(open) => {
        if (!open) {
          setReviewOrder(null);
          setReviewNotes('');
          if (pdfBlobUrl && pdfBlobUrl.startsWith('blob:')) URL.revokeObjectURL(pdfBlobUrl);
          setPdfBlobUrl(null);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-amber-500" />
              Revisão Farmacêutica — Pedido #{reviewOrder?.id}
            </DialogTitle>
            <DialogDescription>
              Verifique a receita e confirme se os medicamentos solicitados correspondem à prescrição
            </DialogDescription>
          </DialogHeader>

          {reviewOrder && (
            <div className="flex flex-1 overflow-hidden min-h-0">

              {/* Coluna esquerda: PDF */}
              <div className="flex-1 flex flex-col border-r min-w-0">
                <div className="px-4 py-2 bg-muted/50 border-b flex items-center justify-between shrink-0">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    Receita — Consulta #{reviewOrder.receita_id ?? reviewOrder.consulta_id ?? 'N/A'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => window.open(reviewOrder.receita_url_pdf!, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Nova aba
                  </Button>
                </div>
                <div className="flex-1 p-3">
                  {loadingPdf ? (
                    <div className="w-full h-full min-h-[500px] rounded-lg border bg-muted/30 flex flex-col items-center justify-center gap-3">
                      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">Carregando receita...</p>
                    </div>
                  ) : pdfBlobUrl ? (
                    <iframe
                      src={pdfBlobUrl}
                      className="w-full h-full rounded-lg border min-h-[500px]"
                      title="Receita PDF"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[500px] rounded-lg border bg-muted/30 flex flex-col items-center justify-center gap-3">
                      <FileText className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">PDF não disponível para preview</p>
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => window.open(reviewOrder.receita_url_pdf!, '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                        Abrir em nova aba
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna direita: dados do pedido + ação */}
              <div className="w-[360px] shrink-0 flex flex-col overflow-y-auto">
                <div className="p-4 space-y-4">

                  {/* Paciente */}
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">Paciente</p>
                    <p className="font-medium">{reviewOrder.customer}</p>
                    <p className="text-sm text-muted-foreground">{reviewOrder.customer_email}</p>
                    {reviewOrder.customer_phone && (
                      <p className="text-sm text-muted-foreground">{reviewOrder.customer_phone}</p>
                    )}
                  </div>

                  <Separator />

                  {/* Medicamentos solicitados */}
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                      Medicamentos Solicitados ({reviewOrder.items.length})
                    </p>
                    <div className="space-y-2">
                      {reviewOrder.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                          </div>
                          <span className="text-sm font-semibold shrink-0 ml-2">
                            R$ {(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">R$ {(reviewOrder.subtotal ?? reviewOrder.total).toFixed(2)}</span>
                    </div>
                    {reviewOrder.shipping != null && reviewOrder.shipping > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frete</span>
                        <span className="font-medium">R$ {reviewOrder.shipping.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold pt-1">
                      <span>Total</span>
                      <span className="text-primary">R$ {reviewOrder.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* JSON bruto colapsável */}
                  <div>
                    <details className="group">
                      <summary className="text-xs font-semibold uppercase text-muted-foreground tracking-wide cursor-pointer select-none">
                        JSON do Pedido
                      </summary>
                      <pre className="mt-2 p-3 rounded-lg bg-slate-950 text-slate-200 text-[11px] overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
                        {JSON.stringify({
                          id: reviewOrder.id,
                          status: reviewOrder.status,
                          date: reviewOrder.date,
                          customer: reviewOrder.customer,
                          customer_email: reviewOrder.customer_email,
                          delivery_address: reviewOrder.delivery_address,
                          payment_method: reviewOrder.payment_method,
                          payment_status: reviewOrder.payment_status,
                          total: reviewOrder.total,
                          receita_id: reviewOrder.receita_id,
                          consulta_id: reviewOrder.consulta_id,
                          receita_url_pdf: reviewOrder.receita_url_pdf,
                          items: reviewOrder.items,
                        }, null, 2)}
                      </pre>
                    </details>
                  </div>

                  <Separator />

                  {/* Observações + decisão */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Decisão do Farmacêutico</p>
                    <div>
                      <Label htmlFor="review-notes" className="text-sm mb-1.5 block">
                        Observações (opcional)
                      </Label>
                      <Textarea
                        id="review-notes"
                        placeholder="Ex: Receita válida. Dosagem confirmada conforme prescrição."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={3}
                        className="text-sm resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                        disabled={submittingReview}
                        onClick={() => handleReview('approved')}
                      >
                        {submittingReview ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCheck className="h-4 w-4" />
                        )}
                        Aprovar
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 gap-2"
                        disabled={submittingReview}
                        onClick={() => handleReview('rejected')}
                      >
                        {submittingReview ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Rejeitar
                      </Button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF Receita Preview Dialog */}
      <Dialog open={!!pdfPreviewUrl} onOpenChange={(open) => { if (!open) setPdfPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Receita Médica
            </DialogTitle>
            <DialogDescription>
              Valide se os medicamentos do pedido correspondem à receita
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-4">
            {pdfPreviewUrl && (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-[65vh] rounded-lg border"
                title="Receita PDF"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 px-6 pb-5">
            <Button variant="outline" onClick={() => setPdfPreviewUrl(null)}>Fechar</Button>
            {pdfPreviewUrl && (
              <Button variant="outline" className="gap-2" onClick={() => window.open(pdfPreviewUrl, '_blank')}>
                <ExternalLink className="h-4 w-4" />
                Abrir em nova aba
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Shipping Tracking Dialog — pergunta o código ao marcar como "Enviado" */}
      <Dialog
        open={!!shippingOrder}
        onOpenChange={(open) => {
          if (!open && !confirmingShipping) {
            setShippingOrder(null);
            setShippingTrackingCode('');
            setShippingEstimatedDelivery('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              Marcar pedido como Enviado
            </DialogTitle>
            <DialogDescription>
              Informe o código de rastreio dos Correios. Ele será incluído no e-mail de notificação ao cliente e aparecerá em "Meus Pedidos".
            </DialogDescription>
          </DialogHeader>

          {shippingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Pedido</Label>
                  <p className="font-mono">#{shippingOrder.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{shippingOrder.customer}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="shipping-tracking">Código de Rastreio Correios</Label>
                <Input
                  id="shipping-tracking"
                  value={shippingTrackingCode}
                  onChange={(e) => setShippingTrackingCode(normalizeCorreiosTrackingCode(e.target.value))}
                  placeholder="DG049186226BR"
                  className="font-mono uppercase"
                  autoFocus
                />
                {shippingTrackingCode && (
                  <p className={`text-xs mt-1 ${shippingTrackingValidation.valid ? 'text-muted-foreground' : 'text-destructive'}`}>
                    {shippingTrackingValidation.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="shipping-delivery">Previsão de Entrega (opcional)</Label>
                <Input
                  id="shipping-delivery"
                  value={shippingEstimatedDelivery}
                  onChange={(e) => setShippingEstimatedDelivery(e.target.value)}
                  placeholder="Ex: 3-5 dias úteis"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShippingOrder(null);
                setShippingTrackingCode('');
                setShippingEstimatedDelivery('');
              }}
              disabled={confirmingShipping}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmShipping}
              disabled={confirmingShipping || (!!shippingTrackingCode && !shippingTrackingValidation.valid)}
            >
              {confirmingShipping ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Confirmando...
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4 mr-2" />
                  Confirmar envio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Notification Dialog */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Notificação</DialogTitle>
            <DialogDescription>
              Envie uma notificação por e-mail para o cliente sobre este pedido
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cliente</Label>
                  <p className="font-medium">{selectedOrder.customer}</p>
                </div>
                <div>
                  <Label>E-mail</Label>
                  <p className="font-medium">{selectedOrder.customer_email}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="tracking">Código de Rastreamento Correios (opcional)</Label>
                <Input
                  id="tracking"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(normalizeCorreiosTrackingCode(e.target.value))}
                  placeholder={selectedOrder.tracking_code || 'DG049186226BR'}
                  className="font-mono uppercase"
                />
                {trackingCode && (
                  <p className={`text-xs mt-1 ${trackingValidation.valid ? 'text-muted-foreground' : 'text-destructive'}`}>
                    {trackingValidation.message}
                  </p>
                )}
                {selectedOrder.tracking_status_label && !trackingCode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Status atual nos Correios: {selectedOrder.tracking_status_label}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="delivery">Previsão de Entrega (opcional)</Label>
                <Input
                  id="delivery"
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  placeholder="Ex: 3-5 dias úteis"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendNotification} disabled={sendingNotification || !trackingValidation.valid}>
              {sendingNotification ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Notificação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
