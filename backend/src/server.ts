import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import {
  insertSession, listSessions, getSession, deleteSession, createUser, getUserByEmail, getUserById,
  listUsers, updateUserRole, deleteUser, updateUser, listTeachers,
  listSessionsByUser,
  listQuotasByStudent, setQuotas, upsertQuota, countSessionsByStudentOrientacion, getStudentMetrics,
  listClinicalCases, getClinicalCase, getClinicalCaseBySlug, createClinicalCase, updateClinicalCase, deleteClinicalCase, duplicateClinicalCase,
  getAllCaseStats,
  listConfig, getConfig, setConfig,
  Role,
} from './db.js';
import { PROMPTS_ORIENTACION, PROMPT_EVALUACION } from './prompts.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 3000);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIO_SECRETO_123';
const ORIENTACIONES = ['Psicoanalítica', 'Cognitivo-Conductual', 'Humanista'];
const DEFAULT_QUOTA = Number(process.env.DEFAULT_QUOTA || 1); // cupo por defecto al registrarse

if (!ANTHROPIC_API_KEY) {
  console.warn('Advertencia: ANTHROPIC_API_KEY no está configurada. API Anthropic no funcionará.');
}

function normalizeAnthropicResponse(data: any) {
  return (
    data.completion ||
    data.output?.[0]?.content?.[0]?.text ||
    data.content?.[0]?.text ||
    ''
  );
}

// ==================== MIDDLEWARE ====================

type AuthRequest = Request & { user?: any };

const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    const user = await getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    req.user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware opcional: permite guest (sin token) pero adjunta user si existe
const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
      const user = await getUserById(payload.userId);
      if (user) req.user = user;
    } catch {}
  }
  next();
};

const requireRole = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
};

// ==================== AUTH ====================

// Lista pública de profesores (para el formulario de registro)
app.get('/api/teachers', async (_req: Request, res: Response) => {
  const teachers = await listTeachers();
  res.json({ teachers });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, teacher_id, orientacion } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email y password son requeridos' });
  }
  if (!orientacion || !ORIENTACIONES.includes(orientacion)) {
    return res.status(400).json({ error: 'Debes seleccionar una orientación válida' });
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Usuario ya existe' });
  }

  // El estudiante debe elegir un profesor existente
  if (!teacher_id) {
    return res.status(400).json({ error: 'Debes seleccionar un profesor' });
  }
  const t = await getUserById(Number(teacher_id));
  if (!t || t.role !== 'teacher') {
    return res.status(400).json({ error: 'Profesor inválido' });
  }
  const assignedTeacher: number = t.id;

  const password_hash = await bcrypt.hash(password, 10);
  const userId = await createUser({ name, email, password_hash, role: 'student', teacher_id: assignedTeacher });

  // Cupo por defecto para la orientación elegida al registrarse
  if (userId && DEFAULT_QUOTA > 0) {
    await upsertQuota(userId, orientacion, DEFAULT_QUOTA);
  }

  const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

  res.json({ token, user: { id: userId, name, email, role: 'student' } });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email y password son requeridos' });
  }

  const user = await getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'student' } });
});

app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { id, name, email, role } = req.user;
  res.json({ user: { id, name, email, role: role || 'student' } });
});

// ==================== GUEST: demo sin persistencia ====================

