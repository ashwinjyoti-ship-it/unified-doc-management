import { Loader2, X } from 'lucide-react';

interface OperationBannerProps {
  label: string;
  onCancel: () => void;
}

export default function OperationBanner({ label, onCancel }: OperationBannerProps) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-tooltip-bg text-tooltip-fg px-4 py-3 rounded-xl shadow-lg min-w-[280px] bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4rem))] md:bottom-6">
      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      <span className="text-sm flex-1">{label}</span>
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition-colors"
      >
        <X className="w-3.5 h-3.5" /> Stop
      </button>
    </div>
  );
}
