import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import {
  insertSession, listSessions, getSession, createUser, getUserByEmail, getUserById,
  listUsers, updateUserRole, deleteUser, updateUser,
  listSessionsByUser,
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
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIO_SECRETO_123';

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

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email y password son requeridos' });
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Usuario ya existe' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const userId = await createUser({ name, email, password_hash, role: 'student' });
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

app.post('/api/sessions', authMiddleware, requireRole('student', 'teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const { estudiante_nombre, orientacion, caso, mensajes, historia, evaluacion } = req.body;
  if (!caso || !mensajes) {
    return res.status(400).json({ error: 'caso y mensajes son requeridos' });
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
  const { name, email, role } = req.body;
  const validRoles: Role[] = ['admin', 'teacher', 'student', 'guest'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  await updateUser(id, { name, email, role });
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
  if (userId) {
    const rows = await listSessionsByUser(userId);
    return res.json({ sessions: rows });
  }
  const rows = await listSessions();
  res.json({ sessions: rows });
});

app.get('/api/teacher/students', authMiddleware, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  const users = await listUsers();
  const students = users.filter((u: any) => u.role === 'student');
  res.json({ students });
});

// ==================== START ====================

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
