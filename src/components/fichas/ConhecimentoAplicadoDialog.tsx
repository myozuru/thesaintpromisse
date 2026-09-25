import { useState } from 'react';
import { X, Shield, Minus, Plus } from 'lucide-react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

interface Props {
  character: Character;
  onClose: () => void;
}

/**
 * Dialog de "Conhecimento Aplicado" (Especialista em Técnica, Tier 2).
 *
 * O jogador, ao realizar um TR contra Feitiço inimigo, pode gastar até
 * floor(Treinamento/2) PE — cada PE concede +2 no resultado do TR.
 * Debita do `tempPE` antes do `peCurrent` (helper do store).
 */
export function ConhecimentoAplicadoDialog({ character: c, onClose }: Props) {
  const spendPEForResistance = useCharacterStore((s) => s.spendPEForResistance);
  const addLog = useLogStore((s) => s.addLog);

  const tb = getTrainingBonusByLevel(c.level);
  const maxPe = Math.floor(tb / 2);
  const totalPE = (c.tempPE ?? 0) + c.peCurrent;
  const cap = Math.min(maxPe, totalPE);
  const [pe, setPe] = useState(Math.min(1, cap));

  const dec = () => { setPe((v) => Math.max(0, v - 1)); playClickSound(); };
  const inc = () => { setPe((v) => Math.min(cap, v + 1)); playClickSound(); };

  const handleConfirm = () => {
    if (pe <= 0) { playErrorSound(); return; }
    const res = spendPEForResistance(c.id, pe);
    if (!res.ok) {
      playErrorSound();
      addLog('system', `❌ ${c.name}: ${res.reason ?? 'Falha no Conhecimento Aplicado.'}`);
      return;
    }
    playSuccessSound();
    addLog(
      'system',
      `🛡️ ${c.name}: Conhecimento Aplicado — gasta ${res.peSpent} PE no TR contra Feitiço → +${res.bonus} no resultado.`,
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl shadow-primary/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <h2 className="text-lg font-bold text-primary tracking-wide flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif" }}>
            <Shield className="h-5 w-5" /> Conhecimento Aplicado
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-border bg-background/40 p-3 text-sm space-y-1">
            <p className="text-muted-foreground">
              Antes de rolar o <span className="text-foreground font-medium">Teste de Resistência contra Feitiço inimigo</span>,
              gaste PE para receber bônus no resultado.
            </p>
            <p className="text-xs text-muted-foreground">
              Limite por TR: <span className="font-mono text-foreground">{maxPe}</span> PE
              (½ Treinamento, TB={tb}). Cada PE = <span className="text-foreground">+2</span> no TR.
            </p>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">PE a gastar</span>
              <span className="font-mono text-xs text-muted-foreground">
                disponível: {totalPE}{(c.tempPE ?? 0) > 0 ? ` (inclui ${c.tempPE} tempPE)` : ''}
              </span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={dec}
                disabled={pe <= 0}
                className="h-9 w-9 rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-40 flex items-center justify-center"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="min-w-[80px] text-center">
                <div className="text-2xl font-bold text-primary font-mono">{pe}</div>
                <div className="text-xs text-muted-foreground">PE</div>
              </div>
              <button
                onClick={inc}
                disabled={pe >= cap}
                className="h-9 w-9 rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-40 flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="text-center text-sm">
              Bônus no TR: <span className="font-bold text-primary font-mono">+{pe * 2}</span>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={pe <= 0}
            className={cn(
              'w-full h-11 rounded-lg font-bold transition-all flex items-center justify-center gap-2',
              pe > 0
                ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 glow-primary'
                : 'bg-secondary text-muted-foreground cursor-not-allowed',
            )}
          >
            <Shield className="h-5 w-5" /> Aplicar (+{pe * 2} no TR)
          </button>
        </div>
      </div>
    </div>
  );
}
