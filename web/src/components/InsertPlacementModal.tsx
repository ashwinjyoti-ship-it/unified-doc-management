import { FileText, FilePlus, Link2 } from 'lucide-react';

interface InsertPlacementModalProps {
  open: boolean;
  itemTitle: string;
  onClose: () => void;
  onSamePage: () => void;
  onLinkHere: () => void;
  onNewPage: () => void;
}

export default function InsertPlacementModal({
  open,
  itemTitle,
  onClose,
  onSamePage,
  onLinkHere,
  onNewPage,
}: InsertPlacementModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[110] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="card-surface w-full max-w-md p-6 rounded-t-2xl md:rounded-[14px] safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-lg mb-1">Add {itemTitle}</h3>
        <p className="text-sm text-mid-gray mb-4">Where should this go?</p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onSamePage}
            className="w-full text-left p-3 rounded-xl border border-green-mist hover:border-forest hover:bg-sage/20 transition-colors flex items-start gap-3"
          >
            <FileText className="w-5 h-5 text-forest shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">On this page</div>
              <div className="text-xs text-mid-gray mt-0.5">Insert inline in the current page</div>
            </div>
          </button>
          <button
            type="button"
            onClick={onLinkHere}
            className="w-full text-left p-3 rounded-xl border border-green-mist hover:border-forest hover:bg-sage/20 transition-colors flex items-start gap-3"
          >
            <Link2 className="w-5 h-5 text-forest shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">Create &amp; link here</div>
              <div className="text-xs text-mid-gray mt-0.5">New page in project, link stays on this page</div>
            </div>
          </button>
          <button
            type="button"
            onClick={onNewPage}
            className="w-full text-left p-3 rounded-xl border border-green-mist hover:border-forest hover:bg-sage/20 transition-colors flex items-start gap-3"
          >
            <FilePlus className="w-5 h-5 text-forest shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">New page in project</div>
              <div className="text-xs text-mid-gray mt-0.5">Create a dedicated page and open it</div>
            </div>
          </button>
        </div>

        <button type="button" onClick={onClose} className="btn-secondary w-full text-sm mt-4">
          Cancel
        </button>
      </div>
    </div>
  );
}
