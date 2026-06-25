import { memo, useCallback } from 'react';
import { useDebouncedField } from '../hooks/useDebouncedField';

interface DatabaseTextCellProps {
  rowId: string;
  propId: string;
  value: string;
  type: 'text' | 'number' | 'long_text';
  onPersist: (rowId: string, propId: string, value: string) => void;
  className?: string;
}

function DatabaseTextCell({ rowId, propId, value, type, onPersist, className }: DatabaseTextCellProps) {
  const persist = useCallback(
    (v: string) => onPersist(rowId, propId, v),
    [rowId, propId, onPersist],
  );
  const { local, onFocus, onChange, onBlur } = useDebouncedField({
    value,
    onPersist: persist,
  });

  if (type === 'long_text') {
    return (
      <textarea
        value={local}
        rows={3}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${className} resize-y min-h-[4rem]`}
      />
    );
  }

  return (
    <input
      type={type === 'number' ? 'number' : 'text'}
      inputMode={type === 'number' ? 'decimal' : 'text'}
      value={local}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={className}
    />
  );
}

export default memo(DatabaseTextCell);
