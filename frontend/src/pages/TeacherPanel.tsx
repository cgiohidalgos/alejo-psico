import { useEffect, useState, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useNavigate } from "react-router-dom";
import { httpRequest, withAuth } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { CaseForm } from "@/components/CaseForm";
import { DIFICULTADES, CATEGORIAS } from "@/data/cases";
import { Users, BarChart3, BookOpen, Eye, Plus, Edit2, Copy, Download, Upload } from "lucide-react";

interface StudentRow { id: number; name: string; email: string; created_at: string; }
interface SessionRow { id: number; user_id: number; estudiante_nombre: string; orientacion: string; caso: any; evaluacion: any; created_at: string; }

type Tab = "students" | "sessions" | "cases";

const TeacherPanel = () => {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("students");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [viewSession, setViewSession] = useState<SessionRow | null>(null);

  // Case editing
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [editingCase, setEditingCase] = useState<any | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "admin")) { navigate("/auth"); return; }
    loadData();
  }, [user, tab, selectedStudent]);

  const loadData = async () => {
    if (!user) return;
    setError("");
    try {
      if (tab === "students") {
        const data = await httpRequest("/api/teacher/students", withAuth(user.token));
        setStudents(data.students);
      } else if (tab === "sessions") {
        const url = selectedStudent ? `/api/teacher/sessions?user_id=${selectedStudent}` : "/api/teacher/sessions";
        const data = await httpRequest(url, withAuth(user.token));
        setSessions(data.sessions);
      } else if (tab === "cases") {
        const data = await httpRequest("/api/cases?stats=1", withAuth(user.token));
        setCases(data.cases);
      }
    } catch (err: any) { setError(err.message); }
  };

  const handleCreateCase = async (data: any) => {
    if (!user) return;
    await httpRequest("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
      body: JSON.stringify(data),
    });
    setShowCreateCase(false);
    loadData();
  };

  const handleUpdateCase = async (data: any) => {
    if (!user || !editingCase) return;
    await httpRequest(`/api/cases/${editingCase.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
      body: JSON.stringify(data),
    });
    setEditingCase(null);
    loadData();
  };

  const handleDuplicate = async (id: number) => {
    if (!user) return;
    try {
      await httpRequest(`/api/cases/${id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      loadData();
    } catch (err: any) { setError(err.message); }
  };

  const handleExport = async (id: number) => {
    if (!user) return;
    try {
      const data = await httpRequest(`/api/cases/${id}/export`, withAuth(user.token));
      const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caso-${data.export.slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { setError(err.message); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    try {
      const text = await e.target.files[0].text();
      const data = JSON.parse(text);
      await httpRequest("/api/cases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(data),
      });
      loadData();
    } catch (err: any) { setError(err.message); }
    if (importRef.current) importRef.current.value = "";
  };

  const avgScore = (ev: any) => {
    if (!ev) return "-";
    const scores = [ev.estructura_preguntas?.puntuacion, ev.tecnica_entrevista?.puntuacion, ev.apertura_emocional?.puntuacion, ev.adecuacion_contexto?.puntuacion].filter((s) => typeof s === "number");
    if (scores.length === 0) return "-";
    return (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1);
  };

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "students", label: "Estudiantes", icon: Users },
    { key: "sessions", label: "Sesiones", icon: BarChart3 },
    { key: "cases", label: "Casos", icon: BookOpen },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-2xl font-bold">Panel del Profesor</h2>
            <p className="text-sm text-muted-foreground">Seguimiento de estudiantes, sesiones y gestión de casos</p>
          </div>
          <button onClick={() => navigate("/casos")} className="text-sm text-primary underline">Ir a simulación</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border pb-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setViewSession(null); setShowCreateCase(false); setEditingCase(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* STUDENTS */}
        {tab === "students" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2">Nombre</th>
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Registrado</th>
                  <th className="text-right px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.email}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setSelectedStudent(s.id); setTab("sessions"); }} className="text-primary text-xs underline">Ver sesiones</button>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Sin estudiantes registrados</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* SESSIONS */}
        {tab === "sessions" && !viewSession && (
          <div>
            {selectedStudent && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filtrando por:</span>
                <span className="text-sm font-medium">{students.find((s) => s.id === selectedStudent)?.name || `#${selectedStudent}`}</span>
                <button onClick={() => setSelectedStudent(null)} className="text-xs text-red-500 underline">Quitar filtro</button>
              </div>
            )}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2">Estudiante</th>
                    <th className="text-left px-4 py-2">Caso</th>
                    <th className="text-left px-4 py-2">Orientación</th>
                    <th className="text-left px-4 py-2">Puntaje</th>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-right px-4 py-2">Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{s.estudiante_nombre || "-"}</td>
                      <td className="px-4 py-2">{s.caso?.nombre || "-"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s.orientacion || "-"}</td>
                      <td className="px-4 py-2"><span className="font-semibold">{avgScore(s.evaluacion)}</span><span className="text-muted-foreground">/10</span></td>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-right"><button onClick={() => setViewSession(s)} className="text-primary"><Eye className="w-4 h-4 inline" /></button></td>
                    </tr>
                  ))}
                  {sessions.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sin sesiones</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SESSION DETAIL */}
        {tab === "sessions" && viewSession && (
          <div>
            <button onClick={() => setViewSession(null)} className="text-sm text-primary underline mb-4">&larr; Volver a sesiones</button>
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Estudiante:</span> <span className="font-medium">{viewSession.estudiante_nombre}</span></div>
                <div><span className="text-muted-foreground">Caso:</span> <span className="font-medium">{viewSession.caso?.nombre}</span></div>
                <div><span className="text-muted-foreground">Orientación:</span> <span className="font-medium">{viewSession.orientacion}</span></div>
                <div><span className="text-muted-foreground">Puntaje promedio:</span> <span className="font-semibold">{avgScore(viewSession.evaluacion)}/10</span></div>
              </div>
              {viewSession.evaluacion && (
                <div>
                  <h4 className="font-semibold mb-2">Evaluación</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {["estructura_preguntas", "tecnica_entrevista", "apertura_emocional", "adecuacion_contexto"].map((key) => {
                      const dim = (viewSession.evaluacion as any)?.[key];
                      if (!dim) return null;
                      const labels: Record<string, string> = { estructura_preguntas: "Estructura", tecnica_entrevista: "Técnica", apertura_emocional: "Apertura emocional", adecuacion_contexto: "Contexto" };
                      return (
                        <div key={key} className="bg-muted/30 rounded-lg p-3">
                          <div className="flex justify-between text-sm mb-1"><span>{labels[key]}</span><span className="font-semibold">{dim.puntuacion}/10</span></div>
                          <p className="text-xs text-muted-foreground">{dim.comentario}</p>
                        </div>
                      );
                    })}
                  </div>
                  {viewSession.evaluacion.fortalezas && (
                    <div className="mt-3"><h5 className="text-sm font-medium mb-1">Fortalezas</h5><ul className="text-sm text-muted-foreground list-disc list-inside">{viewSession.evaluacion.fortalezas.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul></div>
                  )}
                  {viewSession.evaluacion.areas_mejora && (
                    <div className="mt-3"><h5 className="text-sm font-medium mb-1">Áreas de mejora</h5><ul className="text-sm text-muted-foreground list-disc list-inside">{viewSession.evaluacion.areas_mejora.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul></div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CASES */}
        {tab === "cases" && (
          <div>
            {/* Header con acciones */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{cases.length} casos clínicos</h3>
              <div className="flex gap-2">
                <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                <button onClick={() => importRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted">
                  <Upload className="w-3.5 h-3.5" /> Importar
                </button>
                <button onClick={() => { setShowCreateCase(true); setEditingCase(null); }} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">
                  <Plus className="w-4 h-4" /> Crear caso
                </button>
              </div>
            </div>

            {/* Create form */}
            {showCreateCase && !editingCase && (
              <div className="mb-4">
                <CaseForm title="Nuevo caso clínico" onSave={handleCreateCase} onCancel={() => setShowCreateCase(false)} />
              </div>
            )}

            {/* Edit form */}
            {editingCase && (
              <div className="mb-4">
                <CaseForm title={`Editar: ${editingCase.nombre}`} initial={editingCase} onSave={handleUpdateCase} onCancel={() => setEditingCase(null)} />
              </div>
            )}

            {/* Cases list */}
            <div className="space-y-3">
              {cases.map((c: any) => {
                const dif = DIFICULTADES.find((d) => d.value === c.dificultad);
                const cat = CATEGORIAS.find((ct) => ct.value === c.categoria);
                return (
                  <div key={c.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-medium">{c.nombre}</h4>
                          <span className="text-xs text-muted-foreground">({c.edad} años)</span>
                          {dif && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dif.color}`}>{dif.label}</span>}
                          {cat && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{cat.label}</span>}
                          {c.is_public ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">Público</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Privado</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{c.motivo}</p>
                        {c.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {c.tags.map((t: string) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>)}
                          </div>
                        )}
                        {/* Stats */}
                        {c.stats && (
                          <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span>{c.stats.total_sessions} sesiones</span>
                            {c.stats.avg_score && <span>Promedio: {c.stats.avg_score}/10</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button onClick={() => { setEditingCase(c); setShowCreateCase(false); }} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded" title="Editar">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDuplicate(c.id)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded" title="Duplicar">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleExport(c.id)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded" title="Exportar JSON">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {cases.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No hay casos en la base de datos.</p>}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TeacherPanel;
