import { Menu } from 'lucide-react';
import { useStore } from '../lib/store';

interface MobileStandaloneHeaderProps {
  title: string;
}

/** Slim mobile header for Settings/Notifications — menu + title only (matches desktop: no workspace bar). */
export default function MobileStandaloneHeader({ title }: MobileStandaloneHeaderProps) {
  const { setSidebarOpen } = useStore();

  return (
    <div className="md:hidden flex items-center gap-2 px-3 py-3 border-b border-green-mist bg-warm-white sticky top-0 z-20 safe-top">
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="p-2 -ml-1 rounded-lg hover:bg-linen shrink-0"
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="flex-1 font-semibold text-forest text-sm truncate min-w-0">{title}</h1>
    </div>
  );
}
