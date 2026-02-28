import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Calendar, MapPin, CreditCard, ChevronRight, Truck, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { User, Session } from "@supabase/supabase-js";

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  items: { name: string; quantity: number; price: number }[];
  delivery_address: string;
  tracking_code: string | null;
  payment_id: string | null;
  payment_method: string | null;
  installments: number | null;
  shipping_cost: number;
  subtotal: number;
  created_at: string;
  user_id: string;
}

const Orders = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        } else {
          fetchOrders(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        fetchOrders(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const normalizeStatus = (status: string | null | undefined) => {
    if (!status) return "pending";
    if (status === "in_transit") return "shipped";
    if (status === "confirmed") return "processing";
    return status;
  };

  const fetchOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (error) {
        logger.error("Error fetching orders:", error);
        return;
      }

      if (data) {
        const parsedOrders = data.map(order => ({
          ...order,
          status: normalizeStatus(order.status),
          items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items || [],
        }));
        setOrders(parsedOrders);
      }
    } catch (error) {
      logger.error("Error fetching orders:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-slate-500";
      case "delivered":
        return "bg-green-500";
      case "shipped":
        return "bg-blue-500";
      case "processing":
        return "bg-yellow-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "delivered":
        return "Entregue";
      case "shipped":
        return "Em Trânsito";
      case "processing":
        return "Processando";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="h-5 w-5" />;
      case "shipped":
        return <Truck className="h-5 w-5" />;
      case "processing":
        return <Clock className="h-5 w-5" />;
      case "pending":
        return <Clock className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const filteredOrders = selectedTab === "all" 
    ? orders 
    : orders.filter(order => order.status === selectedTab);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} title="Meus Pedidos" />
      
      <main className="container mx-auto px-4 py-8">
        <BackLink />
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Meus Pedidos
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o status de todos os seus pedidos
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes/Processando
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {orders.filter(o => o.status === "processing" || o.status === "pending").length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Trânsito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {orders.filter(o => o.status === "shipped").length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entregues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {orders.filter(o => o.status === "delivered").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="processing">Processando</TabsTrigger>
            <TabsTrigger value="shipped">Em Trânsito</TabsTrigger>
            <TabsTrigger value="delivered">Entregues</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhum pedido encontrado
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl flex items-center gap-2">
                        {getStatusIcon(order.status)}
                        {order.id}
                      </CardTitle>
                      <CardDescription>
                        <div className="flex items-center gap-2 mt-2">
                          <Calendar className="h-4 w-4" />
                          <span>Pedido realizado em {new Date(order.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusText(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    {/* Items */}
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Itens do Pedido ({order.items.length}):
                      </p>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-medium">
                              R$ {item.price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="pt-3 border-t">
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="font-medium mb-1">Endereço de Entrega:</p>
                          <p className="text-muted-foreground">{order.delivery_address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Code */}
                    {order.tracking_code && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Código de Rastreamento:</p>
                            <p className="text-primary font-mono">{order.tracking_code}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="pt-3 border-t flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Total:</span>
                      </div>
                      <span className="text-xl font-bold text-primary">
                        R$ {order.total.toFixed(2)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 flex gap-2">
                      {order.tracking_code && (
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(`https://www.google.com/search?q=rastreamento+${order.tracking_code}`, '_blank')}>
                          <Truck className="mr-2 h-4 w-4" />
                          Rastrear Pedido
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="flex-1 text-primary" onClick={() => navigate(`/order/${order.id}`)}>
                        Ver Detalhes
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Orders;
