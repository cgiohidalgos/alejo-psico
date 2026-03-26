import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, HistoriaClinica } from "@/stores/useAppStore";
import { AppLayout } from "@/components/AppLayout";
import { FileText } from "lucide-react";
import { useEffect } from "react";

const fields: { key: keyof HistoriaClinica; label: string; placeholder: string }[] = [
  {
    key: "motivo_consulta",
    label: "Motivo de Consulta",
    placeholder: "Describe el motivo principal de consulta del paciente...",
  },
  {
    key: "historia_problema",
    label: "Historia del Problema Actual",
    placeholder: "Narra la evolución y contexto del problema presentado...",
  },
  {
    key: "antecedentes",
    label: "Antecedentes Relevantes",
    placeholder: "Incluye antecedentes personales, familiares y sociales relevantes...",
  },
  {
    key: "impresion_diagnostica",
    label: "Impresión Diagnóstica",
    placeholder: "Plantea tu hipótesis diagnóstica según tu orientación teórica...",
  },
];

const ClinicalHistoryPage = () => {
  const { sesion, guardarHistoria, estudiante } = useAppStore();
  const navigate = useNavigate();

  const [form, setForm] = useState<HistoriaClinica>(
    sesion.historia ?? {
      motivo_consulta: "",
      historia_problema: "",
      antecedentes: "",
      impresion_diagnostica: "",
    }
  );

  useEffect(() => {
    if (!sesion.chatFinalizado || !estudiante) navigate("/casos");
  }, [sesion.chatFinalizado, estudiante, navigate]);

  const allFilled = Object.values(form).every((v) => v.trim().length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled) return;
    guardarHistoria(form);
    navigate("/evaluacion");
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Historia Clínica
            </h2>
            <p className="text-xs text-muted-foreground">
              Completa los campos basándote en la entrevista realizada
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {f.label} <span className="text-destructive">*</span>
              </label>
              <textarea
                value={form[f.key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
                placeholder={f.placeholder}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition resize-y"
                required
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={!allFilled}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            Evaluar con IA
          </button>
        </form>
      </div>
    </AppLayout>
  );
};

export default ClinicalHistoryPage;