app.post('/api/guest/chat', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }

  const { messages, caso, orientacion } = req.body;
  if (!messages || !caso || !orientacion) {
    return res.status(400).json({ error: 'Falta messages, caso u orientacion' });
  }

  try {
    const systemPrompt = `${PROMPTS_ORIENTACION[orientacion] || PROMPTS_ORIENTACION['Humanista']}

DATOS DEL PACIENTE:
${JSON.stringify(caso, null, 2)}

Responde de manera breve y natural (2-4 oraciones máximo). Usa lenguaje coloquial colombiano cuando sea apropiado.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1000, system: systemPrompt, messages }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data.error?.message || 'Error Anthropic' });
    }

    return res.json({ response: normalizeAnthropicResponse(data) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// Evaluación para el demo de invitado (NO guarda la sesión)
app.post('/api/guest/evaluate', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }
  const { messages, orientacion, historia } = req.body;
  if (!messages || !orientacion || !historia) {
    return res.status(400).json({ error: 'Falta messages, orientacion o historia' });
  }

  try {
    const transcript = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === 'user' ? 'ESTUDIANTE' : 'PACIENTE'}: ${m.content}`
      )
      .join('\n');

    const evalPrompt = `${PROMPT_EVALUACION}\n\nORIENTACIÓN TEÓRICA DEL ESTUDIANTE: ${orientacion}\n\nTRANSCRIPCIÓN DE LA ENTREVISTA:\n${transcript}\n\nHISTORIA CLÍNICA ELABORADA:\n${JSON.stringify(historia, null, 2)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 2000, messages: [{ role: 'user', content: evalPrompt }] }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data.error?.message || 'Error Anthropic' });
    }
    const text = normalizeAnthropicResponse(data);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'No se pudo parsear evaluación JSON' });
    let evaluation;
    try { evaluation = JSON.parse(jsonMatch[0]); } catch { return res.status(500).json({ error: 'JSON mal formado' }); }
    return res.json({ evaluation });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// ==================== CHAT (autenticado: student, teacher, admin) ====================

app.post('/api/chat', authMiddleware, requireRole('student', 'teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }

  const { type, messages, caso, orientacion, historia } = req.body;
  if (!type || !messages || !caso || !orientacion) {
    return res.status(400).json({ error: 'Falta type, messages, caso u orientacion' });
  }

  try {
    if (type === 'interview') {
      const systemPrompt = `${PROMPTS_ORIENTACION[orientacion] || PROMPTS_ORIENTACION['Humanista']}

DATOS DEL PACIENTE:
${JSON.stringify(caso, null, 2)}

