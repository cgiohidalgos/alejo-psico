import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ChatBubble } from "@/components/ChatBubble";
import { ScoreCard } from "@/components/ScoreCard";
import { CaseData } from "@/data/cases";
import { httpRequest } from "@/lib/api";
import { Send, ArrowLeft, Loader2, Mail, UserPlus, Sparkles, FileText, BarChart3, CheckCircle, AlertTriangle } from "lucide-react";

interface Mensaje { role: "user" | "assistant"; content: string; }
interface Historia { motivo_consulta: string; historia_problema: string; antecedentes: string; impresion_diagnostica: string; }

const ORIENTACIONES = ["Psicoanalítica", "Cognitivo-Conductual", "Humanista"];
const MAX_PREGUNTAS = 10;
const CONTACTO = "alejandroriascosguerrero@udenar.edu.co";

const HIST_FIELDS: { key: keyof Historia; label: string; placeholder: string }[] = [
  { key: "motivo_consulta", label: "Motivo de Consulta", placeholder: "Motivo principal de consulta..." },
  { key: "historia_problema", label: "Historia del Problema Actual", placeholder: "Evolución y contexto del problema..." },
  { key: "antecedentes", label: "Antecedentes Relevantes", placeholder: "Antecedentes personales, familiares y sociales..." },
  { key: "impresion_diagnostica", label: "Impresión Diagnóstica", placeholder: "Tu hipótesis diagnóstica según la orientación..." },
];

const DIM_LABELS: Record<string, string> = {
  estructura_preguntas: "Estructura de Preguntas",
  tecnica_entrevista: "Técnica de Entrevista",
  apertura_emocional: "Apertura Emocional",
  adecuacion_contexto: "Adecuación al Contexto",
};

