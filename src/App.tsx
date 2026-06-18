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
import MyCheckups from "./pages/MyCheckups";
import LabPanel from "./pages/LabPanel";
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
import AdminMedications from "./pages/admin/Medications";
import AdminSubscriptions from "./pages/admin/Subscriptions";
import AdminSubscriptionDetail from "./pages/admin/SubscriptionDetail";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cancellation from "./pages/Cancellation";
import AdminUserDetail from "./pages/admin/UserDetail";
import ServiceOrderView from "./pages/admin/ServiceOrderView";
import Support from "./pages/Support";
import PreparacaoConsulta from "./pages/consulta/PreparacaoConsulta";
import ConsultaPage from "./pages/consulta/ConsultaPage";
import ConsultaDetalhes from "./pages/consulta/ConsultaDetalhes";
import Notificacoes from "./pages/Notificacoes";
import PatientLayout from "@/components/layout/PatientLayout";
import MedicoLayout from "./pages/medico/MedicoLayout";
import MedicoDashboard from "./pages/medico/MedicoDashboard";
import MedicoSalaEspera from "./pages/medico/MedicoSalaEspera";
import MedicoConsultas from "./pages/medico/MedicoConsultas";
import MedicoAtendimento from "./pages/medico/MedicoAtendimento";
import MedicoPacientes from "./pages/medico/MedicoPacientes";
import MedicoPrescricoes from "./pages/medico/MedicoPrescricoes";
import MedicoExames from "./pages/medico/MedicoExames";
import MedicoAtestados from "./pages/medico/MedicoAtestados";
import MedicoDocumentos from "./pages/medico/MedicoDocumentos";
import MedicoConfiguracoes from "./pages/medico/MedicoPerfil";
import MedicoAgenda from "./pages/medico/MedicoAgenda";
import MedicoSuporte from "./pages/medico/MedicoSuporte";
import AtendenteTriagem from "./pages/atendente/AtendenteTriagem";

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
};

const StaticHtmlRedirect = ({ to }: { to: string }) => {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

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
          {/* Área logada do paciente — layout com sidebar + topbar */}
          <Route element={<PatientLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/perfil" element={<ProfileSettings />} />
            <Route path="/meu-plano" element={<MyPlan />} />
            <Route path="/meus-checkups" element={<MyCheckups />} />
            <Route path="/prescriptions" element={<Prescriptions />} />
            <Route path="/prescription/:id" element={<PrescriptionDetail />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/order/:id" element={<OrderDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/telemedicina" element={<Telemedicine />} />
            <Route path="/teleconsultas" element={<Teleconsultas />} />
            <Route path="/notificacoes" element={<Notificacoes />} />
            <Route path="/consulta/:id/detalhes" element={<ConsultaDetalhes />} />
            <Route path="/especialistas" element={<Especialistas />} />
            <Route path="/farmacia" element={<Farmacia />} />
            <Route path="/suporte" element={<Support />} />
          </Route>

          {/* Fluxos sem o layout (tela cheia / foco / outros papéis) */}
          <Route path="/laboratorio" element={<LabPanel />} />
          <Route path="/blog/:id" element={<BlogPost />} />
          <Route path="/checkout/subscription" element={<CheckoutSubscription />} />
          <Route path="/checkout/medication" element={<CheckoutMedication />} />
          <Route path="/checkout/consultation" element={<CheckoutConsultation />} />
          <Route path="/sala-espera/:id" element={<SalaEspera />} />
          <Route path="/consulta/:id/preparacao" element={<PreparacaoConsulta />} />
          <Route path="/consulta/:id/chamada" element={<ConsultaPage />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="/cancelamento" element={<Cancellation />} />
          <Route path="/docs" element={<StaticHtmlRedirect to="/docs/index.html" />} />
          <Route path="/compare" element={<StaticHtmlRedirect to="/docs/compare/index.html" />} />
          <Route path="/compare/" element={<StaticHtmlRedirect to="/docs/compare/index.html" />} />
          <Route path="/compare/index.html" element={<StaticHtmlRedirect to="/docs/compare/index.html" />} />
          <Route path="/compare/status.html" element={<StaticHtmlRedirect to="/docs/compare/status.html" />} />
          <Route path="/docs/fluxo-os-pedidos" element={<StaticHtmlRedirect to="/docs/APRESENTACAO_FLUXO_OS_PEDIDOS.html" />} />

          {/* Médico Routes */}
          <Route path="/medico" element={<MedicoLayout />}>
            <Route index element={<MedicoDashboard />} />
            <Route path="sala-espera" element={<MedicoSalaEspera />} />
            <Route path="consultas" element={<MedicoConsultas />} />
            <Route path="atendimento/:id" element={<MedicoAtendimento />} />
            <Route path="pacientes" element={<MedicoPacientes />} />
            <Route path="prescricoes" element={<MedicoPrescricoes />} />
            <Route path="exames" element={<MedicoExames />} />
            <Route path="atestados" element={<MedicoAtestados />} />
            <Route path="documentos" element={<MedicoDocumentos />} />
            <Route path="agenda" element={<MedicoAgenda />} />
            <Route path="configuracoes" element={<MedicoConfiguracoes />} />
            <Route path="suporte" element={<MedicoSuporte />} />
          </Route>

          {/* Atendente (triagem) Route */}
          <Route path="/atendente" element={<AtendenteTriagem />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="usuarios/:userId" element={<AdminUserDetail />} />
            <Route path="pedidos" element={<AdminOrders />} />
            <Route path="medicamentos" element={<AdminMedications />} />
            <Route path="planos-contratados" element={<AdminSubscriptions />} />
            <Route path="planos-contratados/:subscriptionId" element={<AdminSubscriptionDetail />} />
            <Route path="receitas" element={<AdminPrescriptions />} />
            <Route path="conteudo" element={<AdminContent />} />
            <Route path="financeiro" element={<AdminReports />} />
            <Route path="relatorios" element={<AdminReports />} />
            <Route path="configuracoes" element={<AdminSettings />} />
            <Route path="suporte" element={<AdminSupport />} />
          </Route>

          {/* OS fullscreen (sem AdminLayout) — para impressão limpa */}
          <Route path="/admin/pedidos/:orderId/os" element={<ServiceOrderView />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
