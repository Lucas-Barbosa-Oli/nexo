import { useId } from 'react';

export function NexoIcon({ size = 22 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const bgId = `nexo-bg-${id}`;
  const bridgeId = `nexo-br-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="nexo-icon-svg"
    >
      <defs>
        <linearGradient id={bgId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b45339" />
          <stop offset="55%" stopColor="#913b27" />
          <stop offset="100%" stopColor="#6b2718" />
        </linearGradient>
        <linearGradient id={bridgeId} x1="19" y1="19" x2="45" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff8f2" />
          <stop offset="100%" stopColor="#f7d5c2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bgId})`} />
      <rect x="2" y="2" width="60" height="60" rx="14" stroke="#fff5ed" strokeOpacity="0.18" strokeWidth="1.25" />
      <circle cx="32" cy="32" r="20" stroke="#fff5ed" strokeOpacity="0.15" strokeWidth="1.2" strokeDasharray="2.5 3.5" />
      <path d="M20.5 44.5V20.5" stroke="#fff8f2" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M43.5 43.5V19.5" stroke="#fff8f2" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M21 21L43 43" stroke={`url(#${bridgeId})`} strokeWidth="4.6" strokeLinecap="round" />
      <circle cx="20.5" cy="20.5" r="3.4" fill="#fff8f2" />
      <circle cx="43.5" cy="43.5" r="3.4" fill="#fff8f2" />
      <circle cx="43.5" cy="19.5" r="3.8" fill="#ffbc9e" />
      <circle cx="43.5" cy="19.5" r="1.5" fill="#6b2718" />
      <circle cx="20.5" cy="44.5" r="2.5" fill="#f7d5c2" />
    </svg>
  );
}

export function Brand({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'lg' ? 40 : size === 'sm' ? 28 : 34;
  return (
    <div className={`brand brand-${size}`}>
      <span className="brand-mark">
        <NexoIcon size={iconSize} />
      </span>
      <span className="brand-wordmark">
        nexo<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
