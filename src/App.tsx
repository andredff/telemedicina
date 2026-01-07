import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Plans from "./pages/Plans";
import HowItWorks from "./pages/HowItWorks";
import Medications from "./pages/Medications";
import Blog from "./pages/Blog";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import PrescriptionDetail from "./pages/PrescriptionDetail";
import Cart from "./pages/Cart";
import CheckoutSubscription from "./pages/CheckoutSubscription";
import CheckoutMedication from "./pages/CheckoutMedication";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/planos" element={<Plans />} />
          <Route path="/como-funciona" element={<HowItWorks />} />
          <Route path="/medicamentos" element={<Medications />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/prescription/:id" element={<PrescriptionDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout/subscription" element={<CheckoutSubscription />} />
          <Route path="/checkout/medication" element={<CheckoutMedication />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;