import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Plans from "./pages/Plans";
import HowItWorks from "./pages/HowItWorks";
import Medications from "./pages/Medications";
import Blog from "./pages/Blog";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ProfileSettings from "./pages/ProfileSettings";
import MyPlan from "./pages/MyPlan";
import PrescriptionDetail from "./pages/PrescriptionDetail";
import Prescriptions from "./pages/Prescriptions";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import BlogPost from "./pages/BlogPost";
import Cart from "./pages/Cart";
import CheckoutSubscription from "./pages/CheckoutSubscription";
import CheckoutMedication from "./pages/CheckoutMedication";
import CheckoutConsultation from "./pages/CheckoutConsultation";
import Telemedicine from "./pages/Telemedicine";
import Teleconsultas from "./pages/Teleconsultas";
import SalaEspera from "./pages/SalaEspera";
import Especialistas from "./pages/Especialistas";
import Farmacia from "./pages/Farmacia";
import Sobre from "./pages/Sobre";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminOrders from "./pages/admin/Orders";
import AdminPrescriptions from "./pages/admin/Prescriptions";
import AdminContent from "./pages/admin/Content";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import AdminSupport from "./pages/admin/Support";
import TestSupabase from "./pages/TestSupabase";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cancellation from "./pages/Cancellation";
import AdminUserDetail from "./pages/admin/UserDetail";

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/planos" element={<Plans />} />
          <Route path="/como-funciona" element={<HowItWorks />} />
          <Route path="/medicamentos" element={<Medications />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/perfil" element={<ProfileSettings />} />
          <Route path="/meu-plano" element={<MyPlan />} />
          <Route path="/prescriptions" element={<Prescriptions />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order/:id" element={<OrderDetail />} />
          <Route path="/blog/:id" element={<BlogPost />} />
          <Route path="/prescription/:id" element={<PrescriptionDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout/subscription" element={<CheckoutSubscription />} />
          <Route path="/checkout/medication" element={<CheckoutMedication />} />
          <Route path="/checkout/consultation" element={<CheckoutConsultation />} />
          <Route path="/telemedicina" element={<Telemedicine />} />
          <Route path="/teleconsultas" element={<Teleconsultas />} />
          <Route path="/sala-espera/:id" element={<SalaEspera />} />
          <Route path="/especialistas" element={<Especialistas />} />
          <Route path="/farmacia" element={<Farmacia />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="/cancelamento" element={<Cancellation />} />
          <Route path="/test-supabase" element={<TestSupabase />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="usuarios/:userId" element={<AdminUserDetail />} />
            <Route path="pedidos" element={<AdminOrders />} />
            <Route path="receitas" element={<AdminPrescriptions />} />
            <Route path="conteudo" element={<AdminContent />} />
            <Route path="relatorios" element={<AdminReports />} />
            <Route path="configuracoes" element={<AdminSettings />} />
            <Route path="suporte" element={<AdminSupport />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;