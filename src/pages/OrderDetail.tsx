import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import OrderTracking from "@/components/OrderTracking";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Package,
  Calendar,
  MapPin,
  CreditCard,
  CheckCircle,
  Printer,
  Share2,
  XCircle,
  FileText,
  Stethoscope,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import type { OrderStatus } from "@/hooks/useOrderSubscription";
import { formatPaymentMethod } from "@/lib/labels";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  items: OrderItem[];
  delivery_address: string;
  payment_id: string | null;
  payment_method: string | null;
  payment_status?: string | null;
  installments: number | null;
  shipping_cost: number;
  subtotal: number;
  receita_id: string | null;
  receita_url_pdf: string | null;
  consulta_id: string | null;
}

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user?.id && id) {
      fetchOrder(id, session.user.id);
    }
  }, [session, id]);

  const normalizeStatus = (status: string | null | undefined) => {
    if (!status) return "pending";
    if (status === "in_transit") return "shipped";
    if (status === "confirmed") return "processing";
    return status;
  };

  const fetchOrder = async (orderId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("user_id", userId)
        .single();

      if (error) {
        logger.error("Error fetching order:", error);
        toast.error("Erro ao carregar pedido");
        return;
      }

      if (data) {
        // Parse items if it's a string or null
        const itemsData = data.items 
          ? (typeof data.items === "string" ? JSON.parse(data.items) : data.items)
          : [];
        const parsedData = {
          ...data,
          status: normalizeStatus(data.status),
          items: itemsData as OrderItem[],
        };
        setOrder(parsedData);
      }
    } catch (error) {
      logger.error("Error fetching order:", error);
      toast.error("Erro ao carregar pedido");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = useCallback((newStatus: string) => {
    setOrder((prev) => prev ? { ...prev, status: newStatus } : null);
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pedido ${order?.id}`,
          text: `Confira os detalhes do meu pedido na Novitá!`,
          url: window.location.href,
        });
      } catch (error) {
        logger.error("Error sharing:", error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado para a área de transferência!");
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;

    setCancelling(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id)
        .eq("user_id", session?.user?.id);

      if (error) {
        logger.error("Error cancelling order:", error);
        toast.error("Erro ao cancelar pedido. Tente novamente.");
        return;
      }

      setOrder({ ...order, status: "cancelled" });
      toast.success("Pedido cancelado com sucesso!");
      setShowCancelDialog(false);
    } catch (error) {
      logger.error("Error cancelling order:", error);
      toast.error("Erro ao cancelar pedido. Tente novamente.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated onLogout={handleLogout} />
        <main className="page-container">
          <BackLink to="/orders" label="Pedidos" />
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold mb-2">Pedido não encontrado</h2>
              <p className="text-muted-foreground mb-6">
                O pedido solicitado não foi encontrado ou você não tem permissão para visualizá-lo.
              </p>
              <Button onClick={() => navigate("/orders")}>
                Voltar aos Pedidos
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />

      <main className="page-container">
        <BackLink />
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-primary">
              Pedido #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-muted-foreground">
              Realizado em {new Date(order.date).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <OrderTracking
              orderId={order.id}
              status={order.status as OrderStatus}
              onStatusChange={handleStatusChange}
            />

            {/* Items Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens do Pedido
                </CardTitle>
                <CardDescription>
                  {order.items.length} item(s) no pedido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Quantidade: {item.quantity}
                          </p>
                        </div>
                      </div>
                      <p className="font-medium">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Address Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground">{order.delivery_address}</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir etiqueta
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  <span>
                    {order.shipping_cost === 0 ? (
                      <span className="text-green-600">Grátis</span>
                    ) : (
                      `R$ ${order.shipping_cost.toFixed(2)}`
                    )}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-xl text-primary">
                    R$ {order.total.toFixed(2)}
                  </span>
                </div>

                {order.installments && order.installments > 1 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Parcelado em {order.installments}x de R$ {(order.total / order.installments).toFixed(2)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Receita / Consulta Card */}
            {(order.receita_id || order.consulta_id) && (
              <Card className="border-primary/20 bg-primary/[0.02]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Stethoscope className="h-5 w-5 text-primary" />
                    Origem do Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Consulta #{order.receita_id ?? order.consulta_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Receita vinculada ao pedido
                      </p>
                    </div>
                  </div>
                  {order.receita_url_pdf && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => window.open(order.receita_url_pdf!, "_blank")}
                      >
                        <FileText className="h-4 w-4" />
                        Ver Receita
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(order.receita_url_pdf!, "_blank")}
                        title="Abrir em nova aba"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Vinculado à receita
                  </Badge>
                </CardContent>
              </Card>
            )}

            {/* Payment Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Informações de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Método de pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPaymentMethod(order.payment_method)}
                  </p>
                </div>
                {order.payment_id && (
                  <div>
                    <p className="text-sm font-medium">ID da Transação</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {order.payment_id}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Status do pagamento</p>
                  {order.payment_status === "pending" || order.status === "pending" ? (
                    <Badge className="bg-yellow-500 mt-1">Pendente</Badge>
                  ) : (
                    <Badge className="bg-green-500 mt-1">Aprovado</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card>
              <CardHeader>
                <CardTitle>Precisa de Ajuda?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/telemedicina">
                    <Package className="h-4 w-4 mr-2" />
                    Falar com Suporte
                  </a>
                </Button>
                {(order.status === "processing" || order.status === "pending") && (
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={cancelling}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {cancelling ? "Cancelando..." : "Cancelar Pedido"}
                  </Button>
                )}
                {order.status !== "processing" && order.status !== "pending" && (
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="/cancelamento">
                      <Package className="h-4 w-4 mr-2" />
                      Política de Cancelamento
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Cancelar Pedido
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
              <br /><br />
              <strong>Informações importantes:</strong>
              <ul className="list-disc pl-4 mt-2 space-y-1">
                <li>O pedido será cancelado e não será mais processado</li>
                <li>O reembolso será processado em até 5 dias úteis</li>
                <li>Você receberá a confirmação por e-mail</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter pedido</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-red-500 hover:bg-red-600"
            >
              Sim, cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrderDetail;
