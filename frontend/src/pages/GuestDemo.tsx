import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ChatBubble } from "@/components/ChatBubble";
import { CaseData } from "@/data/cases";
import { CaseCard } from "@/components/CaseCard";
import { httpRequest } from "@/lib/api";
import { Send, ArrowLeft, Loader2 } from "lucide-react";

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

const ORIENTACIONES = ["Psicoanalítica", "Cognitivo-Conductual", "Humanista"];

const GuestDemo = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"select" | "chat">("select");
  const [casos, setCasos] = useState<CaseData[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [caso, setCaso] = useState<CaseData | null>(null);
  const [orientacion, setOrientacion] = useState(ORIENTACIONES[2]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    httpRequest("/api/cases").then((data) => setCasos(data.cases || [])).catch(() => {}).finally(() => setLoadingCases(false));
  }, []);

  const selectCase = (c: CaseData) => {
    setCaso(c);
    setMensajes([{ role: "assistant", content: c.presentacion }]);
    setStep("chat");
  };

  const send = async () => {
    if (!input.trim() || !caso || loading) return;
    const newMsg: Mensaje = { role: "user", content: input.trim() };
    const updated = [...mensajes, newMsg];
    setMensajes(updated);
    setInput("");
    setLoading(true);

    try {
      const data = await httpRequest("/api/guest/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, caso, orientacion }),
      });
      setMensajes([...updated, { role: "assistant", content: data.response }]);
    } catch (err: any) {
      setMensajes([...updated, { role: "assistant", content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-2xl font-bold">Demo (Invitado)</h2>
            <p className="text-sm text-muted-foreground">
              Prueba la entrevista sin registro. Las sesiones no se guardan.
            </p>
          </div>
          <button onClick={() => navigate("/auth")} className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg">
            Registrarse
          </button>
        </div>

        {step === "select" && (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Orientación teórica</label>
              <div className="flex gap-2">
                {ORIENTACIONES.map((o) => (
                  <button
                    key={o}
                    onClick={() => setOrientacion(o)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      orientacion === o
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            {loadingCases ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {casos.map((c) => (
                  <CaseCard key={c.id} caso={c} onSelect={() => selectCase(c)} />
                ))}
              </div>
            )}
          </div>
        )}

        {step === "chat" && (
          <div>
            <button onClick={() => { setStep("select"); setMensajes([]); setCaso(null); }} className="flex items-center gap-1 text-sm text-primary mb-4">
              <ArrowLeft className="w-4 h-4" /> Volver a casos
            </button>

            <div className="bg-card border border-border rounded-xl p-4 mb-4 h-[50vh] overflow-y-auto space-y-3">
              {mensajes.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} />
              ))}
              {loading && (
                <div className="text-sm text-muted-foreground animate-pulse">El paciente está respondiendo...</div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Escribe tu pregunta..."
                className="flex-1 px-3 py-2 rounded-lg border border-input text-sm"
              />
              <button onClick={send} disabled={loading} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GuestDemo;
