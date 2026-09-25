/**
 * RadioIconButton — botão de ferramenta do mapa.
 *
 * Quadrado, compacto, com 3 estados visuais: idle, hover, active.
 * Disabled mostra cursor not-allowed e cor mais apagada.
 * Usa os tokens de tema do app (violeta/dourado) para combinar com o HUD geral.
 */
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  /** Variante "ghost" — sem fundo ativo, só ícone (para top bar). */
  variant?: 'rail' | 'ghost';
}

export function RadioIconButton({
  children,
  onClick,
  onContextMenu,
  active,
  disabled,
  title,
  variant = 'rail',
}: Props) {
  const base =
    'h-9 w-9 rounded-md flex items-center justify-center transition-colors shrink-0';
  let state: string;
  if (disabled) {
    state = 'text-muted-foreground/40 cursor-not-allowed';
  } else if (variant === 'ghost') {
    state = active
      ? 'text-primary-foreground bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.45)]'
      : 'text-muted-foreground hover:text-foreground hover:bg-secondary';
  } else {
    state = active
      ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.5)]'
      : 'text-muted-foreground hover:text-foreground hover:bg-secondary';
  }
  return (
    <button
      type="button"
      title={title}
      onClick={disabled ? undefined : onClick}
      onContextMenu={disabled ? undefined : onContextMenu}
      className={`${base} ${state}`}
    >
      {children}
    </button>
  );
}

export function RailDivider() {
  return <div className="h-px w-7 bg-border my-1 self-center" />;
}
