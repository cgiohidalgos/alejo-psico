interface Props {
  label: string;
  puntuacion: number;
  comentario: string;
}

export function ScoreCard({ label, puntuacion, comentario }: Props) {
  const color =
    puntuacion >= 7 ? "score-high" : puntuacion >= 5 ? "score-mid" : "score-low";

  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-card-foreground">{label}</h4>
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold bg-${color}/15 text-${color}`}
        >
          {puntuacion}
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{comentario}</p>
    </div>
  );
}
