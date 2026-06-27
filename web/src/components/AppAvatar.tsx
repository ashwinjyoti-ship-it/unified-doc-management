type AppAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<AppAvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 128,
};

interface AppAvatarProps {
  size?: AppAvatarSize | number;
  className?: string;
}

export default function AppAvatar({ size = 'md', className = '' }: AppAvatarProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];

  return (
    <img
      src="/favicon.svg"
      alt="UnifiedDocs"
      width={px}
      height={px}
      className={className}
      draggable={false}
    />
  );
}
