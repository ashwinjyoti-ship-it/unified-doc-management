import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDebouncedFieldOptions<T> {
  value: T;
  onPersist: (value: T) => void;
  debounceMs?: number;
  serialize?: (value: T) => string;
}

/**
 * Local field state for responsive typing. Syncs from props when not focused.
 * Calls onPersist on debounce and immediately on blur.
 */
export function useDebouncedField<T>({
  value,
  onPersist,
  debounceMs = 400,
  serialize = (v) => String(v ?? ''),
}: UseDebouncedFieldOptions<T>) {
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const latestRef = useRef(value);
  latestRef.current = local;

  useEffect(() => {
    if (!focusedRef.current && serialize(value) !== serialize(local)) {
      setLocal(value);
    }
  }, [value, local, serialize]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const flush = useCallback((next: T) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    onPersist(next);
  }, [onPersist]);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const onChange = useCallback((next: T) => {
    latestRef.current = next;
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(next), debounceMs);
  }, [debounceMs, flush]);

  const onBlur = useCallback(() => {
    focusedRef.current = false;
    flush(latestRef.current);
  }, [flush]);

  return { local, onFocus, onChange, onBlur, focusedRef };
}
