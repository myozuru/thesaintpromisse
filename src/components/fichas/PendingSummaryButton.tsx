/**
 * Botão + popover com um resumo único de TUDO que está pendente na ficha:
 * - Pendências de nível (PendingLevelChoices)
 * - Pontos de atributo a distribuir
 * - Pool de Habilidades/Talentos (compartilhado e exclusivo)
 * - Escolhas pendentes do catálogo de Aura
 * - Reações de aura armadas (ex.: Absorção Elemental)
 *
 * Não duplica funcionalidade — apenas centraliza visibilidade. Cada item tem
 * link/atalho que expande a ficha para que o jogador resolva no painel correto.
 */
import { useState, useMemo } from 'react';
import { Bell, ListChecks, Sparkles, Wand2, Shield, Zap } from 'lucide-react';
import type { Character } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getPendingAbsorbedDice } from '@/lib/auraEffects';
import { DAMAGE_TYPE_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { playClickSound } from '@/lib/sounds';

interface Props {
  character: Character;
  /** Garante que a ficha esteja expandida ao clicar num atalho. */
  onExpand?: () => void;
}

interface PendingItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  detail?: string;
  count?: number;
  tone: 'primary' | 'accent' | 'warning' | 'destructive';
}

export function PendingSummaryButton({ character: c, onExpand }: Props) {
  const [open, setOpen] = useState(false);

  const items = useMemo<PendingItem[]>(() => {
    const list: PendingItem[] = [];

    const lvlPending = (c.pendingLevelChoices ?? []).filter(p => !p.resolved);
    if (lvlPending.length > 0) {
      list.push({
        key: 'level',
        icon: <ListChecks className="h-3.5 w-3.5" />,
        label: 'Pendências de nível',
        detail: lvlPending.slice(0, 3).map(p => p.label).join(' • ') +
          (lvlPending.length > 3 ? ` +${lvlPending.length - 3}` : ''),
        count: lvlPending.length,
        tone: 'destructive',
      });
    }

    const attrPts = c.availableAttrPoints ?? 0;
    if (attrPts > 0) {
      list.push({
        key: 'attr',
        icon: <Sparkles className="h-3.5 w-3.5" />,
        label: `Distribuir ${attrPts} ponto${attrPts > 1 ? 's' : ''} de atributo`,
        count: attrPts,
        tone: 'accent',
      });
    }

    const skillPool = c.availableSpecAbilities ?? 0;
    if (skillPool > 0) {
      list.push({
        key: 'skill-pool',
        icon: <Wand2 className="h-3.5 w-3.5" />,
        label: `Pool de Habilidade/Talento: ${skillPool}`,
        detail: 'Gaste pelo Catálogo de Especialização.',
        count: skillPool,
        tone: 'primary',
      });
    }

    const talentOnly = c.availableTalentOnly ?? 0;
    if (talentOnly > 0) {
      list.push({
        key: 'talent-only',
        icon: <Wand2 className="h-3.5 w-3.5" />,
        label: `Talento exclusivo: ${talentOnly}`,
        detail: 'Aberto pelo Catálogo de Talentos.',
        count: talentOnly,
        tone: 'primary',
      });
    }

    const auraChoices = c.availableAuraChoices ?? 0;
    if (auraChoices > 0) {
      list.push({
        key: 'aura',
        icon: <Sparkles className="h-3.5 w-3.5" />,
        label: `Aptidão de Aura a escolher: ${auraChoices}`,
        detail: 'Abra o catálogo no painel de Aura.',
        count: auraChoices,
        tone: 'primary',
      });
    }

    const armed = getPendingAbsorbedDice(c);
    if (armed) {
      list.push({
        key: 'absorption',
        icon: <Shield className="h-3.5 w-3.5" />,
        label: 'Absorção Elemental armada',
        detail: `${armed.count}d${armed.sides} ${DAMAGE_TYPE_LABELS[armed.element]} no próximo ataque.`,
        tone: 'warning',
      });
    }

    return list;
  }, [c]);

  const total = items.reduce((s, it) => s + (it.count ?? 1), 0);
  const hasAny = items.length > 0;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) playClickSound(); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'relative h-6 min-w-6 px-1.5 rounded-md border text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors whitespace-nowrap',
            hasAny
              ? 'border-primary/60 bg-primary/15 text-primary hover:bg-primary/25'
              : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50',
          )}
          title={hasAny ? `${total} pendência(s) na ficha` : 'Nenhuma pendência'}
        >
          <Bell className={cn('h-3 w-3', hasAny && 'animate-pulse')} />
          <span className="hidden sm:inline">Pendências</span>
          {hasAny && (
            <span className="rounded-full bg-primary text-primary-foreground min-w-4 h-4 px-1 flex items-center justify-center text-[8px] font-mono">
              {total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-2 space-y-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-1 pb-1 border-b border-border">
          <Bell className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Resumo de pendências
          </span>
          {hasAny && (
            <span className="ml-auto text-xs text-muted-foreground font-mono">{total} item(ns)</span>
          )}
        </div>

        {!hasAny ? (
          <div className="text-xs text-muted-foreground italic text-center py-3">
            ✓ Nada pendente. Ficha em dia!
          </div>
        ) : (
          <div className="space-y-1">
            {items.map(it => (
              <button
                key={it.key}
                onClick={() => {
                  onExpand?.();
                  setOpen(false);
                  playClickSound();
                }}
                className={cn(
                  'w-full text-left rounded-md border px-2 py-1.5 flex items-start gap-2 transition-colors',
                  it.tone === 'destructive' && 'border-destructive/40 bg-destructive/10 hover:bg-destructive/20',
                  it.tone === 'accent' && 'border-accent/40 bg-accent/10 hover:bg-accent/20',
                  it.tone === 'warning' && 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20',
                  it.tone === 'primary' && 'border-primary/40 bg-primary/10 hover:bg-primary/20',
                )}
              >
                <span className={cn(
                  'mt-0.5',
                  it.tone === 'destructive' && 'text-destructive',
                  it.tone === 'accent' && 'text-accent-foreground',
                  it.tone === 'warning' && 'text-amber-400',
                  it.tone === 'primary' && 'text-primary',
                )}>
                  {it.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-foreground">{it.label}</span>
                  {it.detail && (
                    <span className="block text-xs text-muted-foreground truncate">{it.detail}</span>
                  )}
                </span>
                {it.count !== undefined && it.count > 0 && (
                  <span className="text-xs font-mono font-bold rounded bg-background/60 px-1.5 py-0.5">
                    {it.count}
                  </span>
                )}
              </button>
            ))}
            <div className="text-xs text-muted-foreground italic text-center pt-1 border-t border-border">
              Clique em um item para abrir a ficha no painel correspondente.
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
