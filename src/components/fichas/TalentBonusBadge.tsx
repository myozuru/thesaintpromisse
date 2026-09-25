/**
 * Badge ⚙ exibido ao lado de uma estatística que recebe bônus de Talentos.
 *
 * Uso:
 *   <TalentBonusBadge bonuses={talentBonuses} prefix="HP máx" />
 *
 * Renderiza nada se não houver itens. Tooltip discrimina cada talento.
 */
import { Settings2 } from 'lucide-react';
import type { AggregatedTalentBonuses } from '@/lib/talentEffects';
import { breakdownFor } from '@/lib/talentEffects';

interface Props {
  bonuses: AggregatedTalentBonuses;
  prefix: string;
  className?: string;
}

export function TalentBonusBadge({ bonuses, prefix, className }: Props) {
  const items = breakdownFor(bonuses, prefix);
  if (items.length === 0) return null;

  const tooltip = items
    .map(i => `${i.talentName}: ${i.field} ${i.value}`)
    .join('\n');

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center text-xs text-primary/80 hover:text-primary cursor-help ${className ?? ''}`}
      aria-label={`Bônus de talentos em ${prefix}`}
    >
      <Settings2 className="h-3 w-3" />
    </span>
  );
}
