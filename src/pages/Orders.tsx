import { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Calendar, MapPin, CreditCard, ChevronRight, Truck, CheckCircle, Clock } from "lucide-react";

// Mock orders data
const mockOrders = [
  {
    id: "PED-2024-001",
    date: "2024-12-20",
    status: "delivered",
    total: 75.40,
    items: [
      { name: "Losartana 50mg", quantity: 1, price: 25.90 },
      { name: "Sinvastatina 20mg", quantity: 1, price: 18.50 },
      { name: "Metformina 850mg", quantity: 1, price: 31.00 },
    ],
    deliveryAddress: "Rua das Flores, 123 - Asa Sul, Brasília - DF",
    trackingCode: "BR123456789BR",
  },
  {
    id: "PED-2024-002",
    date: "2024-12-18",
    status: "in_transit",
    total: 24.80,
    items: [
      { name: "Omeprazol 20mg", quantity: 1, price: 15.90 },
      { name: "Dipirona 500mg", quantity: 1, price: 8.90 },
    ],
    deliveryAddress: "Rua das Flores, 123 - Asa Sul, Brasília - DF",
    trackingCode: "BR987654321BR",
  },
  {
    id: "PED-2024-003",
    date: "2024-12-15",
    status: "processing",
    total: 89.70,
    items: [
      { name: "Atorvastatina 10mg", quantity: 1, price: 22.50 },
      { name: "Enalapril 10mg", quantity: 1, price: 19.90 },
      { name: "Hidroclorotiazida 25mg", quantity: 1, price: 15.30 },
      { name: "AAS 100mg", quantity: 1, price: 32.00 },
    ],
    deliveryAddress: "Rua das Flores, 123 - Asa Sul, Brasília - DF",
    trackingCode: null,
  },
];

const Orders = () => {
  const [selectedTab, setSelectedTab] = useState("all");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-500";
      case "in_transit":
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
      case "delivered":
        return "Entregue";
      case "in_transit":
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
      case "in_transit":
        return <Truck className="h-5 w-5" />;
      case "processing":
        return <Clock className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const filteredOrders = selectedTab === "all" 
    ? mockOrders 
    : mockOrders.filter(order => order.status === selectedTab);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 mt-20">
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
              <div className="text-2xl font-bold">{mockOrders.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Processamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {mockOrders.filter(o => o.status === "processing").length}
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
                {mockOrders.filter(o => o.status === "in_transit").length}
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
                {mockOrders.filter(o => o.status === "delivered").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="processing">Processando</TabsTrigger>
            <TabsTrigger value="in_transit">Em Trânsito</TabsTrigger>
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
                          <p className="text-muted-foreground">{order.deliveryAddress}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Code */}
                    {order.trackingCode && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Código de Rastreamento:</p>
                            <p className="text-primary font-mono">{order.trackingCode}</p>
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
                      {order.trackingCode && (
                        <Button variant="outline" size="sm" className="flex-1">
                          <Truck className="mr-2 h-4 w-4" />
                          Rastrear Pedido
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="flex-1 text-primary">
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
