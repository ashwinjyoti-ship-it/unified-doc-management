import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import Tooltip from './Tooltip';
import type { Theme } from '../types';
import { ArrowLeft, Key, Copy, Check, Sun, Moon, Monitor } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout, theme, setTheme } = useStore();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateApiKey = async () => {
    const { key } = await api.createApiKey('Integration Key');
    setApiKey(key);
  };

  const copyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const themes: { value: Theme; label: string; icon: React.ReactNode; tooltip: string }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" />, tooltip: 'Light background — best for bright environments' },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" />, tooltip: 'Dark background — reduces eye strain in low light' },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" />, tooltip: 'Match your operating system appearance setting' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-2xl mx-auto w-full">
      <Tooltip text="Go back to the previous page">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-warm-gray hover:text-charcoal mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </Tooltip>

      <h1 className="text-2xl font-bold text-charcoal mb-8">Settings</h1>

      <section className="card-surface p-6 mb-6">
        <h2 className="font-semibold mb-4">Appearance</h2>
        <p className="text-sm text-warm-gray mb-4">Choose a color theme for the interface.</p>
        <div className="flex gap-2">
          {themes.map((t) => (
            <Tooltip key={t.value} text={t.tooltip}>
              <button
                onClick={() => setTheme(t.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  theme === t.value ? 'bg-sage/30 text-forest font-medium' : 'bg-linen hover:bg-green-mist'
                }`}
              >
                {t.icon} {t.label}
              </button>
            </Tooltip>
          ))}
        </div>
      </section>

      <section className="card-surface p-6 mb-6">
        <h2 className="font-semibold mb-4">Account</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-warm-gray">Name</span>
            <span>{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-warm-gray">Email</span>
            <span>{user?.email}</span>
          </div>
        </div>
      </section>

      <section className="card-surface p-6 mb-6">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <Key className="w-4 h-4" /> API Access
        </h2>
        <p className="text-sm text-warm-gray mb-4">
          Generate an API key for integrations and automation. Use the <code className="bg-linen px-1 rounded">X-API-Key</code> header.
        </p>

        {apiKey ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-linen px-3 py-2 rounded-lg text-xs break-all">{apiKey}</code>
            <Tooltip text="Copy API key to clipboard">
              <button onClick={copyKey} className="btn-secondary p-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </Tooltip>
          </div>
        ) : (
          <Tooltip text="Create a new API key for external integrations">
            <button onClick={generateApiKey} className="btn-primary text-sm">
              Generate API Key
            </button>
          </Tooltip>
        )}

        <div className="mt-4 p-3 bg-linen rounded-lg text-xs text-warm-gray">
          <p className="font-medium text-charcoal mb-1">API Endpoints</p>
          <p>GET /api/workspaces — List workspaces</p>
          <p>GET /api/pages/:id — Get page with blocks</p>
          <p>PUT /api/pages/:id/blocks — Update blocks</p>
          <p>GET /api/search?q=query — Full-text search</p>
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-semibold mb-4 text-red-600">Danger Zone</h2>
        <Tooltip text="Sign out and clear your session">
          <button onClick={logout} className="btn-secondary text-red-600 text-sm">
            Sign Out
          </button>
        </Tooltip>
      </section>
    </div>
  );
}
