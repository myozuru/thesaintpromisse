/** Jujutsu Kaisen–inspired cursed energy swirl SVG animation */
export function JjkSwirl({
  size = 120,
  className = '',
  style,
  animated = true,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Quando false, renderiza estático (sem animação CSS) — útil em fundos fixos. */
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`${animated ? 'jjk-swirl' : ''} ${className}`}
      style={{ opacity: 0.18, ...style }}
    >
      <defs>
        <radialGradient id="swirlGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(270 100% 62%)" stopOpacity="0.9" />
          <stop offset="60%" stopColor="hsl(275 100% 50%)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(270 100% 30%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M100 20 C130 20, 170 50, 170 80 C170 110, 140 130, 120 120 C100 110, 110 80, 130 80 C150 80, 150 100, 130 110"
        fill="none"
        stroke="url(#swirlGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M100 180 C70 180, 30 150, 30 120 C30 90, 60 70, 80 80 C100 90, 90 120, 70 120 C50 120, 50 100, 70 90"
        fill="none"
        stroke="url(#swirlGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="100" cy="100" r="8" fill="hsl(270 100% 62%)" opacity="0.6" />
      <circle cx="100" cy="100" r="3" fill="hsl(270 100% 80%)" opacity="0.9" />
      <circle
        cx="100"
        cy="100"
        r="85"
        fill="none"
        stroke="hsl(270 100% 62%)"
        strokeWidth="1.5"
        opacity="0.2"
        strokeDasharray="8 12"
      />
    </svg>
  );
}
