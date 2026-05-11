import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Calendar,
  MapPin,
  CreditCard,
  ChevronRight,
  Truck,
  CheckCircle,
  Clock,
  FileText,
  Stethoscope,
  XCircle,
  AlertCircle,
  ShoppingBag,
  Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { User, Session } from "@supabase/supabase-js";
import { getCorreiosTrackingUrl, type TrackingEvent } from "@/services/trackingService";
import { formatPaymentMethod } from "@/lib/labels";

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  items: { name: string; quantity: number; price: number }[];
  delivery_address: string;
  tracking_code: string | null;
  tracking_status_label?: string | null;
  tracking_last_checked_at?: string | null;
  tracking_events?: TrackingEvent[] | null;
  payment_id: string | null;
  payment_method: string | null;
  installments: number | null;
  shipping_cost: number;
  subtotal: number;
  created_at: string;
  user_id: string;
  receita_id: string | null;
  receita_url_pdf: string | null;
  consulta_id: string | null;
  receita_review_status: string | null;
  receita_review_notes: string | null;
  payment_status: string | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const normalizeStatus = (status: string | null | undefined) => {
  if (!status) return "pending";
  if (status === "in_transit") return "shipped";
  if (status === "confirmed") return "processing";
  return status;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const shortId = (id: string) =>
  `#${id.replace(/-/g, "").toUpperCase().slice(0, 8)}`;

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; badgeClass: string; ringClass: string; textClass: string }
> = {
  pending: {
    label: "Pago",
    icon: <CreditCard className="h-4 w-4" />,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    ringClass: "bg-slate-100",
    textClass: "text-slate-700",
  },
  processing: {
    label: "Em Separação",
    icon: <Clock className="h-4 w-4" />,
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    ringClass: "bg-amber-100",
    textClass: "text-amber-700",
  },
  shipped: {
    label: "Enviado",
    icon: <Truck className="h-4 w-4" />,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    ringClass: "bg-blue-100",
    textClass: "text-blue-700",
  },
  delivered: {
    label: "Entregue",
    icon: <CheckCircle className="h-4 w-4" />,
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    ringClass: "bg-green-100",
    textClass: "text-green-700",
  },
  cancelled: {
    label: "Cancelado",
    icon: <XCircle className="h-4 w-4" />,
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    ringClass: "bg-red-100",
    textClass: "text-red-700",
  },
};

// Progress steps for active orders
const STATUS_STEPS = ["pending", "processing", "shipped", "delivered"];

