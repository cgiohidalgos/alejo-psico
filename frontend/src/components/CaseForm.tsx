import { useState } from "react";
import { CaseData, CATEGORIAS, DIFICULTADES, GENEROS } from "@/data/cases";
import { Save, X, Plus, Trash2, Upload, Download } from "lucide-react";

interface Props {
  initial?: Partial<CaseData>;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  title: string;
}

export function CaseForm({ initial, onSave, onCancel, title }: Props) {
  const [form, setForm] = useState({
    slug: initial?.slug || "",
    nombre: initial?.nombre || "",
    edad: initial?.edad || 0,
    genero: initial?.genero || "otro",
    motivo: initial?.motivo || "",
    tipo: initial?.tipo || "típico",
    categoria: initial?.categoria || "general",
    dificultad: initial?.dificultad || "intermedio",
    tags: initial?.tags || [] as string[],
    objetivos: initial?.objetivos || [] as string[],
    presentacion: initial?.presentacion || "",
    contexto: initial?.contexto || "",
    personalidad: initial?.personalidad || "",
    antecedentes_medicos: initial?.antecedentes_medicos || "",
    dinamica_familiar: initial?.dinamica_familiar || "",
    notas_docente: initial?.notas_docente || "",
    is_public: initial?.is_public ?? true,
  });

  const [newTag, setNewTag] = useState("");
  const [newObj, setNewObj] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"basico" | "clinico" | "pedagogico">("basico");

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const addTag = () => {
    if (!newTag.trim()) return;
    set("tags", [...form.tags, newTag.trim()]);
    setNewTag("");
  };

  const removeTag = (i: number) => set("tags", form.tags.filter((_: any, idx: number) => idx !== i));

  const addObj = () => {
    if (!newObj.trim()) return;
    set("objetivos", [...form.objetivos, newObj.trim()]);
    setNewObj("");
  };

  const removeObj = (i: number) => set("objetivos", form.objetivos.filter((_: any, idx: number) => idx !== i));

  // Auto-generate slug from nombre
  const autoSlug = () => {
    if (form.nombre && !form.slug) {
      set("slug", form.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));
    }
  };

  const handleSave = async () => {
    if (!form.slug || !form.nombre || !form.edad || !form.motivo || !form.presentacion || !form.contexto) {
      setError("Completa los campos requeridos: slug, nombre, edad, motivo, presentación y contexto.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  const tabs = [
    { key: "basico" as const, label: "Datos básicos" },
    { key: "clinico" as const, label: "Perfil clínico" },
    { key: "pedagogico" as const, label: "Pedagógico" },
  ];

  const inputCls = "w-full px-3 py-2 rounded-lg border border-input text-sm bg-background";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";
  const reqCls = "text-red-500";

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 rounded-t text-xs font-medium transition ${activeTab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Datos básicos */}
      {activeTab === "basico" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre <span className={reqCls}>*</span></label>
              <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} onBlur={autoSlug} className={inputCls} placeholder="María González" />
            </div>
            <div>
              <label className={labelCls}>Slug <span className={reqCls}>*</span></label>
              <input value={form.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls} placeholder="maria-gonzalez" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Edad <span className={reqCls}>*</span></label>
              <input type="number" value={form.edad || ""} onChange={(e) => set("edad", Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Género</label>
              <select value={form.genero} onChange={(e) => set("genero", e.target.value)} className={inputCls}>
                {GENEROS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className={inputCls}>
                <option value="típico">Típico</option>
                <option value="contextualizado">Contextualizado</option>
                <option value="complejo">Complejo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Categoría</label>
              <select value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className={inputCls}>
                {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Dificultad</label>
              <select value={form.dificultad} onChange={(e) => set("dificultad", e.target.value)} className={inputCls}>
                {DIFICULTADES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Motivo de consulta <span className={reqCls}>*</span></label>
            <input value={form.motivo} onChange={(e) => set("motivo", e.target.value)} className={inputCls} placeholder="Dificultades en relaciones sociales" />
          </div>
          <div>
            <label className={labelCls}>Presentación (frase de apertura del paciente) <span className={reqCls}>*</span></label>
            <textarea value={form.presentacion} onChange={(e) => set("presentacion", e.target.value)} className={inputCls} rows={2} placeholder='Buenas tardes... mi mamá me dijo que viniera...' />
          </div>
          <div>
            <label className={labelCls}>Etiquetas</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((tag: string, i: number) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                  {tag}
                  <button onClick={() => removeTag(i)} className="text-muted-foreground/60 hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} className={`${inputCls} flex-1`} placeholder="Nueva etiqueta" />
              <button onClick={addTag} className="px-2 py-1.5 rounded-lg border border-input text-muted-foreground hover:bg-muted"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_public} onChange={(e) => set("is_public", e.target.checked)} />
            Caso público (visible para estudiantes)
          </label>
        </div>
      )}

      {/* Tab: Perfil clínico */}
      {activeTab === "clinico" && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Contexto clínico completo <span className={reqCls}>*</span></label>
            <textarea value={form.contexto} onChange={(e) => set("contexto", e.target.value)} className={inputCls} rows={5} placeholder="Historia completa del paciente..." />
          </div>
          <div>
            <label className={labelCls}>Personalidad y comportamiento en sesión</label>
            <textarea value={form.personalidad} onChange={(e) => set("personalidad", e.target.value)} className={inputCls} rows={3} placeholder="Cómo se comporta, habla y reacciona en sesión..." />
          </div>
          <div>
            <label className={labelCls}>Antecedentes médicos</label>
            <textarea value={form.antecedentes_medicos} onChange={(e) => set("antecedentes_medicos", e.target.value)} className={inputCls} rows={2} placeholder="Condiciones médicas, medicamentos, consumo de sustancias..." />
          </div>
          <div>
            <label className={labelCls}>Dinámica familiar</label>
            <textarea value={form.dinamica_familiar} onChange={(e) => set("dinamica_familiar", e.target.value)} className={inputCls} rows={3} placeholder="Relaciones familiares, roles, conflictos..." />
          </div>
        </div>
      )}

      {/* Tab: Pedagógico */}
      {activeTab === "pedagogico" && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Objetivos de aprendizaje</label>
            <ul className="space-y-1.5 mb-2">
              {form.objetivos.map((obj: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">{i + 1}</span>
                  <span className="flex-1">{obj}</span>
                  <button onClick={() => removeObj(i)} className="text-muted-foreground/60 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1.5">
              <input value={newObj} onChange={(e) => setNewObj(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addObj())} className={`${inputCls} flex-1`} placeholder="Nuevo objetivo de aprendizaje" />
              <button onClick={addObj} className="px-2 py-1.5 rounded-lg border border-input text-muted-foreground hover:bg-muted"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Notas para el docente (solo visible para profesores)</label>
            <textarea value={form.notas_docente} onChange={(e) => set("notas_docente", e.target.value)} className={inputCls} rows={4} placeholder="Puntos clave para evaluar al estudiante, errores comunes, sugerencias pedagógicas..." />
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
          <Save className="w-3.5 h-3.5" />
          {saving ? "Guardando..." : "Guardar caso"}
        </button>
      </div>
    </div>
  );
}
