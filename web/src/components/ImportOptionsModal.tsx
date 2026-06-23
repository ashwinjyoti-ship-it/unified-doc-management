export type ImportMode = 'append' | 'overwrite' | 'new';

interface ImportOptionsModalProps {
  open: boolean;
  sourceLabel: string;
  sourceType: 'file' | 'url';
  onClose: () => void;
  onConfirm: (mode: ImportMode) => void;
}

export default function ImportOptionsModal({
  open, sourceLabel, sourceType, onClose, onConfirm,
}: ImportOptionsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-surface w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-1">Import options</h3>
        <p className="text-sm text-mid-gray mb-4 truncate">
          {sourceType === 'file' ? 'File' : 'URL'}: {sourceLabel}
        </p>

        <div className="space-y-2 mb-6">
          <button
            type="button"
            onClick={() => onConfirm('append')}
            className="w-full text-left p-3 rounded-xl border border-green-mist hover:border-forest hover:bg-sage/20 transition-colors"
          >
            <div className="font-medium text-sm">Add to current page</div>
            <div className="text-xs text-mid-gray mt-0.5">Append imported content below existing text</div>
          </button>
          <button
            type="button"
            onClick={() => onConfirm('overwrite')}
            className="w-full text-left p-3 rounded-xl border border-green-mist hover:border-forest hover:bg-sage/20 transition-colors"
          >
            <div className="font-medium text-sm">Overwrite current page</div>
            <div className="text-xs text-mid-gray mt-0.5">Replace all content on this page</div>
          </button>
          <button
            type="button"
            onClick={() => onConfirm('new')}
            className="w-full text-left p-3 rounded-xl border border-green-mist hover:border-forest hover:bg-sage/20 transition-colors"
          >
            <div className="font-medium text-sm">Create new page</div>
            <div className="text-xs text-mid-gray mt-0.5">Import into a brand-new page</div>
          </button>
        </div>

        <button type="button" onClick={onClose} className="btn-secondary w-full text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
