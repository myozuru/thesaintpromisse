import { useMemo, useState, useEffect } from 'react';
import { Plus, Minus, Sparkles, AlertTriangle, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
  lockedTo?: string[];
  perAttrCap?: number;
  hint?: string;
  requireSpendAll?: boolean;
  linkChoiceId?: string;
  onApplied?: (totalSpent: number) => void;
}

const DEFAULT_CAP = 20;

/**
 * Janela única para distribuir Pontos de Atributo Livres.
 *
 * Usada sempre que `availableAttrPoints > 0` — seja pelo marco ASI (Nv 4/8/12/16/20),
 * pelo bônus da Origem Derivado (+1 quebrando o cap), ou pela origem inicial do wizard.
 * Respeita `attrCaps[attr]` (default 20) por atributo.
 */
export function AttributeSpendDialog({
  open,
  onOpenChange,
  character: c,
  lockedTo,
  perAttrCap,
  hint,
  requireSpendAll,
  linkChoiceId,
  onApplied,
}: Props) {
  const { spendAttributePoints } = useCharacterStore();
  const addLog = useLogStore(s => s.addLog);

  const totalPoints = c.availableAttrPoints ?? 0;

  // Estado local: alocação por nome de atributo.
  const [allocs, setAllocs] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Guarda o instante de abertura para ignorar o 1º pointer-down "fora"
  // que é na verdade o pointer-up do clique que abriu o dialog.
  const [openedAt, setOpenedAt] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setAllocs({});
      setConfirmOpen(false);
      setOpenedAt(Date.now());
    }
  }, [open, c.id]);

  const remaining = useMemo(
    () => totalPoints - Object.values(allocs).reduce((s, v) => s + v, 0),
    [totalPoints, allocs],
  );

  const eligibleAttrs = useMemo(() => {
    const list = c.attributes ?? [];
    if (!lockedTo || lockedTo.length === 0) return list;
    const lower = lockedTo.map(s => s.toLowerCase());
    return list.filter(a => lower.includes(a.name.toLowerCase()));
  }, [c.attributes, lockedTo]);

  const inc = (name: string, currentValue: number, cap: number) => {
    if (remaining <= 0) {
      playErrorSound();
      return;
    }
    const cur = allocs[name] ?? 0;
    if (currentValue + cur >= cap) {
      playErrorSound();
      return;
    }
    if (perAttrCap != null && cur >= perAttrCap) {
      playErrorSound();
      return;
    }
    playClickSound();
    setAllocs(p => ({ ...p, [name]: cur + 1 }));
  };

  const dec = (name: string) => {
    const cur = allocs[name] ?? 0;
    if (cur <= 0) return;
    playClickSound();
    setAllocs(p => ({ ...p, [name]: cur - 1 }));
  };

  const requestApply = () => {
    const spent = Object.entries(allocs).filter(([, v]) => v > 0);
    if (spent.length === 0) {
      playErrorSound();
      return;
    }
    const totalSpent = spent.reduce((s, [, v]) => s + v, 0);
    if (requireSpendAll && totalSpent !== totalPoints) {
      playErrorSound();
      return;
    }
    playClickSound();
    setConfirmOpen(true);
  };

  const handleApply = () => {
    const spent = Object.entries(allocs).filter(([, v]) => v > 0);
    if (spent.length === 0) return;
    const totalSpent = spent.reduce((s, [, v]) => s + v, 0);
    const spendsObj = Object.fromEntries(spent) as Record<string, number>;
    spendAttributePoints(c.id, spendsObj, { linkChoiceId });
    playSuccessSound();
    addLog(
      'system',
      `✦ ${c.name}: Distribuição de Atributos → ${spent.map(([n, v]) => `${n} +${v}`).join(', ')}`,
    );
    onApplied?.(totalSpent);
    setConfirmOpen(false);
    onOpenChange(false);
  };

  const allocSummary = Object.entries(allocs).filter(([, v]) => v > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-primary/40 bg-card/95 backdrop-blur"
        onPointerDownOutside={(e) => {
          // Ignora o pointer-up residual do clique que acabou de abrir o dialog.
          if (Date.now() - openedAt < 250) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (Date.now() - openedAt < 250) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-cinzel text-primary">
            <Sparkles className="h-4 w-4" />
            Distribuir Pontos de Atributo
          </DialogTitle>
          <DialogDescription className="text-xs">
            {hint ?? 'Aumente os atributos escolhidos. Cada ponto = +1 no valor base do atributo, respeitando os limites máximos.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pontos Restantes
          </span>
          <span
            className={cn(
              'rounded-md px-3 py-0.5 font-mono text-lg font-bold',
              remaining > 0 ? 'bg-primary/30 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            {remaining} / {totalPoints}
          </span>
        </div>

        {lockedTo && lockedTo.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 p-2 text-[10px] text-accent-foreground">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Pontos restritos a: <strong>{lockedTo.join(', ')}</strong>.
            </span>
          </div>
        )}

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {eligibleAttrs.length === 0 && (
            <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 p-3 text-center text-xs text-muted-foreground italic">
              Nenhum atributo elegível encontrado.
            </div>
          )}
          {eligibleAttrs.map(a => {
            const cap = c.attrCaps?.[a.name] ?? DEFAULT_CAP;
            const add = allocs[a.name] ?? 0;
            const finalVal = a.value + add;
            const atCap = finalVal >= cap;
            const mod = Math.floor((finalVal - 10) / 2);
            return (
              <div
                key={a.id}
                className={cn(
                  'flex items-center gap-2 rounded-md border p-2 transition-colors',
                  add > 0
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border bg-secondary/30',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{a.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      cap {cap}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {a.value}
                    {add > 0 && (
                      <span className="text-primary font-bold"> +{add} = {finalVal}</span>
                    )}
                    <span className="ml-2 text-accent-foreground/70">
                      (mod {mod >= 0 ? '+' : ''}{mod})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => dec(a.name)}
                    disabled={add <= 0}
                    className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center text-foreground hover:border-destructive/60 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={`Diminuir ${a.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center font-mono text-sm font-bold text-primary">
                    {add}
                  </span>
                  <button
                    type="button"
                    onClick={() => inc(a.name, a.value, cap)}
                    disabled={remaining <= 0 || atCap || (perAttrCap != null && add >= perAttrCap)}
                    className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center text-foreground hover:border-primary/60 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={`Aumentar ${a.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { playClickSound(); onOpenChange(false); }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={requestApply}
            disabled={Object.values(allocs).every(v => v <= 0)}
            className="bg-primary/30 border border-primary text-primary hover:bg-primary/50"
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Aplicar {totalPoints - remaining > 0 && `(${totalPoints - remaining})`}
          </Button>
        </DialogFooter>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="border-primary/40 bg-card/95 backdrop-blur">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 font-cinzel text-primary">
                <AlertTriangle className="h-4 w-4" />
                Confirmar Distribuição
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-destructive">
                    Atenção: esta escolha é permanente. Após confirmar, você NÃO poderá trocar nem desfazer a distribuição destes pontos.
                  </p>
                  <p className="text-muted-foreground">Você está prestes a aplicar:</p>
                  <ul className="rounded-md border border-primary/30 bg-primary/10 p-2 font-mono text-foreground">
                    {allocSummary.map(([name, v]) => (
                      <li key={name} className="flex justify-between">
                        <span>{name}</span>
                        <span className="text-primary font-bold">+{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => playClickSound()}>
                Revisar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleApply}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Confirmar e aplicar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
