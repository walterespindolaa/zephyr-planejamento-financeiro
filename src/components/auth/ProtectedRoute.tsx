import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/types";

export function ProtectedRoute({
  children,
  roles,
  allowPasswordChange = false,
}: {
  children: ReactNode;
  roles?: UserRole[];
  /** Quando true, não redireciona para /trocar-senha (usado na própria tela de troca). */
  allowPasswordChange?: boolean;
}) {
  const { user, role, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Força troca de senha no primeiro acesso
  if (profile?.must_change_password && !allowPasswordChange) {
    return <Navigate to="/trocar-senha" replace />;
  }

  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
