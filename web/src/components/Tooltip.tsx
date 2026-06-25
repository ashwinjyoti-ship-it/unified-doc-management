import { useState, useRef, useCallback, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function Tooltip({ text, children, position = 'bottom', className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updateCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    switch (position) {
      case 'top':
        setCoords({ top: rect.top - gap, left: rect.left + rect.width / 2 });
        break;
      case 'left':
        setCoords({ top: rect.top + rect.height / 2, left: rect.left - gap });
        break;
      case 'right':
        setCoords({ top: rect.top + rect.height / 2, left: rect.right + gap });
        break;
      default:
        setCoords({ top: rect.bottom + gap, left: rect.left + rect.width / 2 });
    }
  }, [position]);

  const show = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateCoords();
      setVisible(true);
    }, 400);
  }, [updateCoords]);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    updateCoords();
    const onScrollOrResize = () => updateCoords();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [visible, updateCoords]);

  const transform =
    position === 'top' ? 'translate(-50%, -100%)' :
    position === 'left' ? 'translate(-100%, -50%)' :
    position === 'right' ? 'translate(0, -50%)' :
    'translate(-50%, 0)';

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && text && coords && createPortal(
        <span
          role="tooltip"
          style={{ position: 'fixed', top: coords.top, left: coords.left, transform, zIndex: 9999 }}
          className="px-2.5 py-1.5 text-xs font-medium text-tooltip-fg bg-tooltip-bg rounded-lg shadow-lg max-w-[220px] whitespace-normal text-left pointer-events-none"
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
