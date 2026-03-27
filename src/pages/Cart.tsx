import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2, ShoppingCart, Plus, Minus, Truck, Store,
  Tag, ShoppingBag, ArrowRight, Shield, RotateCcw, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getShippingConfig, type ShippingConfig } from "@/integrations/correios/client";
import type { CartItem, CatalogCartItem } from "@/types/prescription";

// ─── Item row component ───────────────────────────────────────────────────────

function PrescriptionItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex gap-4 py-5 border-b border-border/50 last:border-0">
      {/* Icon */}
      <div className="h-12 w-12 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
        <ShoppingCart className="h-5 w-5 text-primary/60" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground leading-snug">{item.name}</p>
            {item.dosage && (
              <p className="text-xs text-muted-foreground mt-0.5">{item.dosage}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.frequency && (
                <span className="text-xs text-muted-foreground">{item.frequency}</span>
              )}
              {item.pharmacyName && (
                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  <Store className="h-3 w-3" />
                  {item.pharmacyName}
                </span>
              )}
            </div>
          </div>
          <p className="font-bold text-foreground shrink-0">
            R$ {(item.price * item.quantity).toFixed(2)}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">
            R$ {item.price.toFixed(2)} / unid.
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
              disabled={item.quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 ml-1"
              onClick={() => onRemove(item.cartItemId)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CatalogCartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex gap-4 py-5 border-b border-border/50 last:border-0">
      {/* Icon */}
      <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
        <Tag className="h-5 w-5 text-emerald-600" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground leading-snug">{item.name}</p>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-4 shrink-0">
                Com desconto
              </Badge>
            </div>
            {item.principioAtivo && (
              <p className="text-xs text-muted-foreground mt-0.5">{item.principioAtivo}</p>
            )}
            {item.dosage && (
              <p className="text-xs text-muted-foreground">{item.dosage}</p>
            )}
          </div>
          <p className="font-bold text-foreground shrink-0">
            R$ {(item.price * item.quantity).toFixed(2)}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">
            R$ {item.price.toFixed(2)} / unid.
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
              disabled={item.quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
              disabled={item.maxQuantity !== undefined && item.quantity >= item.maxQuantity}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 ml-1"
              onClick={() => onRemove(item.cartItemId)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const Cart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cart = useCart();
  const cartItems = cart.items;
  const catalogItems = cart.catalogItems;
  const [loading, setLoading] = useState(true);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  const { accessToken: assemedAccessToken } = useAssemedToken();

  const totalItems = cartItems.length + catalogItems.length;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) navigate("/auth");
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      setLoading(false);
    });

    getShippingConfig().then(setShippingConfig);

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleRemovePrescriptionItem = (cartItemId: string) => {
    cart.removeItem(cartItemId);
    toast({ title: "Item removido do carrinho" });
  };

  const handleRemoveCatalogItem = (cartItemId: string) => {
    cart.removeCatalogItem(cartItemId);
    toast({ title: "Item removido do carrinho" });
  };

  const subtotal =
    cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0) +
    catalogItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const isFreeShipping =
    shippingConfig?.enableFreeShipping && subtotal >= shippingConfig.freeShippingThreshold;
  const shippingCost = isFreeShipping ? 0 : (shippingConfig?.shippingCost ?? 0);
  const total = subtotal + shippingCost;

  const missingForFree =
    shippingConfig?.enableFreeShipping && !isFreeShipping
      ? shippingConfig.freeShippingThreshold - subtotal
      : 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header
        isAuthenticated
        onLogout={handleLogout}
        cartItemsCount={totalItems}
      />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-32 lg:pb-8">
        <BackLink to={-1} label="Continuar comprando" />

        <div className="flex items-center gap-3 mt-4 mb-6">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Carrinho
          </h1>
          {totalItems > 0 && (
            <span className="text-sm text-muted-foreground">
              ({totalItems} {totalItems === 1 ? "item" : "itens"})
            </span>
          )}
        </div>

        {/* ─── Empty state ──────────────────────────────────────────────── */}
        {totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-xl font-heading font-semibold">Seu carrinho está vazio</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Adicione medicamentos das suas receitas para continuar
              </p>
            </div>
            <Button
              className="mt-2 gradient-hero text-primary-foreground gap-2"
              onClick={() => navigate("/prescriptions")}
            >
              <ShoppingCart className="h-4 w-4" />
              Ver receituários
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3 lg:items-start">

            {/* ─── Items list ──────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Free shipping progress bar */}
              {missingForFree > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-emerald-800 font-medium mb-2">
                    Faltam <strong>R$ {missingForFree.toFixed(2)}</strong> para frete grátis!
                  </p>
                  <div className="h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (subtotal / (shippingConfig?.freeShippingThreshold ?? 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {isFreeShipping && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-800 font-medium">
                    Frete grátis aplicado!
                  </p>
                </div>
              )}

              {/* Prescription items */}
              {cartItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-border/50 shadow-sm px-5">
                  {cartItems.map((item) => (
                    <PrescriptionItemRow
                      key={item.cartItemId}
                      item={item}
                      onUpdateQuantity={cart.updateQuantity}
                      onRemove={handleRemovePrescriptionItem}
                    />
                  ))}
                </div>
              )}

              {/* Catalog items (from prescriptions via OCR) — agrupados por receita */}
              {catalogItems.length > 0 && (() => {
                // Agrupa por receitaId
                const groups: { receitaId: string | undefined; items: typeof catalogItems }[] = [];
                for (const item of catalogItems) {
                  const existing = groups.find(g => g.receitaId === item.receitaId);
                  if (existing) existing.items.push(item);
                  else groups.push({ receitaId: item.receitaId, items: [item] });
                }
                const namedGroups = groups.filter(g => g.receitaId !== undefined);
                const hasMultiple = namedGroups.length > 1;

                return (
                  <>
                    {hasMultiple && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          Você possui medicamentos de{" "}
                          <strong>{namedGroups.length} receitas diferentes</strong> no carrinho.
                          Serão gerados pedidos separados por receita.
                        </p>
                      </div>
                    )}
                    {groups.map(group => (
                      <div
                        key={group.receitaId ?? "__sem-receita__"}
                        className="bg-white rounded-2xl border border-border/50 shadow-sm px-5"
                      >
                        <div className="flex items-center gap-2 py-3 border-b border-border/30">
                          <Tag className="h-4 w-4 text-emerald-600" />
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                            {group.receitaId
                              ? `Medicamentos com desconto — Receita #${group.receitaId}`
                              : "Medicamentos com desconto — receita"}
                          </p>
                        </div>
                        {group.items.map((item) => (
                          <CatalogItemRow
                            key={item.cartItemId}
                            item={item}
                            onUpdateQuantity={cart.updateCatalogQuantity}
                            onRemove={handleRemoveCatalogItem}
                          />
                        ))}
                      </div>
                    ))}
                  </>
                );
              })()}

              {/* Clear cart */}
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                onClick={async () => {
                  await cart.clearCart();
                  cart.clearCatalogItems();
                  toast({ title: "Carrinho esvaziado" });
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Esvaziar carrinho
              </button>
            </div>

            {/* ─── Order summary ────────────────────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 sticky top-20 space-y-4">
                <p className="font-heading font-semibold text-base">Resumo do pedido</p>

                <div className="space-y-2 text-sm">
                  {cartItems.map((item) => (
                    <div key={item.cartItemId} className="flex justify-between text-muted-foreground">
                      <span className="truncate mr-2">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="shrink-0">R$ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {catalogItems.map((item) => (
                    <div key={item.cartItemId} className="flex justify-between text-muted-foreground">
                      <span className="truncate mr-2">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="shrink-0 text-emerald-700">R$ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    {isFreeShipping ? (
                      <span className="font-medium text-emerald-600">Grátis</span>
                    ) : shippingConfig ? (
                      <span className="font-medium">R$ {shippingCost.toFixed(2)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Calculado no checkout</span>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-heading font-bold text-base">Total</span>
                  <span className="font-heading font-bold text-2xl text-primary">
                    R$ {total.toFixed(2)}
                  </span>
                </div>

                {shippingConfig && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Truck className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Entrega em {shippingConfig.minDeliveryDays}–{shippingConfig.maxDeliveryDays} dias úteis
                    </span>
                  </div>
                )}

                <Button
                  className="w-full gradient-hero text-primary-foreground gap-2 h-12 text-base font-semibold"
                  onClick={() => navigate("/checkout/medication")}
                  size="lg"
                >
                  Ir para o pagamento
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Pagamento 100% seguro</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Mobile sticky checkout bar ───────────────────────────────────── */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-border/50 shadow-lg px-4 py-3 flex items-center gap-3 lg:hidden z-40">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-heading font-bold text-xl text-primary">R$ {total.toFixed(2)}</p>
          </div>
          <Button
            className="gradient-hero text-primary-foreground gap-2 h-12 px-6 font-semibold"
            onClick={() => navigate("/checkout/medication")}
          >
            Ir para o pagamento
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ActiveConsultationBanner accessToken={assemedAccessToken} />
    </div>
  );
};

export default Cart;
