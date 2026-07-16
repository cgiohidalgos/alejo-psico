import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { AppLayout } from '@/components/AppLayout';
import { httpRequest } from '@/lib/api';
import { PlayCircle } from 'lucide-react';

interface Teacher { id: number; name: string; }

const ORIENTACIONES = ['Psicoanalítica', 'Cognitivo-Conductual', 'Humanista'];

const AuthPage = () => {
  const setUser = useAppStore((s) => s.setUser);
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [orientacion, setOrientacion] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'register' && teachers.length === 0) {
      httpRequest('/api/teachers')
        .then((data) => setTeachers(data.teachers || []))
        .catch(() => {/* no bloquea el registro */});
    }
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { name, email, password, teacher_id: teacherId ? Number(teacherId) : undefined, orientacion };
      const data = await httpRequest(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const user = { ...data.user, token: data.token, role: data.user.role || 'student' };
      setUser(user);

      // Redirigir según rol
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-center">
            {mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}
          </h2>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input"
                  placeholder="Tu nombre"
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium mb-1">Profesor</label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="">Selecciona tu profesor</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No hay profesores disponibles. Contacta al administrador.</p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium mb-1">Orientación teórica</label>
                <select
                  value={orientacion}
                  onChange={(e) => setOrientacion(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="">Selecciona una orientación</option>
                  {ORIENTACIONES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Recibirás un cupo inicial para esta orientación.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input"
                placeholder="usuario@dominio.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg border border-input"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-lg">
              {mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-primary underline"
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">o</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <button
            onClick={() => navigate('/demo')}
            className="w-full flex items-center justify-center gap-2 border-2 border-primary text-primary font-medium py-2.5 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Probar como invitado (demo)
          </button>
          <p className="text-xs text-muted-foreground text-center mt-2">Sin registro · practica una entrevista al instante</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default AuthPage;
