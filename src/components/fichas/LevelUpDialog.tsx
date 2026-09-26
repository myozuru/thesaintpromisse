import { useEffect, useMemo, useState } from 'react';
import { Character, getMasteryBonus, getLevelSkillBonus, getBaseAttackBonus, type CoreId } from '@/types';
import { getMaxSpellLevel } from '@/lib/spellRules';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playSuccessSound, playClickSound } from '@/lib/sounds';
import { isCamActive, defaultSizeForLevel } from '@/lib/camCores';
import { rollDiceCom } from '@/lib/dice';
import {
  getClassHitDie,
  getDieAvg,
  getConMod,
  getTrainingBonusByLevel,
  getSorcererRank,
  isMilestoneLevel,
  isRestringido,
  getPePerLevelMult,
  getKeyAttrForSpec,
  getAttrMod,
  getAttrValue,
  MAX_LEVEL,
} from '@/lib/levelEngine';
import { cn } from '@/lib/utils';
import { Sparkles, Heart, Zap, Star, Shield, ScrollText, Check, X, ChevronUp, Layers, Dices, Calculator } from 'lucide-react';
import { PendingLevelChoicesPanel } from './PendingLevelChoicesPanel';

interface Props {
  character: Character;
  onClose: () => void;
}

/**
 * Janela de Subir de Nível.
 * - Pergunta: Rolar Dado de Vida OU usar valor Fixo (média) — em ambos soma o mod de CON.
 * - Aplica via `applyLevelUp` (gera trackers de Habilidade/Talento, Aptidão, Marcos).
 * - Mantém escolhas existentes (atributo, perícia, CAM) por meio de `updateCharacter`.
 */
