import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { httpRequest, withAuth } from "@/lib/api";
import { Brain, BarChart3, Award, ClipboardList, GraduationCap } from "lucide-react";

interface Quota { orientacion: string; max: number; used: number; remaining: number; }
interface Dimension { dimension: string; promedio: number | null; }
interface Metrics { total_sessions: number; avg_score: number | null; best_score: number | null; dimensions: Dimension[]; }

const DIM_LABELS: Record<string, string> = {
  estructura_preguntas: "Estructura",
  tecnica_entrevista: "Técnica",
  apertura_emocional: "Apertura emocional",
  adecuacion_contexto: "Contexto",
};

const ORIENTACIONES = ["Psicoanalítica", "Cognitivo-Conductual", "Humanista"];

const Index = () => {
  const registrar = useAppStore((s) => s.registrar);
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  const privileged = user?.role === "admin" || user?.role === "teacher";

  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orientacion, setOrientacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (privileged) { setLoading(false); return; }
    httpRequest("/api/student/dashboard", withAuth(user.token))
      .then((data) => {
        setQuotas(data.quotas || []);
        setMetrics(data.metrics || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const disponibles = quotas.filter((q) => q.remaining > 0);

  const comenzar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orientacion || !user) return;
    registrar({ nombre: user.name, orientacion });
    navigate("/casos");
  };

  // Vista para admin/profesor: simulación libre (cualquier caso, sin cupos)
  if (privileged) {
    return (
      <AppLayout>
        <div className="animate-fade-in max-w-md mx-auto">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Brain className="w-7 h-7 text-primary" />
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold">Modo simulación</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Como {user?.role === "admin" ? "administrador" : "profesor"} puedes practicar cualquier caso sin límite de cupos.
            </p>
          </div>

          <form onSubmit={comenzar} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Orientación teórica</label>
              <select
                value={orientacion}
                onChange={(e) => setOrientacion(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Selecciona una orientación</option>
                {ORIENTACIONES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition">
              Elegir caso y comenzar
            </button>
          </form>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fade-in max-w-5xl mx-auto">
        {/* Encabezado */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">
              Hola, {user?.name}
            </h1>
            <p className="text-sm text-muted-foreground">Tu progreso en la simulación clínica</p>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={ClipboardList} label="Entrevistas realizadas" value={loading ? "…" : metrics?.total_sessions ?? 0} />
          <StatCard icon={BarChart3} label="Puntaje promedio"
            value={loading ? "…" : metrics?.avg_score != null ? `${metrics.avg_score}/10` : "–"}
            accent="bg-emerald-500/10 text-emerald-600" />
          <StatCard icon={Award} label="Mejor puntaje"
            value={loading ? "…" : metrics?.best_score != null ? `${metrics.best_score}/10` : "–"}
            accent="bg-amber-500/10 text-amber-600" />
          <StatCard icon={GraduationCap} label="Orientaciones disponibles" value={loading ? "…" : disponibles.length}
            accent="bg-blue-500/10 text-blue-600" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Panel: comenzar entrevista */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-1">Nueva entrevista</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Elige una de las orientaciones que te asignó tu profesor.
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : quotas.length === 0 ? (
              <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground">
                Tu profesor aún no te ha asignado entrevistas. Vuelve más tarde.
              </div>
            ) : disponibles.length === 0 ? (
              <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground">
                Ya usaste todas tus entrevistas asignadas. Contacta a tu profesor para más cupos.
              </div>
            ) : (
              <form onSubmit={comenzar} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Orientación teórica</label>
                  <select
                    value={orientacion}
                    onChange={(e) => setOrientacion(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">Selecciona una orientación</option>
                    {disponibles.map((q) => (
                      <option key={q.orientacion} value={q.orientacion}>
                        {q.orientacion} ({q.remaining} disponible{q.remaining !== 1 ? "s" : ""})
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition">
                  Comenzar
                </button>
              </form>
            )}
          </div>

          {/* Panel: cupos por orientación */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Cupos por orientación</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : quotas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin cupos asignados.</p>
            ) : (
              <div className="space-y-4">
                {quotas.map((q) => {
                  const pct = q.max ? Math.min(100, (q.used / q.max) * 100) : 0;
                  return (
                    <div key={q.orientacion}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{q.orientacion}</span>
                        <span className="text-muted-foreground">{q.used}/{q.max}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${q.remaining > 0 ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Promedios por dimensión */}
        {!loading && metrics && metrics.total_sessions > 0 && (
          <div className="bg-card border border-border rounded-xl p-6 mt-6">
            <h2 className="font-semibold mb-4">Promedio por dimensión</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {metrics.dimensions.map((d) => (
                <div key={d.dimension} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-2xl font-bold tabular-nums">{d.promedio != null ? d.promedio : "–"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{DIM_LABELS[d.dimension] || d.dimension}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