const GuestDemo = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"select" | "chat" | "historia" | "evaluacion">("select");
  const [casos, setCasos] = useState<CaseData[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [caso, setCaso] = useState<CaseData | null>(null);
  const [orientacion, setOrientacion] = useState("");
  const [modoCompleto, setModoCompleto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [historia, setHistoria] = useState<Historia>({ motivo_consulta: "", historia_problema: "", antecedentes: "", impresion_diagnostica: "" });
  const [evaluacion, setEvaluacion] = useState<any | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    httpRequest("/api/cases").then((data) => setCasos(data.cases || [])).catch(() => {}).finally(() => setLoadingCases(false));
  }, []);

  // Solo el primer caso (Psicoanalítica / María) permite el flujo completo
  const demoItems = ORIENTACIONES.map((o, i) => ({ orientacion: o, caso: casos[i] || casos[0] || null, full: i === 0 }));
  const preguntasHechas = mensajes.filter((m) => m.role === "user").length;
  const limiteAlcanzado = preguntasHechas >= MAX_PREGUNTAS;

  const selectCase = (o: string, c: CaseData, full: boolean) => {
    setCaso(c); setOrientacion(o); setModoCompleto(full);
    setMensajes([{ role: "assistant", content: c.presentacion }]);
    setStep("chat");
  };

  const send = async () => {
    if (!input.trim() || !caso || loading || limiteAlcanzado) return;
    const updated = [...mensajes, { role: "user", content: input.trim() } as Mensaje];
    setMensajes(updated); setInput(""); setLoading(true);
    try {
      const data = await httpRequest("/api/guest/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, caso, orientacion }),
      });
      setMensajes([...updated, { role: "assistant", content: data.response }]);
    } catch (err: any) {
      setMensajes([...updated, { role: "assistant", content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  };

  const histCompleta = Object.values(historia).every((v) => v.trim().length > 0);

  const evaluar = async () => {
    setStep("evaluacion");
    setEvalLoading(true); setError("");
    try {
      const data = await httpRequest("/api/guest/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: mensajes, orientacion, historia }),
      });
      setEvaluacion(data.evaluation);
    } catch (err: any) {
      setError(err.message || "Error al evaluar");
    }
    setEvalLoading(false);
  };

  const promedio = evaluacion
    ? ((evaluacion.estructura_preguntas.puntuacion + evaluacion.tecnica_entrevista.puntuacion + evaluacion.apertura_emocional.puntuacion + evaluacion.adecuacion_contexto.puntuacion) / 4).toFixed(1)
    : null;

  const mailtoInteres = `mailto:${CONTACTO}?subject=${encodeURIComponent("Me interesa Psiké")}&body=${encodeURIComponent("Hola Alejandro,\n\nProbé la demo completa de Psiké y me interesa. Me gustaría saber más / obtener acceso.\n\nGracias.")}`;

  const InteresPanel = () => (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center mt-6">
      <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
      <h3 className="font-serif text-xl font-bold mb-2">¿Te gustó la experiencia?</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
        Acabas de completar una simulación de demostración. Regístrate para practicar sin límites,
        guardar tus sesiones y llevar el seguimiento de tu progreso. Si te interesó Psiké, también puedes escribirnos.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={() => navigate("/auth")} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium">
          <UserPlus className="w-4 h-4" /> Registrarme
        </button>
        <a href={mailtoInteres} className="flex items-center justify-center gap-2 border border-primary text-primary px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/5">
          <Mail className="w-4 h-4" /> Me interesa, escribir
        </a>
      </div>
      <p className="text-xs text-muted-foreground mt-4">Contacto: {CONTACTO}</p>
    </div>
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-2xl font-bold">Demo (Invitado)</h2>
            <p className="text-sm text-muted-foreground">
              Prueba el proceso completo sin registro. Las sesiones no se guardan.
            </p>
          </div>
          <button onClick={() => navigate("/auth")} className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg">Registrarse</button>
        </div>

        {/* Pasos (solo modo completo) */}
        {step !== "select" && modoCompleto && (
          <div className="flex items-center gap-2 text-xs mb-5">
            {[["chat", "Entrevista"], ["historia", "Historia"], ["evaluacion", "Evaluación"]].map(([k, label], i) => (
              <span key={k} className={`px-2.5 py-1 rounded-full ${step === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
        )}

        {/* SELECT */}
        {step === "select" && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">Elige una orientación teórica para practicar la simulación completa:</p>
            {loadingCases ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {demoItems.map(({ orientacion: o, caso: c, full }) => (
                  <button key={o} onClick={() => c && selectCase(o, c, full)} disabled={!c}
                    className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary hover:shadow-sm transition-all disabled:opacity-50">
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-3">{o}</span>
                    <h3 className="font-medium mb-1">{c?.nombre || "Sin caso disponible"}</h3>
                    {c && <p className="text-sm text-muted-foreground mb-2">{c.edad} años · {c.motivo}</p>}
                    {full ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                        <Sparkles className="w-3 h-3" /> Se puede probar completo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        Prueba rápida · {MAX_PREGUNTAS} preguntas
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHAT */}
        {step === "chat" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { setStep("select"); setMensajes([]); setCaso(null); }} className="flex items-center gap-1 text-sm text-primary">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <span className="text-xs text-muted-foreground">{orientacion} · {preguntasHechas}/{MAX_PREGUNTAS} preguntas</span>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 mb-4 h-[45vh] overflow-y-auto space-y-3">
              {mensajes.map((m, i) => <ChatBubble key={i} msg={m} />)}
              {loading && <div className="text-sm text-muted-foreground animate-pulse">El paciente está respondiendo...</div>}
            </div>

            {!limiteAlcanzado && (
              <div className="flex gap-2 mb-3">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={`Escribe tu pregunta... (${MAX_PREGUNTAS - preguntasHechas} restantes)`}
                  className="flex-1 px-3 py-2 rounded-lg border border-input text-sm" />
                <button onClick={send} disabled={loading} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-50"><Send className="w-4 h-4" /></button>
              </div>
            )}

            {modoCompleto ? (
              <>
                {limiteAlcanzado && <p className="text-sm text-center text-muted-foreground mb-3">Llegaste al máximo de {MAX_PREGUNTAS} preguntas. Continúa con la historia clínica.</p>}
                <button onClick={() => setStep("historia")} disabled={preguntasHechas === 0}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  <FileText className="w-4 h-4" /> Continuar a la historia clínica
                </button>
              </>
            ) : (
              limiteAlcanzado && <InteresPanel />
            )}
          </div>
        )}

        {/* HISTORIA */}
        {step === "historia" && (
          <div>
            <button onClick={() => setStep("chat")} className="flex items-center gap-1 text-sm text-primary mb-4"><ArrowLeft className="w-4 h-4" /> Volver a la entrevista</button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
              <div>
                <h3 className="font-serif text-xl font-bold">Historia Clínica</h3>
                <p className="text-xs text-muted-foreground">Completa los campos basándote en la entrevista</p>
              </div>
            </div>
            <div className="space-y-4">
              {HIST_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium mb-1.5">{f.label} <span className="text-destructive">*</span></label>
                  <textarea value={historia[f.key]} onChange={(e) => setHistoria((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} rows={3} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm resize-y" />
                </div>
              ))}
              <button onClick={evaluar} disabled={!histCompleta}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg text-sm font-medium disabled:opacity-50">
                <BarChart3 className="w-4 h-4" /> Evaluar con IA
              </button>
            </div>
          </div>
        )}

        {/* EVALUACION */}
        {step === "evaluacion" && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-primary" /></div>
              <div>
                <h3 className="font-serif text-xl font-bold">Evaluación</h3>
                <p className="text-xs text-muted-foreground">Retroalimentación generada por IA sobre tu desempeño</p>
              </div>
            </div>

            {evalLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-3" /><p className="text-sm">Evaluando tu entrevista...</p>
              </div>
            )}
            {error && (
              <div className="text-center py-10">
                <p className="text-sm text-destructive mb-3">{error}</p>
                <button onClick={evaluar} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Reintentar</button>
              </div>
            )}

            {evaluacion && (
              <>
                <div className="bg-card border border-border rounded-xl p-6 mb-6 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Promedio General</p>
                  <p className="font-serif text-5xl font-bold text-primary">{promedio}</p>
                  <p className="text-xs text-muted-foreground mt-1">de 10.0</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 mb-6">
                  {Object.entries(DIM_LABELS).map(([key, label]) => {
                    const dim = evaluacion[key];
                    return <ScoreCard key={key} label={label} puntuacion={dim.puntuacion} comentario={dim.comentario} />;
                  })}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-success mb-3"><CheckCircle className="w-4 h-4" /> Fortalezas</h4>
                    <ul className="space-y-2">{(evaluacion.fortalezas || []).map((f: string, i: number) => <li key={i} className="text-xs leading-relaxed">• {f}</li>)}</ul>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-accent mb-3"><AlertTriangle className="w-4 h-4" /> Áreas de Mejora</h4>
                    <ul className="space-y-2">{(evaluacion.areas_mejora || []).map((a: string, i: number) => <li key={i} className="text-xs leading-relaxed">• {a}</li>)}</ul>
                  </div>
                </div>
                <InteresPanel />
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GuestDemo;
