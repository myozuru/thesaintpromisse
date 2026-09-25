/**
 * RadioIconButton — botão de ferramenta no padrão Owlbear Rodeo.
 *
 * Quadrado, compacto, com 3 estados visuais: idle, hover, active.
 * Disabled mostra cursor not-allowed e cor mais apagada.
 * Tooltip via `title` nativo (suficiente para esta fase).
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
    state = 'text-zinc-600 cursor-not-allowed';
  } else if (variant === 'ghost') {
    state = active
      ? 'text-zinc-100 bg-[#2a2b30]'
      : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#23252a]';
  } else {
    state = active
      ? 'bg-zinc-100 text-zinc-900'
      : 'text-zinc-300 hover:text-zinc-100 hover:bg-[#23252a]';
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
  return <div className="h-px w-7 bg-[#2a2b30] my-1 self-center" />;
}
