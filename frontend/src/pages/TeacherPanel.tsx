import { useEffect, useState, useRef, Fragment } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useNavigate } from "react-router-dom";
import { httpRequest, withAuth } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { CaseForm } from "@/components/CaseForm";
import { AiCaseButton } from "@/components/AiCaseButton";
import { StatCard } from "@/components/StatCard";
import { DIFICULTADES, CATEGORIAS } from "@/data/cases";
import { Users, BarChart3, BookOpen, Eye, Plus, Edit2, Copy, Download, Upload, Award, FileSpreadsheet, Save, X, Trash2, SlidersHorizontal } from "lucide-react";
import * as XLSX from "xlsx";

const ORIENTACIONES = ["Psicoanalítica", "Cognitivo-Conductual", "Humanista"];

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
  const [stats, setStats] = useState<{ students: number; sessions: number; avg: string; cases: number } | null>(null);
  const [editingStudent, setEditingStudent] = useState<number | null>(null);
  const [studentEdit, setStudentEdit] = useState({ name: "", email: "", password: "" });
  const [quotaStudent, setQuotaStudent] = useState<number | null>(null);
  const [quotaData, setQuotaData] = useState<Record<string, number>>({});
  const [quotaUsed, setQuotaUsed] = useState<Record<string, number>>({});
  const [showBulk, setShowBulk] = useState(false);
  const [bulkData, setBulkData] = useState<Record<string, number>>({});
  const [bulkMsg, setBulkMsg] = useState("");

  // Case editing
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [editingCase, setEditingCase] = useState<any | null>(null);
  const [createInitial, setCreateInitial] = useState<any | null>(null);
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
    loadStats();
  };

  const loadStats = async () => {
    if (!user) return;
    try {
      const [st, se, ca] = await Promise.all([
        httpRequest("/api/teacher/students", withAuth(user.token)),
        httpRequest("/api/teacher/sessions", withAuth(user.token)),
        httpRequest("/api/cases", withAuth(user.token)),
      ]);
      const sess: SessionRow[] = se.sessions || [];
      const nums = sess.map((s) => Number(avgScore(s.evaluacion))).filter((n) => !isNaN(n));
      const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "–";
      setStats({
        students: (st.students || []).length,
        sessions: sess.length,
        avg,
        cases: (ca.cases || []).length,
      });
    } catch {
      /* KPIs informativos */
    }
  };

  const handleUpdateStudent = async (id: number) => {
    if (!user) return;
    try {
      await httpRequest(`/api/teacher/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(studentEdit),
      });
      setEditingStudent(null);
      loadData();
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteStudent = async (id: number) => {
    if (!user || !confirm("¿Eliminar este estudiante y todas sus sesiones?")) return;
    try {
      await httpRequest(`/api/teacher/students/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      loadData();
    } catch (err: any) { setError(err.message); }
  };

  const openQuotas = async (id: number) => {
    if (!user) return;
    setEditingStudent(null);
    setQuotaStudent(id);
    setQuotaData({});
    setQuotaUsed({});
    try {
      const data = await httpRequest(`/api/teacher/students/${id}/quotas`, withAuth(user.token));
      const map: Record<string, number> = {};
      const used: Record<string, number> = {};
      (data.quotas || []).forEach((q: any) => { map[q.orientacion] = q.max; used[q.orientacion] = q.used; });
      setQuotaData(map);
      setQuotaUsed(used);
    } catch (err: any) { setError(err.message); }
  };

  const saveQuotas = async (id: number) => {
    if (!user) return;
    const quotas = ORIENTACIONES
      .map((o) => ({ orientacion: o, max_count: Number(quotaData[o]) || 0 }))
      .filter((q) => q.max_count > 0);
    try {
      await httpRequest(`/api/teacher/students/${id}/quotas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ quotas }),
      });
      setQuotaStudent(null);
    } catch (err: any) { setError(err.message); }
  };

  const saveBulkQuotas = async () => {
    if (!user) return;
    const quotas = ORIENTACIONES
      .map((o) => ({ orientacion: o, max_count: Number(bulkData[o]) || 0 }))
      .filter((q) => q.max_count > 0);
    if (quotas.length === 0) { setBulkMsg("Indica al menos una cantidad."); return; }
    try {
      const res = await httpRequest("/api/teacher/students/quotas/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ quotas }),
      });
      setBulkMsg(`Cupos asignados a ${res.updated} estudiante(s).`);
      setBulkData({});
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteSession = async (id: number) => {
    if (!user || !confirm("¿Eliminar esta sesión? No se puede deshacer.")) return;
    try {
      await httpRequest(`/api/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (viewSession?.id === id) setViewSession(null);
      loadData();
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
    setCreateInitial(null);
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

  const handleExportSessions = () => {
    if (sessions.length === 0) return;
    const rows = sessions.map((s) => {
      const ev = s.evaluacion || {};
      return {
        "Estudiante": s.estudiante_nombre || "-",
        "Caso": s.caso?.nombre || "-",
        "Orientación": s.orientacion || "-",
        "Puntaje promedio": avgScore(s.evaluacion),
        "Estructura": ev.estructura_preguntas?.puntuacion ?? "-",
        "Técnica": ev.tecnica_entrevista?.puntuacion ?? "-",
        "Apertura emocional": ev.apertura_emocional?.puntuacion ?? "-",
        "Contexto": ev.adecuacion_contexto?.puntuacion ?? "-",
        "Fortalezas": Array.isArray(ev.fortalezas) ? ev.fortalezas.join("; ") : "",
        "Áreas de mejora": Array.isArray(ev.areas_mejora) ? ev.areas_mejora.join("; ") : "",
        "Fecha": new Date(s.created_at).toLocaleString(),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 10 },
      { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 40 }, { wch: 40 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sesiones");
    const filtro = selectedStudent ? `-${students.find((s) => s.id === selectedStudent)?.name || selectedStudent}` : "";
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `sesiones${filtro}-${fecha}.xlsx`);
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
          <button onClick={() => navigate("/")} className="text-sm text-primary underline">Ir a simulación</button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Users} label="Estudiantes" value={stats ? stats.students : "–"} />
          <StatCard icon={BarChart3} label="Sesiones" value={stats ? stats.sessions : "–"}
            accent="bg-emerald-500/10 text-emerald-600" />
          <StatCard icon={Award} label="Puntaje promedio" value={stats ? `${stats.avg}${stats.avg !== "–" ? "/10" : ""}` : "–"}
            accent="bg-amber-500/10 text-amber-600" />
          <StatCard icon={BookOpen} label="Casos disponibles" value={stats ? stats.cases : "–"}
            accent="bg-blue-500/10 text-blue-600" />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-muted/50 p-1 rounded-xl w-fit">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setViewSession(null); setShowCreateCase(false); setEditingCase(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* STUDENTS */}
        {tab === "students" && (
          <div>
          {/* Asignación masiva */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">{students.length} estudiantes</h3>
              <button
                onClick={() => { setShowBulk(!showBulk); setBulkMsg(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm"
              >
                <SlidersHorizontal className="w-4 h-4" /> Asignar cupos a todos
              </button>
            </div>
            {showBulk && (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Asigna estas cantidades a <span className="font-medium">todos tus estudiantes</span>. Sobrescribe el cupo de cada orientación indicada (deja en blanco las que no quieras cambiar).
                </p>
                <div className="grid sm:grid-cols-3 gap-3 mb-3">
                  {ORIENTACIONES.map((o) => (
                    <div key={o}>
                      <label className="block text-xs font-medium mb-1">{o}</label>
                      <input type="number" min={0} value={bulkData[o] ?? ""} onChange={(e) => setBulkData({ ...bulkData, [o]: Number(e.target.value) })} placeholder="—" className="w-full px-2 py-1.5 border border-input rounded text-sm" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={saveBulkQuotas} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">Aplicar a todos</button>
                  <button onClick={() => setShowBulk(false)} className="text-sm text-muted-foreground">Cerrar</button>
                  {bulkMsg && <span className="text-sm text-emerald-600">{bulkMsg}</span>}
                </div>
              </div>
            )}
          </div>

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
                  <Fragment key={s.id}>
                  <tr className="border-t border-border">
                    {editingStudent === s.id ? (
                      <>
                        <td className="px-4 py-2"><input value={studentEdit.name} onChange={(e) => setStudentEdit({ ...studentEdit, name: e.target.value })} className="px-2 py-1 border border-input rounded text-sm w-full" /></td>
                        <td className="px-4 py-2"><input value={studentEdit.email} onChange={(e) => setStudentEdit({ ...studentEdit, email: e.target.value })} className="px-2 py-1 border border-input rounded text-sm w-full" /></td>
                        <td className="px-4 py-2"><input type="password" placeholder="Nueva contraseña (opcional)" value={studentEdit.password} onChange={(e) => setStudentEdit({ ...studentEdit, password: e.target.value })} className="px-2 py-1 border border-input rounded text-sm w-full" /></td>
                        <td className="px-4 py-2 text-right space-x-1">
                          <button onClick={() => handleUpdateStudent(s.id)} className="text-green-600 hover:text-green-800"><Save className="w-4 h-4 inline" /></button>
                          <button onClick={() => setEditingStudent(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4 inline" /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 font-medium">{s.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{s.email}</td>
                        <td className="px-4 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                          <button onClick={() => { setSelectedStudent(s.id); setTab("sessions"); }} className="text-primary text-xs underline">Ver sesiones</button>
                          <button onClick={() => openQuotas(s.id)} className="text-emerald-600 hover:text-emerald-800" title="Asignar cupos de entrevistas"><SlidersHorizontal className="w-4 h-4 inline" /></button>
                          <button onClick={() => { setQuotaStudent(null); setEditingStudent(s.id); setStudentEdit({ name: s.name, email: s.email, password: "" }); }} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 className="w-4 h-4 inline" /></button>
                          <button onClick={() => handleDeleteStudent(s.id)} className="text-red-600 hover:text-red-800" title="Eliminar"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </>
                    )}
                  </tr>
                  {quotaStudent === s.id && (
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={4} className="px-4 py-4">
                        <div className="flex items-center gap-2 mb-3">
                          <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium">Cupos de entrevistas para {s.name}</span>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3 mb-3">
                          {ORIENTACIONES.map((o) => (
                            <div key={o}>
                              <label className="block text-xs font-medium mb-1">{o}</label>
                              <input
                                type="number" min={0}
                                value={quotaData[o] ?? ""}
                                onChange={(e) => setQuotaData({ ...quotaData, [o]: Number(e.target.value) })}
                                placeholder="0"
                                className="w-full px-2 py-1.5 border border-input rounded text-sm"
                              />
                              {quotaUsed[o] > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{quotaUsed[o]} ya usada(s)</p>}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveQuotas(s.id)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">Guardar cupos</button>
                          <button onClick={() => setQuotaStudent(null)} className="text-sm text-muted-foreground">Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {students.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Sin estudiantes registrados</td></tr>}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {/* SESSIONS */}
        {tab === "sessions" && !viewSession && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {selectedStudent && (
                  <>
                    <span className="text-sm text-muted-foreground">Filtrando por:</span>
                    <span className="text-sm font-medium">{students.find((s) => s.id === selectedStudent)?.name || `#${selectedStudent}`}</span>
                    <button onClick={() => setSelectedStudent(null)} className="text-xs text-red-500 underline">Quitar filtro</button>
                  </>
                )}
              </div>
              <button
                onClick={handleExportSessions}
                disabled={sessions.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                title="Exportar las sesiones mostradas a Excel"
              >
                <FileSpreadsheet className="w-4 h-4" /> Exportar XLSX
              </button>
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2">Estudiante</th>
                    <th className="text-left px-4 py-2">Caso</th>
                    <th className="text-left px-4 py-2">Orientación</th>
                    <th className="text-left px-4 py-2">Puntaje</th>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-right px-4 py-2">Acciones</th>
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
                      <td className="px-4 py-2 text-right space-x-2">
                        <button onClick={() => setViewSession(s)} className="text-primary" title="Ver"><Eye className="w-4 h-4 inline" /></button>
                        <button onClick={() => handleDeleteSession(s.id)} className="text-red-600 hover:text-red-800" title="Eliminar sesión"><Trash2 className="w-4 h-4 inline" /></button>
                      </td>
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
                {user && <AiCaseButton token={user.token} onGenerated={(caso) => { setEditingCase(null); setCreateInitial(caso); setShowCreateCase(true); }} />}
                <button onClick={() => { setShowCreateCase(true); setEditingCase(null); setCreateInitial(null); }} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">
                  <Plus className="w-4 h-4" /> Crear caso
                </button>
              </div>
            </div>

            {/* Create form */}
            {showCreateCase && !editingCase && (
              <div className="mb-4">
                <CaseForm
                  title={createInitial ? "Revisar caso generado por IA" : "Nuevo caso clínico"}
                  initial={createInitial || undefined}
                  onSave={handleCreateCase}
                  onCancel={() => { setShowCreateCase(false); setCreateInitial(null); }}
                />
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
