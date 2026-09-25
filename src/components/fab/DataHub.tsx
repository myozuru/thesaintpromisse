import { useState } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS, DamageType } from '@/types';
import { rollDiceGroups } from '@/lib/dice';
import { avaliarFormula } from '@/lib/omni/parser';
import { cn } from '@/lib/utils';
import { Dice1, X, Calculator, Swords, Heart, Shield, Trash2, Plus, Minus, ChevronDown, ShieldMinus } from 'lucide-react';
import { playDiceSound, playClickSound, playSuccessSound, playDeleteSound } from '@/lib/sounds';

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];

const DICE_ICONS: Record<number, string> = {
  4: '▲', 6: '⬡', 8: '◆', 10: '⬠', 12: '⬟', 20: '⏣', 100: '%',
};

interface DiceSelection {
  sides: number;
  count: number;
}

export function DataHub({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [diceSelections, setDiceSelections] = useState<DiceSelection[]>(
    DICE_TYPES.map((s) => ({ sides: s, count: 0 }))
  );
  const [rolling, setRolling] = useState(false);
  const [results, setResults] = useState<{ label: string; rolls: number[]; total: number }[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [applyMode, setApplyMode] = useState<'damage' | 'heal' | 'shield' | 'shieldRemove' | null>(null);
  const [selectedDamageType, setSelectedDamageType] = useState<DamageType | ''>('');
  const [calcDisplay, setCalcDisplay] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [customNumber, setCustomNumber] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const characters = useCharacterStore((s) => s.characters);
  const { applyDamage, applyHealing, applyShield, updateCharacter } = useCharacterStore();
  const addLog = useLogStore((s) => s.addLog);

  const addDice = (sides: number) => {
    setDiceSelections((prev) =>
      prev.map((d) => (d.sides === sides ? { ...d, count: d.count + 1 } : d))
    );
  };

  const removeDice = (sides: number) => {
    setDiceSelections((prev) =>
      prev.map((d) => (d.sides === sides ? { ...d, count: Math.max(0, d.count - 1) } : d))
    );
  };

  const customNum = parseInt(customNumber) || 0;
  const hasDice = diceSelections.some((d) => d.count > 0);
  const grandTotal = results.reduce((s, r) => s + r.total, 0) + customNum;
  // For applying fixed value only (no dice rolled)
  const fixedOnlyTotal = customNum;
  const hasResults = results.length > 0;
  const effectiveTotal = hasResults ? grandTotal : fixedOnlyTotal;

  const handleRoll = async () => {
    const active = diceSelections.filter((d) => d.count > 0);
    if (active.length === 0) return;

    playDiceSound();
    setRolling(true);
    setResults([]);
    setApplyMode(null);

    try {
      // Todos os dados selecionados caem juntos numa ÚNICA rolagem na bandeja 3D.
      const res = await rollDiceGroups(
        active.map((d) => ({ count: d.count, sides: d.sides })),
        { bonus: customNum || undefined },
      );
      const finalResults = res.groups.map((g) => ({
        label: `${g.count}d${g.sides}`,
        rolls: g.rolls,
        total: g.total,
      }));
      setResults(finalResults);

      const gt = finalResults.reduce((s, r) => s + r.total, 0);
      const details = finalResults.map((r) => `${r.label}[${r.rolls.join(',')}]=${r.total}`).join(' | ');
      addLog('roll', `🎲 Hub: ${details} → Total: ${gt}`);
    } finally {
      setRolling(false);
    }
  };

  const toggleTarget = (id: string) =>
    setSelectedTargets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const applyResultToTargets = (mode: 'damage' | 'heal' | 'shield' | 'shieldRemove') => {
    if (effectiveTotal <= 0 || selectedTargets.length === 0) return;
    const dmgType = selectedDamageType || undefined;
    selectedTargets.forEach((id) => {
      const target = characters.find((c) => c.id === id);
      if (!target) return;
      if (mode === 'damage') {
        applyDamage(id, effectiveTotal, dmgType);
        const typeStr = dmgType ? ` (${DAMAGE_TYPE_LABELS[dmgType]})` : '';
        addLog('combat', `⚔️ Hub → ${target.name}: ${effectiveTotal} dano${typeStr}`);
      } else if (mode === 'heal') {
        applyHealing(id, effectiveTotal);
        addLog('combat', `💚 Hub → ${target.name}: ${effectiveTotal} cura`);
      } else if (mode === 'shield') {
        applyShield(id, effectiveTotal);
        addLog('combat', `🛡 Hub → ${target.name}: ${effectiveTotal} escudo`);
      } else if (mode === 'shieldRemove') {
        const newEsc = Math.max(0, target.escCurrent - effectiveTotal);
        updateCharacter(id, { escCurrent: newEsc });
        addLog('combat', `💔 Hub → ${target.name}: -${effectiveTotal} escudo`);
      }
    });
    setSelectedTargets([]);
    setApplyMode(null);
  };

  const clearAll = () => {
    setDiceSelections(DICE_TYPES.map((s) => ({ sides: s, count: 0 })));
    setResults([]);
    setSelectedTargets([]);
    setApplyMode(null);
    setCustomNumber('');
    setSelectedDamageType('');
  };

  // Calculator
  const calcPress = (val: string) => {
    if (val === 'C') return setCalcDisplay('');
    if (val === '=') {
      // Sem `eval`: usa o parser do Omni-Engine (expr-eval), que entende
      // soma/subtração/mult/div/parênteses e ainda suporta notação de dados.
      const expr = calcDisplay.trim();
      if (!expr) return setCalcDisplay('');
      const { valor } = avaliarFormula(expr);
      // `avaliarFormula` retorna 0 em qualquer erro de parse — distinguimos
      // "expressão inválida" reavaliando rapidamente sem rolagens.
      const parecValido = /^[\d+\-*/().\s]+$/.test(expr) || /\d+d\d+/i.test(expr);
      if (!parecValido) return setCalcDisplay('Erro');
      setCalcDisplay(String(valor));
      return;
    }
    setCalcDisplay((prev) => prev + val);
  };

  if (!open) return null;

  const canApply = effectiveTotal > 0 && !rolling;
  const showApplySection = (hasResults || (customNum > 0 && !hasDice)) && canApply;

  return (
    <div className="fixed bottom-20 right-6 z-50 w-72 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl animate-scale-in">
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-3 py-1.5 z-10">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Dice1 className="h-3.5 w-3.5 text-primary" /> Hub de Dados
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setShowCalc(!showCalc)} className="rounded p-1 text-muted-foreground hover:bg-secondary">
            <Calculator className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { playDeleteSound(); clearAll(); }} className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-2 space-y-2 text-xs">
        {/* Calculator */}
        {showCalc && (
          <div className="rounded border border-border p-2 space-y-1">
            <input value={calcDisplay} readOnly className="h-7 w-full rounded bg-background px-2 text-right font-mono text-xs text-foreground border border-input" />
            <div className="grid grid-cols-4 gap-0.5">
              {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+','C'].map((k) => (
                <button key={k} onClick={() => calcPress(k)} className={cn('h-6 rounded text-center font-mono text-xs transition-colors', k === 'C' ? 'bg-destructive/20 text-destructive col-span-4' : k === '=' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80')}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dice grid - click to add */}
        <div className="flex flex-wrap gap-1 justify-center">
          {diceSelections.map((d) => (
            <div key={d.sides} className="flex flex-col items-center">
              <button
                onClick={() => addDice(d.sides)}
                className={cn(
                  'relative h-10 w-10 rounded-lg flex flex-col items-center justify-center transition-all border',
                  d.count > 0
                    ? 'bg-primary/20 border-primary/40 text-primary shadow-sm shadow-primary/10'
                    : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <span className="text-lg leading-none">{DICE_ICONS[d.sides]}</span>
                <span className="text-xs font-mono">d{d.sides}</span>
                {d.count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {d.count}
                  </span>
                )}
              </button>
              {d.count > 0 && (
                <button
                  onClick={() => removeDice(d.sides)}
                  className="mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Minus className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Custom fixed value - collapsible */}
        <div>
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Valor fixo (dano/cura/escudo)</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', showCustom && 'rotate-180')} />
          </button>
          {showCustom && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-muted-foreground font-mono text-xs">+</span>
              <input
                type="number"
                value={customNumber}
                onChange={(e) => setCustomNumber(e.target.value)}
                placeholder="0"
                className="h-6 w-full rounded border border-input bg-background px-2 text-center text-xs text-foreground"
              />
            </div>
          )}
        </div>

        {/* Roll button - only if dice selected */}
        {hasDice && (
          <button
            onClick={handleRoll}
            disabled={rolling}
            className="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {rolling ? '🎰 Rolando...' : '🎲 Rolar'}
          </button>
        )}

        {/* Results */}
        {hasResults && (
          <div className={cn('rounded border border-primary/30 bg-secondary/50 p-2 space-y-0.5', rolling && 'animate-pulse')}>
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-mono font-bold text-foreground">
                  [{r.rolls.join(', ')}] = {r.total}
                </span>
              </div>
            ))}
            {customNum !== 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">+Fixo</span>
                <span className="font-mono font-bold text-foreground">{customNum}</span>
              </div>
            )}
            {(results.length > 1 || customNum !== 0) && (
              <div className="border-t border-border pt-0.5 flex justify-between font-bold text-primary text-sm">
                <span>Total</span>
                <span>{grandTotal}</span>
              </div>
            )}
          </div>
        )}

        {/* Fixed value only display (no dice rolled) */}
        {!hasResults && customNum > 0 && !hasDice && (
          <div className="rounded border border-primary/30 bg-secondary/50 p-2 text-center">
            <div className="text-xs text-muted-foreground">Valor Fixo</div>
            <div className="text-lg font-bold font-mono text-primary">{customNum}</div>
          </div>
        )}

        {/* Apply as damage/heal/shield */}
        {showApplySection && (
          <div className="border-t border-border pt-2 space-y-1.5">
            <p className="text-muted-foreground text-xs">Aplicar ({effectiveTotal}):</p>
            <div className="flex gap-0.5">
              <button
                onClick={() => setApplyMode(applyMode === 'damage' ? null : 'damage')}
                className={cn('flex-1 h-6 rounded flex items-center justify-center gap-0.5 text-xs transition-colors', applyMode === 'damage' ? 'bg-hp/30 text-hp' : 'bg-hp/10 text-hp hover:bg-hp/20')}
              >
                <Swords className="h-3 w-3" /> Dano
              </button>
              <button
                onClick={() => setApplyMode(applyMode === 'heal' ? null : 'heal')}
                className={cn('flex-1 h-6 rounded flex items-center justify-center gap-0.5 text-xs transition-colors', applyMode === 'heal' ? 'bg-neon-green/30 text-neon-green' : 'bg-neon-green/10 text-neon-green hover:bg-neon-green/20')}
              >
                <Heart className="h-3 w-3" /> Cura
              </button>
              <button
                onClick={() => setApplyMode(applyMode === 'shield' ? null : 'shield')}
                className={cn('flex-1 h-6 rounded flex items-center justify-center gap-0.5 text-xs transition-colors', applyMode === 'shield' ? 'bg-shield/30 text-shield' : 'bg-shield/10 text-shield hover:bg-shield/20')}
              >
                <Shield className="h-3 w-3" /> +ESC
              </button>
              <button
                onClick={() => setApplyMode(applyMode === 'shieldRemove' ? null : 'shieldRemove')}
                className={cn('flex-1 h-6 rounded flex items-center justify-center gap-0.5 text-xs transition-colors', applyMode === 'shieldRemove' ? 'bg-orange-400/30 text-orange-400' : 'bg-orange-400/10 text-orange-400 hover:bg-orange-400/20')}
              >
                <ShieldMinus className="h-3 w-3" /> -ESC
              </button>
            </div>
            {applyMode && (
              <>
                {applyMode === 'damage' && (
                  <select
                    value={selectedDamageType}
                    onChange={(e) => setSelectedDamageType(e.target.value as DamageType | '')}
                    className="h-6 w-full rounded border border-input bg-background px-1 text-xs text-foreground"
                  >
                    <option value="">Tipo de dano: Nenhum</option>
                    {DAMAGE_TYPES.map((t) => (
                      <option key={t} value={t}>{DAMAGE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                )}
                <div className="flex flex-wrap gap-0.5">
                  {characters.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => toggleTarget(c.id)}
                      className={cn('rounded border px-1.5 py-0.5 text-xs transition-colors', selectedTargets.includes(c.id) ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {selectedTargets.length > 0 && (
                  <button
                    onClick={() => applyResultToTargets(applyMode)}
                    className="w-full h-6 rounded bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
                  >
                    Aplicar ({effectiveTotal}) em {selectedTargets.length} alvo(s)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
