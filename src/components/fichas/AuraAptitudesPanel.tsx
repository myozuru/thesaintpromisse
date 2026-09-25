import { useState, useMemo, useEffect } from 'react';
import { Sparkles, Lock, Plus, X, Zap, Check, ChevronDown, ChevronUp, Power, Shield, Flame, Crosshair, Skull, EyeOff } from 'lucide-react';
import type { Character, DamageType } from '@/types';
import { createDefaultCursedAptitudes, DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from '@/types';
import {
  AURA_APTITUDES,
  getAuraAptitudeById,
  checkAuraGate,
  resolveAuraUsageMax,
  resolveFixedPeCost,
  type AuraAptitude,
} from '@/lib/auraAptitudes';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { isAuraToggleActive, getPendingAbsorbedDice, getEnemyTurnAuraPrompts, aggregateAuraEffects } from '@/lib/auraEffects';
import { useLogStore } from '@/stores/useLogStore';
import type { ActiveBuff } from '@/types';
import { Users } from 'lucide-react';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { cn } from '@/lib/utils';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';
import { rollD20Com } from '@/lib/dice';
import { AuraEffectsBreakdown } from './AuraEffectsBreakdown';
import { AuraElementSelector } from './AuraElementSelector';

interface Props {
  character: Character;
  /** Estado controlado do catálogo interno (opcional). */
  catalogOpen?: boolean;
  onCatalogOpenChange?: (open: boolean) => void;
  /** Estado inicial do catálogo quando usado em modo não-controlado. */
  defaultCatalogOpen?: boolean;
  /** Quando false, esconde botões de adquirir/remover (modo visualização). */
  editMode?: boolean;
  /**
   * Quando true, exibe apenas o catálogo de aptidões disponíveis (esconde
   * blocos de reações, ações, prompts de turno e a lista de aptidões já
   * adquiridas). Usado quando o painel é aberto a partir de uma pendência
   * de level-up para focar exclusivamente na escolha de uma nova aptidão.
   */
  catalogOnly?: boolean;
}

const ATTR_SHORT: Record<string, string> = {
  'Força': 'FOR', 'Destreza': 'DES', 'Constituição': 'CON',
  'Inteligência': 'INT', 'Sabedoria': 'SAB', 'Presença': 'PRE',
};

export function AuraAptitudesPanel({
  character: c,
  catalogOpen,
  onCatalogOpenChange,
  defaultCatalogOpen = false,
  editMode = false,
  catalogOnly = false,
}: Props) {
  const chooseAuraAptitude = useCharacterStore(s => s.chooseAuraAptitude);
  const removeAuraAptitude = useCharacterStore(s => s.removeAuraAptitude);
  const activateAuraAptitude = useCharacterStore(s => s.activateAuraAptitude);
  const toggleAuraAptitude = useCharacterStore(s => s.toggleAuraAptitude);
  const tryNullifyCondition = useCharacterStore(s => s.tryNullifyCondition);
  const armElementalAbsorption = useCharacterStore(s => s.armElementalAbsorption);
  const consumeElementalAbsorption = useCharacterStore(s => s.consumeElementalAbsorption);
  const redirectMissedAttack = useCharacterStore(s => s.redirectMissedAttack);
  const triggerAuraDrenadora = useCharacterStore(s => s.triggerAuraDrenadora);
  const rollFurtividadeWithAuraBoost = useCharacterStore(s => s.rollFurtividadeWithAuraBoost);
  const grappleAttempt = useCharacterStore(s => s.grappleAttempt);
  const escapeGrapple = useCharacterStore(s => s.escapeGrapple);
  const releaseGrapple = useCharacterStore(s => s.releaseGrapple);
  const armConcentratedAura = useCharacterStore(s => s.armConcentratedAura);
  const transferAuraTo = useCharacterStore(s => s.transferAuraTo);
  const revokeTransferAura = useCharacterStore(s => s.revokeTransferAura);
  const allCharacters = useCharacterStore(s => s.characters);
  const addBuff = useCharacterStore(s => s.addBuff);
  const addLog = useLogStore(s => s.addLog);
  const isControlled = catalogOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultCatalogOpen);
  const showCatalog = isControlled ? !!catalogOpen : internalOpen;
  const setShowCatalog = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === 'function' ? (next as (p: boolean) => boolean)(showCatalog) : next;
    if (isControlled) onCatalogOpenChange?.(value);
    else setInternalOpen(value);
  };
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Fase A — seleção para Transferência de Aura
  const [transferAllyId, setTransferAllyId] = useState<string>('');
  const [transferAuraId, setTransferAuraId] = useState<string>('');
  // Fase C — seleções para Grapple (Aura de Contenção)
  const [grappleTargetId, setGrappleTargetId] = useState<string>('');
  const [grappleAdvantage, setGrappleAdvantage] = useState<boolean>(false);
  const [escapeSkill, setEscapeSkill] = useState<'Atletismo' | 'Acrobacia'>('Atletismo');
  const transferActive = useMemo(
    () => allCharacters.some(x => (x.activeBuffs ?? []).some(
      b => b.isSustained && b.sourceCharId === c.id && b.spellName === 'Transferência de Aura',
    )),
    [allCharacters, c.id],
  );

  const apts = { ...createDefaultCursedAptitudes(), ...(c.cursedAptitudes ?? {}) };
  const auLevel = apts.AU;
  const chosen = c.chosenAuraAptitudes ?? [];
  const usage = c.auraAptitudeUsage ?? {};
  const trainingBonus = getTrainingBonusByLevel(c.level);

  const ctx = useMemo(() => {
    const attrs: Partial<Record<'FOR' | 'DES' | 'CON' | 'INT' | 'PRE' | 'SAB', number>> = {};
    (c.attributes ?? []).forEach(a => {
      const k = ATTR_SHORT[a.name];
      if (k) (attrs as any)[k] = a.value;
    });
    const trainedSkills = (c.skills ?? []).filter(s => s.trained || s.mastery).map(s => s.name);
    return { level: c.level, auLevel, attrs, trainedSkills, chosenAuraIds: chosen };
  }, [c.attributes, c.skills, c.level, auLevel, chosen]);

  // Filtra apenas aptidões da família AU (entradas legadas sem `family` são tratadas como AU).
  const isAuFamily = (a: AuraAptitude) => (a.family ?? 'AU') === 'AU';
  const chosenList = chosen
    .map(id => getAuraAptitudeById(id))
    .filter((a): a is AuraAptitude => !!a && isAuFamily(a));
  const availableList = AURA_APTITUDES.filter(a => isAuFamily(a) && !chosen.includes(a.id));

  const handleAcquire = (apt: AuraAptitude) => {
    console.log('[AuraAptitudes] handleAcquire clicked', { aptId: apt.id, charId: c.id, pool: c.availableAuraChoices });
    const r = chooseAuraAptitude(c.id, apt.id);
    console.log('[AuraAptitudes] chooseAuraAptitude result', r);
    if (r.ok) {
      playSuccessSound();
      addLog('system', `${c.name} adquiriu Aptidão de Aura: ${apt.name}`);
    } else {
      playErrorSound();
      addLog('system', `❌ Falha ao adquirir ${apt.name}: ${r.reason ?? 'erro'}`);
    }
  };

  const handleRemove = (apt: AuraAptitude) => {
    removeAuraAptitude(c.id, apt.id);
    playClickSound();
    addLog('system', `${c.name} removeu Aptidão de Aura: ${apt.name}`);
  };

  const handleActivate = (apt: AuraAptitude) => {
    const r = activateAuraAptitude(c.id, apt.id);
    if (r.ok) {
      playSuccessSound();
      const parts: string[] = [`Ativou ${apt.name}`];
      if (r.peSpent) parts.push(`-${r.peSpent} PE`);
      if (typeof r.usesLeft === 'number') parts.push(`Usos restantes: ${r.usesLeft}`);
      addLog('system', `${c.name}: ${parts.join(' • ')}`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: ${r.reason ?? 'falha ao ativar'}`);
    }
  };

  // ─── Reações (Fase 3) ───
  const [nullifyTier, setNullifyTier] = useState<'fraca' | 'media' | 'forte' | 'extrema'>('fraca');
  const [absorbElement, setAbsorbElement] = useState<DamageType>('DQ');
  const TIER_LABEL: Record<typeof nullifyTier, string> = {
    fraca: 'Fraca (2 PE)', media: 'Média (4 PE)', forte: 'Forte (6 PE)', extrema: 'Extrema (10 PE)',
  };
  const hasAnuladora = chosen.includes('aura_anuladora');
  const hasAbsorcao = chosen.includes('absorcao_elemental');
  const hasRedirecionadora = chosen.includes('aura_redirecionadora');
  const hasAnyReaction = hasAnuladora || hasAbsorcao || hasRedirecionadora;
  const anuladoraApt = getAuraAptitudeById('aura_anuladora');
  const anuladoraMax = anuladoraApt?.usage
    ? resolveAuraUsageMax(anuladoraApt.usage, { auLevel, trainingBonus })
    : 0;
  const anuladoraUsed = usage['aura_anuladora'] ?? 0;
  const armed = getPendingAbsorbedDice(c);

  // ─── Fase 8 — Auras que afetam aliados (Bastião / Comandante / Embaçada) ───
  const hasBastiao = chosen.includes('aura_do_bastiao');
  const hasComandante = chosen.includes('aura_do_comandante');
  const hasComandanteEvol = chosen.includes('aura_do_comandante_evoluida');
  const hasEmbacada = chosen.includes('aura_embacada');
  const hasAllyAuras = hasBastiao || hasComandante || hasEmbacada;
  // Aliados elegíveis: outros PCs do grupo (mesma categoria PLAYER) — o Mestre confirma raio.
  const allies = allCharacters.filter(a => a.id !== c.id && a.category === 'PLAYER');
  const [selectedAllies, setSelectedAllies] = useState<string[]>([]);
  const toggleAlly = (id: string) =>
    setSelectedAllies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const applyBastiaoToAllies = () => {
    if (!hasBastiao || selectedAllies.length === 0 || auLevel <= 0) return;
    selectedAllies.forEach(allyId => {
      const buff: ActiveBuff = {
        id: `aura_bastiao_from:${c.id}:${Date.now()}:${allyId}`,
        spellName: `Aura do Bastião (${c.name})`,
        type: 'ca',
        value: auLevel,
        remainingTurns: 1,
        sourceCharId: c.id,
        isSustained: false,
      };
      addBuff(allyId, buff);
    });
    const names = selectedAllies.map(id => allCharacters.find(a => a.id === id)?.name ?? '?').join(', ');
    addLog('combat', `🛡 ${c.name}: Aura do Bastião → +${auLevel} CA por 1 rodada em ${names}.`);
    playSuccessSound();
  };

  const applyComandanteToAllies = () => {
    if (!hasComandante || selectedAllies.length === 0) return;
    if (!isAuraToggleActive(c, 'aura_do_comandante')) {
      playErrorSound();
      addLog('system', `${c.name}: Aura do Comandante precisa estar ATIVA (toggle).`);
      return;
    }
    const baseBonus = hasComandanteEvol ? auLevel : (1 + Math.floor(auLevel / 2));
    const extraEvol = hasComandanteEvol ? 2 : 0; // +2 ataques/TR adicional na Evoluída
    const hitTotal = baseBonus + extraEvol;
    const dmgTotal = baseBonus;
    selectedAllies.forEach(allyId => {
      const stamp = `${Date.now()}:${allyId}`;
      const hitBuff: ActiveBuff = {
        id: `aura_comandante_hit:${c.id}:${stamp}`,
        spellName: `Aura do Comandante (${c.name})`,
        type: 'hit',
        value: hitTotal,
        remainingTurns: 1,
        sourceCharId: c.id,
        isSustained: false,
      };
      const dmgBuff: ActiveBuff = {
        id: `aura_comandante_dmg:${c.id}:${stamp}`,
        spellName: `Aura do Comandante (${c.name})`,
        type: 'damageBonus',
        value: dmgTotal,
        remainingTurns: 1,
        sourceCharId: c.id,
        isSustained: false,
      };
      addBuff(allyId, hitBuff);
      addBuff(allyId, dmgBuff);
    });
    const names = selectedAllies.map(id => allCharacters.find(a => a.id === id)?.name ?? '?').join(', ');
    addLog(
      'combat',
      `📣 ${c.name}: Aura do Comandante${hasComandanteEvol ? ' Evoluída' : ''} → +${hitTotal} acerto / +${dmgTotal} dano (e perícia em combate) por 1 rodada em ${names}.`,
    );
    playSuccessSound();
  };

  const promptEmbacada = () => {
    if (!hasEmbacada) return;
    if (!isAuraToggleActive(c, 'aura_embacada')) {
      playErrorSound();
      addLog('system', `${c.name}: Aura Embaçada precisa estar ATIVA (toggle).`);
      return;
    }
    addLog(
      'combat',
      `🌫 ${c.name}: Aura Embaçada ATIVA — ataques contra ${c.name} têm 20% de falhar (role 1d10; 1-2 = miss). Lembrete válido até a próxima rodada.`,
    );
    playClickSound();
  };

  const handleNullify = () => {
    const r = tryNullifyCondition(c.id, nullifyTier);
    if (r.ok) {
      playSuccessSound();
      addLog('system', `${c.name}: Aura Anuladora — anulou condição ${TIER_LABEL[nullifyTier]}. Usos restantes: ${r.usesLeft ?? '∞'}.`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: ${r.reason ?? 'falha ao anular'}`);
    }
  };
  const handleArmAbsorption = () => {
    const r = armElementalAbsorption(c.id, absorbElement);
    if (r.ok) {
      playSuccessSound();
      const sides = (r.au ?? 0) >= 5 ? 10 : (r.au ?? 0) >= 3 ? 8 : 6;
      addLog('system', `${c.name}: Absorção Elemental ARMADA (${DAMAGE_TYPE_LABELS[absorbElement]}) — próximo ataque ganha ${r.au}d${sides}.`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: ${r.reason ?? 'falha ao armar absorção'}`);
    }
  };
  const handleConsumeAbsorption = () => {
    consumeElementalAbsorption(c.id);
    playClickSound();
    addLog('system', `${c.name}: Absorção Elemental descartada (consumo manual).`);
  };
  const handleRedirect = () => {
    const r = redirectMissedAttack(c.id);
    if (r.ok) {
      playSuccessSound();
      addLog('system', `${c.name}: Aura Redirecionadora — refazer ataque com +${r.bonus} (-${r.peSpent} PE).`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: ${r.reason ?? 'falha ao redirecionar'}`);
    }
  };

  const handleToggle = (apt: AuraAptitude) => {
    const r = toggleAuraAptitude(c.id, apt.id);
    if (r.ok) {
      playSuccessSound();
      const state = r.active ? 'LIGADA' : 'DESLIGADA';
      const peTxt = r.peSpent ? ` (-${r.peSpent} PE)` : '';
      addLog('system', `${c.name}: Aura "${apt.name}" ${state}${peTxt}.`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: ${r.reason ?? 'falha ao alternar aura'}`);
    }
  };
  return (
    <div className="space-y-3">
      {/* Header com nível AU */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">
            Nível de <span className="font-bold text-primary">AU</span>: <span className="font-mono font-bold text-foreground">{auLevel}</span>/5
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {chosen.length > 0 && !catalogOnly && <AuraEffectsBreakdown character={c} />}
          {!catalogOnly && (
            <button
              onClick={() => { setShowCatalog(p => !p); playClickSound(); }}
              className="text-xs px-2 py-1 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1"
            >
              {showCatalog ? 'Fechar catálogo' : <><Plus className="h-3 w-3" />Abrir catálogo</>}
            </button>
          )}
        </div>
      </div>

      {!catalogOnly && (<>
      {/* Seletor de elemento (Aura Elemental / Afinidade Ampliada) — Fase 10 */}
      <AuraElementSelector character={c} />

      {/* ─── REAÇÕES (Fase 3) ─── */}
      {hasAnyReaction && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
          <div className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-1">
            <Zap className="h-3 w-3" /> Reações disponíveis
          </div>

          {hasAnuladora && (
            <div className="rounded-md border border-border bg-card/40 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold">Aura Anuladora</span>
                {anuladoraMax > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {anuladoraUsed}/{anuladoraMax} usos (descanso longo)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={nullifyTier}
                  onChange={(e) => setNullifyTier(e.target.value as typeof nullifyTier)}
                  className="flex-1 text-xs bg-secondary/40 border border-border rounded px-1.5 py-1 text-foreground"
                >
                  <option value="fraca">Fraca — 2 PE</option>
                  <option value="media">Média — 4 PE</option>
                  <option value="forte">Forte — 6 PE</option>
                  <option value="extrema">Extrema — 10 PE</option>
                </select>
                <button
                  onClick={handleNullify}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                >
                  Anular
                </button>
              </div>
            </div>
          )}

          {hasAbsorcao && (
            <div className="rounded-md border border-border bg-card/40 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Flame className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold">Absorção Elemental</span>
                {armed && (
                  <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold ml-auto">
                    ARMADA: {armed.count}d{armed.sides} {DAMAGE_TYPE_LABELS[armed.element]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={absorbElement}
                  onChange={(e) => setAbsorbElement(e.target.value as DamageType)}
                  className="flex-1 text-xs bg-secondary/40 border border-border rounded px-1.5 py-1 text-foreground"
                >
                  {DAMAGE_TYPES.map(t => (
                    <option key={t} value={t}>{DAMAGE_TYPE_LABELS[t]} ({t})</option>
                  ))}
                </select>
                <button
                  onClick={handleArmAbsorption}
                  className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 font-bold"
                  title="Armar absorção do elemento recebido"
                >
                  Armar
                </button>
                {armed && (
                  <button
                    onClick={handleConsumeAbsorption}
                    className="text-xs p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Descartar absorção armada"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {hasRedirecionadora && (
            <div className="rounded-md border border-border bg-card/40 p-2">
              <div className="flex items-center gap-2">
                <Crosshair className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold flex-1">Aura Redirecionadora</span>
                <span className="text-xs text-muted-foreground">
                  +{1 + Math.floor(auLevel / 2)} no rerolagem
                </span>
                <button
                  onClick={handleRedirect}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                  title="Redirecionar tiro errado (-2 PE)"
                >
                  Redirecionar (2 PE)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── HOOKS DE INÍCIO DE TURNO INIMIGO (Fase 4) ─── */}
      {(chosen.includes('aura_lacerante') || chosen.includes('aura_macabra') || chosen.includes('aura_chamativa')) && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
          <div className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Auras de área (início de turno inimigo)
          </div>
          {(() => {
            const prompts = getEnemyTurnAuraPrompts(c);
            if (prompts.length === 0) {
              return (
                <div className="text-xs text-muted-foreground italic px-1">
                  Nenhuma aura de área ativa neste momento. Ative Lacerante/Macabra abaixo para gerar prompts a cada turno inimigo.
                </div>
              );
            }
            return (
              <div className="space-y-1">
                {prompts.map(p => (
                  <div key={p.auraId} className="text-xs rounded bg-card/40 border border-border px-2 py-1 leading-snug">
                    <span className="font-bold text-foreground">{p.auraName}</span>{' '}
                    <span className="text-muted-foreground">— raio {p.radiusM}m, TR {p.saveType}.</span>{' '}
                    <span className="text-foreground">{p.onFailText}</span>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground italic px-1">
                  💡 Estes prompts aparecem no log de combate sempre que um inimigo iniciar turno.
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── AÇÕES ESPECIAIS (Fase 5) ─── */}
      {(chosen.includes('aura_drenadora') || chosen.includes('aura_inofensiva') || chosen.includes('aura_controlada') || chosen.includes('aura_de_contencao') || chosen.includes('enganacao_projetada') || chosen.includes('concentrar_aura') || chosen.includes('golpe_com_aura') || chosen.includes('transferencia_de_aura') || (c.grappleState?.grappledBy?.length ?? 0) > 0) && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
          <div className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-1">
            <Zap className="h-3 w-3" /> Ações especiais
          </div>

          {chosen.includes('aura_drenadora') && (
            <div className="rounded-md border border-border bg-card/40 p-2">
              <div className="flex items-center gap-2">
                <Skull className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold flex-1">Aura Drenadora</span>
                <span className="text-xs text-muted-foreground">{auLevel}d8 + mod CON → PV temp</span>
                <button
                  onClick={async () => {
                    const r = await triggerAuraDrenadora(c.id);
                    if (r.ok) {
                      playSuccessSound();
                      addLog('system', `${c.name}: Aura Drenadora — [${r.rolls?.join(', ')}] + ${r.conMod} CON = +${r.total} PV temp.`);
                    } else {
                      playErrorSound();
                      addLog('system', `${c.name}: ${r.reason ?? 'falha na drenagem'}`);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                  title="Inimigo abatido — drenar"
                >
                  Drenar (inimigo abatido)
                </button>
              </div>
            </div>
          )}

          {chosen.includes('aura_inofensiva') && (
            <div className="rounded-md border border-border bg-card/40 p-2">
              <div className="flex items-center gap-2">
                <EyeOff className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold flex-1">Aura Inofensiva</span>
                <span className="text-xs text-muted-foreground">Início de combate</span>
                <button
                  onClick={() => {
                    playClickSound();
                    addLog('system', `${c.name}: Aura Inofensiva — role Feitiçaria vs Atenção dos inimigos. Fica escondido contra os que falharem.`);
                  }}
                  className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 font-bold"
                >
                  Esconder (prompt)
                </button>
              </div>
            </div>
          )}

          {chosen.includes('aura_controlada') && (
            <div className="rounded-md border border-border bg-card/40 p-2">
              <div className="flex items-center gap-2">
                <EyeOff className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold flex-1">Aura Controlada</span>
                <span className="text-xs text-muted-foreground">1 PE → AU completo na rolagem</span>
                <button
                  onClick={async () => {
                    const r = await rollFurtividadeWithAuraBoost(c.id);
                    if (r.ok) {
                      playSuccessSound();
                      addLog('system', `${c.name}: Aura Controlada (1 PE) — Furtividade d20=${r.roll} + base ${r.base! >= 0 ? '+' : ''}${r.base} + AU completo +${r.auFull} = ${r.total}. (passivo ½AU +${r.auHalfAlreadyApplied} já contava no bônus base de Furtividade.)`);
                    } else {
                      playErrorSound();
                      addLog('system', `${c.name}: Aura Controlada — ${r.reason ?? 'falha'}`);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                >
                  Boost (1 PE)
                </button>
              </div>
            </div>
          )}

          {chosen.includes('aura_de_contencao') && (() => {
            const possibleTargets = allCharacters.filter(x => x.id !== c.id);
            const grappling = c.grappleState?.grappling ?? [];
            return (
              <div className="rounded-md border border-border bg-card/40 p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Crosshair className="h-3 w-3 text-primary" />
                  <span className="text-xs font-bold flex-1">Aura de Contenção — Agarrar</span>
                  <span className="text-xs text-muted-foreground">Atletismo + ½AU</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="text-xs px-2 py-1 rounded bg-background border border-border flex-1 min-w-[150px]"
                    value={grappleTargetId}
                    onChange={(e) => setGrappleTargetId(e.target.value)}
                  >
                    <option value="">— escolher alvo —</option>
                    {possibleTargets.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} {grappling.includes(t.id) ? '(já agarrado)' : ''}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs flex items-center gap-1 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={grappleAdvantage}
                      onChange={(e) => setGrappleAdvantage(e.target.checked)}
                    />
                    1 PE → vantagem
                  </label>
                  <button
                    disabled={!grappleTargetId}
                    onClick={async () => {
                      const tgt = allCharacters.find(x => x.id === grappleTargetId);
                      if (!tgt) return;
                      const r = await grappleAttempt(c.id, grappleTargetId, grappleAdvantage);
                      if (!r.ok) {
                        playErrorSound();
                        addLog('system', `${c.name}: Agarrar — ${r.reason ?? 'falha'}`);
                        return;
                      }
                      (r.success ? playSuccessSound : playErrorSound)();
                      if (r.success) setGrappleTargetId('');
                    }}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold disabled:opacity-50"
                  >
                    Agarrar (Ação)
                  </button>
                </div>
                {grappling.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase text-muted-foreground">Agarrando:</div>
                    {grappling.map(id => {
                      const t = allCharacters.find(x => x.id === id);
                      if (!t) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 text-xs">
                          <span className="flex-1">🤼 {t.name}</span>
                          <button
                            onClick={() => {
                              releaseGrapple(c.id, id);
                              playClickSound();
                              // log detalhado emitido pelo store
                            }}
                            className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80"
                          >
                            Soltar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {(c.grappleState?.grappledBy?.length ?? 0) > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 text-destructive" />
                <span className="text-xs font-bold flex-1 text-destructive">Você está AGARRADO</span>
                <span className="text-[10px] text-muted-foreground">movimento bloqueado · desvantagem em ataques</span>
              </div>
              {(c.grappleState?.grappledBy ?? []).map(grpId => {
                const grp = allCharacters.find(x => x.id === grpId);
                if (!grp) return null;
                return (
                  <div key={grpId} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex-1">por <b>{grp.name}</b></span>
                    <select
                      value={escapeSkill}
                      onChange={(e) => setEscapeSkill(e.target.value as 'Atletismo' | 'Acrobacia')}
                      className="text-xs px-1 py-0.5 rounded bg-background border border-border"
                    >
                      <option value="Atletismo">Atletismo</option>
                      <option value="Acrobacia">Acrobacia</option>
                    </select>
                    <button
                      onClick={async () => {
                        const r = await escapeGrapple(c.id, grpId, escapeSkill, false);
                        if (!r.ok) {
                          playErrorSound();
                          addLog('system', `${c.name}: Escapar — ${r.reason ?? 'falha'}`);
                          return;
                        }
                        (r.success ? playSuccessSound : playErrorSound)();
                      }}
                      className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                    >
                      Escapar (Ação)
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {chosen.includes('enganacao_projetada') && (() => {
            const skill = (c.skills ?? []).find(s => (s.name ?? '').trim().toLowerCase() === 'astúcia' || (s.name ?? '').trim().toLowerCase() === 'astucia');
            const attr = (c.attributes ?? []).find(a => a.name === skill?.linkedAttribute);
            const attrMod = attr ? Math.floor((attr.value - 10) / 2) : 0;
            const train = skill?.trained ? Math.floor(((c.level ?? 1) + 3) / 4) + 1 : 0;
            const bonus = attrMod + train + (skill?.externalBonus ?? 0);
            return (
              <div className="rounded-md border border-border bg-card/40 p-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs font-bold flex-1">Enganação Projetada</span>
                  <span className="text-xs text-muted-foreground">TR Astúcia (vantagem se passar)</span>
                  <button
                    onClick={async () => {
                      playClickSound();
                      const roll = await rollD20Com(c.id);
                      const total = roll + bonus;
                      addLog('system', `${c.name}: Enganação Projetada — Astúcia ${roll}${bonus >= 0 ? '+' : ''}${bonus} = ${total}. Se ≥ CD do alvo, ganha vantagem.`);
                    }}
                    className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 font-bold"
                  >
                    Rolar Astúcia
                  </button>
                </div>
              </div>
            );
          })()}

          {chosen.includes('concentrar_aura') && (
            <div className="rounded-md border border-border bg-card/40 p-2">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold flex-1">Concentrar Aura</span>
                <span className="text-xs text-muted-foreground">
                  Carga: <b>{c.concentratedAura?.au ?? 0}</b> AU
                </span>
                <button
                  onClick={() => {
                    const r = armConcentratedAura(c.id);
                    if (r.ok) {
                      playSuccessSound();
                      addLog('system', `${c.name}: Concentrar Aura — carga +${r.au} AU acumulada para o próximo Golpe com Aura.`);
                    } else {
                      playErrorSound();
                      addLog('system', `${c.name}: ${r.reason ?? 'falha ao concentrar'}`);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                >
                  Concentrar (Ação)
                </button>
              </div>
            </div>
          )}

          {chosen.includes('golpe_com_aura') && (
            <div className="rounded-md border border-border bg-card/40 p-2 text-xs text-muted-foreground">
              <b className="text-primary">Golpe com Aura:</b> ao acertar próximo ataque, soma <b>+{c.concentratedAura?.au ?? 0}</b> de dano (consome a carga). Carga atual: <b>{c.concentratedAura?.au ?? 0}</b> AU.
            </div>
          )}

          {chosen.includes('transferencia_de_aura') && (
            <div className="rounded-md border border-border bg-card/40 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold flex-1">Transferência de Aura</span>
                <span className="text-xs text-muted-foreground">Ação Bônus · 2 PE + 1/rd</span>
                {transferActive && (
                  <button
                    onClick={() => {
                      revokeTransferAura(c.id);
                      playClickSound();
                      addLog('system', `${c.name}: Transferência de Aura encerrada.`);
                    }}
                    className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 font-bold"
                  >
                    Encerrar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={transferAllyId}
                  onChange={(e) => setTransferAllyId(e.target.value)}
                  className="text-xs bg-background border border-border rounded px-2 py-1"
                >
                  <option value="">— aliado —</option>
                  {allies.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <select
                  value={transferAuraId}
                  onChange={(e) => setTransferAuraId(e.target.value)}
                  className="text-xs bg-background border border-border rounded px-2 py-1"
                >
                  <option value="">— aptidão —</option>
                  {chosen.filter(id => id !== 'transferencia_de_aura').map(id => {
                    const apt = AURA_APTITUDES.find(x => x.id === id);
                    return apt ? <option key={id} value={id}>{apt.name}</option> : null;
                  })}
                </select>
              </div>
              <button
                onClick={() => {
                  if (!transferAllyId || !transferAuraId) {
                    playErrorSound();
                    addLog('system', `${c.name}: selecione aliado e aptidão.`);
                    return;
                  }
                  const r = transferAuraTo(c.id, transferAllyId, transferAuraId);
                  if (r.ok) {
                    const allyName = allCharacters.find(a => a.id === transferAllyId)?.name ?? '?';
                    const auraName = AURA_APTITUDES.find(x => x.id === transferAuraId)?.name ?? transferAuraId;
                    playSuccessSound();
                    addLog('combat', `🔁 ${c.name}: Transferência de Aura → ${allyName} recebe "${auraName}" (sustentado, 1 PE/rd para manter).`);
                  } else {
                    playErrorSound();
                    addLog('system', `${c.name}: ${r.reason ?? 'falha na transferência'}`);
                  }
                }}
                className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold disabled:opacity-50"
                disabled={!transferAllyId || !transferAuraId}
              >
                {transferActive ? 'Substituir transferência' : 'Transferir aura'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bloco "Auras em aliados" agora renderizado inline dentro de cada aptidão expandida (abaixo). */}

      {/* Aptidões adquiridas */}
      {chosenList.length === 0 ? (
        <div className="text-xs text-muted-foreground italic px-2 py-3 rounded-md border border-dashed border-border text-center">
          Nenhuma aptidão de aura adquirida ainda.
        </div>
      ) : (
        <div className="space-y-1.5">
          {chosenList.map(apt => {
            const isExpanded = expandedId === apt.id;
            const showAllyBlock = isExpanded && (
              (apt.id === 'aura_do_bastiao' && hasBastiao) ||
              (apt.id === 'aura_do_comandante' && hasComandante) ||
              (apt.id === 'aura_do_comandante_evoluida' && hasComandanteEvol) ||
              (apt.id === 'aura_embacada' && hasEmbacada)
            );
            return (
              <div key={apt.id} className="space-y-1.5">
                <ChosenCard
                  apt={apt}
                  expanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : apt.id)}
                  usageCount={usage[apt.id] ?? 0}
                  maxUses={apt.usage ? resolveAuraUsageMax(apt.usage, { auLevel, trainingBonus }) : null}
                  onActivate={() => handleActivate(apt)}
                  onTogglePower={() => handleToggle(apt)}
                  isPowered={isAuraToggleActive(c, apt.id)}
                  onRemove={() => handleRemove(apt)}
                  peCurrent={c.peCurrent}
                  radiusM={getAuraRadiusM(apt.id, auLevel, isAuraToggleActive(c, apt.id))}
                  elementChosen={
                    (apt.id === 'aura_elemental' || apt.id === 'afinidade_ampliada')
                      ? ((usage as Record<string, unknown>)[`${apt.id}:element`] as DamageType | undefined) ?? null
                      : null
                  }
                  editMode={editMode}
                />
                {showAllyBlock && (
                  <div className="ml-2 rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
                    <div className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-1">
                      <Users className="h-3 w-3" /> Auras em aliados (raio confirmado pelo Mestre)
                    </div>
                    {allies.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic px-1">
                        Nenhum outro PC no grupo para receber a aura.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {allies.map(ally => (
                            <button
                              key={ally.id}
                              onClick={() => toggleAlly(ally.id)}
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium border transition-all',
                                selectedAllies.includes(ally.id)
                                  ? 'bg-primary/20 text-primary border-primary/40'
                                  : 'bg-secondary/30 text-muted-foreground border-border hover:border-primary/30',
                              )}
                            >
                              {ally.name}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {apt.id === 'aura_do_bastiao' && (
                            <button
                              onClick={applyBastiaoToAllies}
                              disabled={selectedAllies.length === 0 || auLevel <= 0}
                              className={cn(
                                'text-xs px-2 py-1 rounded font-bold flex items-center gap-1',
                                selectedAllies.length === 0 || auLevel <= 0
                                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                  : 'bg-primary/20 text-primary hover:bg-primary/30',
                              )}
                              title={`+${auLevel} CA por 1 rodada nos aliados selecionados (Aura do Bastião).`}
                            >
                              <Shield className="h-3 w-3" /> Bastião → +{auLevel} CA (1r)
                            </button>
                          )}
                          {(apt.id === 'aura_do_comandante' || apt.id === 'aura_do_comandante_evoluida') && (
                            <button
                              onClick={applyComandanteToAllies}
                              disabled={selectedAllies.length === 0}
                              className={cn(
                                'text-xs px-2 py-1 rounded font-bold flex items-center gap-1',
                                selectedAllies.length === 0
                                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                  : 'bg-primary/20 text-primary hover:bg-primary/30',
                              )}
                              title={
                                hasComandanteEvol
                                  ? `+${auLevel + 2} acerto / +${auLevel} dano por 1 rodada (Comandante Evoluída).`
                                  : `+${1 + Math.floor(auLevel / 2)} acerto e dano por 1 rodada (Comandante).`
                              }
                            >
                              <Sparkles className="h-3 w-3" />
                              Comandante{hasComandanteEvol ? ' Evol.' : ''} →{' '}
                              {hasComandanteEvol ? `+${auLevel + 2} hit / +${auLevel} dmg` : `+${1 + Math.floor(auLevel / 2)} hit/dmg`} (1r)
                            </button>
                          )}
                          {apt.id === 'aura_embacada' && (
                            <button
                              onClick={promptEmbacada}
                              className="text-xs px-2 py-1 rounded font-bold flex items-center gap-1 bg-primary/20 text-primary hover:bg-primary/30"
                              title="Lembra o Mestre de pedir 1d10 (1-2 = miss) em cada ataque contra você."
                            >
                              <EyeOff className="h-3 w-3" /> Embaçada → prompt 1d10
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground italic px-1">
                          💡 Reaplique a cada rodada enquanto a aura estiver ativa. Buffs duram 1 rodada nos aliados.
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {/* Catálogo (expansível) — sempre visível em modo catalogOnly */}
      {(showCatalog || catalogOnly) && (
        <div className="rounded-lg border border-border bg-card/30 p-2 space-y-1.5 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between gap-2 px-1 sticky top-0 bg-card/80 backdrop-blur-sm py-1 -mx-1 -mt-1 mb-1 border-b border-border/40">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Catálogo — {availableList.length} aptidões disponíveis
            </span>
            <span className={cn(
              'text-xs font-mono font-bold rounded px-1.5 py-0.5',
              (c.availableAuraChoices ?? 0) > 0 ? 'bg-primary/30 text-primary' : 'bg-destructive/30 text-destructive',
            )}>
              Pool: {c.availableAuraChoices ?? 0}
            </span>
          </div>
          {(c.availableAuraChoices ?? 0) <= 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              ⚠ Sem pontos no pool de Catálogo. Suba de nível como Especialista em Técnica para ganhar mais escolhas.
            </div>
          )}
          {availableList.map(apt => {
            const gate = checkAuraGate(apt, ctx);
            const noPool = (c.availableAuraChoices ?? 0) <= 0;
            const finalGate = noPool && gate.ok
              ? { ok: false, reasons: ['Sem pontos no pool do Catálogo'] }
              : gate;
            return (
              <CatalogCard
                key={apt.id}
                apt={apt}
                gate={finalGate}
                onAcquire={() => handleAcquire(apt)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Fase 10: Indicadores visuais de raio (m) por aptidão. */
function getAuraRadiusM(auraId: string, auLevel: number, isToggleActive: boolean): number {
  switch (auraId) {
    case 'aura_do_bastiao': return 4.5;
    case 'aura_do_comandante':
    case 'aura_do_comandante_evoluida':
    case 'aura_embacada':
    case 'aura_chamativa': return 4.5;
    case 'aura_lacerante': return isToggleActive ? 3 : 0;
    case 'aura_macabra': return isToggleActive ? 4.5 : 1.5;
    case 'aura_movediça': {
      if (auLevel >= 5) return 6;
      if (auLevel >= 4) return 4.5;
      if (auLevel >= 2) return 3;
      if (auLevel >= 1) return 1.5;
      return 0;
    }
    case 'aura_de_cura': return 3;
    default: return 0;
  }
}

/* ─── Fase 10: Badge visual de elemento escolhido (Aura Elemental / Afinidade Ampliada). */
function getElementGlyph(t: DamageType): string {
  switch (t) {
    case 'DQ': return '🔥';   // Queimante
    case 'DCG': return '❄️';  // Congelante
    case 'DCC': return '⚡';  // Chocante
    case 'DA': return '🧪';   // Ácido
    case 'DS': return '🔊';   // Sônico
    case 'DE': return '✨';   // Energético
    case 'DR': return '☀️';   // Radiante
    case 'DN': return '💀';   // Necrótico
    case 'DV': return '☠️';   // Venenoso
    case 'DPS': return '🧠';  // Psíquico
    case 'DNR': return '🌑';  // Energia Reversa
    default: return '✦';
  }
}
function getElementBadgeClasses(t: DamageType): string {
  switch (t) {
    case 'DQ': return 'border-orange-500/50 text-orange-400 bg-orange-500/10';
    case 'DCG': return 'border-cyan-400/50 text-cyan-300 bg-cyan-400/10';
    case 'DCC': return 'border-yellow-400/50 text-yellow-300 bg-yellow-400/10';
    case 'DA': return 'border-green-500/50 text-green-300 bg-green-500/10';
    case 'DS': return 'border-pink-400/50 text-pink-300 bg-pink-400/10';
    case 'DE': return 'border-violet-400/50 text-violet-300 bg-violet-400/10';
    case 'DR': return 'border-yellow-200/50 text-yellow-100 bg-yellow-200/10';
    case 'DN': return 'border-purple-500/50 text-purple-300 bg-purple-500/10';
    case 'DV': return 'border-lime-500/50 text-lime-300 bg-lime-500/10';
    case 'DPS': return 'border-fuchsia-400/50 text-fuchsia-300 bg-fuchsia-400/10';
    case 'DNR': return 'border-slate-400/50 text-slate-200 bg-slate-400/10';
    default: return 'border-primary/40 text-primary bg-primary/5';
  }
}

/* ─── Chosen aptitude (already acquired) ─── */
function ChosenCard({
  apt, expanded, onToggle, usageCount, maxUses, onActivate, onTogglePower, isPowered, onRemove, peCurrent, radiusM, elementChosen, editMode,
}: {
  apt: AuraAptitude;
  expanded: boolean;
  onToggle: () => void;
  usageCount: number;
  maxUses: number | null;
  onActivate: () => void;
  onTogglePower: () => void;
  isPowered: boolean;
  onRemove: () => void;
  peCurrent: number;
  radiusM: number;
  elementChosen: DamageType | null;
  editMode: boolean;
}) {
  const isPassive = apt.activation === 'passive';
  // É "togglable" se for marcado como toggle OU tiver custo de manutenção (peUpkeep).
  const isToggleable = !isPassive && (apt.activation === 'toggle' || (apt.peUpkeep ?? 0) > 0);
  const peCost = resolveFixedPeCost(apt.peCost);
  const noPE = peCost > 0 && peCurrent < peCost;
  const noUses = maxUses !== null && usageCount >= maxUses;
  // Para toggle: só bloqueia PE quando estamos LIGANDO (desligar é sempre permitido).
  const toggleDisabled = !isPowered && noPE;
  const activateDisabled = isPassive || noPE || noUses;

  const activationLabel: Record<typeof apt.activation, string> = {
    passive: 'Passiva',
    reaction: 'Reação',
    bonus: 'Ação Bônus',
    action: 'Ação Comum',
    free: 'Ação Livre',
    toggle: 'Liga/Desliga',
    trigger: 'Gatilho',
  };

  return (
    <div className={cn(
      'rounded-md border overflow-hidden',
      isPowered ? 'border-primary/60 bg-primary/5' : 'border-border bg-secondary/20',
    )}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left">
          {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          <span className="text-xs font-bold text-foreground">{apt.name}</span>
          <span className="text-xs uppercase tracking-wider text-primary/80 px-1.5 py-0.5 rounded bg-primary/10">
            {activationLabel[apt.activation]}
          </span>
          {peCost > 0 && (
            <span className="text-xs text-amber-400">{peCost} PE</span>
          )}
          {(apt.peUpkeep ?? 0) > 0 && (
            <span className="text-xs text-amber-400/80">/{apt.peUpkeep}r</span>
          )}
          {maxUses !== null && (
            <span className="text-xs text-muted-foreground">{usageCount}/{maxUses} usos</span>
          )}
          {isPowered && (
            <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold">
              ATIVA
            </span>
          )}
          {radiusM > 0 && (
            <span
              className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded border border-primary/40 text-primary bg-primary/5 font-bold flex items-center gap-0.5"
              title={`Raio de efeito: ${radiusM} m ao redor`}
            >
              ⊙ {radiusM}m
            </span>
          )}
          {elementChosen && (
            <span
              className={cn(
                'text-xs uppercase tracking-wider px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 border',
                getElementBadgeClasses(elementChosen),
              )}
              title={`Elemento escolhido: ${DAMAGE_TYPE_LABELS[elementChosen]}`}
            >
              <span aria-hidden>{getElementGlyph(elementChosen)}</span>
              {DAMAGE_TYPE_LABELS[elementChosen]}
            </span>
          )}
        </button>
        {isToggleable ? (
          <button
            onClick={onTogglePower}
            disabled={toggleDisabled}
            className={cn(
              'text-xs px-2 py-1 rounded font-bold flex items-center gap-1 transition-colors',
              toggleDisabled
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isPowered
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-primary/20 text-primary hover:bg-primary/30',
            )}
            title={toggleDisabled ? 'PE insuficiente para ligar' : isPowered ? 'Desligar' : 'Ligar'}
          >
            <Power className="h-3 w-3" />
            {isPowered ? 'Desligar' : 'Ligar'}
          </button>
        ) : !isPassive ? (
          <button
            onClick={onActivate}
            disabled={activateDisabled}
            className={cn(
              'text-xs px-2 py-1 rounded font-bold flex items-center gap-1 transition-colors',
              activateDisabled
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary/20 text-primary hover:bg-primary/30',
            )}
            title={noPE ? 'PE insuficiente' : noUses ? 'Sem usos' : 'Ativar'}
          >
            <Zap className="h-3 w-3" />
            Ativar
          </button>
        ) : null}
        {editMode && (
          <button
            onClick={onRemove}
            className="text-xs p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Remover aptidão"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-2 pt-0 space-y-1.5 border-t border-border/50">
          <div className="text-xs text-muted-foreground italic">{apt.flavor}</div>
          <div className="text-xs text-foreground/90 leading-relaxed">{apt.mechanic}</div>
          {apt.peUpkeep ? (
            <div className="text-xs text-amber-400">Manutenção: {apt.peUpkeep} PE/rodada</div>
          ) : null}
          {apt.prerequisitesText && (
            <div className="text-xs text-muted-foreground">Pré-req.: {apt.prerequisitesText}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Catalog card (not yet acquired) ─── */
function CatalogCard({
  apt, gate, onAcquire,
}: {
  apt: AuraAptitude;
  gate: { ok: boolean; reasons: string[] };
  onAcquire: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(
      'rounded-md border overflow-hidden transition-colors',
      gate.ok ? 'border-border bg-card/40' : 'border-border/40 bg-card/20 opacity-70',
    )}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-2 text-left min-w-0">
          {open ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
          <span className="text-xs font-bold text-foreground truncate">{apt.name}</span>
          {apt.prerequisitesText && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">— {apt.prerequisitesText}</span>
          )}
        </button>
        <button
          onClick={onAcquire}
          disabled={!gate.ok}
          className={cn(
            'text-xs px-2 py-1 rounded font-bold flex items-center gap-1 transition-colors shrink-0',
            gate.ok
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
          title={gate.ok ? 'Adquirir' : gate.reasons.join('; ')}
        >
          {gate.ok ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {gate.ok ? 'Adquirir' : 'Bloqueado'}
        </button>
      </div>
      {open && (
        <div className="px-3 pb-2 pt-0 space-y-1.5 border-t border-border/40">
          <div className="text-xs text-muted-foreground italic">{apt.flavor}</div>
          <div className="text-xs text-foreground/90 leading-relaxed">{apt.mechanic}</div>
          {!gate.ok && (
            <div className="text-xs text-destructive">
              Pré-requisitos faltando: {gate.reasons.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
