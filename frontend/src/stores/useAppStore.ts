import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CaseData } from "@/data/cases";

export interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

export interface HistoriaClinica {
  motivo_consulta: string;
  historia_problema: string;
  antecedentes: string;
  impresion_diagnostica: string;
}

export interface Evaluacion {
  estructura_preguntas: { puntuacion: number; comentario: string };
  tecnica_entrevista: { puntuacion: number; comentario: string };
  apertura_emocional: { puntuacion: number; comentario: string };
  adecuacion_contexto: { puntuacion: number; comentario: string };
  fortalezas: string[];
  areas_mejora: string[];
}

export type Role = 'admin' | 'teacher' | 'student' | 'guest';

export interface User {
  id: number;
  name: string;
  email: string;
  token: string;
  role: Role;
}

export interface Estudiante {
  nombre: string;
  orientacion: string;
}

interface SesionActual {
  casoId: string | number | null;
  caso: CaseData | null;
  mensajes: Mensaje[];
  historia: HistoriaClinica | null;
  evaluacion: Evaluacion | null;
  chatFinalizado: boolean;
}

interface AppState {
  user: User | null;
  estudiante: Estudiante | null;
  sesion: SesionActual;
  paso: number; // 1-5

  setUser: (user: User | null) => void;
  logout: () => void;
  registrar: (est: Estudiante) => void;
  seleccionarCaso: (caso: CaseData) => void;
  agregarMensaje: (msg: Mensaje) => void;
  finalizarChat: () => void;
  guardarHistoria: (h: HistoriaClinica) => void;
  guardarEvaluacion: (e: Evaluacion) => void;
  nuevoCaso: () => void;
  setPaso: (p: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      estudiante: null,
      sesion: {
        casoId: null,
        caso: null,
        mensajes: [],
        historia: null,
        evaluacion: null,
        chatFinalizado: false,
      },
      paso: 1,

      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
      registrar: (est) => set({ estudiante: est, paso: 2 }),

      seleccionarCaso: (caso) =>
        set({
          sesion: {
            casoId: caso.id,
            caso,
            mensajes: [{ role: "assistant", content: caso.presentacion }],
            historia: null,
            evaluacion: null,
            chatFinalizado: false,
          },
          paso: 3,
        }),

      agregarMensaje: (msg) =>
        set((s) => ({
          sesion: { ...s.sesion, mensajes: [...s.sesion.mensajes, msg] },
        })),

      finalizarChat: () =>
        set((s) => ({
          sesion: { ...s.sesion, chatFinalizado: true },
          paso: 4,
        })),

      guardarHistoria: (h) =>
        set((s) => ({ sesion: { ...s.sesion, historia: h }, paso: 5 })),

      guardarEvaluacion: (e) =>
        set((s) => ({ sesion: { ...s.sesion, evaluacion: e } })),

      nuevoCaso: () =>
        set({
          sesion: {
            casoId: null,
            caso: null,
            mensajes: [],
            historia: null,
            evaluacion: null,
            chatFinalizado: false,
          },
          paso: 2,
        }),

      setPaso: (p) => set({ paso: p }),
    }),
    { name: "sspec-storage" }
  )
);
