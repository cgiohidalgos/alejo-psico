import { Navigate } from "react-router-dom";
import { useAppStore, Role } from "@/stores/useAppStore";

interface Props {
  children: React.ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const user = useAppStore((s) => s.user);

  if (!user) return <Navigate to="/auth" replace />;

  if (roles && !roles.includes(user.role)) {
    // Redirigir a la página principal según el rol
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'teacher') return <Navigate to="/teacher" replace />;
    return <Navigate to="/casos" replace />;
  }

  return <>{children}</>;
}
