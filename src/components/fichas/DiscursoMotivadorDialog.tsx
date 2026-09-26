/**
 * Discurso Motivador (Talento) — diálogo de seleção de aliados.
 *
 * Cálculo: PV Temporário = Nível × 2 + ⌈(Mod.PRE × Bônus de Treinamento) / 2⌉.
 * Restrição: 1 buff por criatura por Descanso Longo (alvos já buffados ficam
 * desabilitados e marcados na lista).
 */
import { shownHpMax } from '@/lib/peDisplay';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { computeDiscursoMotivador } from '@/lib/talentEffects';
import { playSuccessSound, playErrorSound } from '@/lib/sounds';
import type { Character } from '@/types';
import { Megaphone, ShieldPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  source: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscursoMotivadorDialog({ source, open, onOpenChange }: Props) {
  const characters = useCharacterStore((s) => s.characters);
  const applyDiscursoMotivador = useCharacterStore((s) => s.applyDiscursoMotivador);
  const addLog = useLogStore((s) => s.addLog);

  const calc = useMemo(() => computeDiscursoMotivador(source), [source]);
  const allies = useMemo(
    () => characters.filter((c) => c.category === 'PLAYER' || c.category === 'NPC'),
    [characters],
  );
  const usedSet = useMemo(
    () => new Set(source.discursoMotivadorUsedOn ?? []),
    [source.discursoMotivadorUsedOn],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const r = applyDiscursoMotivador(source.id, ids);
    if (!r.ok) {
      playErrorSound();
      addLog('system', `${source.name}: falha em Discurso Motivador — ${r.reason}`);
      return;
    }
    playSuccessSound();
    const names = (r.applied ?? [])
      .map((id) => characters.find((c) => c.id === id)?.name ?? id)
      .join(', ');
    addLog(
      'combat',
      `📣 ${source.name}: Discurso Motivador → +${r.tempHP} PV Temp para ${names}` +
        (r.skipped && r.skipped.length > 0 ? ` (ignorados: ${r.skipped.length} já buffado(s))` : ''),
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Megaphone className="h-4 w-4" /> Discurso Motivador
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-1.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Orador: <span className="text-foreground font-bold">{source.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
              <span>Nível: <span className="text-foreground">{calc.level}</span></span>
              <span>Mod. PRE: <span className="text-foreground">{calc.preMod >= 0 ? '+' : ''}{calc.preMod}</span></span>
              <span>Treinamento: <span className="text-foreground">+{calc.trainingBonus}</span></span>
              <span>Persuasão treinada: <span className={calc.persuasaoTrained ? 'text-emerald-400' : 'text-destructive'}>{calc.persuasaoTrained ? 'sim' : 'não'}</span></span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">PV Temporário por aliado:</span>{' '}
              <span className="text-primary font-bold text-base">{calc.tempHP}</span>{' '}
              <span className="text-[10px] text-muted-foreground">
                = {calc.level} × 2 + ⌈({calc.preMod} × {calc.trainingBonus}) ÷ 2⌉
              </span>
            </div>
            {!calc.eligible && (
              <div className="text-[11px] text-destructive">
                Persuasão treinada é obrigatória para este talento.
              </div>
            )}
          </div>

          <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
              Selecionar aliados (1 buff por criatura por Descanso Longo)
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {allies.map((a) => {
                const already = usedSet.has(a.id);
                const isSelected = selected.has(a.id);
                return (
                  <label
                    key={a.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition',
                      already
                        ? 'opacity-50 cursor-not-allowed bg-muted/20'
                        : isSelected
                          ? 'bg-primary/15 border border-primary/40'
                          : 'hover:bg-secondary/30 border border-transparent',
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={already || !calc.eligible}
                      onCheckedChange={() => !already && toggle(a.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">
                        {a.name}
                        {a.id === source.id && (
                          <span className="ml-1 text-[10px] text-muted-foreground">(você)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        HP {a.hpCurrent}/{shownHpMax(a)} · PV Temp atual: {a.escCurrent ?? 0}
                        {already && <span className="ml-1 text-amber-400">— já buffado neste descanso</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
              {allies.length === 0 && (
                <div className="text-[11px] text-muted-foreground px-2 py-3 text-center">
                  Nenhum aliado disponível.
                </div>
              )}
            </div>
          </div>

          <div className="text-[10.5px] text-muted-foreground italic">
            Ação Completa em combate, ou 10 min de discurso fora de combate.
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!calc.eligible || selected.size === 0}
            className="gap-1"
          >
            <ShieldPlus className="h-3.5 w-3.5" />
            Aplicar a {selected.size} aliado{selected.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
