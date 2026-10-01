import type { Boss } from '@/lib/bosses';

interface Props {
  boss: Boss;
  alt?: string;
  className?: string;
  draggable?: boolean;
}

/** Exibe o mesmo enquadramento configurado na ficha em todos os avatares do chefe. */
export function BossPortrait({ boss, alt = '', className = 'h-full w-full', draggable }: Props) {
  const zoom = Math.max(1, Math.min(3, boss.retratoZoom ?? 1));
  const x = Math.max(0, Math.min(100, boss.retratoX ?? 50));
  const y = Math.max(0, Math.min(100, boss.retratoY ?? 50));

  return (
    <img
      src={boss.retrato}
      alt={alt}
      className={`${className} object-cover`}
      draggable={draggable}
      style={{
        objectPosition: `${x}% ${y}%`,
        transform: `scale(${zoom})`,
        transformOrigin: `${x}% ${y}%`,
      }}
    />
  );
}