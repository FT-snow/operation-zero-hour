// Lock icon and other micro-icons. Custom bold-stroke SVG primitives,
// consistent 2px stroke, no external icon libraries.

export function LockIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className={className}
    >
      <rect x="4" y="10.5" width="16" height="10" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <path d="M12 14.5v2.5" />
    </svg>
  );
}

export function UnlockIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className={className}
    >
      <rect x="4" y="10.5" width="16" height="10" />
      <path d="M8 10.5V7a4 4 0 0 1 7.6-1.8" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      className={className}
    >
      <path d="M4 12.5 10 18.5 20 5.5" />
    </svg>
  );
}

export function CrossIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      className={className}
    >
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}