function StatusProgress({ status }: { status: string }) {
  if (status === "cancelled" || status === "delivered") return null;
  const currentStep = STATUS_STEPS.indexOf(status);
  if (currentStep === -1) return null;

  const labels = ["Pago", "Separando", "A caminho", "Entregue"];

  return (
    <div className="flex items-center gap-0 w-full" aria-label="Progresso do pedido">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= currentStep;
        const isLast = i === STATUS_STEPS.length - 1;
        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${done ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {labels[i]}
              </span>
            </div>
            {!isLast && (
              <div className={`h-0.5 flex-1 mx-1 mb-3.5 rounded ${done && i < currentStep ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5 space-y-4 animate-pulse">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
          <div className="h-6 w-24 bg-muted rounded-full" />
        </div>
        <div className="h-px bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-40 bg-muted rounded" />
          <div className="h-3 w-32 bg-muted rounded" />
        </div>
        <div className="flex justify-between items-center pt-1">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-6 w-20 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pagos" },
  { value: "processing", label: "Em Separação" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregues" },
  { value: "cancelled", label: "Cancelados" },
];

// ─── main component ───────────────────────────────────────────────────────────

const Orders = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setUser] = useState<User | null>(null);
  const [, setSession] = useState<Session | null>(null);
  const { accessToken } = useAssemedToken();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) navigate("/auth");
        else fetchOrders(session.user.id);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
      else fetchOrders(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (error) { logger.error("Error fetching orders:", error); return; }

      if (data) {
        const parsed = data.map(order => ({
          ...order,
          status: normalizeStatus(order.status),
          items: typeof order.items === "string" ? JSON.parse(order.items) : order.items || [],
        }));
        setOrders(parsed);
      }
    } catch (error) {
      logger.error("Error fetching orders:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const countByStatus = (status: string) => orders.filter(o => o.status === status).length;

  const filteredOrders = selectedTab === "all"
    ? orders
    : orders.filter(o => o.status === selectedTab);

  // ─── loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated onLogout={handleLogout} />
        <main className="page-container">
          <PageHeader
            title="Meus Pedidos"
            subtitle="Acompanhe o status de todos os seus pedidos"
            icon={Package}
            iconColor="text-orange-500"
            iconBg="bg-orange-500/10"
          />
          <div className="space-y-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />

      <main className="page-container">
        <PageHeader
          title="Meus Pedidos"
          subtitle="Acompanhe o status de todos os seus pedidos"
          icon={Package}
          iconColor="text-orange-500"
          iconBg="bg-orange-500/10"
        />

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        {orders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total", value: orders.length, colorClass: "text-foreground" },
              {
                label: "Em andamento",
                value: countByStatus("pending") + countByStatus("processing"),
                colorClass: "text-amber-600",
              },
              { label: "Em trânsito", value: countByStatus("shipped"), colorClass: "text-blue-600" },
              { label: "Entregues", value: countByStatus("delivered"), colorClass: "text-green-600" },
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <span className={`text-2xl font-bold leading-none ${stat.colorClass}`}>
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs (scrollable on mobile) ───────────────────────────────── */}
        <div className="mb-6 -mx-1">
          <div className="flex gap-1 overflow-x-auto pb-1 px-1 scrollbar-none">
            {TABS.map(tab => {
              const count = tab.value === "all" ? orders.length : countByStatus(tab.value);
              const active = selectedTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setSelectedTab(tab.value)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold ${
                        active ? "bg-white/20 text-primary-foreground" : "bg-background text-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Orders list ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">
                  {selectedTab === "all" ? "Nenhum pedido ainda" : "Nenhum pedido nesta categoria"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedTab === "all"
                    ? "Seus pedidos de medicamentos aparecerão aqui."
                    : "Tente selecionar outra categoria."}
                </p>
              </div>
  
            </div>
          ) : (
            filteredOrders.map((order) => {
              const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
              const isActive = ["pending", "processing", "shipped"].includes(order.status);

              return (
                <Card
                  key={order.id}
                  className="overflow-hidden transition-shadow hover:shadow-md"
                >
                  {/* Colored top accent bar */}
                  <div className={`h-1 w-full ${
                    order.status === "delivered" ? "bg-green-500" :
                    order.status === "shipped"   ? "bg-blue-500" :
                    order.status === "processing"? "bg-amber-500" :
                    order.status === "cancelled" ? "bg-red-400" :
                    "bg-slate-400"
                  }`} />

                  <CardContent className="p-5">
                    {/* ── Row 1: ID + date | total + badge ────────────────── */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-base text-foreground leading-tight">
                          {shortId(order.id)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{formatDate(order.date)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xl font-bold text-foreground leading-none">
                          {formatCurrency(order.total)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 ${config.badgeClass}`}
                        >
                          <span className={config.textClass}>{config.icon}</span>
                          {config.label}
                        </Badge>
                      </div>
                    </div>

                    {/* ── Progress bar (active orders only) ───────────────── */}
                    {isActive && (
                      <div className="mb-4 px-2">
                        <StatusProgress status={order.status} />
                      </div>
                    )}

                    {/* ── Items ────────────────────────────────────────────── */}
                    <div className="bg-muted/40 rounded-lg p-3 mb-3 space-y-1.5">
                      {order.items.slice(0, 3).map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-foreground">
                            <span className="font-medium text-muted-foreground mr-1">{item.quantity}×</span>
                            {item.name}
                          </span>
                          <span className="text-muted-foreground text-xs shrink-0 ml-2">
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-xs text-muted-foreground pt-0.5">
                          +{order.items.length - 3} item{order.items.length - 3 > 1 ? "s" : ""} a mais
                        </p>
                      )}
                    </div>

                    {/* ── Rejeição farmacêutica ────────────────────────────── */}
                    {order.status === "cancelled" && order.receita_review_status === "rejected" && (
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 mb-3">
                        <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-700">Rejeitado pela farmácia</p>
                          {order.receita_review_notes && (
                            <p className="text-xs text-red-600 mt-0.5">{order.receita_review_notes}</p>
                          )}
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {order.payment_status === "refunded"
                              ? "Estorno realizado — crédito em até 5 dias úteis."
                              : "Reembolso será processado em breve."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Consulta / Receita ───────────────────────────────── */}
                    {(order.receita_id || order.consulta_id) && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15 mb-3">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Origem</p>
                            <p className="text-sm font-semibold text-foreground">
                              Consulta {shortId(order.receita_id ?? order.consulta_id ?? "")}
                            </p>
                          </div>
                        </div>
                        {order.receita_url_pdf && (
                          <button
                            onClick={() => window.open(order.receita_url_pdf!, "_blank")}
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Ver receita
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── Footer: address + tracking + payment ─────────────── */}
                    <div className="space-y-2 text-xs text-muted-foreground border-t pt-3">
                      {order.status !== "cancelled" && order.delivery_address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="truncate">{order.delivery_address}</span>
                        </div>
                      )}

                      {order.tracking_code && (
                        <div className="flex items-start gap-1.5">
                          <Truck className="h-3.5 w-3.5 shrink-0" />
                          <div>
                            <span>Rastreio: </span>
                            <span className="font-mono text-primary font-medium">{order.tracking_code}</span>
                            {order.tracking_status_label && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {order.tracking_status_label}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {order.payment_method && (
                        <div className="flex items-center gap-1.5">
                          {order.payment_method.toLowerCase().includes("pix")
                            ? <Banknote className="h-3.5 w-3.5 shrink-0" />
                            : <CreditCard className="h-3.5 w-3.5 shrink-0" />
                          }
                          <span>{formatPaymentMethod(order.payment_method)}</span>
                          {order.installments && order.installments > 1 && (
                            <span>· {order.installments}×</span>
                          )}
                          {order.shipping_cost > 0 && (
                            <span className="ml-auto">
                              Frete: {formatCurrency(order.shipping_cost)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Actions ──────────────────────────────────────────── */}
                    <div className="flex gap-2 mt-4">
                      {order.tracking_code && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-9"
                          onClick={() =>
                            window.open(
                              getCorreiosTrackingUrl(order.tracking_code!),
                              "_blank"
                            )
                          }
                        >
                          <Truck className="h-3.5 w-3.5 mr-1.5" />
                          Rastrear
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-xs h-9 text-primary hover:text-primary"
                        onClick={() => navigate(`/order/${order.id}`)}
                      >
                        Ver detalhes
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>

      <ActiveConsultationBanner accessToken={accessToken} />
    </div>
  );
};

export default Orders;
