import { useEffect, useRef, useState } from 'react';

interface NamePromptModalProps {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  defaultIcon?: string;
  showIcon?: boolean;
  iconLabel?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (name: string, icon?: string) => void;
}

export default function NamePromptModal({
  open,
  title,
  label,
  placeholder = '',
  defaultValue = '',
  defaultIcon = '📁',
  showIcon = false,
  iconLabel = 'Icon (emoji)',
  confirmLabel = 'Create',
  onClose,
  onConfirm,
}: NamePromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [icon, setIcon] = useState(defaultIcon);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setIcon(defaultIcon);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue, defaultIcon]);

  if (!open) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed, showIcon ? icon.trim() || defaultIcon : undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="card-surface w-full max-w-md p-6 rounded-t-2xl md:rounded-[14px] safe-bottom" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-4">{title}</h3>
        {showIcon && (
          <div className="mb-4">
            <label className="block text-sm text-mid-gray mb-1.5">{iconLabel}</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              className="w-20 px-3 py-2 rounded-lg border border-green-mist bg-warm-white outline-none focus:border-forest text-center text-xl"
            />
          </div>
        )}
        <label className="block text-sm text-mid-gray mb-1.5">{label}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-green-mist bg-warm-white outline-none focus:border-forest mb-6"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
