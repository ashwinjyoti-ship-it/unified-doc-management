import { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { saveLastAuthEmail, getLastAuthEmail } from '../lib/authSession';
import { Shield, Users, Search, Settings, BarChart3 } from 'lucide-react';
import AppAvatar from './AppAvatar';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(() => getLastAuthEmail());
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      saveLastAuthEmail(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Shield, label: 'Secure' },
    { icon: Users, label: 'Collaborate' },
    { icon: Search, label: 'Search' },
    { icon: Settings, label: 'Automate' },
    { icon: BarChart3, label: 'Organize' },
  ];

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="card-surface w-full max-w-4xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="p-8 md:p-12">
            <h1 className="text-3xl font-bold text-charcoal leading-tight mb-2">
              Tandem —{' '}
              <span className="text-forest">Agent-Human Workspace</span>
            </h1>
            <p className="text-warm-gray mb-8">
              Where humans and AI agents work side by side.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-linen border-none outline-none focus:ring-2 focus:ring-sage"
                  required
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-linen border-none outline-none focus:ring-2 focus:ring-sage"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-linen border-none outline-none focus:ring-2 focus:ring-sage"
                required
                minLength={6}
              />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-sm text-mid-gray mt-4 text-center">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-forest font-medium hover:underline"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-forest to-shaded-green p-8 text-white">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-warm-white/10 flex items-center justify-center shadow-lg shadow-black/10">
                  <AppAvatar size="xl" className="rounded-2xl" />
                </div>
                <p className="text-sage text-lg">Create. Organize. Collaborate.</p>
              </div>
            </div>
            <div className="flex justify-between border-t border-white/20 pt-6">
              {features.map(({ icon: Icon, label }) => (
                <div key={label} className="text-center flex-1">
                  <Icon className="w-5 h-5 mx-auto mb-1 text-sage" strokeWidth={1.5} />
                  <span className="text-xs text-sage">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
