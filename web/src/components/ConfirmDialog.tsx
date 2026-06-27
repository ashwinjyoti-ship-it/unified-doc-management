interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[200] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onCancel}
    >
      <div
        className="card-surface w-full max-w-sm p-6 rounded-t-2xl md:rounded-[14px] safe-bottom"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h3 id="confirm-dialog-title" className="font-semibold text-charcoal mb-2">{title}</h3>
        <p id="confirm-dialog-message" className="text-sm text-mid-gray mb-5 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 text-sm px-5 py-2.5 rounded-[10px] font-medium border-none cursor-pointer ${
              destructive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
