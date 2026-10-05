import { shownPeMax } from '@/lib/peDisplay';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playSuccessSound, playErrorSound } from '@/lib/sounds';
import type { Character } from '@/types';
import { HeartPulse, Droplet, Hand } from 'lucide-react';

interface Props {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = 'ferimento' | 'veneno' | 'membro';

const OPTIONS: Array<{
  mode: Mode;
  label: string;
  perCost: number;
  action: 'Ação Comum' | 'Ação Bônus';
  icon: React.ReactNode;
  description: string;
}> = [
  {
    mode: 'ferimento',
    label: 'Curar Ferimento Complexo',
    perCost: 8,
    action: 'Ação Comum',
    icon: <HeartPulse className="h-3.5 w-3.5" />,
    description: 'Trauma severo, sangramento ou ferida grave.',
  },
  {
    mode: 'veneno',
    label: 'Remover Veneno',
    perCost: 4,
    action: 'Ação Bônus',
    icon: <Droplet className="h-3.5 w-3.5" />,
    description: 'Neutraliza condição Envenenado.',
  },
  {
    mode: 'membro',
    label: 'Recolocar Membro',
    perCost: 3,
    action: 'Ação Bônus',
    icon: <Hand className="h-3.5 w-3.5" />,
    description: 'Reanexa membro decepado/dilacerado.',
  },
];

export function RegeneracaoAprimoradaDialog({ character: c, open, onOpenChange }: Props) {
  const cast = useCharacterStore((s) => s.castRegeneracaoAprimorada);
  const addLog = useLogStore((s) => s.addLog);

  const [freeAction, setFreeAction] = useState(false);
  const er = c.cursedAptitudes?.ER ?? 0;
  const canFreeAction = er >= 5;

  useEffect(() => {
    if (!open) setFreeAction(false);
  }, [open]);

  const handle = async (mode: Mode) => {
    const r = await cast(c.id, mode, freeAction);
    if (r.ok) {
      playSuccessSound();
      const opt = OPTIONS.find((o) => o.mode === mode);
      const sh = r.sideHeal!;
      addLog(
        'spell',
        `🩹 ${c.name}: Regeneração Aprimorada — ${opt?.label} (${r.perSpent} PER → ${r.peSpent} PE)` +
          `${freeAction ? ' [Ação Livre]' : ''} | Cura passiva: ${sh.total} HP [${sh.rolls.join(',')}${sh.mod >= 0 ? '+' : ''}${sh.mod}]`,
      );
      onOpenChange(false);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: falha em Regeneração Aprimorada — ${r.reason}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <HeartPulse className="h-4 w-4" /> Regeneração Aprimorada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs text-muted-foreground space-y-1">
            <div>
              <span className="text-foreground font-bold">{c.name}</span> · PE: <span className="text-foreground">{c.peCurrent}/{shownPeMax(c)}</span> · ER: <span className="text-foreground">{er}/5</span>
            </div>
            <div>
              Cada operação consome a ação correspondente e PE = PER × 2. Após executar, cura HP automaticamente
              rolando <span className="text-foreground">(PER/2)·2 d8 + 2·Mod-Chave</span> (Cura Amplificada).
            </div>
          </div>

          {canFreeAction && (
            <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 cursor-pointer">
              <Checkbox checked={freeAction} onCheckedChange={(v) => setFreeAction(!!v)} className="mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-amber-400">Realizar como Ação Livre [10 PER → 20 PE]</div>
                <div className="text-muted-foreground">
                  Override ER 5: ignora a ação comum/bônus exigida e gasta apenas a Ação Livre da rodada.
                </div>
              </div>
            </label>
          )}

          <div className="space-y-2">
            {OPTIONS.map((opt) => {
              const per = freeAction ? 10 : opt.perCost;
              const pe = per * 2;
              const insufficient = c.peCurrent < pe;
              return (
                <button
                  key={opt.mode}
                  onClick={() => handle(opt.mode)}
                  disabled={insufficient}
                  className={`w-full text-left rounded-md border p-3 flex items-start gap-3 transition-colors
                    ${insufficient
                      ? 'border-border bg-secondary/10 opacity-50 cursor-not-allowed'
                      : 'border-primary/40 bg-primary/5 hover:bg-primary/10'}`}
                >
                  <span className="text-primary mt-0.5">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">{opt.label}</span>
                      <span className="text-xs uppercase tracking-wider text-primary/80 px-1.5 py-0.5 rounded bg-primary/10">
                        {freeAction ? 'Ação Livre' : opt.action}
                      </span>
                      <span className="text-xs text-amber-400 font-bold">{per} PER · {pe} PE</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
