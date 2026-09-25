/**
 * ============================================================================
 *  SPEC REACTIONS PANEL — Bloco A (8 Reações do Especialista em Técnica)
 * ============================================================================
 *  Reações manuais: o jogador clica para confirmar o gatilho. O store cobra
 *  PE quando aplicável, gera log narrativo e aplica side-effects determinísticos
 *  (tempPE/peCurrent). Limites de uso (1×/rodada, 1/2/3×/Descanso) NÃO são
 *  rastreados — confiamos no jogador (mesma filosofia de FahPanel).
 *
 *  Cobre:
 *    A1 tec-zelo-recompensador     → +1 (ou +2 Lv≥14) tempPE
 *    A2 tec-determinacao-energizada → custo escalonado → vantagem em TR Ast/Vont
 *    A3 tec-incapaz-de-falhar       → 2 PE → +Mod_Chave em rolagem de aptidão
 *    A5 tec-explosao-defensiva      → X PE → −X·5 dano, push X·3m
 *    A6 tec-passo-rapido            → log de movimento reativo sem AoO
 *    A7 tec-primeiro-disparo        → log: ativar habilidade Bônus/Livre pré-1º turno
 *    A8 tec-abastecido-pelo-sangue  → +Mod_Chave PE quando inimigo cai em 12m
 *    A4 tec-correcao                → spellLevel PE → ignora quebra de Concentração
 * ============================================================================
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSpecKeyMod } from '@/lib/specKeyMod';
import { Zap, Shield, Target, Wind, Crosshair, Droplets, RotateCcw, Sparkles } from 'lucide-react';

interface Props {
  character: Character;
}

interface ReactionDef {
  id:
    | 'tec-zelo-recompensador'
    | 'tec-abastecido-pelo-sangue'
    | 'tec-determinacao-energizada'
    | 'tec-incapaz-de-falhar'
    | 'tec-explosao-defensiva'
    | 'tec-passo-rapido'
    | 'tec-primeiro-disparo'
    | 'tec-correcao';
  name: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  inputType: 'none' | 'pe-input' | 'spell-level-input' | 'scaling-pe';
}

const REACTIONS: ReactionDef[] = [
  { id: 'tec-zelo-recompensador',     name: 'Zelo Recompensador',     hint: 'Passou em TR contra Feitiço',                       icon: Sparkles,  inputType: 'none' },
  { id: 'tec-abastecido-pelo-sangue', name: 'Abastecido pelo Sangue', hint: 'Inimigo caiu em até 12m',                            icon: Droplets,  inputType: 'none' },
  { id: 'tec-determinacao-energizada', name: 'Determinação Energizada', hint: 'Custo: 1 + usos nesta rodada',                     icon: Target,    inputType: 'scaling-pe' },
  { id: 'tec-incapaz-de-falhar',      name: 'Incapaz de Falhar',      hint: 'Rolagem de Aptidão (exceto Domínio) · 2 PE',         icon: Crosshair, inputType: 'none' },
  { id: 'tec-explosao-defensiva',     name: 'Explosão Defensiva',     hint: 'Sofreu dano CaC · PE: ≤ Treinamento',                icon: Shield,    inputType: 'pe-input' },
  { id: 'tec-passo-rapido',           name: 'Passo Rápido',           hint: 'Inimigo entrou no alcance CaC',                      icon: Wind,      inputType: 'none' },
  { id: 'tec-primeiro-disparo',       name: 'Primeiro Disparo',       hint: 'Na rolagem de iniciativa',                           icon: Zap,       inputType: 'none' },
  { id: 'tec-correcao',               name: 'Correção',               hint: 'Pagar PE = Nv do Feitiço para manter Concentração',  icon: RotateCcw, inputType: 'spell-level-input' },
];

export function SpecReactionsPanel({ character: c }: Props) {
  const triggerSpecReaction = useCharacterStore((s) => s.triggerSpecReaction);
  const addLog = useLogStore((s) => s.addLog);
  const [inputs, setInputs] = useState<Record<string, number>>({});

  const chosen = new Set((c.chosenSpecAbilities ?? []).map((a) => a.abilityId));
  const visible = REACTIONS.filter((r) => chosen.has(r.id));
  if (visible.length === 0) return null;

  const tb = getTrainingBonusByLevel(c.level);
  const keyMod = getSpecKeyMod(c);

  const fire = (def: ReactionDef) => {
    const inp = inputs[def.id] ?? (def.inputType === 'spell-level-input' ? 1 : def.inputType === 'pe-input' ? 1 : def.inputType === 'scaling-pe' ? 1 : 0);
    const payload: { pe?: number; spellLevel?: number } = {};
    if (def.inputType === 'pe-input' || def.inputType === 'scaling-pe') payload.pe = inp;
    if (def.inputType === 'spell-level-input') payload.spellLevel = inp;
    const res = triggerSpecReaction(c.id, def.id, payload);
    if (!res.ok) {
      addLog('combat', `⚠️ ${c.name}: ${def.name} — ${res.reason}`);
      return;
    }
    if (res.log) addLog('combat', `${c.name}: ${res.log}`);
  };

  return (
    <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-3 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-fuchsia-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">
          Reações — Especialista em Técnica
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          TB {tb} · Mod_Chave {keyMod >= 0 ? '+' : ''}{keyMod}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {visible.map((def) => {
          const Icon = def.icon;
          const showInput = def.inputType !== 'none';
          const inputVal = inputs[def.id] ?? 1;
          const inputMax = def.inputType === 'pe-input' ? tb : def.inputType === 'spell-level-input' ? 10 : 99;
          return (
            <div
              key={def.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5"
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0 text-fuchsia-400" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{def.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{def.hint}</div>
              </div>
              {showInput && (
                <input
                  type="number"
                  min={1}
                  max={inputMax}
                  value={inputVal}
                  onChange={(e) =>
                    setInputs((p) => ({
                      ...p,
                      [def.id]: Math.max(1, Math.min(inputMax, parseInt(e.target.value) || 1)),
                    }))
                  }
                  className="h-6 w-12 rounded border border-input bg-background px-1 text-center font-mono text-xs"
                  title={def.inputType === 'pe-input' ? `PE (máx ${tb})` : def.inputType === 'spell-level-input' ? 'Nv do Feitiço' : 'Usos nesta rodada (custo total)'}
                />
              )}
              <button
                onClick={() => fire(def)}
                className="rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 transition-colors flex-shrink-0"
              >
                Ativar
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-muted-foreground italic">
        Limites de uso (1×/rodada, 1-3×/descanso) não são rastreados automaticamente — administre manualmente.
      </p>
    </div>
  );
}
