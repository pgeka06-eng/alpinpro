import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import CalculatorPage from "@/pages/CalculatorPage";
import OrdersPage from "@/pages/OrdersPage";
import AccountingPage from "@/pages/AccountingPage";
import DocumentsPage from "@/pages/DocumentsPage";
import ClimbersPage from "@/pages/ClimbersPage";
import SettingsPage from "@/pages/SettingsPage";
import AdminPage from "@/pages/AdminPage";
import AuthPage from "@/pages/AuthPage";
import PriceListsPage from "@/pages/PriceListsPage";
import ClientEstimatePage from "@/pages/ClientEstimatePage";
import ContractSignPage from "@/pages/ContractSignPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import MarketplacePage from "@/pages/MarketplacePage";
import RequestsPage from "@/pages/RequestsPage";
import SitesPage from "@/pages/SitesPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/estimate" element={<ClientEstimatePage />} />
            <Route path="/contract" element={<ContractSignPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/accounting" element={<AccountingPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/climbers" element={<ClimbersPage />} />
              <Route path="/price-lists" element={<PriceListsPage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/sites" element={<SitesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
