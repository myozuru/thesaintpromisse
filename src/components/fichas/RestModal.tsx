import { shownPeMax, shownHpMax } from '@/lib/peDisplay';
import { useState } from 'react';
import { X, Coffee, Moon, Dices, Hammer } from 'lucide-react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getClassHitDie, getConMod } from '@/lib/levelEngine';
import { playClickSound, playSuccessSound, playErrorSound, playDiceSound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

interface RestModalProps {
  character: Character;
  onClose: () => void;
  /** Quando definido, trava a aba e oculta a outra opção. */
  allowedMode?: 'short' | 'long';
}

export function RestModal({ character: c, onClose, allowedMode }: RestModalProps) {
  const spendHitDie = useCharacterStore((s) => s.spendHitDie);
  const applyShortRest = useCharacterStore((s) => s.applyShortRest);
  const applyLongRest = useCharacterStore((s) => s.applyLongRest);
  const addLog = useLogStore((s) => s.addLog);

  const [tab, setTab] = useState<'short' | 'long'>(allowedMode ?? 'short');
  const [crafting, setCrafting] = useState(false);

  const hitDie = c.hpClassDie ?? getClassHitDie(c.characterClass, c.specialization) ?? 8;
  const conMod = getConMod(c);
  const hdAvail = c.hitDiceCurrent ?? c.hitDiceMax ?? c.level;
  const hdMax = c.hitDiceMax ?? c.level;

  const handleRollHitDie = async () => {
    const res = await spendHitDie(c.id);
    if (!res.ok) {
      playErrorSound();
      addLog('system', `❌ ${c.name}: ${res.reason ?? 'Falha ao rolar Dado de Vida.'}`);
      return;
    }
    playDiceSound();
    const modStr = (res.conMod ?? 0) >= 0 ? `+${res.conMod}` : `${res.conMod}`;
    addLog('system', `🎲 ${c.name}: Dado de Vida (1d${res.die}) → ${res.roll} ${modStr} CON = +${res.healed} PV.`);
  };

  const handleShortRest = async () => {
    const { peRecovered, economiaRoll } = await applyShortRest(c.id);
    playSuccessSound();
    const parts = [`+${peRecovered} PE`];
    if (economiaRoll !== undefined) parts.push(`Economia de Energia: reserva = ${economiaRoll} PE`);
    parts.push('Usos rest_short e cooldowns resetados');
    addLog('system', `☕ ${c.name}: Descanso Curto — ${parts.join(' • ')}.`);
    onClose();
  };

  const handleLongRest = async () => {
    const { hpRecovered, peRecovered, hitDiceRecovered, economiaRoll, crafting: craftingFlag } = await applyLongRest(c.id, { crafting });
    playSuccessSound();
    const parts = [`+${hpRecovered} PV`, `+${peRecovered} PE`, `+${hitDiceRecovered} Dado(s) de Vida`];
    if (economiaRoll !== undefined) parts.push(`Economia de Energia: reserva = ${economiaRoll} PE`);
    parts.push('Usos rest_short/rest_long e cooldowns resetados');
    parts.push('Escudo zerado');
    parts.push('hpSacrificed reset');
    parts.push('Exaustão −1');
    addLog('system', `🌙 ${c.name}: Descanso Longo${craftingFlag ? ' (Modo Crafting)' : ''} — ${parts.join(' • ')}.`);
    if (craftingFlag) {
      addLog('system', `🔨 ATENÇÃO MESTRE: ${c.name} está tentando craftar um item usando seu kit de ferramentas durante o descanso. Resolver no chat.`);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl shadow-primary/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <h2 className="text-lg font-bold text-primary tracking-wide flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif" }}>
            <Moon className="h-5 w-5" /> Descanso — {c.name}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(!allowedMode || allowedMode === 'short') && (
            <button
              onClick={() => { setTab('short'); playClickSound(); }}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2',
                tab === 'short'
                  ? 'bg-primary/15 text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30',
              )}
            >
              <Coffee className="h-4 w-4" /> Descanso Curto
            </button>
          )}
          {(!allowedMode || allowedMode === 'long') && (
            <button
              onClick={() => { setTab('long'); playClickSound(); }}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2',
                tab === 'long'
                  ? 'bg-primary/15 text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30',
              )}
            >
              <Moon className="h-4 w-4" /> Descanso Longo
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {tab === 'short' ? (
            <>
              <div className="rounded-lg border border-border bg-background/40 p-3 text-sm space-y-1">
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">Curto (2–4h):</span> recupera 50% do PE e reseta usos rest_short / cooldowns.
                </p>
                <p className="text-muted-foreground text-xs">
                  Use Dados de Vida para curar PV antes de finalizar.
                </p>
              </div>

              {/* Hit Dice */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium flex items-center gap-2">
                    <Dices className="h-4 w-4" /> Dados de Vida
                  </span>
                  <span className="font-mono text-primary">
                    {hdAvail}/{hdMax}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRollHitDie}
                    disabled={hdAvail <= 0 || c.hpCurrent >= c.hpMax}
                    className="flex-1 h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                  >
                    <Dices className="h-4 w-4" /> Rolar Dado de Vida
                  </button>
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    1d{hitDie}{conMod >= 0 ? `+${conMod}` : conMod} CON
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  PV: <span className="font-mono text-foreground">{c.hpCurrent}/{shownHpMax(c)}</span> · PE: <span className="font-mono text-foreground">{c.peCurrent}/{shownPeMax(c)}</span>
                </p>
              </div>

              <button
                onClick={handleShortRest}
                className="w-full h-11 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold hover:from-primary/90 hover:to-primary/70 transition-all glow-primary flex items-center justify-center gap-2"
              >
                <Coffee className="h-5 w-5" /> Finalizar Descanso Curto
              </button>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-background/40 p-3 text-sm space-y-1">
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">Longo (8h):</span> recupera PV/PE/Dados de Vida ao máximo, reseta rest_short e rest_long, zera escudo e hpSacrificed, reduz Exaustão em 1.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3 cursor-pointer hover:bg-background/60 transition-colors">
                <input
                  type="checkbox"
                  checked={crafting}
                  onChange={(e) => { setCrafting(e.target.checked); playClickSound(); }}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <div className="text-sm">
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <Hammer className="h-4 w-4" /> Realizar Atividade de Criação / Crafting
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Recupera apenas <span className="text-foreground">50%</span> de PV / PE / Dados de Vida. Notifica o Mestre no chat.
                  </p>
                </div>
              </label>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-0.5">
                <p>PV: <span className="font-mono text-foreground">{c.hpCurrent}/{shownHpMax(c)}</span></p>
                <p>PE: <span className="font-mono text-foreground">{c.peCurrent}/{shownPeMax(c)}</span></p>
                <p>Dados de Vida: <span className="font-mono text-foreground">{hdAvail}/{hdMax}</span></p>
                {c.exhaustionLevel ? <p>Exaustão atual: <span className="font-mono text-foreground">{c.exhaustionLevel}</span></p> : null}
              </div>

              <button
                onClick={handleLongRest}
                className="w-full h-11 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold hover:from-primary/90 hover:to-primary/70 transition-all glow-primary flex items-center justify-center gap-2"
              >
                <Moon className="h-5 w-5" /> Finalizar Descanso Longo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
