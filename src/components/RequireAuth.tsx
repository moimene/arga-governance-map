import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ShellLayout } from "@/components/shell/ShellLayout";

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Cargando sesión…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children ?? <Outlet />}</>;
}

/** Convenience wrapper used in the route tree: protected shell. */
export function ProtectedShell() {
  return (
    <RequireAuth>
      <ShellLayout />
    </RequireAuth>
  );
}
