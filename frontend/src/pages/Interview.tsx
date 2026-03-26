import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { AppLayout } from "@/components/AppLayout";
import { ChatBubble, TypingIndicator } from "@/components/ChatBubble";
import { Send, Square } from "lucide-react";

const InterviewPage = () => {
  const { sesion, estudiante, agregarMensaje, finalizarChat, user } = useAppStore();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sesion.caso || !estudiante) navigate("/casos");
  }, [sesion.caso, estudiante, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sesion.mensajes, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !sesion.caso || !estudiante) return;

    const userMsg = input.trim();
    setInput("");
    agregarMensaje({ role: "user", content: userMsg });
    setLoading(true);

    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          type: "interview",
          messages: [
            ...sesion.mensajes.map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            })),
            { role: "user", content: userMsg },
          ],
          caso: sesion.caso,
          orientacion: estudiante.orientacion,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error API chat");
      agregarMensaje({ role: "assistant", content: data.response });
    } catch (err) {
      console.error(err);
      agregarMensaje({
        role: "assistant",
        content: "Lo siento, hubo un error en la conexión. ¿Podría repetir?",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFinish = () => {
    finalizarChat();
    navigate("/historia");
  };

  if (!sesion.caso) return null;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">
              Entrevista con {sesion.caso.nombre}
            </h2>
            <p className="text-xs text-muted-foreground">
              {sesion.caso.edad} años — {sesion.caso.motivo}
            </p>
          </div>
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <Square className="w-3 h-3" />
            Finalizar
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {sesion.mensajes.map((msg, i) => (
            <ChatBubble key={i} msg={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu intervención..."
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default InterviewPage;
