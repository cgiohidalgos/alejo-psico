import { useAppStore } from "@/stores/useAppStore";
import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, MessageSquare, FileText, BarChart3, Users, Brain, Shield, GraduationCap, LogOut } from "lucide-react";

const studentSteps = [
  { num: 1, label: "Registro", icon: Users, path: "/" },
  { num: 2, label: "Casos", icon: ClipboardList, path: "/casos" },
  { num: 3, label: "Entrevista", icon: MessageSquare, path: "/entrevista" },
  { num: 4, label: "Historia", icon: FileText, path: "/historia" },
  { num: 5, label: "Evaluación", icon: BarChart3, path: "/evaluacion" },
];

export function AppSidebar() {
  const paso = useAppStore((s) => s.paso);
  const estudiante = useAppStore((s) => s.estudiante);
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role || "guest";
  const isAuthPage = location.pathname === "/auth";

  const renderUserInfo = () => {
    if (!user) {
      return (
        <button onClick={() => navigate("/auth")} className="text-sm text-primary underline">
          Iniciar sesión
        </button>
      );
    }

    return (
      <div>
        <p className="text-xs text-sidebar-foreground/50 mb-1">
          {role === "admin" ? "Administrador" : role === "teacher" ? "Profesor" : "Estudiante"}
        </p>
        <p className="text-sm font-medium truncate">{user.name}</p>
        {estudiante && <p className="text-xs text-sidebar-foreground/60">{estudiante.orientacion}</p>}
        <button
          onClick={() => {
            logout();
            navigate("/auth");
          }}
          className="flex items-center gap-1 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground mt-2"
        >
          <LogOut className="w-3 h-3" />
          Cerrar sesión
        </button>
      </div>
    );
  };

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-sidebar-foreground">SSPEC</h1>
            <p className="text-xs text-sidebar-foreground/60">Simulación Clínica</p>
          </div>
        </div>
      </div>

      {isAuthPage ? (
        <div className="p-6">
          <h2 className="text-sm font-semibold mb-2">¿Qué es SSPEC?</h2>
          <p className="text-xs text-sidebar-foreground/70">
            Plataforma de práctica de entrevista clínica con paciente simulado por IA.
            Inicia sesión o regístrate y sigue los pasos: elegir caso, entrevista, historia clínica y evaluación.
          </p>
          <p className="text-xs text-sidebar-foreground/70 mt-3">
            Al autenticarte, tus sesiones se guardan en SQLite y puedes revisar tus evaluaciones.
          </p>
        </div>
      ) : (
        <nav className="flex-1 p-4 space-y-1">
          {(role === "admin" || role === "teacher") && (
            <div className="mb-4 space-y-1">
              {role === "admin" && (
                <button
                  onClick={() => navigate("/admin")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    location.pathname === "/admin"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Administración</span>
                </button>
              )}
              <button
                onClick={() => navigate("/teacher")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  location.pathname === "/teacher"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Panel Profesor</span>
              </button>
              <div className="border-b border-sidebar-border my-3" />
            </div>
          )}

          {studentSteps.map((step) => {
            const isActive = paso === step.num;
            const isCompleted = paso > step.num;
            const isDisabled = paso < step.num;
            const Icon = step.icon;

            return (
              <button
                key={step.num}
                disabled={isDisabled}
                onClick={() => !isDisabled && navigate(step.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : isCompleted
                    ? "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 cursor-pointer"
                    : "text-sidebar-foreground/30 cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : isCompleted
                      ? "bg-success text-success-foreground"
                      : "bg-sidebar-border text-sidebar-foreground/30"
                  }`}
                >
                  {isCompleted ? "✓" : step.num}
                </div>
                <Icon className="w-4 h-4" />
                <span>{step.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      <div className="p-4 border-t border-sidebar-border">{renderUserInfo()}</div>
    </aside>
  );
}
