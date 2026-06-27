import { useId } from 'react';

type AppAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AppAvatarVariant = 'static' | 'loading' | 'onboarding';

const SIZE_PX: Record<AppAvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 128,
};

interface AppAvatarProps {
  size?: AppAvatarSize | number;
  className?: string;
  variant?: AppAvatarVariant;
}

export default function AppAvatar({
  size = 'md',
  className = '',
  variant = 'static',
}: AppAvatarProps) {
  const uid = useId().replace(/:/g, '');
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const variantClass =
    variant === 'loading'
      ? 'app-avatar--loading'
      : variant === 'onboarding'
        ? 'app-avatar--onboarding'
        : '';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={px}
      height={px}
      role="img"
      aria-label="UnifiedDocs"
      className={`app-avatar ${variantClass} ${className}`.trim()}
      draggable={false}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="8" y1="6" x2="92" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#004228" />
          <stop offset="100%" stopColor="#325A41" />
        </linearGradient>
        <linearGradient id={`${uid}-paper`} x1="22" y1="18" x2="68" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCF9F7" />
          <stop offset="100%" stopColor="#F4F1ED" />
        </linearGradient>
      </defs>

      <rect width="100" height="100" rx="22" fill={`url(#${uid}-bg)`} />

      <rect className="avatar-doc" x="20" y="16" width="48" height="60" rx="7" fill={`url(#${uid}-paper)`} />
      <path className="avatar-doc" d="M60 16h8v8l-8-8z" fill="#DCDED6" />

      <rect className="avatar-line avatar-line-1" x="27" y="29" width="28" height="3.5" rx="1.75" fill="#97B79E" opacity="0.55" />
      <rect className="avatar-line avatar-line-2" x="27" y="38" width="22" height="3" rx="1.5" fill="#ADACA6" opacity="0.42" />
      <rect className="avatar-line avatar-line-3" x="27" y="46" width="26" height="3" rx="1.5" fill="#ADACA6" opacity="0.38" />
      <rect className="avatar-line avatar-line-4" x="27" y="54" width="18" height="3" rx="1.5" fill="#ADACA6" opacity="0.32" />
      <rect className="avatar-highlight" x="27" y="62" width="24" height="6" rx="3" fill="#97B79E" opacity="0.28" />

      <path
        className="avatar-link"
        d="M56 58 C64 52 70 56 74 64"
        fill="none"
        stroke="#FCF9F7"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />

      <circle className="avatar-agent" cx="78" cy="66" r="15" fill="#97B79E" />
      <circle className="avatar-agent-ring" cx="78" cy="66" r="15" fill="none" stroke="#FCF9F7" strokeWidth="1.5" opacity="0.35" />
      <path
        className="avatar-spark"
        d="M78 58.5l1.4 4.1 4.3 1.1-4.3 1.1L78 69l-1.4-4.2-4.3-1.1 4.3-1.1z"
        fill="#FCF9F7"
      />

      <circle className="avatar-user" cx="62" cy="78" r="7" fill="#FCF9F7" />
      <circle className="avatar-user" cx="62" cy="76.2" r="2.2" fill="#244632" />
      <path
        className="avatar-user"
        d="M58.8 80.2c0.8 1.6 2.4 2.6 4.2 2.6s3.4-1 4.2-2.6"
        fill="none"
        stroke="#244632"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
