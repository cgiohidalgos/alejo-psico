import { useAppStore } from "@/stores/useAppStore";
import { Brain, Menu } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const steps = [
  { num: 1, label: "Registro", path: "/" },
  { num: 2, label: "Casos", path: "/casos" },
  { num: 3, label: "Entrevista", path: "/entrevista" },
  { num: 4, label: "Historia", path: "/historia" },
  { num: 5, label: "Evaluación", path: "/evaluacion" },
];

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const paso = useAppStore((s) => s.paso);
  const navigate = useNavigate();

  return (
    <header className="md:hidden sticky top-0 z-50 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-sidebar-primary" />
          <span className="font-serif font-bold">SSPEC</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <nav className="px-4 pb-3 space-y-1">
          {steps.map((s) => (
            <button
              key={s.num}
              disabled={paso < s.num}
              onClick={() => {
                if (paso >= s.num) {
                  navigate(s.path);
                  setOpen(false);
                }
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                paso === s.num
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : paso > s.num
                  ? "text-sidebar-foreground/70"
                  : "text-sidebar-foreground/30"
              }`}
            >
              {s.num}. {s.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
