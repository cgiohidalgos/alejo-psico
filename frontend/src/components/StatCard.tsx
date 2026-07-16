import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: string;
}

export function StatCard({ icon: Icon, label, value, hint, accent }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${accent || "bg-primary/10 text-primary"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground/70 truncate">{hint}</p>}
      </div>
    </div>
  );
}
