import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { AppLayout } from "@/components/AppLayout";
import { Brain } from "lucide-react";

const orientaciones = ["Psicoanalítica", "Cognitivo-Conductual", "Humanista"];

const Index = () => {
  const registrar = useAppStore((s) => s.registrar);
  const estudiante = useAppStore((s) => s.estudiante);
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (user && estudiante) {
      navigate('/casos');
      return;
    }
  }, [user, estudiante, navigate]);

  const [nombre, setNombre] = useState(estudiante?.nombre ?? "");
  const [orientacion, setOrientacion] = useState(estudiante?.orientacion ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !orientacion) return;
    registrar({ nombre: nombre.trim(), orientacion });
    navigate("/casos");
  };

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Brain className="w-8 h-8 text-primary" />
        </div>

        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground text-center mb-2">
          Bienvenido a SSPEC
        </h1>
        <p className="text-muted-foreground text-center mb-10 max-w-md">
          Sistema de Simulación de Pacientes para Entrenamiento Clínico.
          Practica entrevistas clínicas con pacientes simulados por IA.
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-5 bg-card border border-border rounded-xl p-6"
        >
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1.5">
              Tu nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ingresa tu nombre completo"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1.5">
              Orientación teórica
            </label>
            <select
              value={orientacion}
              onChange={(e) => setOrientacion(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
              required
            >
              <option value="">Selecciona una orientación</option>
              {orientaciones.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            Comenzar
          </button>
        </form>
      </div>
    </AppLayout>
  );
};

export default Index;
