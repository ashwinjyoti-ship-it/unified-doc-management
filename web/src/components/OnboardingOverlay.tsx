import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { markOnboardingComplete } from '../lib/onboarding';
import AppAvatar from './AppAvatar';
import { FileText, Palette, Sparkles, Users } from 'lucide-react';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: FileText,
    title: 'Write',
    description: 'Create pages, folders, and databases in a rich block editor with markdown support.',
  },
  {
    icon: Palette,
    title: 'Design',
    description: 'Build visual layouts on an infinite canvas with frames, shapes, and agent design-to-code.',
  },
  {
    icon: Sparkles,
    title: 'Instruct your agent',
    description: 'Select text and leave agent instructions on any block — let AI do the work.',
  },
  {
    icon: Users,
    title: 'Collaborate',
    description: 'Edit together in real time with shared cursors and live sync across all your docs.',
  },
] as const;

export default function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const navigate = useNavigate();
  const recent = useStore((s) => s.recent);
  const pages = useStore((s) => s.pages);

  const finish = () => {
    markOnboardingComplete();
    onComplete();
    const lastDoc = recent[0] ?? pages[0];
    navigate(lastDoc ? `/page/${lastDoc.id}` : '/');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="card-surface w-full max-w-md p-8 text-center shadow-2xl shadow-forest/20">
        <AppAvatar
          size="xl"
          variant="onboarding"
          className="mx-auto mb-6 rounded-2xl shadow-lg shadow-forest/15"
        />

        <h2 id="onboarding-title" className="text-2xl font-bold text-charcoal mb-2">
          Welcome to <span className="text-forest">Tandem</span>
        </h2>
        <p className="text-warm-gray mb-8">
          An open-source, agent-native workspace where humans and coding agents collaborate through structured documents, databases, and design canvases.
        </p>

        <ul className="space-y-4 mb-8 text-left">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <li
              key={title}
              className="flex gap-3 items-start onboarding-step"
              style={{ animationDelay: `${0.6 + index * 0.15}s` }}
            >
              <span className="shrink-0 w-9 h-9 rounded-xl bg-linen flex items-center justify-center text-forest">
                <Icon className="w-4 h-4" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block font-semibold text-sm text-charcoal">{title}</span>
                <span className="block text-sm text-warm-gray">{description}</span>
              </span>
            </li>
          ))}
        </ul>

        <button type="button" className="btn-primary w-full" onClick={finish}>
          Get started
        </button>
      </div>
    </div>
  );
}
