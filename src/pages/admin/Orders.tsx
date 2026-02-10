import { useEffect, useState } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import {
  sendOrderStatusNotification,
  sendLogisticsServiceOrder,
  getOrderNotificationHistory,
  type OrderStatus
} from '@/services/notificationService';
import { logger } from "@/lib/logger";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  History
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

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
  items: OrderItem[];
  prescription_id?: string;
  tracking_code?: string;
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
          items: itemsData as OrderItem[],
          prescription_id: order.prescription_id as string,
          tracking_code: order.tracking_code as string,
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { text: 'Pendente', color: 'bg-slate-100 text-slate-800', icon: <Clock className="h-4 w-4" /> },
      processing: { text: 'Processando', color: 'bg-yellow-100 text-yellow-800', icon: <Package className="h-4 w-4" /> },
      shipped: { text: 'Em Trânsito', color: 'bg-purple-100 text-purple-800', icon: <Truck className="h-4 w-4" /> },
      delivered: { text: 'Entregue', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-4 w-4" /> },
      cancelled: { text: 'Cancelado', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> }
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

    setSendingNotification(true);

    try {
      const result = await sendOrderStatusNotification({
        orderId: selectedOrder.id,
        customerEmail: selectedOrder.customer_email || 'email@exemplo.com',
        customerName: selectedOrder.customer,
        status: selectedOrder.status as OrderStatus,
        trackingCode: trackingCode || selectedOrder.tracking_code,
        estimatedDelivery: estimatedDelivery,
      });

      if (result.success) {
        toast({
          title: 'Notificação enviada',
          description: `E-mail enviado para ${selectedOrder.customer_email}`,
        });

        // Atualiza histórico
        const history = await getOrderNotificationHistory(selectedOrder.id);
        setNotificationHistory(history);

        // Atualiza tracking code no pedido se informado
        if (trackingCode) {
          const { error: trackingError } = await AdminQueries.updateOrderTracking(
            selectedOrder.id,
            trackingCode
          );

          if (!trackingError) {
            setOrders(orders.map(o =>
              o.id === selectedOrder.id ? { ...o, tracking_code: trackingCode } : o
            ));
          } else {
            toast({
              title: 'Erro',
              description: 'Não foi possível salvar o código de rastreio no banco.',
              variant: 'destructive',
            });
          }
        }
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
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
            <SelectItem value="shipped">Em Trânsito</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
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
                  <TableCell>{order.prescription_id || 'N/A'}</TableCell>
                  <TableCell>{order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'itens'}</TableCell>
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
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="processing">Processando</SelectItem>
                        <SelectItem value="shipped">Em Trânsito</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
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
            <CardTitle className="text-sm font-medium">Processando</CardTitle>
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
            <CardTitle className="text-sm font-medium">Em Trânsito</CardTitle>
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
                  </div>
                )}
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
                    onClick={() => setShowNotificationDialog(true)}
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
                        <Badge variant="outline">{notification.status}</Badge>
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
                <Label htmlFor="tracking">Código de Rastreamento (opcional)</Label>
                <Input
                  id="tracking"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder={selectedOrder.tracking_code || 'Código de rastreamento'}
                />
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
            <Button onClick={handleSendNotification} disabled={sendingNotification}>
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
