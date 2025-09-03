import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Verification from "./pages/Verification";
import Groups from "./pages/Groups";
import CreateGroup from "./pages/CreateGroup";
import Wallet from "./pages/Wallet";
import Transactions from "./pages/Transactions";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <Layout requireAuth>
                <Dashboard />
              </Layout>
            } />
            <Route path="/verification" element={
              <Layout requireAuth>
                <Verification />
              </Layout>
            } />
            <Route path="/groups" element={
              <Layout requireAuth>
                <Groups />
              </Layout>
            } />
            <Route path="/groups/create" element={
              <Layout requireAuth>
                <CreateGroup />
              </Layout>
            } />
            <Route path="/wallet" element={
              <Layout requireAuth>
                <Wallet />
              </Layout>
            } />
            <Route path="/transactions" element={
              <Layout requireAuth>
                <Transactions />
              </Layout>
            } />
            <Route path="/notifications" element={
              <Layout requireAuth>
                <Notifications />
              </Layout>
            } />
            <Route path="/settings" element={
              <Layout requireAuth>
                <Settings />
              </Layout>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
