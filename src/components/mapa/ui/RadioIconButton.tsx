/**
 * RadioIconButton — botão de ferramenta do mapa.
 *
 * Quadrado, compacto, com 3 estados visuais: idle, hover, active.
 * Disabled mostra cursor not-allowed e cor mais apagada.
 * Usa os tokens de tema do app (violeta/dourado) para combinar com o HUD geral.
 */
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  id?: string;
  children: ReactNode;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  active?: boolean;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  disabled?: boolean;
  title: string;
  label?: string;
  /** Variante "ghost" — sem fundo ativo, só ícone (para top bar). */
  variant?: 'rail' | 'ghost';
}

export function RadioIconButton({
  id,
  children,
  onClick,
  onContextMenu,
  active,
  pressed,
  expanded,
  controls,
  disabled,
  title,
  label,
  variant = 'rail',
}: Props) {
  const base = label
    ? variant === 'rail'
      ? 'min-h-11 h-auto w-full px-3 py-2 rounded-md flex items-center justify-start gap-3 text-base font-medium text-left whitespace-nowrap transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70'
      : 'h-11 min-w-11 w-auto px-2 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium whitespace-nowrap transition-colors shrink-0'
    : 'h-11 w-11 rounded-md flex items-center justify-center transition-colors shrink-0';
  let state: string;
  if (disabled) {
    state = 'text-muted-foreground/40 cursor-not-allowed';
  } else if (variant === 'ghost') {
    state = active
      ? cn('text-primary-foreground bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.45)]', 'glow-primary')
      : 'text-muted-foreground hover:text-foreground hover:bg-secondary';
  } else {
    state = active
      ? cn('bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.5)]', 'glow-primary')
      : 'text-muted-foreground hover:text-foreground hover:bg-secondary';
  }
  return (
    <button
      id={id}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onContextMenu={disabled ? undefined : onContextMenu}
      className={cn(base, state)}
    >
      {children}
      {label && <span className={variant === 'rail' ? 'min-w-0 flex-1' : undefined}>{label}</span>}
    </button>
  );
}

export function RailDivider() {
  return <div className="h-px w-full bg-border/50 my-1 self-center" />;
}

export function RailSectionToggle({
  children,
  title,
  expanded,
  controls,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  expanded: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className="w-full min-h-11 px-3 flex items-center justify-between gap-2 rounded text-base font-body uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span aria-hidden="true" className="whitespace-nowrap">
        {children}
      </span>
      <ChevronDown aria-hidden="true" className={`h-3 w-3 shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
    </button>
  );
}
