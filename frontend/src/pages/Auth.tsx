import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { AppLayout } from '@/components/AppLayout';
import { httpRequest } from '@/lib/api';

const AuthPage = () => {
  const setUser = useAppStore((s) => s.setUser);
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { name, email, password };
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
        navigate('/casos');
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

          <div className="mt-3 text-center">
            <button
              onClick={() => navigate('/demo')}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Probar como invitado (demo)
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AuthPage;
