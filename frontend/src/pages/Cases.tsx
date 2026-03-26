import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { AppLayout } from "@/components/AppLayout";
import { CaseCard } from "@/components/CaseCard";
import { CaseData, CATEGORIAS, DIFICULTADES } from "@/data/cases";
import { httpRequest, withAuth } from "@/lib/api";
import { useEffect, useState } from "react";
import { Search, Filter, X, Loader2 } from "lucide-react";

const CasesPage = () => {
  const seleccionarCaso = useAppStore((s) => s.seleccionarCaso);
  const estudiante = useAppStore((s) => s.estudiante);
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtros
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterDif, setFilterDif] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    if (!estudiante) { navigate('/'); return; }
    loadCases();
  }, [user, estudiante, navigate]);

  const loadCases = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await httpRequest("/api/cases", withAuth(user.token));
      setCases(data.cases || []);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSelect = (caso: CaseData) => {
    seleccionarCaso(caso);
    navigate("/entrevista");
  };

  const handleDetail = (caso: CaseData) => {
    navigate(`/caso/${caso.id}`);
  };

  // Filtrado
  const filtered = cases.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = c.nombre.toLowerCase().includes(q);
      const matchMotivo = c.motivo.toLowerCase().includes(q);
      const matchTags = c.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchMotivo && !matchTags) return false;
    }
    if (filterCat && c.categoria !== filterCat) return false;
    if (filterDif && c.dificultad !== filterDif) return false;
    return true;
  });

  const hasActiveFilters = !!search || !!filterCat || !!filterDif;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-serif text-2xl font-bold text-foreground">
            Catálogo de Casos
          </h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} de {cases.length} casos
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Selecciona un caso para iniciar la entrevista clínica simulada.
        </p>

        {/* Search + Filter toggle */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, motivo o etiqueta..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition ${
              hasActiveFilters ? "border-primary text-primary bg-primary/5" : "border-input text-muted-foreground hover:bg-muted"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {[filterCat, filterDif].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filtrar casos</span>
              {hasActiveFilters && (
                <button onClick={() => { setFilterCat(""); setFilterDif(""); setSearch(""); }} className="text-xs text-primary underline">
                  Limpiar filtros
                </button>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Categoría</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterCat("")}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${!filterCat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  Todas
                </button>
                {CATEGORIAS.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setFilterCat(filterCat === cat.value ? "" : cat.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${filterCat === cat.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Dificultad</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterDif("")}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${!filterDif ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  Todas
                </button>
                {DIFICULTADES.map((dif) => (
                  <button
                    key={dif.value}
                    onClick={() => setFilterDif(filterDif === dif.value ? "" : dif.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${filterDif === dif.value ? `${dif.color} border-transparent` : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {dif.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-10">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <button onClick={loadCases} className="text-sm text-primary underline">Reintentar</button>
          </div>
        )}

        {/* Cases grid */}
        {!loading && !error && (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((caso) => (
              <CaseCard
                key={caso.id}
                caso={caso}
                onSelect={() => handleSelect(caso)}
                onDetail={() => handleDetail(caso)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && cases.length > 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm mb-2">No se encontraron casos con estos filtros.</p>
            <button onClick={() => { setFilterCat(""); setFilterDif(""); setSearch(""); }} className="text-sm text-primary underline">
              Limpiar filtros
            </button>
          </div>
        )}

        {!loading && !error && cases.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No hay casos clínicos disponibles.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CasesPage;
