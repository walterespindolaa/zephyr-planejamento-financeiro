import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";

const Login = lazy(() => import("@/pages/Login"));
const TrocarSenha = lazy(() => import("@/pages/TrocarSenha"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const NovoCliente = lazy(() => import("@/pages/NovoCliente"));
const ClienteDetalhe = lazy(() => import("@/pages/ClienteDetalhe"));
const Acompanhamentos = lazy(() => import("@/pages/Acompanhamentos"));
const Equipe = lazy(() => import("@/pages/Equipe"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<Loader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/trocar-senha"
                  element={
                    <ProtectedRoute allowPasswordChange>
                      <TrocarSenha />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="clientes/novo" element={<NovoCliente />} />
                  <Route path="clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="acompanhamentos" element={<Acompanhamentos />} />
                  <Route
                    path="equipe"
                    element={
                      <ProtectedRoute roles={["admin"]}>
                        <Equipe />
                      </ProtectedRoute>
                    }
                  />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
