import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { CartItem } from "@/types/prescription";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShoppingBag, Plus, Minus, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { getShippingConfig, type ShippingConfig } from "@/integrations/correios/client";

const Cart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  const { accessToken: assemedAccessToken } = useAssemedToken();

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

    loadCart();
    getShippingConfig().then(setShippingConfig);

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadCart = () => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    setCartItems(cart);
  };

  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    const updatedCart = cartItems.map((item) =>
      item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
    );
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    setCartItems(updatedCart);
  };

  const removeItem = (cartItemId: string) => {
    const updatedCart = cartItems.filter((item) => item.cartItemId !== cartItemId);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    setCartItems(updatedCart);
    toast({
      title: "Item removido",
      description: "Medicamento removido do carrinho",
    });
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const isFreeShipping = shippingConfig?.enableFreeShipping && subtotal >= shippingConfig.freeShippingThreshold;
  const estimatedShipping = isFreeShipping ? 0 : (shippingConfig?.shippingCost ?? 0);
  const estimatedTotal = subtotal + estimatedShipping;

  const handleCheckout = () => {
    navigate("/checkout/medication");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        isAuthenticated 
        onLogout={handleLogout} 
        cartItemsCount={cartItems.length}
      />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-2">
            Carrinho de Compras
          </h1>
          <p className="text-muted-foreground">
            Revise seus medicamentos antes de finalizar
          </p>
        </div>

        {cartItems.length === 0 ? (
          <Card className="text-center py-12 border-border/50">
            <CardContent>
              <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-heading font-semibold mb-2">Carrinho vazio</h2>
              <p className="text-muted-foreground mb-6">
                Adicione medicamentos dos seus receituários
              </p>
              <Button 
                onClick={() => navigate("/dashboard")}
                className="gradient-hero text-primary-foreground"
              >
                Ver receituários
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.cartItemId} className="border-border/50">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex-1">
                      <h3 className="font-heading font-semibold text-lg mb-1">{item.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Receituário: {item.prescriptionId}
                      </p>
                      <div className="text-sm space-y-1">
                        <p><span className="font-medium">Posologia:</span> {item.frequency}</p>
                        <p><span className="font-medium">Duração:</span> {item.duration}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-sm text-muted-foreground">Quantidade:</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.cartItemId, parseInt(e.target.value) || 1)}
                            className="w-16 h-7 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Preço unitário</p>
                        <p className="text-sm">R$ {item.price.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-2xl font-heading font-bold text-primary">
                          R$ {(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeItem(item.cartItemId)}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-20 border-border/50 shadow-card">
                <CardHeader>
                  <CardTitle className="font-heading">Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-semibold">R$ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete:</span>
                      {isFreeShipping ? (
                        <span className="font-semibold text-green-600">Grátis</span>
                      ) : shippingConfig ? (
                        <span className="font-semibold">R$ {shippingConfig.shippingCost.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Calculado no checkout</span>
                      )}
                    </div>
                    {shippingConfig?.enableFreeShipping && !isFreeShipping && (
                      <p className="text-xs text-green-600">
                        Frete grátis para compras acima de R$ {shippingConfig.freeShippingThreshold.toFixed(2)}!
                      </p>
                    )}
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-2xl font-heading font-bold text-primary">
                        R$ {estimatedTotal.toFixed(2)}
                      </span>
                    </div>

                    <Button
                      className="w-full gradient-hero text-primary-foreground"
                      onClick={handleCheckout}
                      size="lg"
                    >
                      Finalizar Pedido
                    </Button>
                    {shippingConfig && (
                      <div className="flex items-center justify-center gap-1 mt-3">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          Entrega em {shippingConfig.minDeliveryDays} a {shippingConfig.maxDeliveryDays} dias úteis
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
      <ActiveConsultationBanner accessToken={assemedAccessToken} />
    </div>
  );
};

export default Cart;