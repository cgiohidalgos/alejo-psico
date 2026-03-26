import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { AppLayout } from "@/components/AppLayout";
import { ScoreCard } from "@/components/ScoreCard";
import { BarChart3, RefreshCw, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

const dimensionLabels: Record<string, string> = {
  estructura_preguntas: "Estructura de Preguntas",
  tecnica_entrevista: "Técnica de Entrevista",
  apertura_emocional: "Apertura Emocional",
  adecuacion_contexto: "Adecuación al Contexto",
};

const EvaluationPage = () => {
  const { sesion, estudiante, guardarEvaluacion, nuevoCaso, user } = useAppStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sesion.historia || !estudiante) {
      navigate("/casos");
      return;
    }
    if (!sesion.evaluacion) {
      fetchEvaluation();
    }
  }, []);

  const fetchEvaluation = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!sesion.caso || !sesion.historia || !estudiante) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          type: "evaluation",
          messages: sesion.mensajes.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
          caso: sesion.caso,
          orientacion: estudiante.orientacion,
          historia: sesion.historia,
          estudiante_nombre: estudiante.nombre,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error API evaluation");
      guardarEvaluacion(data.evaluation);

      // Guardado local en backend SQLite
      await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          estudiante_nombre: estudiante?.nombre || '',
          orientacion: estudiante?.orientacion || '',
          caso: sesion.caso,
          mensajes: sesion.mensajes,
          historia: sesion.historia,
          evaluacion: data.evaluation,
        }),
      });
    } catch (err) {
      console.error(err);
      setError("Error al obtener la evaluación. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const ev = sesion.evaluacion;

  const promedio = ev
    ? (
        (ev.estructura_preguntas.puntuacion +
          ev.tecnica_entrevista.puntuacion +
          ev.apertura_emocional.puntuacion +
          ev.adecuacion_contexto.puntuacion) /
        4
      ).toFixed(1)
    : null;

  const handleNewCase = () => {
    nuevoCaso();
    navigate("/casos");
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Evaluación
            </h2>
            <p className="text-xs text-muted-foreground">
              Retroalimentación generada por IA sobre tu desempeño
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Evaluando tu entrevista...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-10">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <button
              onClick={fetchEvaluation}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition"
            >
              Reintentar
            </button>
          </div>
        )}

        {ev && (
          <>
            {/* Average */}
            <div className="bg-card border border-border rounded-xl p-6 mb-6 text-center">
              <p className="text-sm text-muted-foreground mb-1">Promedio General</p>
              <p className="font-serif text-5xl font-bold text-primary">{promedio}</p>
              <p className="text-xs text-muted-foreground mt-1">de 10.0</p>
            </div>

            {/* Scores grid */}
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              {Object.entries(dimensionLabels).map(([key, label]) => {
                const dim = ev[key as keyof typeof ev] as { puntuacion: number; comentario: string };
                return (
                  <ScoreCard
                    key={key}
                    label={label}
                    puntuacion={dim.puntuacion}
                    comentario={dim.comentario}
                  />
                );
              })}
            </div>

            {/* Strengths & improvements */}
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              <div className="bg-card border border-border rounded-xl p-5">
                <h4 className="flex items-center gap-2 text-sm font-medium text-success mb-3">
                  <CheckCircle className="w-4 h-4" /> Fortalezas
                </h4>
                <ul className="space-y-2">
                  {ev.fortalezas.map((f, i) => (
                    <li key={i} className="text-xs text-card-foreground leading-relaxed">
                      • {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <h4 className="flex items-center gap-2 text-sm font-medium text-accent mb-3">
                  <AlertTriangle className="w-4 h-4" /> Áreas de Mejora
                </h4>
                <ul className="space-y-2">
                  {ev.areas_mejora.map((a, i) => (
                    <li key={i} className="text-xs text-card-foreground leading-relaxed">
                      • {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={handleNewCase}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Nuevo Caso
            </button>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default EvaluationPage;
