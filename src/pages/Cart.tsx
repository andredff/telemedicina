import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { CartItem } from "@/types/prescription";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

const Cart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadCart = () => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    setCartItems(cart);
  };

  const removeItem = (itemId: string) => {
    const updatedCart = cartItems.filter((item) => item.id !== itemId);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    setCartItems(updatedCart);
    toast({
      title: "Item removido",
      description: "Medicamento removido do carrinho",
    });
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckout = () => {
    toast({
      title: "Pedido finalizado!",
      description: "Seu pedido foi processado com sucesso. Entrega em até 24h.",
    });
    localStorage.removeItem("cart");
    setCartItems([]);
    navigate("/dashboard");
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
                <Card key={item.id} className="border-border/50">
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
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-2xl font-heading font-bold text-primary">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeItem(item.id)}
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
                      <span className="font-semibold">R$ {calculateTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete:</span>
                      <span className="font-semibold text-accent">Grátis</span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-2xl font-heading font-bold text-primary">
                        R$ {calculateTotal().toFixed(2)}
                      </span>
                    </div>

                    <Button
                      className="w-full gradient-hero text-primary-foreground"
                      onClick={handleCheckout}
                      size="lg"
                    >
                      Finalizar Pedido
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      Entrega em até 24 horas úteis
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Cart;