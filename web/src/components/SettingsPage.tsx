import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { API_ENDPOINT_GROUPS } from '../lib/apiEndpoints';
import {
  buildAgentConnectInstructions,
  loadStoredAgentApiKey,
  persistAgentApiKey,
} from '../lib/agentConnectInstructions';
import Tooltip from './Tooltip';
import MobileStandaloneHeader from './MobileStandaloneHeader';
import ConfirmDialog from './ConfirmDialog';
import type { Theme, Workspace } from '../types';
import { ArrowLeft, Key, Copy, Check, Sun, Moon, Monitor, Sparkles, Loader2 } from 'lucide-react';

function WorkspaceRenameSection({
  workspace,
  renameWorkspace,
}: {
  workspace: Workspace;
  renameWorkspace: (name: string) => Promise<void>;
}) {
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [workspaceSaved, setWorkspaceSaved] = useState(false);

  return (
    <section className="card-surface p-6 mb-6">
      <h2 className="font-semibold mb-2">Workspace</h2>
      <p className="text-sm text-warm-gray mb-4">Rename your workspace (e.g. &ldquo;My Knowledge Base&rdquo;).</p>
      <div className="flex gap-2">
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-green-mist bg-warm-white outline-none focus:border-forest text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            if (!workspaceName.trim()) return;
            await renameWorkspace(workspaceName.trim());
            setWorkspaceSaved(true);
            setTimeout(() => setWorkspaceSaved(false), 2000);
          }}
          className="btn-primary text-sm shrink-0"
        >
          {workspaceSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { user, logout, theme, setTheme, workspace, renameWorkspace, loadWorkspace, loadPages } = useStore();
  const navigate = useNavigate();
  const [keyDraft, setKeyDraft] = useState(() => loadStoredAgentApiKey());
  const [copied, setCopied] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [confirmSeed, setConfirmSeed] = useState(false);

  const effectiveApiKey = keyDraft.trim();
  const agentInstructions = effectiveApiKey ? buildAgentConnectInstructions(effectiveApiKey) : null;

  const updateApiKey = (key: string) => {
    setKeyDraft(key);
    persistAgentApiKey(key);
  };

  const generateApiKey = async () => {
    const { key } = await api.createApiKey('Integration Key');
    updateApiKey(key);
  };

  const copyKey = () => {
    if (!effectiveApiKey) return;
    navigator.clipboard.writeText(effectiveApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAgentInstructions = () => {
    if (!agentInstructions) return;
    navigator.clipboard.writeText(agentInstructions);
    setCopiedInstructions(true);
    setTimeout(() => setCopiedInstructions(false), 2000);
  };

  const loadDemoKnowledgeBase = () => {
    setConfirmSeed(true);
  };

  const confirmLoadDemoKnowledgeBase = async () => {
    setConfirmSeed(false);
    setSeedLoading(true);
    setSeedMessage(null);
    try {
      const result = await api.seedKnowledgeBase();
      await loadWorkspace();
      await loadPages();
      setSeedMessage(result.message);
      navigate(`/page/${result.pageIds.projectId}`);
    } catch (err) {
      setSeedMessage(err instanceof Error ? err.message : 'Could not load demo data');
    } finally {
      setSeedLoading(false);
    }
  };

  const themes: { value: Theme; label: string; icon: ReactNode; tooltip: string }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" />, tooltip: 'Light background — best for bright environments' },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" />, tooltip: 'Dark background — reduces eye strain in low light' },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" />, tooltip: 'Match your operating system appearance setting' },
  ];

  return (
    <>
      <MobileStandaloneHeader title="Settings" />
      <div className="p-6 md:p-10 max-w-2xl mx-auto w-full min-h-full">
      <Tooltip text="Go back to the previous page">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-warm-gray hover:text-charcoal mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </Tooltip>

      <h1 className="hidden md:block text-2xl font-bold text-charcoal mb-8">Settings</h1>

      {workspace && (
        <WorkspaceRenameSection
          key={workspace.id}
          workspace={workspace}
          renameWorkspace={renameWorkspace}
        />
      )}

      <section className="card-surface p-6 mb-6">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-forest" /> Demo data
        </h2>
        <p className="text-sm text-warm-gray mb-4">
          Load a sample &ldquo;My Knowledge Base&rdquo; project with folders, linked pages, a daily note in Inbox, and a weekly review.
        </p>
        <Tooltip text="Adds demo folders and pages to your current workspace">
          <button
            type="button"
            onClick={() => void loadDemoKnowledgeBase()}
            disabled={seedLoading}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {seedLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Load demo Knowledge Base
          </button>
        </Tooltip>
        {seedMessage && (
          <p className={`text-sm mt-3 ${seedMessage.includes('Could not') ? 'text-red-600' : 'text-forest'}`}>
            {seedMessage}
          </p>
        )}
      </section>

      <section className="card-surface p-6 mb-6">
        <h2 className="font-semibold mb-4">Appearance</h2>
        <p className="text-sm text-warm-gray mb-4">Choose a color theme for the interface.</p>
        <div className="flex flex-wrap gap-2">
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
          Your permanent API key is filled in below for agent instructions. Use the{' '}
          <code className="bg-linen px-1 rounded">X-API-Key</code> header, or copy the ready-made agent prompt.
        </p>

        <div className="space-y-3">
          <Tooltip text="Create a new API key (replaces the one shown below in this browser)">
            <button type="button" onClick={() => void generateApiKey()} className="btn-secondary text-sm">
              Generate new API Key
            </button>
          </Tooltip>
          <div>
            <label htmlFor="api-key-input" className="block text-xs text-warm-gray mb-1">
              Permanent API key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="api-key-input"
                type="text"
                value={keyDraft}
                onChange={(e) => updateApiKey(e.target.value)}
                placeholder="udm_…"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 px-3 py-2 rounded-lg border border-green-mist bg-warm-white outline-none focus:border-forest text-xs font-mono"
              />
              <Tooltip text="Copy API key">
                <button
                  type="button"
                  onClick={copyKey}
                  disabled={!effectiveApiKey}
                  className="btn-secondary p-2 shrink-0 disabled:opacity-50"
                  aria-label="Copy API key"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-green-mist">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-medium text-charcoal">Agent connection instructions</h3>
            <Tooltip text="Copy full agent instructions including API key">
              <button
                type="button"
                onClick={copyAgentInstructions}
                disabled={!agentInstructions}
                className="btn-primary text-sm flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {copiedInstructions ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedInstructions ? 'Copied' : 'Copy'}
              </button>
            </Tooltip>
          </div>
          <p className="text-sm text-warm-gray mb-3">
            Paste into Cursor, Claude Code, or Codex so the agent can connect to Tandem over REST (includes your API key).
          </p>
          {agentInstructions ? (
            <div className="relative">
              <pre className="bg-linen px-3 py-3 pr-12 rounded-lg text-xs text-charcoal whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono leading-relaxed">
                {agentInstructions}
              </pre>
              <Tooltip text="Copy instructions">
                <button
                  type="button"
                  onClick={copyAgentInstructions}
                  className="absolute top-2 right-2 btn-secondary p-1.5"
                  aria-label="Copy agent instructions"
                >
                  {copiedInstructions ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </Tooltip>
            </div>
          ) : (
            <p className="text-sm text-warm-gray bg-linen rounded-lg px-3 py-3">
              Enter an API key above to unlock a ready-to-paste agent instruction.
            </p>
          )}
        </div>

        <div className="mt-4 p-3 bg-linen rounded-lg text-xs text-warm-gray">
          <p className="font-medium text-charcoal mb-2">API Endpoints</p>
          <p className="mb-3">
            Authenticate with <code className="bg-warm-white px-1 rounded">Authorization: Bearer &lt;token&gt;</code> or{' '}
            <code className="bg-warm-white px-1 rounded">X-API-Key: &lt;key&gt;</code>. See{' '}
            <code className="bg-warm-white px-1 rounded">docs/AGENT_API.md</code> for examples.
          </p>
          <div className="space-y-3">
            {API_ENDPOINT_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="font-medium text-charcoal mb-1">{group.title}</p>
                <ul className="space-y-0.5 font-mono">
                  {group.endpoints.map((endpoint) => (
                    <li key={endpoint}>{endpoint}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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

      <ConfirmDialog
        open={confirmSeed}
        title="Load demo Knowledge Base?"
        message={'This adds folders (Learning, Ideas, Tasks, Interesting), sample pages, daily note, and [[page links]]. Safe to run once — if already loaded, you\'ll be taken to the existing demo.'}
        confirmLabel="Load demo"
        onConfirm={() => { void confirmLoadDemoKnowledgeBase(); }}
        onCancel={() => setConfirmSeed(false)}
      />
    </>
  );
}
