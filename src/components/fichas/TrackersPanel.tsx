import { cn } from '@/lib/utils';
import type { LiveTrackers } from '@/lib/originEngine';
import type { PendingChoice } from '@/lib/origins';
import { AlertTriangle, CheckCircle2, ListChecks } from 'lucide-react';

interface Props {
  trackers: LiveTrackers;
  pendingLabel?: string;
  /** Lista de escolhas obrigatórias (Empenho Implacável / Novo Estilo da Sombra). */
  pendingChoices?: PendingChoice[];
}

/**
 * Painel sempre visível no topo do CharacterWizard mostrando as 4 contagens
 * de pendências + o "stack" de escolhas obrigatórias por nível (Sem Técnica).
 * Bloqueia visualmente a finalização quando há valores > 0.
 */
export function TrackersPanel({ trackers, pendingLabel, pendingChoices = [] }: Props) {
  const items = [
    { key: 'attr',    label: 'Pontos de Atributo', value: trackers.availableAttrPoints },
    { key: 'train',   label: 'Treinos',            value: trackers.availableTrainings },
    { key: 'talent',  label: 'Talentos',           value: trackers.availableTalents },
    { key: 'special', label: 'Escolha Especial',   value: trackers.pendingSpecialChoice },
  ];
  const allClear = items.every(i => i.value === 0) && pendingChoices.length === 0;

  return (
    <div
      className={cn(
        'sticky top-0 z-10 -mx-2 mb-2 rounded-xl border px-3 py-2 backdrop-blur-md transition-colors',
        allClear
          ? 'border-neon-green/30 bg-neon-green/5'
          : 'border-primary/40 bg-gradient-to-r from-primary/15 to-accent/10',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {allClear ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-neon-green" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-primary animate-pulse" />
        )}
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Rastreadores de Pendências
        </span>
        {!allClear && (
          <span className="ml-auto text-xs uppercase tracking-wider text-primary font-bold">
            Resolva todas para finalizar
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {items.map(it => (
          <div
            key={it.key}
            className={cn(
              'flex items-center justify-between rounded-lg border px-2 py-1 text-xs transition-all',
              it.value > 0
                ? 'border-primary/50 bg-primary/15 text-foreground'
                : 'border-border bg-secondary/30 text-muted-foreground',
            )}
          >
            <span className="truncate">{it.label}</span>
            <span
              className={cn(
                'font-mono font-bold tabular-nums',
                it.value > 0 ? 'text-primary' : 'text-muted-foreground/60',
              )}
            >
              {it.value}
            </span>
          </div>
        ))}
      </div>
      {trackers.pendingSpecialChoice > 0 && pendingLabel && (
        <div className="mt-1.5 text-xs text-primary/80 italic">→ {pendingLabel}</div>
      )}
      {pendingChoices.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-primary/20 pt-1.5">
          <div className="flex items-center gap-1 text-xs uppercase tracking-wider font-bold text-primary">
            <ListChecks className="h-3 w-3" /> Escolhas obrigatórias por nível
            <span className="ml-1 rounded-full bg-primary/25 px-1.5 py-0 text-xs font-mono">
              {pendingChoices.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {pendingChoices.map(pc => (
              <span
                key={pc.id}
                className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-xs text-foreground"
                title={pc.label}
              >
                <span className="font-mono font-bold text-primary">Nv{pc.level}</span>{' '}
                {pc.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