Responde de manera breve y natural (2-4 oraciones máximo). Usa lenguaje coloquial colombiano cuando sea apropiado.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1000, system: systemPrompt, messages }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(502).json({ error: data.error?.message || 'Error Anthropic' });
      }

      return res.json({ response: normalizeAnthropicResponse(data) });
    }

    if (type === 'evaluation') {
      const transcript = messages
        .map((m: { role: string; content: string }) =>
          `${m.role === 'user' ? 'ESTUDIANTE' : 'PACIENTE'}: ${m.content}`
        )
        .join('\n');

      const evalPrompt = `${PROMPT_EVALUACION}\n\nORIENTACIÓN TEÓRICA DEL ESTUDIANTE: ${orientacion}\n\nTRANSCRIPCIÓN DE LA ENTREVISTA:\n${transcript}\n\nHISTORIA CLÍNICA ELABORADA:\n${JSON.stringify(historia, null, 2)}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 2000, messages: [{ role: 'user', content: evalPrompt }] }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(502).json({ error: data.error?.message || 'Error Anthropic' });
      }

      const text = normalizeAnthropicResponse(data);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: 'No se pudo parsear evaluación JSON' });
      }

      let evaluation;
      try {
        evaluation = JSON.parse(jsonMatch[0]);
      } catch (err) {
        return res.status(500).json({ error: 'JSON mal formado en respuesta de Anthropic' });
      }

      const sessionId = await insertSession({
        user_id: req.user?.id,
        estudiante_nombre: req.body.estudiante_nombre || null,
        orientacion,
        caso,
        mensajes: messages,
        historia,
        evaluacion: evaluation,
      });

      return res.json({ evaluation, sessionId });
    }

    return res.status(400).json({ error: 'type inválido' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// ==================== SESSIONS ====================

// Student: solo sus sesiones. Teacher/Admin: todas
app.get('/api/sessions', authMiddleware, requireRole('student', 'teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const role = req.user.role || 'student';
  if (role === 'student') {
    const rows = await listSessionsByUser(req.user.id);
    return res.json({ sessions: rows });
  }
  // teacher y admin ven todo
  const rows = await listSessions();
  res.json({ sessions: rows });
});

app.get('/api/sessions/:id', authMiddleware, requireRole('student', 'teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const session = await getSession(id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

  // Student solo puede ver sus propias sesiones
  const role = req.user.role || 'student';
  if (role === 'student' && (session as any).user_id !== req.user.id) {
    return res.status(403).json({ error: 'No tienes acceso a esta sesión' });
  }

  res.json({ session });
});

// Eliminar sesión: admin cualquiera; profesor solo las de sus estudiantes
app.delete('/api/sessions/:id', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const session = await getSession(id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

  if (req.user.role === 'teacher') {
    const owner = (session as any).user_id ? await getUserById((session as any).user_id) : null;
    if (!owner || owner.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Esa sesión no pertenece a un estudiante a tu cargo' });
    }
  }

  await deleteSession(id);
  res.json({ ok: true });
});

app.post('/api/sessions', authMiddleware, requireRole('student', 'teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const { estudiante_nombre, orientacion, caso, mensajes, historia, evaluacion } = req.body;
  if (!caso || !mensajes) {
    return res.status(400).json({ error: 'caso y mensajes son requeridos' });
  }

  // Los estudiantes solo pueden guardar entrevistas dentro del cupo asignado por su profesor
  if (req.user.role === 'student' && orientacion) {
    const quotas = await listQuotasByStudent(req.user.id);
    const q = quotas.find((x: any) => x.orientacion === orientacion);
    if (!q) {
      return res.status(403).json({ error: `No tienes entrevistas asignadas de la orientación "${orientacion}"` });
    }
    if (q.used >= q.max_count) {
      return res.status(403).json({ error: `Alcanzaste el límite de entrevistas de "${orientacion}" (${q.max_count})` });
    }
  }

  const id = await insertSession({
    user_id: req.user?.id,
    estudiante_nombre,
    orientacion,
    caso,
    mensajes,
    historia,
    evaluacion,
  });
  return res.json({ id });
});

// ==================== ESTUDIANTE: dashboard (cupos + métricas) ====================

app.get('/api/student/dashboard', authMiddleware, requireRole('student', 'teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const quotas = await listQuotasByStudent(req.user.id);
  const metrics = await getStudentMetrics(req.user.id);
  res.json({
    quotas: quotas.map((q: any) => ({
      orientacion: q.orientacion,
      max: q.max_count,
      used: q.used,
      remaining: Math.max(0, q.max_count - q.used),
    })),
    metrics,
  });
});

// ==================== ADMIN: CRUD USUARIOS ====================

app.get('/api/admin/users', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const users = await listUsers();
  res.json({ users });
});

app.post('/api/admin/users', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email y password son requeridos' });
  }
  const validRoles: Role[] = ['admin', 'teacher', 'student', 'guest'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  const existing = await getUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'Usuario ya existe' });

  const password_hash = await bcrypt.hash(password, 10);
  const userId = await createUser({ name, email, password_hash, role: role || 'student' });
  res.json({ id: userId, name, email, role: role || 'student' });
});

app.put('/api/admin/users/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { name, email, role, password, teacher_id } = req.body;
  const validRoles: Role[] = ['admin', 'teacher', 'student', 'guest'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  // Reasignar profesor: número válido (profesor) o null para desasignar
  let teacherIdVal: number | null | undefined = undefined;
  if (teacher_id !== undefined) {
    if (teacher_id === null || teacher_id === "") {
      teacherIdVal = null;
    } else {
      const t = await getUserById(Number(teacher_id));
      if (!t || t.role !== 'teacher') return res.status(400).json({ error: 'Profesor inválido' });
      teacherIdVal = t.id;
    }
  }
  const password_hash = password ? await bcrypt.hash(password, 10) : undefined;
  await updateUser(id, { name, email, role, password_hash, teacher_id: teacherIdVal });
  const updated = await getUserById(id);
  if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
});

app.put('/api/admin/users/:id/role', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { role } = req.body;
  const validRoles: Role[] = ['admin', 'teacher', 'student', 'guest'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  await updateUserRole(id, role);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }
  await deleteUser(id);
  res.json({ ok: true });
});

// ==================== ADMIN: CONFIG GLOBAL ====================

app.get('/api/admin/config', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const config = await listConfig();
  res.json({ config });
});

app.put('/api/admin/config/:key', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value es requerido' });
  await setConfig(key, String(value));
  res.json({ ok: true });
});

// ==================== CASOS CLÍNICOS (CRUD) ====================

// Listar con stats opcionales
app.get('/api/cases', optionalAuth, async (req: AuthRequest, res: Response) => {
  const role = req.user?.role || 'guest';
  const includePrivate = role === 'admin' || role === 'teacher';
  const cases = await listClinicalCases(includePrivate);

  // Para teacher/admin: incluir estadísticas
  if (req.query.stats === '1' && (role === 'admin' || role === 'teacher')) {
    const stats = await getAllCaseStats();
    const casesWithStats = cases.map((c: any) => ({
      ...c,
      stats: stats[c.id] || { total_sessions: 0, total_evaluated: 0, avg_score: null },
    }));
    return res.json({ cases: casesWithStats });
  }

  // Para student: ocultar notas_docente y contexto completo
  if (role === 'student' || role === 'guest') {
    const filtered = cases.map((c: any) => {
      const { notas_docente, ...rest } = c;
      return rest;
    });
    return res.json({ cases: filtered });
  }

  res.json({ cases });
});

app.get('/api/cases/slug/:slug', optionalAuth, async (req: AuthRequest, res: Response) => {
  const c = await getClinicalCaseBySlug(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Caso no encontrado' });
  const role = req.user?.role || 'guest';
  if (!c.is_public && role !== 'admin' && role !== 'teacher') {
    return res.status(403).json({ error: 'No tienes acceso a este caso' });
  }
  if (role === 'student' || role === 'guest') {
    const { notas_docente, ...rest } = c;
    return res.json({ case: rest });
  }
  res.json({ case: c });
});

app.get('/api/cases/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const c = await getClinicalCase(id);
  if (!c) return res.status(404).json({ error: 'Caso no encontrado' });
  const role = req.user?.role || 'guest';
  if (!c.is_public && role !== 'admin' && role !== 'teacher') {
    return res.status(403).json({ error: 'No tienes acceso a este caso' });
  }
  if (role === 'student' || role === 'guest') {
    const { notas_docente, ...rest } = c;
    return res.json({ case: rest });
  }
  res.json({ case: c });
});

// Generar un caso clínico con IA (no lo guarda; devuelve el borrador para revisar)
app.post('/api/cases/generate', authMiddleware, requireRole('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }
  const { descripcion, dificultad, categoria } = req.body;
  if (!descripcion || !String(descripcion).trim()) {
    return res.status(400).json({ error: 'Describe brevemente el caso que quieres generar' });
  }

  const prompt = `Eres un experto en psicología clínica. Genera UN caso clínico simulado, realista y con contexto colombiano, para entrenamiento de estudiantes de psicología.

PETICIÓN DEL DOCENTE: ${descripcion}
${dificultad ? `DIFICULTAD DESEADA: ${dificultad}` : ''}
${categoria ? `CATEGORÍA/TEMÁTICA: ${categoria}` : ''}

Responde EXCLUSIVAMENTE con un objeto JSON válido (sin texto adicional, sin markdown, sin \`\`\`), con exactamente estas claves.
REGLAS ESTRICTAS DE FORMATO: el JSON debe ir en una sola línea; NO uses saltos de línea reales dentro de los valores de texto (usa espacios o "; "); escapa las comillas dobles internas; no agregues comentarios ni texto antes o después del JSON.
{
  "nombre": "nombre completo ficticio",
  "edad": número,
  "genero": "masculino" | "femenino" | "otro",
  "motivo": "motivo de consulta breve (una frase)",
  "categoria": "${categoria || 'una categoría corta en minúsculas, ej: ansiedad, depresion, trauma'}",
  "dificultad": "${dificultad || 'basico | intermedio | avanzado'}",
  "tags": ["3-5 etiquetas cortas"],
  "objetivos": ["2-4 objetivos de aprendizaje para el estudiante"],
  "presentacion": "primera frase que dice el paciente al iniciar la entrevista, en primera persona y tono coloquial colombiano",
  "contexto": "descripción clínica completa del caso (varias frases): síntomas, evolución, situación vital",
  "personalidad": "cómo se comporta el paciente en la entrevista (tono, actitud, defensas)",
  "antecedentes_medicos": "antecedentes médicos y de salud relevantes",
  "dinamica_familiar": "estructura y dinámica familiar relevante",
  "notas_docente": "notas para el docente: puntos clave a evaluar y riesgos"
}`;

  // Intenta parsear el texto de la IA como JSON, saneando errores comunes
  const parseCaso = (raw: string): any | null => {
    let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    text = text.slice(start, end + 1);
    // 1) intento directo
    try { return JSON.parse(text); } catch {}
    // 2) escapar saltos de línea/tab reales que estén dentro de strings
    let out = '';
    let inStr = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' && text[i - 1] !== '\\') inStr = !inStr;
      if (inStr && (ch === '\n' || ch === '\r')) { out += '\\n'; continue; }
      if (inStr && ch === '\t') { out += '\\t'; continue; }
      out += ch;
    }
    // 3) quitar comas colgantes
    out = out.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(out); } catch {}
    return null;
  };

  try {
    let caso: any = null;
    let lastErr = '';
    // Hasta 3 intentos: la IA a veces devuelve JSON malformado
    for (let attempt = 0; attempt < 3 && !caso; attempt++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      if (!response.ok) {
        lastErr = data.error?.message || 'Error Anthropic';
        continue;
      }
      caso = parseCaso(normalizeAnthropicResponse(data));
    }

    if (!caso) {
      return res.status(502).json({ error: lastErr || 'La IA no devolvió un JSON válido. Intenta de nuevo.' });
    }

    // slug derivado del nombre (editable luego en el formulario)
    const slug = String(caso.nombre || 'caso')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 40) + '-' + Date.now().toString().slice(-4);

    res.json({ case: { ...caso, slug, tipo: 'típico', is_public: false } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

app.post('/api/cases', authMiddleware, requireRole('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  const { slug, nombre, edad, motivo, presentacion, contexto } = req.body;
  if (!slug || !nombre || !edad || !motivo || !presentacion || !contexto) {
    return res.status(400).json({ error: 'Campos requeridos: slug, nombre, edad, motivo, presentacion, contexto' });
  }
  const id = await createClinicalCase({ ...req.body, created_by: req.user.id });
  const created = await getClinicalCase(id!);
  res.json({ case: created });
});

app.put('/api/cases/:id', authMiddleware, requireRole('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { slug, created_by, created_at, id: _id, tags_json, objetivos_json, ...fields } = req.body;
  await updateClinicalCase(id, fields);
  const updated = await getClinicalCase(id);
  res.json({ case: updated });
});

app.delete('/api/cases/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await deleteClinicalCase(id);
  res.json({ ok: true });
});

// Duplicar caso
app.post('/api/cases/:id/duplicate', authMiddleware, requireRole('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const original = await getClinicalCase(id);
  if (!original) return res.status(404).json({ error: 'Caso no encontrado' });
  const newSlug = `${original.slug}-copia-${Date.now()}`;
  const newId = await duplicateClinicalCase(id, newSlug);
  const created = await getClinicalCase(newId!);
  res.json({ case: created });
});

// Exportar caso como JSON
app.get('/api/cases/:id/export', authMiddleware, requireRole('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const c = await getClinicalCase(id);
  if (!c) return res.status(404).json({ error: 'Caso no encontrado' });
  const { id: _id, created_by, created_at, updated_at, tags_json, objetivos_json, ...exportData } = c as any;
  res.json({ export: { ...exportData, tags: c.tags, objetivos: c.objetivos } });
});

// Importar caso desde JSON
app.post('/api/cases/import', authMiddleware, requireRole('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  const data = req.body;
  if (!data.slug || !data.nombre || !data.edad || !data.motivo || !data.presentacion || !data.contexto) {
    return res.status(400).json({ error: 'JSON incompleto: faltan campos requeridos' });
  }
  // Evitar slug duplicado
  const existing = await getClinicalCaseBySlug(data.slug);
  if (existing) {
    data.slug = `${data.slug}-import-${Date.now()}`;
  }
  const id = await createClinicalCase({ ...data, created_by: req.user.id });
  const created = await getClinicalCase(id!);
  res.json({ case: created });
});

// Stats de todos los casos
app.get('/api/cases-stats', authMiddleware, requireRole('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  const stats = await getAllCaseStats();
  res.json({ stats });
});

// ==================== TEACHER: reportes ====================

app.get('/api/teacher/sessions', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const userId = req.query.user_id ? Number(req.query.user_id) : null;

  // IDs de los estudiantes del profesor (para restringir su visibilidad)
  let allowedIds: number[] | null = null;
  if (req.user.role === 'teacher') {
    const users = await listUsers();
    allowedIds = users.filter((u: any) => u.role === 'student' && u.teacher_id === req.user.id).map((u: any) => u.id);
  }

  if (userId) {
    if (allowedIds && !allowedIds.includes(userId)) {
      return res.status(403).json({ error: 'Ese estudiante no está a tu cargo' });
    }
    const rows = await listSessionsByUser(userId);
    return res.json({ sessions: rows });
  }

  let rows = await listSessions();
  if (allowedIds) {
    rows = rows.filter((s: any) => allowedIds!.includes(s.user_id));
  }
  res.json({ sessions: rows });
});

