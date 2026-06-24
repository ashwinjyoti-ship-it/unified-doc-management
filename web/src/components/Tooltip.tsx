import { useState, useRef, useCallback, type ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function Tooltip({ text, children, position = 'bottom', className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), 400);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && text && (
        <span
          role="tooltip"
          className={`absolute z-50 px-2.5 py-1.5 text-xs font-medium text-tooltip-fg bg-tooltip-bg rounded-lg shadow-lg max-w-[220px] whitespace-normal text-left pointer-events-none ${positionClasses[position]}`}
        >
          {text}
          <span
            className={`absolute w-2 h-2 bg-tooltip-bg rotate-45 ${
              position === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2' :
              position === 'top' ? '-bottom-1 left-1/2 -translate-x-1/2' :
              position === 'left' ? '-right-1 top-1/2 -translate-y-1/2' :
              '-left-1 top-1/2 -translate-y-1/2'
            }`}
          />
        </span>
      )}
    </span>
  );
}
