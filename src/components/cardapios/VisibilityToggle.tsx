import { Eye, EyeOff, PackageX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playClickSound } from '@/lib/sounds';
import type { HiddenMode } from '@/stores/useMenuStore';

interface Props {
  value: HiddenMode | undefined;
  onChange: (next: HiddenMode | undefined) => void;
  size?: 'sm' | 'md';
}

/**
 * Botão de 3 estados (cicla ao clicar):
 *   visível → esgotado → invisível → visível ...
 *
 * Mostrado apenas para o Mestre. Player nunca interage com este botão.
 */
export function VisibilityToggle({ value, onChange, size = 'md' }: Props) {
  const next: HiddenMode | undefined =
    value === undefined ? 'soldout' : value === 'soldout' ? 'invisible' : undefined;

  const Icon = value === 'invisible' ? EyeOff : value === 'soldout' ? PackageX : Eye;
  const tone =
    value === 'invisible'
      ? 'text-hp hover:bg-hp/15'
      : value === 'soldout'
        ? 'text-neon-yellow hover:bg-neon-yellow/15'
        : 'text-muted-foreground hover:bg-secondary hover:text-primary';
  const title =
    value === 'invisible'
      ? 'Invisível para players (clique → tornar visível)'
      : value === 'soldout'
        ? 'Esgotado para players (clique → invisível)'
        : 'Visível (clique → marcar como esgotado)';

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const padding = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        playClickSound();
        onChange(next);
      }}
      className={cn('rounded transition-colors', padding, tone)}
      title={title}
    >
      <Icon className={iconSize} />
    </button>
  );
}
