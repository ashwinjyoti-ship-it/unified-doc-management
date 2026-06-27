interface AlertDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export default function AlertDialog({ open, message, onClose }: AlertDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[200] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="card-surface w-full max-w-sm p-6 rounded-t-2xl md:rounded-[14px] safe-bottom"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="alert-dialog-message"
      >
        <p id="alert-dialog-message" className="text-sm text-charcoal mb-5 whitespace-pre-wrap">
          {message}
        </p>
        <button type="button" onClick={onClose} className="btn-primary w-full text-sm">
          OK
        </button>
      </div>
    </div>
  );
}
