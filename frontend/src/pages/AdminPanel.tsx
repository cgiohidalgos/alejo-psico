import { useEffect, useState } from "react";
import { useAppStore, Role } from "@/stores/useAppStore";
import { useNavigate } from "react-router-dom";
import { httpRequest, withAuth } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { CaseForm } from "@/components/CaseForm";
import { AiCaseButton } from "@/components/AiCaseButton";
import { Users, BookOpen, Trash2, Edit2, Plus, Save, X, Shield, GraduationCap, FileText, FileSpreadsheet, Eye, EyeOff } from "lucide-react";
import * as XLSX from "xlsx";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  teacher_id: number | null;
  teacher_name: string | null;
  created_at: string;
}

interface TeacherOption { id: number; name: string; }

type Tab = "users" | "cases" | "sessions";

const ROLES: Role[] = ["admin", "teacher", "student", "guest"];

const AdminPanel = () => {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ users: number; admins: number; teachers: number; students: number; cases: number; sessions: number } | null>(null);

  // Crear usuario
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "student" as Role });

  // Editar usuario
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: "", email: "", role: "student" as Role, password: "", teacher_id: "" });

  // Caso
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [editingCase, setEditingCase] = useState<any | null>(null);
  const [createInitial, setCreateInitial] = useState<any | null>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/auth");
      return;
    }
    loadData();
  }, [user, tab]);

  const loadStats = async () => {
    if (!user) return;
    try {
      const [u, c, s] = await Promise.all([
        httpRequest("/api/admin/users", withAuth(user.token)),
        httpRequest("/api/cases", withAuth(user.token)),
        httpRequest("/api/sessions", withAuth(user.token)),
      ]);
      const list: UserRow[] = u.users || [];
      setTeachers(list.filter((x) => x.role === "teacher").map((x) => ({ id: x.id, name: x.name })));
      setStats({
        users: list.length,
        admins: list.filter((x) => x.role === "admin").length,
        teachers: list.filter((x) => x.role === "teacher").length,
        students: list.filter((x) => x.role === "student").length,
        cases: (c.cases || []).length,
        sessions: (s.sessions || []).length,
      });
    } catch {
      /* KPIs son informativos: si fallan no bloquean el panel */
    }
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      if (tab === "users") {
        const data = await httpRequest("/api/admin/users", withAuth(user.token));
        setUsers(data.users);
      } else if (tab === "cases") {
        const data = await httpRequest("/api/cases", withAuth(user.token));
        setCases(data.cases);
      } else if (tab === "sessions") {
        const data = await httpRequest("/api/sessions", withAuth(user.token));
        setSessions(data.sessions);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
    loadStats();
  };

  const handleCreateUser = async () => {
    if (!user) return;
    try {
      await httpRequest("/api/admin/users", {
        ...withAuth(user.token),
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(newUser),
      });
      setShowCreateUser(false);
      setNewUser({ name: "", email: "", password: "", role: "student" });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateUser = async (id: number) => {
    if (!user) return;
    try {
      await httpRequest(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(editData),
      });
      setEditingId(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!user || !confirm("¿Eliminar este usuario y todas sus sesiones?")) return;
    try {
      await httpRequest(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
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

  const handleDeleteSession = async (id: number) => {
    if (!user || !confirm("¿Eliminar esta sesión? No se puede deshacer.")) return;
    try {
      await httpRequest(`/api/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleVisibility = async (c: any) => {
    if (!user) return;
    try {
      await httpRequest(`/api/cases/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ is_public: c.is_public ? 0 : 1 }),
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCase = async (id: number) => {
    if (!user || !confirm("¿Eliminar este caso clínico?")) return;
    try {
      await httpRequest(`/api/cases/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const casoNombre = (caso: any) => (typeof caso === "string" ? caso : caso?.nombre) || "-";

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
        "Caso": casoNombre(s.caso),
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
    XLSX.writeFile(wb, `sesiones-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "users", label: "Usuarios", icon: Users },
    { key: "cases", label: "Casos Clínicos", icon: BookOpen },
    { key: "sessions", label: "Sesiones", icon: FileText },
  ];

  const roleColor = (r: string) => {
    switch (r) {
      case "admin": return "bg-red-100 text-red-800";
      case "teacher": return "bg-blue-100 text-blue-800";
      case "student": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-2xl font-bold">Panel de Administración</h2>
            <p className="text-sm text-muted-foreground">Gestión de usuarios, casos y sesiones</p>
          </div>
          <button onClick={() => navigate("/")} className="text-sm text-primary underline">
            Ir a simulación
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Users} label="Usuarios totales" value={stats ? stats.users : "–"}
            hint={stats ? `${stats.students} estudiantes` : undefined} />
          <StatCard icon={Shield} label="Admins / Profesores" value={stats ? `${stats.admins} / ${stats.teachers}` : "–"}
            accent="bg-blue-500/10 text-blue-600" />
          <StatCard icon={BookOpen} label="Casos clínicos" value={stats ? stats.cases : "–"}
            accent="bg-amber-500/10 text-amber-600" />
          <StatCard icon={FileText} label="Sesiones registradas" value={stats ? stats.sessions : "–"}
            accent="bg-emerald-500/10 text-emerald-600" />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-muted/50 p-1 rounded-xl w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* USUARIOS */}
        {tab === "users" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{users.length} usuarios</h3>
              <button
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm"
              >
                <Plus className="w-4 h-4" /> Crear usuario
              </button>
            </div>

            {showCreateUser && (
              <div className="bg-card border border-border rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Nombre" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="px-3 py-2 rounded-lg border border-input text-sm" />
                  <input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="px-3 py-2 rounded-lg border border-input text-sm" />
                  <input placeholder="Contraseña" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="px-3 py-2 rounded-lg border border-input text-sm" />
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })} className="px-3 py-2 rounded-lg border border-input text-sm">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateUser} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">Crear</button>
                  <button onClick={() => setShowCreateUser(false)} className="text-sm text-muted-foreground">Cancelar</button>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2">Nombre</th>
                    <th className="text-left px-4 py-2">Email</th>
                    <th className="text-left px-4 py-2">Rol</th>
                    <th className="text-left px-4 py-2">Profesor</th>
                    <th className="text-left px-4 py-2">Creado</th>
                    <th className="text-right px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      {editingId === u.id ? (
                        <>
                          <td className="px-4 py-2"><input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="px-2 py-1 border border-input rounded text-sm w-full" /></td>
                          <td className="px-4 py-2"><input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="px-2 py-1 border border-input rounded text-sm w-full" /></td>
                          <td className="px-4 py-2">
                            <select value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value as Role })} className="px-2 py-1 border border-input rounded text-sm">
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select value={editData.teacher_id} onChange={(e) => setEditData({ ...editData, teacher_id: e.target.value })} className="px-2 py-1 border border-input rounded text-sm" disabled={editData.role !== "student"}>
                              <option value="">Sin profesor</option>
                              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-2"><input type="password" placeholder="Nueva contraseña (opcional)" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} className="px-2 py-1 border border-input rounded text-sm w-full" /></td>
                          <td className="px-4 py-2 text-right space-x-1">
                            <button onClick={() => handleUpdateUser(u.id)} className="text-green-600 hover:text-green-800"><Save className="w-4 h-4 inline" /></button>
                            <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4 inline" /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 font-medium">{u.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(u.role)}`}>{u.role}</span></td>
                          <td className="px-4 py-2 text-muted-foreground">{u.role === "student" ? (u.teacher_name || <span className="text-yellow-600">Sin asignar</span>) : "–"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-right space-x-1">
                            <button onClick={() => { setEditingId(u.id); setEditData({ name: u.name, email: u.email, role: u.role, password: "", teacher_id: u.teacher_id ? String(u.teacher_id) : "" }); }} className="text-blue-600 hover:text-blue-800"><Edit2 className="w-4 h-4 inline" /></button>
                            {u.id !== user?.id && (
                              <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4 inline" /></button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CASOS */}
        {tab === "cases" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{cases.length} casos clínicos</h3>
              <div className="flex gap-2">
                {user && <AiCaseButton token={user.token} onGenerated={(caso) => { setEditingCase(null); setCreateInitial(caso); setShowCreateCase(true); }} />}
                <button onClick={() => { setShowCreateCase(true); setEditingCase(null); setCreateInitial(null); }} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">
                  <Plus className="w-4 h-4" /> Crear caso
                </button>
              </div>
            </div>

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

            {editingCase && (
              <div className="mb-4">
                <CaseForm title={`Editar: ${editingCase.nombre}`} initial={editingCase} onSave={handleUpdateCase} onCancel={() => setEditingCase(null)} />
              </div>
            )}

            <div className="space-y-3">
              {cases.map((c: any) => (
                <div key={c.id} className={`bg-card border border-border rounded-lg p-4 flex justify-between items-start ${!c.is_public ? "opacity-70" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{c.nombre}</h4>
                      <span className="text-xs text-muted-foreground">({c.edad} años)</span>
                      {c.is_public ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Público</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Oculto</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.motivo}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => handleToggleVisibility(c)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded" title={c.is_public ? "Ocultar caso" : "Mostrar caso"}>
                      {c.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setEditingCase(c); setShowCreateCase(false); }} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteCase(c.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {cases.length === 0 && !loading && (
                <p className="text-muted-foreground text-sm text-center py-8">No hay casos clínicos en la base de datos.</p>
              )}
            </div>
          </div>
        )}

        {/* SESIONES */}
        {tab === "sessions" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{sessions.length} sesiones</h3>
              <button
                onClick={handleExportSessions}
                disabled={sessions.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                title="Exportar todas las sesiones a Excel"
              >
                <FileSpreadsheet className="w-4 h-4" /> Exportar XLSX
              </button>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-x-auto">
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
                      <td className="px-4 py-2">{casoNombre(s.caso)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s.orientacion || "-"}</td>
                      <td className="px-4 py-2"><span className="font-semibold">{avgScore(s.evaluacion)}</span><span className="text-muted-foreground">/10</span></td>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => handleDeleteSession(s.id)} className="text-red-600 hover:text-red-800" title="Eliminar sesión"><Trash2 className="w-4 h-4 inline" /></button>
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && !loading && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sin sesiones registradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminPanel;