app.get('/api/teacher/students', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const users = await listUsers();
  let students = users.filter((u: any) => u.role === 'student');
  // El profesor solo ve a sus propios estudiantes; el admin ve todos
  if (req.user.role === 'teacher') {
    students = students.filter((u: any) => u.teacher_id === req.user.id);
  }
  res.json({ students });
});

// Profesor/Admin: editar datos y contraseña de un estudiante
app.put('/api/teacher/students/:id', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const target = await getUserById(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.role !== 'student') {
    return res.status(403).json({ error: 'Solo puedes editar estudiantes' });
  }
  const { name, email, password } = req.body;
  if (password && password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const password_hash = password ? await bcrypt.hash(password, 10) : undefined;
  await updateUser(id, { name, email, password_hash });
  const updated = await getUserById(id);
  res.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
});

// Profesor/Admin: ver cupos de orientación de un estudiante
app.get('/api/teacher/students/:id/quotas', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const target = await getUserById(id);
  if (!target || target.role !== 'student') return res.status(404).json({ error: 'Estudiante no encontrado' });
  if (req.user.role === 'teacher' && target.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'Ese estudiante no está a tu cargo' });
  }
  const quotas = await listQuotasByStudent(id);
  res.json({ quotas: quotas.map((q: any) => ({ orientacion: q.orientacion, max: q.max_count, used: q.used })) });
});

