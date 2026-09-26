import { shownPeMax, shownHpMax } from '@/lib/peDisplay';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getEnergiaReversaConfig } from '@/lib/auraEffects';
import { playSuccessSound, playErrorSound, playClickSound } from '@/lib/sounds';
import type { Character } from '@/types';
import { Sparkles, Users } from 'lucide-react';

interface Props {
  caster: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cura em Grupo (ER) — Modal "Distribuir Cura".
 * 1) Jogador escolhe quanto PER vai gastar (1..peLimit).
 * 2) Sistema rola Xd6/d8 + Mod-Chave (já com multiplicador da Cura Amplificada).
 * 3) Lista todos os PLAYER + NPC e o jogador distribui o pool entre eles.
 * 4) Confirma só se soma ≤ healingPool. Despacha applyGroupHealing.
 */
export function GroupHealDialog({ caster, open, onOpenChange }: Props) {
  const characters = useCharacterStore((s) => s.characters);
  const applyGroupHealing = useCharacterStore((s) => s.applyGroupHealing);
  const addLog = useLogStore((s) => s.addLog);

  const cfg = useMemo(() => getEnergiaReversaConfig(caster), [caster]);
  const allies = useMemo(
    () => characters.filter((c) => c.category === 'PLAYER' || c.category === 'NPC'),
    [characters],
  );

  const [perSpent, setPerSpent] = useState(1);
  const [rolled, setRolled] = useState<{ rolls: number[]; mod: number; total: number } | null>(null);
  const [distribution, setDistribution] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) {
      setPerSpent(1);
      setRolled(null);
      setDistribution({});
    }
  }, [open]);

  if (!cfg) {
    return null;
  }

  const peCost = perSpent * 2;
  const peLimit = cfg.peLimit;
  const insufficientPe = caster.peCurrent < peCost;

  const handleRoll = () => {
    const dice = perSpent * 2 + cfg.bonusDiceFromLevel;
    const rolls: number[] = [];
    for (let i = 0; i < dice; i++) {
      rolls.push(Math.floor(Math.random() * cfg.dieSize) + 1);
    }
    const mod = cfg.keyAttrMod * cfg.modMultiplier;
    const total = Math.max(1, rolls.reduce((a, b) => a + b, 0) + mod);
    setRolled({ rolls, mod, total });
    setDistribution({});
    playClickSound();
  };

  const totalAllocated = Object.values(distribution).reduce((a, b) => a + b, 0);
  const remaining = (rolled?.total ?? 0) - totalAllocated;
  const canConfirm = !!rolled && totalAllocated > 0 && remaining >= 0;

  const handleConfirm = () => {
    if (!rolled || !canConfirm) return;
    const filtered: Record<string, number> = {};
    for (const [k, v] of Object.entries(distribution)) {
      if (v > 0) filtered[k] = v;
    }
    const r = applyGroupHealing(caster.id, perSpent, filtered);
    if (r.ok) {
      playSuccessSound();
      const breakdown = Object.entries(r.healed ?? {})
        .map(([id, v]) => {
          const tgt = characters.find((c) => c.id === id);
          return `${tgt?.name ?? id} +${v}`;
        })
        .join(', ');
      addLog(
        'spell',
        `💚 ${caster.name}: Cura em Grupo (${perSpent} PER → ${r.peSpent} PE) — ` +
          `Pool ${rolled.total} [${rolled.rolls.join(',')}${rolled.mod >= 0 ? '+' : ''}${rolled.mod}] → ${breakdown}`,
      );
      onOpenChange(false);
    } else {
      playErrorSound();
      addLog('system', `${caster.name}: falha em Cura em Grupo — ${r.reason}`);
    }
  };

  const setAlloc = (id: string, v: number) => {
    const safe = Math.max(0, Math.floor(Number.isFinite(v) ? v : 0));
    setDistribution((prev) => ({ ...prev, [id]: safe }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Users className="h-4 w-4" /> Cura em Grupo — Distribuir Cura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Conjurador: <span className="text-foreground font-bold">{caster.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
              <span>PE atual: <span className="text-foreground">{caster.peCurrent}/{shownPeMax(caster)}</span></span>
              <span>Limite PER: <span className="text-foreground">{peLimit}</span></span>
              <span>Dado: <span className="text-foreground">d{cfg.dieSize}</span></span>
              <span>Mod-Chave: <span className="text-foreground">{cfg.keyAttribute} {cfg.keyAttrMod >= 0 ? '+' : ''}{cfg.keyAttrMod}{cfg.modMultiplier === 2 ? ' ×2' : ''}</span></span>
              {cfg.bonusDiceFromLevel > 0 && <span>Bônus Nível: <span className="text-foreground">+{cfg.bonusDiceFromLevel}d</span></span>}
              {cfg.groupHealRadiusM > 0 && <span>Raio: <span className="text-foreground">{cfg.groupHealRadiusM.toFixed(1)}m</span></span>}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">PER a gastar (1..{peLimit})</Label>
                <Input
                  type="number"
                  min={1}
                  max={peLimit}
                  value={perSpent}
                  onChange={(e) => setPerSpent(Math.max(1, Math.min(peLimit, parseInt(e.target.value) || 1)))}
                  disabled={!!rolled}
                />
              </div>
              <div className="text-[11px] text-muted-foreground pb-2">
                Custo: <span className={insufficientPe ? 'text-destructive font-bold' : 'text-amber-400 font-bold'}>{peCost} PE</span>
              </div>
              <Button
                size="sm"
                disabled={!!rolled || insufficientPe}
                onClick={handleRoll}
                className="gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" /> Rolar
              </Button>
            </div>
          </div>

          {rolled && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="text-xs">
                <span className="text-muted-foreground">Pool de Cura:</span>{' '}
                <span className="text-primary font-bold text-base">{rolled.total}</span>{' '}
                <span className="text-[10px] text-muted-foreground">
                  [{rolled.rolls.join(', ')}] {rolled.mod >= 0 ? '+' : ''}{rolled.mod}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Alocado: <span className="text-foreground">{totalAllocated}</span></span>
                <span className={remaining < 0 ? 'text-destructive font-bold' : 'text-emerald-400 font-bold'}>
                  Restante: {remaining}
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 pt-1 border-t border-border/60">
                {allies.map((a) => {
                  const cur = distribution[a.id] ?? 0;
                  const missing = a.hpMax - a.hpCurrent;
                  return (
                    <div key={a.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-secondary/30">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{a.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          HP {a.hpCurrent}/{shownHpMax(a)} {missing > 0 && <span className="text-amber-400">(–{missing})</span>}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={rolled.total}
                        value={cur}
                        onChange={(e) => setAlloc(a.id, parseInt(e.target.value) || 0)}
                        className="w-20 h-8 text-center"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} className="gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Aplicar Cura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
