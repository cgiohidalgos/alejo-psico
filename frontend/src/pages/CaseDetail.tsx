import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { AppLayout } from "@/components/AppLayout";
import { CaseData, DIFICULTADES, CATEGORIAS } from "@/data/cases";
import { httpRequest, withAuth } from "@/lib/api";
import { ArrowLeft, User, Target, Brain, Heart, Users, Stethoscope, BookOpen } from "lucide-react";

const CaseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const user = useAppStore((s) => s.user);
  const seleccionarCaso = useAppStore((s) => s.seleccionarCaso);
  const navigate = useNavigate();
  const [caso, setCaso] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadCase();
  }, [id, user]);

  const loadCase = async () => {
    if (!user || !id) return;
    setLoading(true);
    try {
      const data = await httpRequest(`/api/cases/${id}`, withAuth(user.token));
      setCaso(data.case);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleStart = () => {
    if (!caso) return;
    seleccionarCaso(caso);
    navigate("/entrevista");
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Cargando caso...</div></AppLayout>;
  if (error || !caso) return <AppLayout><div className="text-center py-20 text-red-500">{error || "Caso no encontrado"}</div></AppLayout>;

  const dif = DIFICULTADES.find((d) => d.value === caso.dificultad);
  const cat = CATEGORIAS.find((c) => c.value === caso.categoria);

  const sections = [
    { icon: Brain, title: "Contexto clínico", content: caso.contexto, show: true },
    { icon: User, title: "Personalidad", content: caso.personalidad, show: !!caso.personalidad },
    { icon: Stethoscope, title: "Antecedentes médicos", content: caso.antecedentes_medicos, show: !!caso.antecedentes_medicos },
    { icon: Users, title: "Dinámica familiar", content: caso.dinamica_familiar, show: !!caso.dinamica_familiar },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in max-w-3xl">
        {/* Back */}
        <button onClick={() => navigate("/casos")} className="flex items-center gap-1 text-sm text-primary mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver al catálogo
        </button>

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="font-serif text-2xl font-bold">{caso.nombre}</h1>
                <span className="text-sm text-muted-foreground">({caso.edad} años{caso.genero !== 'otro' ? `, ${caso.genero}` : ''})</span>
              </div>
              <p className="text-muted-foreground mb-3">{caso.motivo}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {dif && <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dif.color}`}>{dif.label}</span>}
                {cat && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">{cat.label}</span>}
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground capitalize">Caso {caso.tipo}</span>
                {caso.tags?.map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">{tag}</span>
                ))}
              </div>

              {/* Presentación (quote) */}
              <div className="bg-muted/30 border-l-4 border-primary/40 rounded-r-lg px-4 py-3">
                <p className="text-sm italic text-foreground/80">"{caso.presentacion}"</p>
                <p className="text-[10px] text-muted-foreground mt-1">— Frase de apertura del paciente</p>
              </div>
            </div>
          </div>
        </div>

        {/* Objetivos de aprendizaje */}
        {caso.objetivos?.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <h3 className="flex items-center gap-2 font-semibold text-sm mb-3">
              <Target className="w-4 h-4 text-primary" />
              Objetivos de aprendizaje
            </h3>
            <ul className="space-y-2">
              {caso.objetivos.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold">{i + 1}</span>
                  {obj}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Secciones de información */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {sections.filter(s => s.show).map((section) => (
            <div key={section.title} className="bg-card border border-border rounded-xl p-5">
              <h3 className="flex items-center gap-2 font-semibold text-sm mb-2">
                <section.icon className="w-4 h-4 text-primary" />
                {section.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>

        {/* Notas docente (solo teacher/admin) */}
        {caso.notas_docente && (user?.role === 'teacher' || user?.role === 'admin') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <h3 className="flex items-center gap-2 font-semibold text-sm mb-2 text-amber-800">
              <BookOpen className="w-4 h-4" />
              Notas para el docente
            </h3>
            <p className="text-xs text-amber-700 leading-relaxed">{caso.notas_docente}</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleStart}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
        >
          <Heart className="w-4 h-4" />
          Iniciar entrevista con {caso.nombre}
        </button>
      </div>
    </AppLayout>
  );
};

export default CaseDetailPage;
