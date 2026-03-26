export interface CaseData {
  id: number | string;
  slug: string;
  nombre: string;
  edad: number;
  genero: string;
  motivo: string;
  tipo: string;
  categoria: string;
  dificultad: string;
  tags: string[];
  objetivos: string[];
  presentacion: string;
  contexto: string;
  personalidad: string;
  antecedentes_medicos: string;
  dinamica_familiar: string;
  notas_docente?: string;
  is_public: boolean;
  stats?: {
    total_sessions: number;
    total_evaluated: number;
    avg_score: string | null;
  };
}

export const CATEGORIAS = [
  { value: 'general', label: 'General' },
  { value: 'ansiedad', label: 'Ansiedad' },
  { value: 'depresion', label: 'Depresión' },
  { value: 'trauma', label: 'Trauma' },
  { value: 'adolescencia', label: 'Adolescencia' },
  { value: 'regulacion-emocional', label: 'Regulación emocional' },
  { value: 'pareja', label: 'Relaciones de pareja' },
  { value: 'adicciones', label: 'Adicciones' },
  { value: 'infantil', label: 'Psicología infantil' },
  { value: 'laboral', label: 'Psicología laboral' },
];

export const DIFICULTADES = [
  { value: 'basico', label: 'Básico', color: 'bg-green-100 text-green-800' },
  { value: 'intermedio', label: 'Intermedio', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'avanzado', label: 'Avanzado', color: 'bg-red-100 text-red-800' },
];

export const GENEROS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
];
