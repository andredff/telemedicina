import { useEffect, useState, type ElementType } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import LogoNovita from "@/assets/logo-novita.png";
import {
  LayoutDashboard, Video, Stethoscope, FileText, FlaskConical, Pill,
  Crown, ShoppingCart, ChevronLeft, Menu, X, LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { PatientShellContext } from "./patientShell";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PlanStatusBanner } from "@/components/notifications/PlanStatusBanner";

const NAV_ITEMS: { label: string; icon: ElementType; route: string }[] = [
  { label: "Início", icon: LayoutDashboard, route: "/dashboard" },
  { label: "Consultas", icon: Video, route: "/teleconsultas" },
  { label: "Especialistas", icon: Stethoscope, route: "/especialistas" },
  { label: "Receitas", icon: FileText, route: "/prescriptions" },
  { label: "Exames", icon: FlaskConical, route: "/meus-checkups" },
  { label: "Farmácia", icon: Pill, route: "/farmacia" },
  { label: "Pedidos", icon: ShoppingCart, route: "/orders" },
  { label: "Meu plano", icon: Crown, route: "/meu-plano" },
];

function isRouteActive(pathname: string, route: string) {
  return route === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(route);
}

export default function PatientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();

  const [mobileNav, setMobileNav] = useState(false);
  const [firstName, setFirstName] = useState("Paciente");
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (active) setFirstName((((prof?.full_name as string) || user.email?.split("@")[0]) || "Paciente").split(" ")[0]);

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("plan:subscription_plans ( name )")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (active && sub) {
        const planObj = Array.isArray((sub as { plan: unknown }).plan)
          ? (sub as unknown as { plan: { name: string }[] }).plan[0]
          : (sub as { plan: { name: string } | null }).plan;
        setPlanName(planObj?.name ?? null);
      }
    })();
    return () => { active = false; };
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const initials = firstName.slice(0, 2).toUpperCase();
  const onDashboard = location.pathname === "/dashboard";
  const currentNav = NAV_ITEMS.find((n) => isRouteActive(location.pathname, n.route));
  const pageTitle = currentNav?.label ?? "";

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV_ITEMS.map(({ label, icon: Icon, route }) => {
        const active = isRouteActive(location.pathname, route);
        return (
          <button
            key={route}
            onClick={() => { onNavigate?.(); navigate(route); }}
            aria-current={active ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              active
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <PatientShellContext.Provider value={true}>
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-slate-50 to-slate-100">
        <div className="flex">

          {/* Sidebar (desktop) */}
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/60 bg-white/70 backdrop-blur-xl lg:flex">
            <button onClick={() => navigate("/dashboard")} className="flex h-16 items-center px-5">
              <img src={LogoNovita} alt="Novità" className="h-9 w-auto" />
            </button>
            <NavList />
            <div className="border-t border-slate-200/70 p-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-[18px] w-[18px]" /> Sair
              </button>
            </div>
          </aside>

          {/* Mobile drawer */}
          {mobileNav && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
              <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-white/60 bg-white/90 backdrop-blur-xl">
                <div className="flex h-16 items-center justify-between px-5">
                  <img src={LogoNovita} alt="Novità" className="h-9 w-auto" />
                  <button onClick={() => setMobileNav(false)} aria-label="Fechar menu" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <NavList onNavigate={() => setMobileNav(false)} />
                <div className="border-t border-slate-200/70 p-3">
                  <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    <LogOut className="h-[18px] w-[18px]" /> Sair
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">

            {/* Topbar */}
            <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-white/60 bg-white/70 px-4 backdrop-blur-xl sm:px-6">
              <button onClick={() => setMobileNav(true)} aria-label="Abrir menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
              {!onDashboard && (
                <button onClick={() => navigate(-1)} aria-label="Voltar" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <p className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">{pageTitle}</p>

              <div className="flex items-center gap-1.5">
                <button onClick={() => navigate("/cart")} aria-label="Carrinho" className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100">
                  <ShoppingCart className="h-5 w-5" />
                  {cart.count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {cart.count}
                    </span>
                  )}
                </button>
                <NotificationBell />
                <button onClick={() => navigate("/perfil")} className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-slate-100">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-sm font-bold text-white">
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-semibold leading-tight text-slate-800">{firstName}</span>
                    <span className="block text-xs leading-tight text-slate-500">{planName ? `Plano ${planName}` : "Sem plano"}</span>
                  </span>
                </button>
              </div>
            </header>

            {/* Banner de status do plano (vencendo / vencido) */}
            <PlanStatusBanner />

            {/* Page content */}
            <main className="min-w-0 flex-1">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </PatientShellContext.Provider>
  );
}
