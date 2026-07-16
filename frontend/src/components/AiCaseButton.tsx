import { useState } from "react";
import { httpRequest } from "@/lib/api";
import { DIFICULTADES, CATEGORIAS } from "@/data/cases";
import { Sparkles, Loader2, X, Plus } from "lucide-react";

interface Props {
  token: string;
  onGenerated: (caso: any) => void;
}

export function AiCaseButton({ token, onGenerated }: Props) {
  const [open, setOpen] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [dificultad, setDificultad] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generar = async () => {
    if (!descripcion.trim()) { setError("Describe el caso que quieres generar."); return; }
    setLoading(true);
    setError("");
    try {
      const data = await httpRequest("/api/cases/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ descripcion, dificultad, categoria }),
      });
      onGenerated(data.case);
      setOpen(false);
      setDescripcion("");
      setDificultad("");
      setCategoria("");
      setNuevaCategoria(false);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary text-sm hover:bg-primary/5"
      >
        <Sparkles className="w-4 h-4" /> Crear con IA
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Generar caso con IA</h3>
              <button onClick={() => !loading && setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <label className="block text-sm font-medium mb-1">Descripción / instrucciones</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              placeholder="Ej: Mujer joven universitaria con ansiedad social y conflictos familiares, ambivalente ante la terapia..."
              className="w-full px-3 py-2 rounded-lg border border-input text-sm mb-3"
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Dificultad</label>
                <select value={dificultad} onChange={(e) => setDificultad(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input text-sm">
                  <option value="">Cualquiera</option>
                  {DIFICULTADES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoría (opcional)</label>
                {nuevaCategoria ? (
                  <div className="flex gap-1">
                    <input autoFocus value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Nueva categoría" className="w-full px-3 py-2 rounded-lg border border-input text-sm" />
                    <button type="button" onClick={() => { setNuevaCategoria(false); setCategoria(""); }} className="px-2 rounded-lg border border-input text-muted-foreground hover:bg-muted" title="Volver a la lista"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input text-sm">
                      <option value="">Cualquiera</option>
                      {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <button type="button" onClick={() => { setNuevaCategoria(true); setCategoria(""); }} className="px-2 rounded-lg border border-input text-primary hover:bg-primary/5" title="Nueva categoría"><Plus className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} disabled={loading} className="px-3 py-1.5 text-sm text-muted-foreground">Cancelar</button>
              <button onClick={generar} disabled={loading} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <>Generar</>}
              </button>
            </div>
            {loading && <p className="text-xs text-muted-foreground mt-3 text-center">La IA está redactando el caso, puede tardar unos segundos…</p>}
          </div>
        </div>
      )}
    </>
  );
}
