import { useEffect, useState } from 'react';
import { Plus, Minus, Wallet, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playClickSound, playSuccessSound } from '@/lib/sounds';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
}

type PoolKey =
  | 'availableAttrPoints'
  | 'availableTrainings'
  | 'availableMastery'
  | 'availableSavingTrainings'
  | 'availableSavingMastery'
  | 'availableSpecAbilities'
  | 'availableSkillOnly'
  | 'availableTalentOnly';

const POOLS: { key: PoolKey; label: string; hint: string }[] = [
  { key: 'availableAttrPoints',      label: 'Pontos de Atributo Livres', hint: 'Distribuídos pelo diálogo de atributos.' },
  { key: 'availableTrainings',       label: 'Treinos de Perícia',        hint: 'Cada 1 = treinar 1 perícia inédita.' },
  { key: 'availableMastery',         label: 'Maestrias de Perícia',      hint: 'Promoção de perícia a Mestre.' },
  { key: 'availableSavingTrainings', label: 'Treinos de TR',             hint: 'Pool separado dos Testes de Resistência.' },
  { key: 'availableSavingMastery',   label: 'Maestrias de TR',           hint: 'Pool separado dos Testes de Resistência.' },
  { key: 'availableSpecAbilities',   label: 'Pool Compartilhado (Hab. Esp. / Talento)', hint: 'Aceita Habilidade de Especialização OU Talento.' },
  { key: 'availableSkillOnly',       label: 'Pool Exclusivo de Hab. Esp.', hint: 'Não aceita Talentos.' },
  { key: 'availableTalentOnly',      label: 'Pool Exclusivo de Talentos', hint: 'Não aceita Habilidades de Especialização.' },
];

/**
 * Painel do Mestre para conceder (ou retirar) pontos de QUALQUER pool da ficha.
 * Os deltas são aplicados de uma vez ao confirmar; valores nunca ficam negativos.
 */
export function PoolGrantDialog({ open, onOpenChange, character: c }: Props) {
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const addLog = useLogStore(s => s.addLog);

  const [deltas, setDeltas] = useState<Record<PoolKey, number>>(() =>
    Object.fromEntries(POOLS.map(p => [p.key, 0])) as Record<PoolKey, number>,
  );

  useEffect(() => {
    if (open) {
      setDeltas(Object.fromEntries(POOLS.map(p => [p.key, 0])) as Record<PoolKey, number>);
    }
  }, [open, c.id]);

  const inc = (k: PoolKey) => { playClickSound(); setDeltas(p => ({ ...p, [k]: p[k] + 1 })); };
  const dec = (k: PoolKey) => {
    const cur = (c[k] as number | undefined) ?? 0;
    setDeltas(p => {
      const next = p[k] - 1;
      if (cur + next < 0) return p; // nunca negativo
      playClickSound();
      return { ...p, [k]: next };
    });
  };

  const apply = () => {
    const updates: Partial<Character> = {};
    const summary: string[] = [];
    for (const p of POOLS) {
      const d = deltas[p.key];
      if (!d) continue;
      const cur = (c[p.key] as number | undefined) ?? 0;
      (updates as Record<string, number>)[p.key] = Math.max(0, cur + d);
      summary.push(`${p.label} ${d > 0 ? '+' : ''}${d}`);
    }
    if (summary.length === 0) { onOpenChange(false); return; }
    updateCharacter(c.id, updates);
    playSuccessSound();
    addLog('system', `🎁 Mestre concedeu pontos a ${c.name}: ${summary.join(', ')}.`);
    onOpenChange(false);
  };

  const totalChanges = Object.values(deltas).filter(v => v !== 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-primary/40 bg-card/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-cinzel text-primary">
            <Wallet className="h-4 w-4" />
            Conceder Pontos de Pools
          </DialogTitle>
          <DialogDescription className="text-xs">
            Painel do Mestre — adicione ou retire pontos em qualquer pool da ficha de <strong>{c.name}</strong>. O total nunca fica negativo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          {POOLS.map(p => {
            const cur = (c[p.key] as number | undefined) ?? 0;
            const d = deltas[p.key];
            const next = Math.max(0, cur + d);
            return (
              <div
                key={p.key}
                className={cn(
                  'flex items-center gap-2 rounded-md border p-2 transition-colors',
                  d !== 0 ? 'border-primary/50 bg-primary/10' : 'border-border bg-secondary/30',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{p.label}</div>
                  <div className="text-[10px] text-muted-foreground italic truncate">{p.hint}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    Atual: {cur}
                    {d !== 0 && (
                      <span className={cn('font-bold ml-1', d > 0 ? 'text-primary' : 'text-destructive')}>
                        {' '}({d > 0 ? '+' : ''}{d}) → {next}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => dec(p.key)}
                    className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center text-foreground hover:border-destructive/60 hover:text-destructive disabled:opacity-30"
                    disabled={cur + d <= 0}
                    aria-label={`Diminuir ${p.label}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className={cn('w-8 text-center font-mono text-sm font-bold', d > 0 ? 'text-primary' : d < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {d > 0 ? `+${d}` : d}
                  </span>
                  <button
                    type="button"
                    onClick={() => inc(p.key)}
                    className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center text-foreground hover:border-primary/60 hover:text-primary"
                    aria-label={`Aumentar ${p.label}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => { playClickSound(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={apply}
            disabled={totalChanges === 0}
            className="bg-primary/30 border border-primary text-primary hover:bg-primary/50"
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Aplicar {totalChanges > 0 && `(${totalChanges})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
