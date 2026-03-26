import { CaseData, DIFICULTADES, CATEGORIAS } from "@/data/cases";
import { User, ArrowRight, BarChart3, BookOpen } from "lucide-react";

interface Props {
  caso: CaseData;
  onSelect: () => void;
  onDetail?: () => void;
  showStats?: boolean;
}

export function CaseCard({ caso, onSelect, onDetail, showStats }: Props) {
  const dif = DIFICULTADES.find((d) => d.value === caso.dificultad);
  const cat = CATEGORIAS.find((c) => c.value === caso.categoria);

  return (
    <div className="group bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-serif text-lg font-semibold text-card-foreground">
              {caso.nombre}
            </h3>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent/20 text-accent-foreground">
              {caso.edad} años
            </span>
          </div>

          {/* Motivo */}
          <p className="text-sm text-muted-foreground mb-2">{caso.motivo}</p>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {dif && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dif.color}`}>
                {dif.label}
              </span>
            )}
            {cat && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {cat.label}
              </span>
            )}
            {caso.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {tag}
              </span>
            ))}
            {caso.tags?.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{caso.tags.length - 3}</span>
            )}
          </div>

          {/* Objetivos preview */}
          {caso.objetivos?.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Objetivos de aprendizaje</p>
              <ul className="space-y-0.5">
                {caso.objetivos.slice(0, 2).map((obj, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-primary mt-0.5">•</span>
                    <span className="line-clamp-1">{obj}</span>
                  </li>
                ))}
                {caso.objetivos.length > 2 && (
                  <li className="text-[10px] text-muted-foreground/60">+{caso.objetivos.length - 2} más</li>
                )}
              </ul>
            </div>
          )}

          {/* Stats */}
          {showStats && caso.stats && (
            <div className="flex items-center gap-3 mb-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {caso.stats.total_sessions} sesiones
              </span>
              {caso.stats.avg_score && (
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  Promedio: {caso.stats.avg_score}/10
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground capitalize">
                Caso {caso.tipo}
              </span>
              {caso.genero && caso.genero !== 'otro' && (
                <span className="text-[10px] text-muted-foreground">
                  · {caso.genero === 'masculino' ? '♂' : '♀'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onDetail && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDetail(); }}
                  className="text-xs text-muted-foreground hover:text-primary transition"
                >
                  Ver detalle
                </button>
              )}
              <button
                onClick={onSelect}
                className="text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Iniciar entrevista <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