export function LevelUpDialog({ character: c, onClose }: Props) {
  const rollDice = (n: string) => rollDiceCom(c.id, n);
  const { characters, updateCharacter, applyLevelUp } = useCharacterStore();
  const addLog = useLogStore((s) => s.addLog);

  const oldLevel = c.level;
  const newLevel = Math.min(MAX_LEVEL, oldLevel + 1);

  // ===== Diffs do nível =====
  const masteryOld = getMasteryBonus(oldLevel);
  const masteryNew = getMasteryBonus(newLevel);
  const masteryGained = masteryNew > masteryOld;
  const baseAtkOld = getBaseAttackBonus(oldLevel);
  const baseAtkNew = getBaseAttackBonus(newLevel);
  const baseAtkGained = baseAtkNew > baseAtkOld;
  const skillBonusOld = getLevelSkillBonus(oldLevel);
  const skillBonusNew = getLevelSkillBonus(newLevel);
  const skillBonusGained = skillBonusNew > skillBonusOld;
  const isWizard = c.characterClass === 'Feiticeiro';
  const spellLvOld = isWizard ? getMaxSpellLevel(oldLevel) : '0';
  const spellLvNew = isWizard ? getMaxSpellLevel(newLevel) : '0';
  const spellLvGained = isWizard && spellLvOld !== spellLvNew;
  const trainOld = getTrainingBonusByLevel(oldLevel);
  const trainNew = getTrainingBonusByLevel(newLevel);
  const trainGained = trainNew > trainOld;
  const rankOld = getSorcererRank(oldLevel);
  const rankNew = getSorcererRank(newLevel);
  const rankGained = rankOld !== rankNew;

  // ===== HP: Rolagem vs Fixo =====
  const hitDie = getClassHitDie(c.characterClass, c.specialization) || c.hpClassDie || 8;
  const fixedHpBase = getDieAvg(hitDie); // média (sem CON)
  const conMod = getConMod(c);
  // Trava a rolagem por personagem+nível-alvo: uma vez rolado, não pode re-rolar
  // fechando/reabrindo o dialog (anti-savescum). Persistido em localStorage até a
  // confirmação aplicar de fato (a partir daí o histórico fica em c.levelHistory).
  const rollLockKey = `levelUpRoll:${c.id}:${newLevel}`;
  const [hpMethod, setHpMethod] = useState<'fixed' | 'roll'>(() => {
    if (typeof window === 'undefined') return 'fixed';
    try {
      const saved = window.localStorage.getItem(rollLockKey);
      return saved ? 'roll' : 'fixed';
    } catch {
      return 'fixed';
    }
  });
  const [rolledValue, setRolledValue] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(rollLockKey);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [rollCommitted, setRollCommitted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !!window.localStorage.getItem(rollLockKey);
    } catch {
      return false;
    }
  });
  const effectiveHpBase = hpMethod === 'fixed' ? fixedHpBase : (rolledValue ?? 0);
  const totalHpGain = effectiveHpBase + conMod;
  const handleRoll = async () => {
    playClickSound();
    const r = (await rollDice(`1d${hitDie}`)).total;
    setRolledValue(r);
    setRollCommitted(true); // trava na escolha de rolagem
    try {
      window.localStorage.setItem(rollLockKey, String(r));
    } catch {
      /* noop */
    }
  };

  // PE automático por especialização (mult/nível). Campo manual = bônus EXTRA opcional.
  const peMult = getPePerLevelMult(c.specialization);
  const peKeyAttr = getKeyAttrForSpec(c.specialization, c.keyAttribute);
  const peKeyMod = peKeyAttr ? getAttrMod(getAttrValue(c, peKeyAttr)) : 0;
  const autoPeGain = peMult; // crescimento por nível (keyMod já está embutido no total acumulado)
  const [bonusPE, setBonusPE] = useState(0);

  const [confirmed, setConfirmed] = useState(false);

  // ===== CAM =====
  const isCam = isCamActive(c);
  const isOddLevel = newLevel % 2 === 1;
  const [perCoreReward, setPerCoreReward] = useState<Record<CoreId, string>>({ core1: '', core2: '', core3: '' });
  const [fixedReward, setFixedReward] = useState('');
  const [talentName, setTalentName] = useState('');
  const [pickGrande, setPickGrande] = useState(c.sizeCategory === 'Grande');

  const isMilestone = isMilestoneLevel(newLevel);
  const liveCharacter = characters.find((ch) => ch.id === c.id) ?? c;
  // Para o Especialista em Técnica, o motor produz várias pendências obrigatórias
  // (fundamentos, feitiço por nível, TR mestre, foco, etc). Algumas são geradas
  // retroativamente ou em níveis anteriores — então não basta checar só o nível
  // atual: varremos TODAS as pendências não resolvidas da classe/espec.
  const isTecnica =
    liveCharacter.characterClass === 'Feiticeiro' &&
    liveCharacter.specialization === 'Especialista em Técnica';
  const TECNICA_BLOCKING_KINDS = new Set<string>([
    'tecnica_fundamentos_initial',
    'tecnica_fundamentos_extra',
    'tecnica_foco',
    'tecnica_extra_spell',
    'tecnica_save_mastery',
    'tecnica_refino_grant',
  ]);
  const hasCurrentLevelPending = (liveCharacter.pendingLevelChoices ?? []).some(
    (choice) => {
      if (choice.resolved) return false;
      // Pendência do nível que estamos confirmando → sempre bloqueia.
      if (choice.level === newLevel) return true;
      // Para Técnica, qualquer pendência obrigatória da classe (em qualquer nível
      // ≤ newLevel) bloqueia o avanço para impedir level-up com escolhas em aberto.
      if (isTecnica && TECNICA_BLOCKING_KINDS.has(choice.kind as string) && choice.level <= newLevel) {
        return true;
      }
      return false;
    },
  );

  const camPairBlocked =
    isCam && !isOddLevel &&
    (perCoreReward.core1.trim() === '' ||
      perCoreReward.core2.trim() === '' ||
      perCoreReward.core3.trim() === '');

  // Bloqueia confirmar se: já confirmou, CAM bloqueado, ou escolheu rolar mas não confirmou a rolagem
  const blockConfirm = confirmed || camPairBlocked || (hpMethod === 'roll' && !rollCommitted);

  const handleConfirm = () => {
    if (blockConfirm) {
      if (hpMethod === 'roll' && !rollCommitted) {
        addLog('system', `⚠ Role o Dado de Vida (d${hitDie}) e confirme antes de prosseguir.`);
      } else if (camPairBlocked) {
        addLog('system', `⚠ Nível par exige uma escolha de Habilidade/Aptidão para cada núcleo.`);
      }
      return;
    }
    playSuccessSound();

    // 1) Motor de Progressão — sobe nível, gera trackers (Habilidade/Talento, Aptidão, Marcos), atualiza HP/PE retroativos.
    applyLevelUp(c.id, {
      hpRollBase: effectiveHpBase,
      pePerLevel: bonusPE || 0,
      method: hpMethod,
    });

    // 2) Escolhas opcionais imediatas (somente CAM)
    const updates: Partial<Character> = {};

    if (isCam && c.cores) {
      const newPassivesByCore: Record<CoreId, string[]> = { core1: [], core2: [], core3: [] };
      if (isOddLevel && fixedReward.trim()) {
        (['core1', 'core2', 'core3'] as CoreId[]).forEach(cid => {
          newPassivesByCore[cid].push(fixedReward.trim());
        });
      } else if (!isOddLevel) {
        (['core1', 'core2', 'core3'] as CoreId[]).forEach(cid => {
          if (perCoreReward[cid].trim()) newPassivesByCore[cid].push(perCoreReward[cid].trim());
        });
      }
      if (talentName.trim()) {
        (['core1', 'core2', 'core3'] as CoreId[]).forEach(cid => {
          newPassivesByCore[cid].push(`[Talento] ${talentName.trim()}`);
        });
      }
      const newCores = c.cores.map(co => {
        const additions = newPassivesByCore[co.id];
        if (!additions || additions.length === 0) return co;
        const extraPassives = additions.map(name => ({
          id: crypto.randomUUID(), name, description: `Concedido no Nv ${newLevel}.`,
          bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusSlots: 0, bonusRD: 0, bonusCA: 0,
        }));
        return { ...co, passives: [...co.passives, ...extraPassives] };
      });
      updates.cores = newCores;
      const activeAfter = newCores.find(co => co.id === c.activeCoreId);
      if (activeAfter) updates.passives = activeAfter.passives;
      const autoSize = defaultSizeForLevel(newLevel, c.sizeCategory);
      updates.sizeCategory = newLevel >= 15 && pickGrande ? 'Grande' : autoSize;
    }

    if (Object.keys(updates).length > 0) updateCharacter(c.id, updates);

    const camAction = isCam
      ? (isOddLevel
          ? (fixedReward.trim() && `[Núcleos] ${fixedReward.trim()} (fixo)`)
          : `[Núcleos] ${(['core1','core2','core3'] as CoreId[]).map(k => `${k.toUpperCase()}: ${perCoreReward[k]}`).join(' | ')}`)
      : null;
    const log = [
      `🎉 ${c.name} subiu para nível ${newLevel}`,
      `+${totalHpGain} HP (${hpMethod === 'roll' ? `rolagem d${hitDie}=${rolledValue}` : `fixo=${fixedHpBase}`} ${conMod >= 0 ? '+' : ''}${conMod} CON)`,
      `+${bonusPE} PE`,
      talentName.trim() && `[Talento fixo] ${talentName.trim()}`,
      camAction,
      rankGained && `→ ${rankNew}`,
    ].filter(Boolean).join(' · ');
    addLog('system', log);

    setConfirmed(true);
    // A rolagem foi consumida pelo applyLevelUp (entrou no levelHistory).
    // Liberamos o lock para que um futuro level-up para o MESMO nível-alvo
    // (caso o personagem volte a esse nível) possa rolar de novo.
    try {
      window.localStorage.removeItem(rollLockKey);
    } catch {
      /* noop */
    }
  };

  // Limpa locks órfãos de níveis-alvo abaixo do nível atual (ex.: personagem já passou).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const prefix = `levelUpRoll:${c.id}:`;
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        const lv = Number(k.slice(prefix.length));
        if (Number.isFinite(lv) && lv <= c.level) window.localStorage.removeItem(k);
      }
    } catch {
      /* noop */
    }
  }, [c.id, c.level]);

  // Após confirmar, fecha automaticamente. Pendências do nível ficam registradas
  // na ficha e podem ser resolvidas depois pelo PendingLevelChoicesPanel — não
  // devem prender o usuário neste diálogo.
  useEffect(() => {
    if (confirmed) onClose();
  }, [confirmed, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-primary/40 bg-card shadow-2xl overflow-hidden">
        {/* Header (fixo) */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-3 border-b border-border shrink-0">
          <div className="rounded-full bg-primary/20 p-2">
            <ChevronUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">Subir de Nível</h2>
            <p className="text-sm text-muted-foreground">
              {c.name} · Nível {oldLevel} → <span className="text-primary font-bold">{newLevel}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body (rolável) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">

        {/* Liberado */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Liberado neste nível
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat icon={<Star className="h-4 w-4" />} label="Maestria" old={`+${masteryOld}`} new={`+${masteryNew}`} highlight={masteryGained} />
            <Stat icon={<Shield className="h-4 w-4" />} label="Ataque Base" old={`+${baseAtkOld}`} new={`+${baseAtkNew}`} highlight={baseAtkGained} />
            <Stat icon={<ScrollText className="h-4 w-4" />} label="Bônus Perícias" old={`+${skillBonusOld}`} new={`+${skillBonusNew}`} highlight={skillBonusGained} />
            <Stat icon={<Star className="h-4 w-4" />} label="Treinamento" old={`+${trainOld}`} new={`+${trainNew}`} highlight={trainGained} />
            {isWizard && (
              <Stat icon={<Sparkles className="h-4 w-4" />} label="Nível de Feitiço" old={`Nv.${spellLvOld}`} new={`Nv.${spellLvNew}`} highlight={spellLvGained} />
            )}
            <Stat icon={<Sparkles className="h-4 w-4" />} label="Grau" old={rankOld} new={rankNew} highlight={rankGained} />
          </div>
        </section>

        {/* HP — Rolar vs Fixo */}
        <section className="space-y-2 rounded-xl border border-hp/30 bg-hp/5 p-3">
          <div className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-hp" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-hp">Aumento de PV (d{hitDie} + CON)</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { playClickSound(); setHpMethod('fixed'); }}
              disabled={confirmed || rollCommitted}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5',
                hpMethod === 'fixed' ? 'border-hp bg-hp/20 text-hp' : 'border-border bg-background text-muted-foreground',
              )}
            >
              <Calculator className="h-3.5 w-3.5" /> Fixo (média): {fixedHpBase}
            </button>
            <button
              onClick={() => { playClickSound(); setHpMethod('roll'); }}
              disabled={confirmed || rollCommitted}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5',
                hpMethod === 'roll' ? 'border-hp bg-hp/20 text-hp' : 'border-border bg-background text-muted-foreground',
              )}
            >
              <Dices className="h-3.5 w-3.5" /> Rolar 1d{hitDie}{rolledValue !== null ? ` = ${rolledValue}` : ''}
            </button>
          </div>
          {hpMethod === 'roll' && !rollCommitted && (
            <button
              onClick={handleRoll}
              disabled={confirmed}
              className="w-full rounded-md border border-hp/50 bg-hp/10 px-3 py-1.5 text-xs font-bold text-hp hover:bg-hp/20"
            >
              Rolar d{hitDie}
            </button>
          )}
          {hpMethod === 'roll' && rollCommitted && (
            <div className="flex items-center justify-between rounded-md border border-hp/30 bg-hp/10 px-3 py-2">
              <span className="text-xs text-hp font-mono font-bold">Rolado: {rolledValue}</span>
              <span className="text-[10px] text-muted-foreground">Confirmado — não pode voltar atrás</span>
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">
            Ganho efetivo: <strong className="text-hp font-mono">+{totalHpGain} HP</strong>
            {' '}({effectiveHpBase} base {conMod >= 0 ? '+' : ''}{conMod} CON × este nível)
          </div>
        </section>

        {/* PE — automático por especialização + bônus opcional */}
        <section className="space-y-3">
          <div className="rounded-xl border border-pe/30 bg-pe/5 p-3 space-y-2">
            <label className="text-xs font-bold text-pe flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> PE máximo (automático)
            </label>
            <div className="flex items-center justify-between rounded-md border border-pe/30 bg-background/40 px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Ganho neste nível
              </span>
              <span className="text-sm font-mono font-bold text-pe">
                +{autoPeGain} PE
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Fórmula da {c.specialization}: <span className="font-mono">{peMult} × Nível{peKeyAttr ? ` + Mod_${peKeyAttr.slice(0, 3).toUpperCase()}` : ''}</span>
              {peKeyAttr && <> ({peKeyMod >= 0 ? '+' : ''}{peKeyMod} {peKeyAttr})</>}
            </p>
            <div className="border-t border-pe/20 pt-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                Bônus EXTRA manual (opcional)
              </label>
              <input
                type="number"
                value={bonusPE}
                onChange={(e) => setBonusPE(parseInt(e.target.value) || 0)}
                disabled={confirmed}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-center font-mono font-bold text-pe disabled:opacity-50"
              />
              <p className="text-[10px] text-muted-foreground italic mt-1">
                Use só se houver fonte externa (item, talento). Deixe 0 para o cálculo automático puro.
              </p>
            </div>
          </div>

          {isMilestone && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
              <label className="text-xs font-bold text-primary">Marco de Nível</label>
              <p className="text-[11px] text-muted-foreground">
                Neste nível você não ganha atributo nem perícia automaticamente. Após confirmar, resolva no painel as escolhas de marco: <strong>Atributo +2</strong> ou <strong>Talento</strong>{c.origin === 'Derivado' ? ', além do bônus extra de Derivado' : ''}.
              </p>
            </div>
          )}
        </section>

        {confirmed && (() => {
          // Para a Técnica, mostramos TODAS as pendências obrigatórias em aberto
          // (até newLevel), não apenas as do próprio nível — caso contrário o
          // jogador ficaria travado sem ver o que falta resolver.
          if (isTecnica) {
            const tecnicaLevels = Array.from(
              new Set(
                (liveCharacter.pendingLevelChoices ?? [])
                  .filter(p => !p.resolved && p.level <= newLevel)
                  .map(p => p.level),
              ),
            ).sort((a, b) => a - b);
            const levels = tecnicaLevels.length > 0 ? tecnicaLevels : [newLevel];
            return <PendingLevelChoicesPanel character={liveCharacter} filterLevels={levels} />;
          }
          return <PendingLevelChoicesPanel character={liveCharacter} filterLevels={[newLevel]} />;
        })()}

        {/* Aviso Restringido */}
        {isRestringido(c.specialization) && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            <strong>Restringido:</strong> não recebe Aptidão Amaldiçoada por nível (HARD LOCK).
          </div>
        )}

        {/* CAM (mantido) */}
        {isCam && (
          <section className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent">
                Núcleos — Recompensas {isOddLevel ? 'Fixas' : 'Versáteis'} (Nv {newLevel} {isOddLevel ? 'Ímpar' : 'Par'})
              </h3>
            </div>

            {isOddLevel ? (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Habilidade / Aptidão Amaldiçoada (propagada aos 3 núcleos)
                </label>
                <input
                  type="text" value={fixedReward} onChange={(e) => setFixedReward(e.target.value)} disabled={confirmed}
                  placeholder="Ex.: Domínio Simples, Reversão de Aura..."
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
                />
              </div>
            ) : (
              <div className="space-y-2">
                {(['core1', 'core2', 'core3'] as CoreId[]).map(cid => {
                  const co = c.cores?.find(x => x.id === cid);
                  if (!co || co.destroyed) return null;
                  return (
                    <div key={cid} className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-accent flex items-center gap-1">
                        {co.name} <span className="text-muted-foreground">· {co.specialization}</span>
                        {cid === c.primaryCoreId && <Sparkles className="h-3 w-3 text-primary" />}
                      </label>
                      <input
                        type="text" value={perCoreReward[cid]}
                        onChange={(e) => setPerCoreReward({ ...perCoreReward, [cid]: e.target.value })}
                        disabled={confirmed}
                        placeholder="Habilidade ou Aptidão deste núcleo"
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
                      />
                    </div>
                  );
                })}
                {camPairBlocked && (
                  <p className="text-[10px] font-bold text-hp">⚠ Preencha uma escolha para CADA núcleo antes de confirmar.</p>
                )}
              </div>
            )}

            <div className="space-y-1 border-t border-accent/20 pt-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Talento (opcional · sempre fixo nos 3 núcleos)
              </label>
              <input
                type="text" value={talentName} onChange={(e) => setTalentName(e.target.value)} disabled={confirmed}
                placeholder="Nome do Talento (deixe em branco se nenhum)"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
              />
            </div>

            {newLevel >= 15 && (
              <div className="flex items-center gap-2 border-t border-accent/20 pt-2">
                <input
                  id="cam-size-grande" type="checkbox" checked={pickGrande}
                  onChange={(e) => setPickGrande(e.target.checked)} disabled={confirmed} className="h-4 w-4"
                />
                <label htmlFor="cam-size-grande" className="text-xs">
                  Atualizar tamanho do CAM para <strong className="text-accent">Grande</strong>
                </label>
              </div>
            )}
          </section>
        )}

        </div>
        {/* /Body */}

        {/* Footer (fixo, sempre visível) */}
        <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur px-6 py-3 space-y-2">
          {hpMethod === 'roll' && !rollCommitted && !confirmed && (
            <p className="text-[11px] font-bold text-hp text-center">
              ⚠ Role o Dado de Vida (d{hitDie}) acima antes de confirmar.
            </p>
          )}
          {camPairBlocked && !confirmed && (
            <p className="text-[11px] font-bold text-hp text-center">
              ⚠ Preencha uma escolha para CADA núcleo antes de confirmar.
            </p>
          )}
          {hasCurrentLevelPending && (
            <p className="text-[11px] font-bold text-primary text-center">
              Resolva as pendências obrigatórias deste nível antes de fechar.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { if (!hasCurrentLevelPending) { playClickSound(); onClose(); } }}
              disabled={hasCurrentLevelPending}
              className="flex-1 rounded-lg border border-border bg-secondary/30 px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-secondary/50"
            >Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={blockConfirm}
              aria-disabled={blockConfirm}
              className={cn(
                'flex-[2] rounded-lg border px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 transition-colors',
                blockConfirm
                  ? 'bg-secondary/40 border-border text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 glow-primary',
              )}
            >
              <Check className="h-4 w-4" />
              {confirmed ? 'Aplicado!' : `Confirmar e Subir para Nível ${newLevel}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, old, new: nw, highlight }: { icon: React.ReactNode; label: string; old: string; new: string; highlight: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-3 py-2',
      highlight ? 'border-primary/40 bg-primary/10' : 'border-border bg-secondary/30',
    )}>
      <span className={cn(highlight ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-muted-foreground/60 line-through">{old}</span>
      <span className={cn('font-mono font-bold text-sm', highlight ? 'text-primary' : 'text-foreground')}>{nw}</span>
    </div>
  );
}