// Profesor/Admin: asignar cupos de orientación a un estudiante
app.put('/api/teacher/students/:id/quotas', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const target = await getUserById(id);
  if (!target || target.role !== 'student') return res.status(404).json({ error: 'Estudiante no encontrado' });
  if (req.user.role === 'teacher' && target.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'Ese estudiante no está a tu cargo' });
  }
  const { quotas } = req.body;
  if (!Array.isArray(quotas)) return res.status(400).json({ error: 'quotas debe ser un arreglo' });
  await setQuotas(id, quotas.map((q: any) => ({ orientacion: String(q.orientacion), max_count: Number(q.max_count) || 0 })));
  const updated = await listQuotasByStudent(id);
  res.json({ quotas: updated.map((q: any) => ({ orientacion: q.orientacion, max: q.max_count, used: q.used })) });
});

// Profesor/Admin: asignación masiva de cupos a TODOS sus estudiantes
app.put('/api/teacher/students/quotas/bulk', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const { quotas } = req.body;
  if (!Array.isArray(quotas)) return res.status(400).json({ error: 'quotas debe ser un arreglo' });

  const users = await listUsers();
  let students = users.filter((u: any) => u.role === 'student');
  if (req.user.role === 'teacher') {
    students = students.filter((u: any) => u.teacher_id === req.user.id);
  }

  const valid = quotas
    .map((q: any) => ({ orientacion: String(q.orientacion), max_count: Number(q.max_count) || 0 }))
    .filter((q) => ORIENTACIONES.includes(q.orientacion) && q.max_count > 0);

  for (const s of students) {
    for (const q of valid) {
      await upsertQuota(s.id, q.orientacion, q.max_count);
    }
  }
  res.json({ ok: true, updated: students.length });
});

// Profesor/Admin: eliminar un estudiante
app.delete('/api/teacher/students/:id', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const target = await getUserById(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.role !== 'student') {
    return res.status(403).json({ error: 'Solo puedes eliminar estudiantes' });
  }
  await deleteUser(id);
  res.json({ ok: true });
});

// ==================== START ====================

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
