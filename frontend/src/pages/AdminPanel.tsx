import { useEffect, useState } from "react";
import { useAppStore, Role } from "@/stores/useAppStore";
import { useNavigate } from "react-router-dom";
import { httpRequest, withAuth } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { Users, Settings, BookOpen, Trash2, Edit2, Plus, Save, X } from "lucide-react";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

interface ConfigRow {
  key: string;
  value: string;
}

type Tab = "users" | "cases" | "config";

const ROLES: Role[] = ["admin", "teacher", "student", "guest"];

const AdminPanel = () => {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [config, setConfig] = useState<ConfigRow[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Crear usuario
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "student" as Role });

  // Editar usuario
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: "", email: "", role: "student" as Role });

  // Config
  const [newConfigKey, setNewConfigKey] = useState("");
  const [newConfigValue, setNewConfigValue] = useState("");

  // Caso
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [newCase, setNewCase] = useState({
    slug: "", nombre: "", edad: 0, motivo: "", tipo: "típico",
    presentacion: "", contexto: "", is_public: true,
  });

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/auth");
      return;
    }
    loadData();
  }, [user, tab]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      if (tab === "users") {
        const data = await httpRequest("/api/admin/users", withAuth(user.token));
        setUsers(data.users);
      } else if (tab === "config") {
        const data = await httpRequest("/api/admin/config", withAuth(user.token));
        setConfig(data.config);
      } else if (tab === "cases") {
        const data = await httpRequest("/api/cases", withAuth(user.token));
        setCases(data.cases);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
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

  const handleSetConfig = async () => {
    if (!user || !newConfigKey) return;
    try {
      await httpRequest(`/api/admin/config/${newConfigKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ value: newConfigValue }),
      });
      setNewConfigKey("");
      setNewConfigValue("");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateCase = async () => {
    if (!user) return;
    try {
      await httpRequest("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(newCase),
      });
      setShowCreateCase(false);
      setNewCase({ slug: "", nombre: "", edad: 0, motivo: "", tipo: "típico", presentacion: "", contexto: "", is_public: true });
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

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "users", label: "Usuarios", icon: Users },
    { key: "cases", label: "Casos Clínicos", icon: BookOpen },
    { key: "config", label: "Configuración", icon: Settings },
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
            <p className="text-sm text-muted-foreground">Gestión de usuarios, casos y configuración</p>
          </div>
          <button onClick={() => navigate("/casos")} className="text-sm text-primary underline">
            Ir a simulación
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border pb-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
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
                          <td className="px-4 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
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
                          <td className="px-4 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-right space-x-1">
                            <button onClick={() => { setEditingId(u.id); setEditData({ name: u.name, email: u.email, role: u.role }); }} className="text-blue-600 hover:text-blue-800"><Edit2 className="w-4 h-4 inline" /></button>
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
              <button onClick={() => setShowCreateCase(!showCreateCase)} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">
                <Plus className="w-4 h-4" /> Crear caso
              </button>
            </div>

            {showCreateCase && (
              <div className="bg-card border border-border rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Slug (ej: maria)" value={newCase.slug} onChange={(e) => setNewCase({ ...newCase, slug: e.target.value })} className="px-3 py-2 rounded-lg border border-input text-sm" />
                  <input placeholder="Nombre completo" value={newCase.nombre} onChange={(e) => setNewCase({ ...newCase, nombre: e.target.value })} className="px-3 py-2 rounded-lg border border-input text-sm" />
                  <input placeholder="Edad" type="number" value={newCase.edad || ""} onChange={(e) => setNewCase({ ...newCase, edad: Number(e.target.value) })} className="px-3 py-2 rounded-lg border border-input text-sm" />
                  <input placeholder="Motivo de consulta" value={newCase.motivo} onChange={(e) => setNewCase({ ...newCase, motivo: e.target.value })} className="px-3 py-2 rounded-lg border border-input text-sm" />
                </div>
                <textarea placeholder="Presentación (frase inicial del paciente)" value={newCase.presentacion} onChange={(e) => setNewCase({ ...newCase, presentacion: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input text-sm" rows={2} />
                <textarea placeholder="Contexto clínico completo" value={newCase.contexto} onChange={(e) => setNewCase({ ...newCase, contexto: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input text-sm" rows={4} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newCase.is_public} onChange={(e) => setNewCase({ ...newCase, is_public: e.target.checked })} />
                  Caso público (visible para estudiantes y guests)
                </label>
                <div className="flex gap-2">
                  <button onClick={handleCreateCase} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">Crear</button>
                  <button onClick={() => setShowCreateCase(false)} className="text-sm text-muted-foreground">Cancelar</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {cases.map((c: any) => (
                <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{c.nombre}</h4>
                      <span className="text-xs text-muted-foreground">({c.edad} años)</span>
                      {c.is_public ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Público</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Privado</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.motivo}</p>
                  </div>
                  <button onClick={() => handleDeleteCase(c.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {cases.length === 0 && !loading && (
                <p className="text-muted-foreground text-sm text-center py-8">No hay casos clínicos en la base de datos. Los casos predeterminados están en el código del frontend.</p>
              )}
            </div>
          </div>
        )}

        {/* CONFIG */}
        {tab === "config" && (
          <div>
            <div className="bg-card border border-border rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-3">Agregar/Modificar configuración</h3>
              <div className="flex gap-3">
                <input placeholder="Clave (ej: max_sessions)" value={newConfigKey} onChange={(e) => setNewConfigKey(e.target.value)} className="px-3 py-2 rounded-lg border border-input text-sm flex-1" />
                <input placeholder="Valor" value={newConfigValue} onChange={(e) => setNewConfigValue(e.target.value)} className="px-3 py-2 rounded-lg border border-input text-sm flex-1" />
                <button onClick={handleSetConfig} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm">Guardar</button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2">Clave</th>
                    <th className="text-left px-4 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {config.map((c) => (
                    <tr key={c.key} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{c.key}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.value}</td>
                    </tr>
                  ))}
                  {config.length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">Sin configuraciones</td></tr>
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
