import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Character, CharacterCategory, CharacterClass, Specialization, Motivation, Origin, Attribute, Passive, CHARACTER_CLASSES, SPECIALIZATIONS, MOTIVATIONS, ORIGINS, createEmptyRdByType, createEmptyAccessorySlots, POINT_BUY_COSTS, POINT_BUY_INITIAL, POINT_BUY_MIN, POINT_BUY_MAX, getTrainingBonus, getMasteryBonus, getLevelSkillBonus, DEFAULT_SAVING_THROWS, getDefaultSavingThrowBonus, DAMAGE_TYPES, DAMAGE_TYPE_ABBR, DAMAGE_TYPE_LABELS, type DamageType, type CoreId, CORE_IDS } from '@/types';
import { ChevronRight, ChevronLeft, Check, User, Shield, Sparkles, Star, ScrollText, Wand2, Lock, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NullSafeInput } from './NullSafeInput';
import { SpellCreationAssistant } from './SpellCreationAssistant';
import { TrackersPanel } from './TrackersPanel';
import { OriginStep } from './OriginStep';
import { TalentCatalogModal, type CatalogPick } from './TalentCatalogModal';
import { getTalentById } from '@/lib/talents';
import { applyOriginEffects, attrChoiceFor, isWizardClear, type OriginChoices } from '@/lib/originEngine';
import { CAM_CORES } from '@/lib/origins';
import { buildInitialCores, defaultSizeForLevel } from '@/lib/camCores';
import { playClickSound, playSuccessSound } from '@/lib/sounds';
import { useRoleStore } from '@/stores/useRoleStore';
import { usePassiveProposalStore } from '@/stores/usePassiveProposalStore';
import { useSpellProposalStore } from '@/stores/useSpellProposalStore';
import { useLogStore } from '@/stores/useLogStore';
import { getMaxSpells, getMaxSpellLevel, isSpellLevelAllowed, getPassiveSpellLevel, isPassiveActive } from '@/lib/spellRules';
import { getClassHitDie, getKeyAttrForSpec, getPePerLevelMult } from '@/lib/levelEngine';
import { TECNICA_FUNDAMENTOS, TECNICA_FUNDAMENTO_DETAILS, type TecnicaFundamento } from '@/lib/tecnicaProgression';
import type { Spell, SpellLevel } from '@/types';
import { SPELL_LEVELS } from '@/types';

const STEPS = [
  { label: 'Identidade', icon: User },
  { label: 'Classe', icon: Shield },
  { label: 'Origem', icon: Sparkles },
  { label: 'Atributos', icon: Sparkles },
  { label: 'Estatísticas', icon: Star },
  { label: 'Perícias', icon: ScrollText },
  { label: 'Passivas', icon: Star },
  { label: 'Feitiços', icon: Wand2 },
  { label: 'Finalizar', icon: Check },
];

// ===== FIXED ATTRIBUTES =====
const FIXED_ATTRIBUTES = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Presença'] as const;
const ATTR_ABBR: Record<string, string> = {
  'Força': 'FOR', 'Destreza': 'DES', 'Constituição': 'CON',
  'Inteligência': 'INT', 'Sabedoria': 'SAB', 'Presença': 'PRE',
};

// ===== FIXED SKILLS =====
interface SkillDef {
  name: string;
  linkedAttr: string;
  editable?: boolean; // for Ofício
}

const FIXED_SKILLS: SkillDef[] = [
  // FOR
  { name: 'Atletismo', linkedAttr: 'Força' },
  // DES
  { name: 'Acrobacia', linkedAttr: 'Destreza' },
  { name: 'Furtividade', linkedAttr: 'Destreza' },
  { name: 'Prestidigitação', linkedAttr: 'Destreza' },
  // INT
  { name: 'Feitiçaria', linkedAttr: 'Inteligência' },
  { name: 'História', linkedAttr: 'Inteligência' },
  { name: 'Investigação', linkedAttr: 'Inteligência' },
  { name: 'Ofício 1', linkedAttr: 'Inteligência', editable: true },
  { name: 'Ofício 2', linkedAttr: 'Inteligência', editable: true },
  { name: 'Ofício 3', linkedAttr: 'Inteligência', editable: true },
  { name: 'Tecnologia', linkedAttr: 'Inteligência' },
  { name: 'Teologia', linkedAttr: 'Inteligência' },
  // SAB
  { name: 'Direção', linkedAttr: 'Sabedoria' },
  { name: 'Intuição', linkedAttr: 'Sabedoria' },
  { name: 'Medicina', linkedAttr: 'Sabedoria' },
  { name: 'Ocultismo', linkedAttr: 'Sabedoria' },
  { name: 'Percepção', linkedAttr: 'Sabedoria' },
  { name: 'Sobrevivência', linkedAttr: 'Sabedoria' },
  // PRE
  { name: 'Enganação', linkedAttr: 'Presença' },
  { name: 'Intimidação', linkedAttr: 'Presença' },
  { name: 'Performance', linkedAttr: 'Presença' },
  { name: 'Persuasão', linkedAttr: 'Presença' },
];

interface Props {
  onComplete: (char: Character) => void;
  onCancel: () => void;
}

export function CharacterWizard({ onComplete, onCancel }: Props) {
  const isMaster = useRoleStore((s) => s.role) === 'MASTER';
  const submitPassiveProposal = usePassiveProposalStore((s) => s.submit);
  const submitSpellProposal = useSpellProposalStore((s) => s.submit);
  const addLog = useLogStore((s) => s.addLog);
  const [step, setStep] = useState(0);

  // Trava o scroll da página enquanto o wizard estiver aberto, para evitar
  // que o conteúdo de fundo role junto e bague o layout durante a criação.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Step 1: Identity
  const [name, setName] = useState('');
  // Players só podem criar fichas de PLAYER. Apenas o Mestre escolhe categoria.
  const [category, setCategory] = useState<CharacterCategory>('PLAYER');
  useEffect(() => {
    if (!isMaster && category !== 'PLAYER') setCategory('PLAYER');
  }, [isMaster, category]);

  // Step 2: Class
  const [charClass, setCharClass] = useState<CharacterClass>('Feiticeiro');
  const [specialization, setSpecialization] = useState<Specialization>('Lutador');
  const [motivation, setMotivation] = useState<Motivation>('Medo');
  const [origin, setOrigin] = useState<Origin>('Inato');
  const [keyAttribute, setKeyAttribute] = useState<'Inteligência' | 'Sabedoria'>('Inteligência');
  /** Suporte: atributo-chave escolhido (Presença ou Sabedoria — regra do livro). */
  const [supKeyAttribute, setSupKeyAttribute] = useState<'Presença' | 'Sabedoria'>('Presença');

  // Step 3: Stats — agora DERIVADAS dos atributos + classe/spec.
  const [level, setLevel] = useState(1);
  // Toda ficha criada por um perfil de PLAYER começa obrigatoriamente em Nv 1.
  // Apenas o Mestre pode definir um nível diferente.
  const lockedToLevel1 = !isMaster;
  useEffect(() => {
    if (lockedToLevel1 && level !== 1) setLevel(1);
  }, [lockedToLevel1, level]);
  // Aptidão Energia Reversa não é mais escolhida na criação (movida para Aptidões da ER na ficha).
  const [hasEnergiaReversa] = useState(false);

  // Step 4: Fixed attributes with values
  const [attrValues, setAttrValues] = useState<Record<string, number>>(
    Object.fromEntries(FIXED_ATTRIBUTES.map(a => [a, 10]))
  );

  // Step 5: Fixed skills with bonuses + custom ofício names + training/mastery
  const [skillBonuses, setSkillBonuses] = useState<Record<string, number>>(
    Object.fromEntries(FIXED_SKILLS.map(s => [s.name, 0]))
  );
  const [skillTrained, setSkillTrained] = useState<Record<string, boolean>>(
    Object.fromEntries(FIXED_SKILLS.map(s => [s.name, false]))
  );
  const [skillMastery, setSkillMastery] = useState<Record<string, boolean>>(
    Object.fromEntries(FIXED_SKILLS.map(s => [s.name, false]))
  );
  const [oficioNames, setOficioNames] = useState<Record<string, string>>({
    'Ofício 1': '',
    'Ofício 2': '',
    'Ofício 3': '',
  });

  // ===== Especialista em Técnica — escolhas obrigatórias de proficiência =====
  // Regras-base: marcar automaticamente Armas Simples + à Distância (meleeTrained
  // + rangedTrained) e Feitiçaria + Ocultismo. Pedir ao jogador apenas:
  //  - 1 TR entre Astúcia | Vontade
  //  - 2 Ofícios (entre Ofício 1/2/3) que entram automaticamente como Treinados
  // (Perícias livres adicionais ficam no passo "Perícias", usando o pool padrão.)
  const [tecSaveChoice, setTecSaveChoice] = useState<'Astúcia' | 'Vontade' | ''>('');
  const [tecOficioChoices, setTecOficioChoices] = useState<string[]>([]);
  // Domínio dos Fundamentos (Nv 1): escolher 2 entre os fundamentos disponíveis no Nv 1.
  // Feitiço Rápido só desbloqueia no Nv 6 — fica fora do pool inicial.
  const [tecFundamentos, setTecFundamentos] = useState<TecnicaFundamento[]>([]);
  const isTecnica = charClass === 'Feiticeiro' && specialization === 'Especialista em Técnica';
  const TEC_FIXED_SKILLS = ['Feitiçaria', 'Ocultismo'];
  const tecOficioOptions = useMemo(() => ['Ofício 1', 'Ofício 2', 'Ofício 3'], []);
  const tecChoicesComplete = !isTecnica || (!!tecSaveChoice && tecOficioChoices.length === 2 && tecFundamentos.length === 2);

  // ===== Suporte — escolhas obrigatórias (regra do livro) =====
  // Automático: Armas Simples + Escudos. Perícias fixas: Medicina + Prestidigitação.
  // O jogador escolhe: 1 TR entre Astúcia | Vontade e 2 Ofícios (Treinados).
  // (As "outras três perícias quaisquer" usam o pool normal do passo Perícias.)
  const [supSaveChoice, setSupSaveChoice] = useState<'Astúcia' | 'Vontade' | ''>('');
  const [supOficioChoices, setSupOficioChoices] = useState<string[]>([]);
  const isSuporte = charClass === 'Feiticeiro' && specialization === 'Suporte';
  const SUP_FIXED_SKILLS = ['Medicina', 'Prestidigitação'];
  const supChoicesComplete = !isSuporte || (!!supSaveChoice && supOficioChoices.length === 2);

  // Step 6: Passives
  const [passives, setPassives] = useState<Passive[]>([]);
  const [passForm, setPassForm] = useState<{ name: string; description: string; spellLevel: SpellLevel; bonusHP: number; bonusPE: number; bonusESC: number; bonusSlots: number; bonusRD: number; bonusCA: number; bonusRdByType: Partial<Record<DamageType, number>> }>({
    name: '', description: '', spellLevel: '1', bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusSlots: 0, bonusRD: 0, bonusCA: 0, bonusRdByType: {},
  });
  const [showPassRdPicker, setShowPassRdPicker] = useState(false);

  // Step 7: Spells
  const [spells, setSpells] = useState<Spell[]>([]);
  /** Feitiços de Nível 0 propostos durante o wizard — enviados ao Mestre no finish. */
  const [pendingSpellProposals, setPendingSpellProposals] = useState<Spell[]>([]);
  const [showSpellAssist, setShowSpellAssist] = useState(false);
  /** Técnicas de Estilo aprendidas (Sem Técnica + Novo Estilo da Sombra). */
  const [styleTechniques, setStyleTechniques] = useState<string[]>([]);
  const [newStyleName, setNewStyleName] = useState('');
  const [activeStyleTechnique, setActiveStyleTechnique] = useState<string>('');

  // ===== ORIGIN SYSTEM =====
  const [originChoices, setOriginChoices] = useState<OriginChoices>({});
  /** Quanto o jogador "consumiu" de cada tracker (treinos/talentos/pontos atribuídos manualmente). */
  const [consumed, setConsumed] = useState({
    availableAttrPoints: 0,
    availableTrainings: 0,
    availableTalents: 0,
  });

  // Talentos escolhidos durante o wizard.
  const [wizardTalents, setWizardTalents] = useState<Array<{ id: string; choices?: Record<string, string> }>>([]);
  const [showTalentCatalog, setShowTalentCatalog] = useState(false);

  // Cálculo de feitiços, efeitos e trackers em tempo real.
  const effects = useMemo(
    () => applyOriginEffects(origin, level, originChoices),
    [origin, level, originChoices],
  );

  // ===== Estatísticas DERIVADAS dos atributos + classe/spec + origem =====
  // Recalculadas a cada mudança em attrValues / charClass / specialization /
  // keyAttribute / origem. IMPORTANTE: incluir os bônus de atributo da Origem
  // (fixos + escolha +2/+1) — sem isso HP/PE/CA/CD não refletem a origem.
  const derivedStats = useMemo(() => {
    const mod = (v: number) => Math.floor((v - 10) / 2);
    const originBonus = (name: string) => (effects.attrBonuses as Record<string, number>)[name] ?? 0;
    const eff = (name: string) => (attrValues[name] ?? 10) + originBonus(name);
    const conMod = mod(eff('Constituição'));
    const desMod = mod(eff('Destreza'));

    let keyAttrName: string | null = null;
    if (charClass === 'Feiticeiro') {
      keyAttrName = specialization === 'Especialista em Técnica'
        ? keyAttribute
        : specialization === 'Suporte'
          ? supKeyAttribute
          : getKeyAttrForSpec(specialization);
    }
    const keyMod = keyAttrName ? mod(eff(keyAttrName)) : 0;

    const hitDie = getClassHitDie(charClass, specialization);
    // Regra do sistema: no Nv 1 o PV é SEMPRE 10 + Mod. de Constituição
    // (independente do dado de vida, que só é rolado em níveis >= 2).
    const hpMax = Math.max(1, 10 + conMod);
    const peMax = Math.max(0, getPePerLevelMult(specialization) + keyMod);
    const ca = 10 + desMod;
    const baseDC = 10 + keyMod;
    return { hpMax, peMax, ca, baseDC, keyAttrName, keyMod, conMod, desMod };
  }, [attrValues, charClass, specialization, keyAttribute, supKeyAttribute, effects.attrBonuses]);
  const { hpMax, peMax, ca, baseDC } = derivedStats;

  const maxSpells = charClass === 'Feiticeiro'
    ? getMaxSpells(level) + (effects.extraSpellsImmediate ?? 0) + (effects.automation.extraSpells ?? 0)
    : getMaxSpells(level);

  const availableTags = useMemo(() => {
    const tags: { label: string; discountPE: number }[] = [];
    if (effects.extraSpellTag) {
      const hasTag = spells.some(s => s.description?.includes(effects.extraSpellTag!));
      if (!hasTag) tags.push({ label: effects.extraSpellTag, discountPE: 1 });
    }
    if (effects.tags.some(t => t.startsWith('Feitiço Focado'))) {
      const hasFocado = spells.some(s => s.description?.includes('Feitiço Focado'));
      if (!hasFocado) tags.push({ label: 'Feitiço Focado', discountPE: 1 });
    }
    return tags;
  }, [effects, spells]);

  // Pontos de perícia consumidos. Regra: T = 1 · M = 2 · M sobre uma perícia
  // que já tem T = 1 (a Maestria absorve o Treino daquela perícia).
  const trainedCount = useMemo(() => {
    const allNames = new Set<string>([...Object.keys(skillTrained), ...Object.keys(skillMastery)]);
    let used = 0;
    allNames.forEach((n) => {
      if (skillMastery[n]) used += 2;
      else if (skillTrained[n]) used += 1;
    });
    // Especialista em Técnica concede automaticamente 2 Ofícios + 2 Perícias Livres
    // como TREINADAS no momento de salvar. Como essas escolhas já foram feitas no
    // próprio passo da Técnica, elas devem consumir o pool de treinos do wizard
    // (caso contrário o tracker fica preso em "Treinos: 2" mesmo tudo selecionado).
    return used;
  }, [skillTrained, skillMastery]);

  // Pool unificado de perícias para Feiticeiros = nível + 1 (mesma regra da ficha).
  // Origens/clãs adicionam pontos extras (effects.trackers.availableTrainings).
  // Suporte recebe +1 ponto extra: o livro concede 3 perícias quaisquer além das fixas
  // (pool padrão nível+1 cobre só 2 no Nv 1).
  const wizardSkillPoolBase = charClass === 'Feiticeiro' ? (level + 1) + (isSuporte ? 1 : 0) : 0;

  const liveTrackers = useMemo(() => {
    const totalAttr = (effects.trackers.availableAttrPoints + (effects.automation.extraAttrPoints ?? 0));
    const totalTrain = wizardSkillPoolBase
      + (effects.trackers.availableTrainings + (effects.automation.extraTrainings ?? 0));
    const totalTalents = (effects.trackers.availableTalents + (effects.automation.extraTalents ?? 0));
    return {
      availableAttrPoints: Math.max(0, totalAttr - consumed.availableAttrPoints),
      availableTrainings: Math.max(0, totalTrain - Math.min(totalTrain, trainedCount)),
      availableTalents: Math.max(0, totalTalents - wizardTalents.length),
      pendingSpecialChoice: effects.trackers.pendingSpecialChoice,
      pendingChoicesCount: effects.automation.pendingChoices.length,
    };
  }, [effects, consumed, trainedCount, wizardTalents.length, wizardSkillPoolBase]);

  // Personagem-mock para alimentar o catálogo de talentos com os dados já preenchidos
  // no wizard (atributos finais, perícias treinadas/maestria, origem, nível e talentos
  // já escolhidos), permitindo a checagem de pré-requisitos em tempo real.
  const wizardCharacterDraft = useMemo<Character>(() => {
    const attrs: Attribute[] = FIXED_ATTRIBUTES.map(a => {
      const originBonus = (effects.attrBonuses as Record<string, number>)[a] ?? 0;
      return { id: a, name: a, value: (attrValues[a] ?? 10) + originBonus };
    });
    const sks: Attribute[] = FIXED_SKILLS.map(sd => ({
      id: sd.name,
      name: sd.editable ? (oficioNames[sd.name]?.trim() || sd.name) : sd.name,
      value: skillBonuses[sd.name] ?? 0,
      trained: skillTrained[sd.name] || false,
      mastery: skillMastery[sd.name] || false,
    }));
    return {
      id: 'wizard-draft',
      name,
      category,
      level,
      characterClass: charClass,
      specialization,
      motivation,
      origin,
      attributes: attrs,
      skills: sks,
      chosenTalents: wizardTalents.map(wt => ({
        id: wt.id, level, source: 'origin', choices: wt.choices,
      })),
    } as Character;
  }, [
    attrValues, effects.attrBonuses, oficioNames, skillBonuses, skillTrained, skillMastery,
    name, category, level, charClass, specialization, motivation, origin, wizardTalents,
  ]);

  const handlePickFromCatalog = (pick: CatalogPick) => {
    if (pick.kind !== 'talent') return;
    if (liveTrackers.availableTalents <= 0) return;
    if (wizardTalents.some(wt => wt.id === pick.talent.id) && !pick.talent.repeatable) return;
    setWizardTalents(prev => [...prev, { id: pick.talent.id }]);
    setShowTalentCatalog(false);
    playSuccessSound();
  };

  // Aplica trava de Specialização (Restringido) e bloqueio de Especialista em Técnica (Sem Técnica).
  // Usa um efeito controlado de side-effect via render: se a origem trava, força o valor.
  const lockedSpec = effects.lockedSpecialization;
  const blockedSpecs = effects.blockedSpecializations ?? [];
  if (lockedSpec && specialization !== lockedSpec) {
    // Schedule micro-task to avoid setState durante render.
    queueMicrotask(() => setSpecialization(lockedSpec));
  } else if (blockedSpecs.includes(specialization)) {
    queueMicrotask(() => setSpecialization('Lutador'));
  }
  // Restringido trava a CLASSE em "Feiticeiro" (a especialização "Restringido"
  // só existe dentro dessa classe — depende estritamente dela).
  if (origin === 'Restringido' && charClass !== 'Feiticeiro') {
    queueMicrotask(() => setCharClass('Feiticeiro'));
  }
  if (charClass !== 'Feiticeiro' && specialization !== 'Lutador') {
    queueMicrotask(() => setSpecialization('Lutador'));
  }

  // FAH: quantidade de anatomias permitidas no momento (1 base + automation).
  const anatomyAllowed = 1 + (effects.automation.extraAnatomyChoices ?? 0);

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) {
      // Especialista em Técnica: bloqueia avanço sem as 3 escolhas obrigatórias.
      if (!tecChoicesComplete) return false;
      // Suporte: bloqueia avanço sem TR + 2 Ofícios.
      if (!supChoicesComplete) return false;
      return true;
    }
    if (step === 2) {
      // Origem step: precisa ter resolvido escolhas obrigatórias (clã/aura/anatomia/núcleo + +2/+1)
      const ac = effects.trackers;
      if (ac.pendingSpecialChoice > 0) return false;
      // Se a origem exige escolha +2/+1 e não foi feita, bloqueia
      const requiresAttrChoice = attrChoiceFor(origin, originChoices.clan) !== null;
      if (requiresAttrChoice && (originChoices.primaryAttr === undefined || originChoices.secondaryAttr === undefined)) {
        return false;
      }
      return true;
    }
    return true;
  };

  const next = () => { if (canProceed() && step < STEPS.length - 1) { playClickSound(); setStep(step + 1); } };
  const prev = () => { if (step > 0) { playClickSound(); setStep(step - 1); } };

  const handleFinish = () => {
    if (charClass === 'Feiticeiro' && !isWizardClear(liveTrackers)) {
      // Bloqueio de finalização: trackers > 0
      return;
    }
    // Sem Técnica: bloqueia finalização se faltar selecionar Técnicas de Estilo já desbloqueadas.
    if (charClass === 'Feiticeiro' && effects.blockSpells && effects.automation.hasShadowStyle) {
      if (styleTechniques.length < effects.automation.extraStyleTechniques) return;
    }
    playSuccessSound();

    // Build attributes array (point-buy + bônus de origem aplicados por baixo dos panos)
    const attributes: Attribute[] = FIXED_ATTRIBUTES.map(a => {
      const originBonus = (effects.attrBonuses as Record<string, number>)[a] ?? 0;
      return {
        id: crypto.randomUUID(),
        name: a,
        value: attrValues[a] + originBonus,
      };
    });

    // ===== Especialista em Técnica — overrides automáticos de proficiência =====
    // Aplicados ANTES de construir os skills/savingThrows finais.
    const tecTrainedOverride: Record<string, boolean> = {};
    if (isTecnica) {
      // Perícias fixas (sempre treinadas).
      for (const fx of TEC_FIXED_SKILLS) tecTrainedOverride[fx] = true;
      // 2 Ofícios escolhidos no passo Classe (sempre treinados).
      for (const ofKey of tecOficioChoices) tecTrainedOverride[ofKey] = true;
    }
    // Suporte: Medicina + Prestidigitação fixas + 2 Ofícios escolhidos.
    if (isSuporte) {
      for (const fx of SUP_FIXED_SKILLS) tecTrainedOverride[fx] = true;
      for (const ofKey of supOficioChoices) tecTrainedOverride[ofKey] = true;
    }

    // Build skills array from fixed definitions
    const skills: Attribute[] = FIXED_SKILLS.map(sd => {
      const attrObj = attributes.find(a => a.name === sd.linkedAttr);
      const displayName = sd.editable ? (oficioNames[sd.name]?.trim() || sd.name) : sd.name;
      const trainedFinal = (skillTrained[sd.name] || false) || (tecTrainedOverride[sd.name] ?? false);
      return {
        id: crypto.randomUUID(),
        name: displayName,
        value: skillBonuses[sd.name],
        linkedAttribute: attrObj?.id,
        trained: trainedFinal,
        mastery: skillMastery[sd.name] || false,
      };
    });

    // Passivas combinadas (manuais + concedidas pela origem)
    const originPassives: Passive[] = effects.abilities.map(a => ({
      id: crypto.randomUUID(),
      name: a.name,
      description: a.description,
      bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusSlots: 0, bonusRD: 0, bonusCA: 0,
    }));
    // Players: passivas criadas pelo player vão para análise do Mestre — NÃO entram
    // na ficha agora. Apenas as passivas concedidas pela origem ficam.
    const passivesForCharacter = isMaster ? [...passives, ...originPassives] : [...originPassives];

    // HP/PE finais incluem automação de nível (Kamo +1/level, Gojo PE par, etc.)
    const finalHpMax = hpMax + (effects.automation.bonusHP ?? 0);
    const finalPeMax = peMax + (effects.automation.bonusPE ?? 0);

    // Núcleos para CAM: 3 snapshots completos (atributos/spec/spells/passives/HP/PE).
    // Por enquanto, todos os núcleos começam com a mesma distribuição de atributos
    // do passo "Atributos" e a mesma especialização — a edição individual por núcleo
    // acontece no próprio CharacterCard (tabs). HP/PE secundários são CAPADOS ao primário.
    const baseCoreAttrs: Attribute[] = FIXED_ATTRIBUTES.map(a => {
      const originBonus = (effects.attrBonuses as Record<string, number>)[a] ?? 0;
      return { id: crypto.randomUUID(), name: a, value: attrValues[a] + originBonus };
    });
    const cloneAttrs = (): Attribute[] =>
      baseCoreAttrs.map(at => ({ ...at, id: crypto.randomUUID() }));
    const primaryId: CoreId = (originChoices.primaryCoreId ?? 'core1') as CoreId;
    const cores = effects.enablesCores
      ? buildInitialCores({
          primaryId,
          baseHpMax: finalHpMax,
          basePeMax: finalPeMax,
          attributesPerCore: {
            core1: primaryId === 'core1' ? baseCoreAttrs : cloneAttrs(),
            core2: primaryId === 'core2' ? baseCoreAttrs : cloneAttrs(),
            core3: primaryId === 'core3' ? baseCoreAttrs : cloneAttrs(),
          },
          specPerCore: {
            core1: specialization,
            core2: specialization,
            core3: specialization,
          },
        })
      : undefined;
    // Imunidades automáticas do CAM: dano DV (já gravado no spec) e a condição
    // narrativa "Envenenado" (tag visível na ficha — a condição mecânica é checada
    // no aplicador de status pelo nome).
    const camImmunities: DamageType[] = effects.enablesCores ? ['DV'] : [];

    const char: Character = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category,
      level,
      ca,
      baseDC,
      hpCurrent: finalHpMax,
      hpMax: finalHpMax,
      peCurrent: finalPeMax,
      peMax: finalPeMax,
      escCurrent: 0,
      escMax: 0,
      rd: 0,
      rdByType: createEmptyRdByType(),
      slotsMax: 5,
      slotsCurrent: 0,
      attributes,
      skills,
      savingThrows: (() => {
        const base = DEFAULT_SAVING_THROWS.map(stName => {
          const linked = attributes.find(a => a.name === stName);
          return {
            id: crypto.randomUUID(),
            name: stName,
            value: 0,
            linkedAttribute: linked?.id,
            trained: false,
            mastery: false,
          };
        });
        // Especialista em Técnica: adiciona o TR escolhido (Astúcia OU Vontade) como Treinado.
        if (isTecnica && tecSaveChoice) {
          base.push({
            id: crypto.randomUUID(),
            name: tecSaveChoice,
            value: 0,
            linkedAttribute: undefined,
            trained: true,
            mastery: false,
          });
        }
        // Suporte: adiciona o TR escolhido (Astúcia OU Vontade) como Treinado.
        if (isSuporte && supSaveChoice) {
          base.push({
            id: crypto.randomUUID(),
            name: supSaveChoice,
            value: 0,
            linkedAttribute: undefined,
            trained: true,
            mastery: false,
          });
        }
        return base;
      })(),
      passives: passivesForCharacter,
      spells,
      equippedItems: [],
      customHitBonus: 0,
      meleeAttackBonus: 0,
      rangedAttackBonus: 0,
      cursedAttackBonus: 0,
      meleeLinkedAttr: '',
      rangedLinkedAttr: '',
      cursedLinkedAttr: '',
      dcLinkedAttr: '',
      // Especialista em Técnica: Armas Simples (melee) + Armas a Distância já treinadas.
      // Suporte: Armas Simples (melee) treinadas (regra do livro).
      meleeTrained: (isTecnica || isSuporte) ? true : false,
      rangedTrained: isTecnica ? true : false,
      cursedTrained: false,
      meleeMastery: false,
      rangedMastery: false,
      cursedMastery: false,
      initiativeBonus: 0,
      movement: 9 + (effects.movementBonus ?? 0),
      damageDiceLevel: 0,
      critMargin: 20,
      cdIncrease: 0,
      rollPenalty: 0,
      actionsMax: 1,
      actionsCurrent: 1,
      bonusActionsMax: 1,
      bonusActionsCurrent: 1,
      reactionsMax: 1,
      reactionsCurrent: 1,
      opportunityMax: 1,
      opportunityCurrent: 1,
      activeBuffs: [],
      activeConditions: [],
      vulnerabilities: [],
      immunities: camImmunities,
      characterClass: charClass,
      specialization,
      motivation,
      origin,
      accessorySlots: createEmptyAccessorySlots(),
      votos: '',
      hasEnergiaReversa,
      keyAttribute: specialization === 'Especialista em Técnica'
        ? keyAttribute
        : specialization === 'Suporte'
          ? supKeyAttribute
          : undefined,
      tecnicaFundamentos: isTecnica ? tecFundamentos : undefined,
      // ===== Origin metadata =====
      originTags: effects.tags,
      healingHalved: effects.healingHalved,
      clanId: originChoices.clan,
      // FAH: persiste as anatomias escolhidas (data-driven; passivas aplicadas
      // pelo applyAnatomyPassives na Fase B).
      anatomyFeatures: origin === 'Feto Amaldiçoada Híbrido (FAH)' ? (originChoices.anatomyIds ?? []) : undefined,
      primaryCoreId: cores ? primaryId : undefined,
      activeCoreId: cores ? primaryId : undefined,
      cores,
      soulIntegrityMax: cores ? Math.floor(cores.reduce((s, co) => s + co.hpMax, 0) / 2) : undefined,
      soulIntegrityCurrent: cores ? Math.floor(cores.reduce((s, co) => s + co.hpMax, 0) / 2) : undefined,
      sizeCategory: cores ? defaultSizeForLevel(level) : undefined,
      attrCaps: (() => {
        // Base: caps explícitos da origem (ex.: Restringido FOR/DES/CON = 30)
        const caps: Record<string, number> = { ...(effects.attrCapOverrides as Record<string, number> ?? {}) };
        // Derivado: "Desenvolvimento Inesperado" eleva o limite de TODOS os atributos
        // em +N (onde N = pontos extras já concedidos), pois o jogador pode escolher
        // onde gastar. O motor de edição da ficha respeita o cap individual.
        const boost = effects.automation.attrCapBoost ?? 0;
        if (boost > 0) {
          const DEFAULT_CAP = 20;
          for (const a of ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Presença']) {
            caps[a] = (caps[a] ?? DEFAULT_CAP) + boost;
          }
        }
        return Object.keys(caps).length ? caps : undefined;
      })(),
      // ===== Sem Técnica / Novo Estilo da Sombra =====
      tecnicaAmaldicoada: effects.automation.tecnicaAmaldicoada,
      aptidaoAmaldicoadaConcedida: effects.automation.aptidaoConcedida,
      styleTechniques: effects.blockSpells && effects.automation.hasShadowStyle ? styleTechniques : undefined,
      activeStyleTechnique: effects.blockSpells && effects.automation.hasShadowStyle ? (activeStyleTechnique || undefined) : undefined,
      originPendingChoices: effects.automation.pendingChoices.length > 0 ? effects.automation.pendingChoices : undefined,
      chosenTalents: wizardTalents.length > 0
        ? wizardTalents.map(wt => ({ id: wt.id, level, source: 'origin' as const, choices: wt.choices }))
        : undefined,
    };
    onComplete(char);
    // Após criar a ficha, se for player, enviar as passivas manuais como propostas.
    if (!isMaster && passives.length > 0) {
      for (const p of passives) {
        submitPassiveProposal(char.id, char.name, p);
      }
      addLog('spell', `📜 ${char.name} enviou ${passives.length} passiva(s) para análise do Mestre.`);
    }
    // Feitiços propostos durante o wizard (Nv 0 ou Modo Mestre) → análise do Mestre.
    if (pendingSpellProposals.length > 0) {
      for (const sp of pendingSpellProposals) {
        submitSpellProposal(char.id, char.name, sp, 'Proposta enviada na criação da ficha.');
      }
      addLog('spell', `📜 ${char.name} enviou ${pendingSpellProposals.length} feitiço(s) para análise do Mestre.`);
    }
  };

  const addPassive = () => {
    if (!passForm.name.trim()) return;
    const cleanRd: Partial<Record<DamageType, number>> = {};
    DAMAGE_TYPES.forEach(t => { if ((passForm.bonusRdByType[t] || 0) !== 0) cleanRd[t] = passForm.bonusRdByType[t]; });
    setPassives([...passives, {
      id: crypto.randomUUID(),
      name: passForm.name,
      description: passForm.description,
      spellLevel: passForm.spellLevel,
      bonusHP: passForm.bonusHP,
      bonusPE: passForm.bonusPE,
      bonusESC: passForm.bonusESC,
      bonusSlots: passForm.bonusSlots,
      bonusRD: passForm.bonusRD,
      bonusCA: passForm.bonusCA,
      bonusRdByType: Object.keys(cleanRd).length > 0 ? cleanRd : undefined,
    }]);
    setPassForm({ name: '', description: '', spellLevel: '1', bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusSlots: 0, bonusRD: 0, bonusCA: 0, bonusRdByType: {} });
    setShowPassRdPicker(false);
  };

  // Group skills by attribute for display
  const skillsByAttr = FIXED_ATTRIBUTES.map(attr => ({
    attr,
    abbr: ATTR_ABBR[attr],
    skills: FIXED_SKILLS.filter(s => s.linkedAttr === attr),
  }));

  return createPortal(
    // IMPORTANTE: NÃO fechar o wizard ao clicar fora — o jogador estava perdendo
    // todo o progresso por engano. Para sair, usar o botão "Cancelar".
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-2xl h-[95vh] sm:h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Step indicator (sticky header) */}
        <div className="flex items-center gap-1 overflow-x-auto px-4 sm:px-6 pt-4 pb-2 border-b border-border shrink-0">
          {STEPS.map((s, i) => (
            <div key={i} className={cn('flex items-center gap-1 text-xs font-medium whitespace-nowrap rounded-full px-2 py-1 border transition-all',
              i === step ? 'bg-primary/20 text-primary border-primary/40' :
              i < step ? 'bg-neon-green/10 text-neon-green border-neon-green/30' :
              'bg-secondary/30 text-muted-foreground border-border'
            )}>
              <s.icon className="h-3 w-3" />
              {s.label}
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Trackers — visíveis a partir do step de Origem (Feiticeiros). */}
          {step >= 2 && charClass === 'Feiticeiro' && (
            <>
              <TrackersPanel
                trackers={liveTrackers}
                pendingLabel={effects.trackers.pendingSpecialChoiceLabel}
                pendingChoices={effects.automation.pendingChoices}
              />

              {(liveTrackers.availableTalents > 0 || wizardTalents.length > 0) && (
                <div className="space-y-2 rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-primary/5 p-4 shadow-lg shadow-accent/10">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-accent" />
                      <span className="text-sm font-bold text-accent uppercase tracking-wider">Talentos</span>
                      <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-mono font-bold text-accent">
                        {liveTrackers.availableTalents} disponíveis
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTalentCatalog(true)}
                      disabled={liveTrackers.availableTalents <= 0}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      + Escolher Talento
                    </button>
                  </div>
                  {wizardTalents.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Você possui pontos de talento da sua origem. Clique em "Escolher Talento" para abrir o catálogo.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {wizardTalents.map((wt, i) => {
                        const def = getTalentById(wt.id);
                        if (!def) return null;
                        return (
                          <div key={`${wt.id}-${i}`} className="flex items-start justify-between gap-2 rounded-lg border border-accent/30 bg-background/40 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-foreground">{def.name}</span>
                                <span className="text-[10px] uppercase tracking-wider rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-accent">
                                  {def.tag ?? def.category}
                                </span>
                              </div>
                              {def.mechanic && (
                                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{def.mechanic}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setWizardTalents(prev => prev.filter((_, j) => j !== i))}
                              className="text-destructive/70 hover:text-destructive text-xs shrink-0"
                              title="Remover talento"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Step content */}
          <div className="min-h-[300px]">
          {/* Step 0: Identity */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">👤 Identidade do Personagem</h2>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground font-medium">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do personagem" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground text-sm" autoFocus />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground font-medium">Categoria</label>
                {isMaster ? (
                  <div className="flex gap-2">
                    {(['PLAYER', 'INIMIGO', 'NPC'] as CharacterCategory[]).map(cat => (
                      <button key={cat} onClick={() => setCategory(cat)} className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-all',
                        category === cat ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/30 text-muted-foreground border-border hover:border-primary/30'
                      )}>
                        {cat}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
                    <Lock className="h-3.5 w-3.5" /> PLAYER
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">Apenas o Mestre cria NPCs/Inimigos</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Class */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">⚔️ Classe</h2>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground font-medium flex items-center gap-1">
                  Classe
                  {(origin === 'Restringido' || origin === 'Corpo Amaldiçoado Mutante (CAM)') && <Lock className="h-3 w-3 text-primary" />}
                </label>
                <div className="flex gap-2">
                  {CHARACTER_CLASSES.map(cls => {
                    const lockedByRestringido = origin === 'Restringido' && cls !== 'Feiticeiro';
                    // CAM: proíbe explicitamente Multiclasse — uma única classe (Feiticeiro) é a única
                    // compatível com a arquitetura de núcleos do briefing.
                    const lockedByCam = origin === 'Corpo Amaldiçoado Mutante (CAM)' && cls !== 'Feiticeiro';
                    const lockedByOrigin = lockedByRestringido || lockedByCam;
                    return (
                    <button
                      key={cls}
                      onClick={() => { if (!lockedByOrigin) setCharClass(cls); }}
                      disabled={lockedByOrigin}
                      className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-all',
                        charClass === cls ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/30 text-muted-foreground border-border hover:border-primary/30',
                        lockedByOrigin && 'opacity-40 cursor-not-allowed hover:border-border',
                      )}>
                      {cls}
                    </button>
                    );
                  })}
                </div>
                {origin === 'Restringido' && (
                  <p className="text-[10px] text-primary/80 italic">
                    Travada em "Feiticeiro" pela origem Restringido.
                  </p>
                )}
                {origin === 'Corpo Amaldiçoado Mutante (CAM)' && (
                  <p className="text-[10px] text-accent/90 italic">
                    CAM proíbe Multiclasse — os 3 núcleos compartilham a classe Feiticeiro.
                  </p>
                )}
              </div>
              {charClass === 'Feiticeiro' && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground font-medium flex items-center gap-1">
                    Especialização
                    {lockedSpec && <Lock className="h-3 w-3 text-primary" />}
                  </label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value as Specialization)}
                    disabled={!!lockedSpec}
                    className={cn(
                      'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground',
                      lockedSpec && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    {SPECIALIZATIONS.map(s => (
                      <option key={s} value={s} disabled={blockedSpecs.includes(s)}>
                        {s}{blockedSpecs.includes(s) ? ' (bloqueado)' : ''}
                      </option>
                    ))}
                  </select>
                  {lockedSpec && (
                    <p className="text-[10px] text-primary/80 italic">
                      Travada em "{lockedSpec}" pela origem.
                    </p>
                  )}
                </div>
              )}
              {specialization === 'Especialista em Técnica' && (
                <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                  <label className="text-sm text-primary font-bold">🔑 Atributo-Chave da Técnica</label>
                  <select
                    value={keyAttribute}
                    onChange={(e) => setKeyAttribute(e.target.value as any)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="Inteligência">Inteligência</option>
                    <option value="Sabedoria">Sabedoria</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground italic">
                    Define CDs, ataques amaldiçoados e o bônus único no PE Máximo (6 × Nv + Mod).
                  </p>
                </div>
              )}

              {/* ─── Especialista em Técnica: proficiências obrigatórias ─── */}
              {isTecnica && (
                <div className="space-y-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-primary">Treinamentos da Técnica</span>
                    {tecChoicesComplete ? (
                      <span className="ml-auto text-[10px] text-primary font-bold">✓ Completo</span>
                    ) : (
                      <span className="ml-auto text-[10px] text-destructive font-bold">Obrigatório</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p><strong>Automático:</strong> Armas Simples + Armas a Distância.</p>
                    <p><strong>Perícias fixas:</strong> Feitiçaria + Ocultismo.</p>
                  </div>

                  {/* (1) TR Astúcia OU Vontade */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground">Teste de Resistência (1)</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['Astúcia', 'Vontade'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setTecSaveChoice(s)}
                          className={cn(
                            'h-8 rounded border text-[11px] font-bold transition-colors',
                            tecSaveChoice === s
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-secondary/40 text-foreground hover:border-primary/60',
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* (2) Ofícios x2 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground">
                      Ofícios (2 de 3) — selecionados: {tecOficioChoices.length}/2
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {tecOficioOptions.map((o) => {
                        const picked = tecOficioChoices.includes(o);
                        const full = tecOficioChoices.length >= 2;
                        return (
                          <button
                            key={o}
                            type="button"
                            disabled={!picked && full}
                            onClick={() => {
                              setTecOficioChoices((prev) =>
                                prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
                              );
                            }}
                            className={cn(
                              'h-8 rounded border text-[10px] font-bold transition-colors px-1',
                              picked
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-secondary/40 text-foreground hover:border-primary/60 disabled:opacity-40 disabled:cursor-not-allowed',
                            )}
                            title={oficioNames[o]?.trim() || o}
                          >
                            {oficioNames[o]?.trim() || o}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Renomeie cada Ofício no passo "Perícias".</p>
                  </div>

                  {/* (3) Domínio dos Fundamentos — escolher 2. Fundamentos com requisito (ex.: Rápido Nv 6)
                      podem ser SELECIONADOS desde já, mas só ficam UTILIZÁVEIS quando a ficha atender ao requisito. */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground">
                      Domínio dos Fundamentos (2 escolhas) — selecionados: {tecFundamentos.length}/2
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {TECNICA_FUNDAMENTOS.map((f) => {
                        const picked = tecFundamentos.includes(f);
                        const full = tecFundamentos.length >= 2;
                        const det = TECNICA_FUNDAMENTO_DETAILS[f];
                        const locked = det.unlockLevel > level;
                        return (
                          <button
                            key={f}
                            type="button"
                            disabled={!picked && full}
                            onClick={() => {
                              playClickSound();
                              setTecFundamentos((prev) =>
                                prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                              );
                            }}
                            className={cn(
                              'rounded border px-2 py-1.5 text-left transition-colors',
                              picked
                                ? 'border-primary bg-primary/20 text-foreground'
                                : 'border-border bg-secondary/40 text-foreground hover:border-primary/60 disabled:opacity-40 disabled:cursor-not-allowed',
                            )}
                            title={det.effect}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold">{f}</span>
                              {locked && (
                                <span className="rounded-sm bg-amber-500/20 border border-amber-500/40 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-300">
                                  🔒 Nv {det.unlockLevel}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">{det.effect}</div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Você pode aprender fundamentos com requisito de nível agora; eles só ficarão utilizáveis ao atingir o nível necessário.</p>
                  </div>

                  {!tecChoicesComplete && (
                    <p className="text-[10px] text-destructive font-bold">
                      Conclua todas as escolhas para avançar do passo Classe.
                    </p>
                  )}
                </div>
              )}
              {charClass === 'Maldição' && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground font-medium">Motivação</label>
                  <select value={motivation} onChange={(e) => setMotivation(e.target.value as Motivation)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">
                    {MOTIVATIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Origem */}
          {step === 2 && charClass === 'Feiticeiro' && (
            <OriginStep
              origin={origin}
              setOrigin={setOrigin}
              choices={originChoices}
              setChoices={setOriginChoices}
              anatomyAllowed={anatomyAllowed}
            />
          )}
          {step === 2 && charClass !== 'Feiticeiro' && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Origem
              </h2>
              <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground text-center">
                Origens são exclusivas para Feiticeiros. Avance para a próxima etapa.
              </div>
            </div>
          )}

          {/* Step 4: Stats — DERIVADAS automaticamente dos atributos + classe/spec */}
          {step === 4 && (() => {
            const bHP = effects.automation.bonusHP ?? 0;
            const bPE = effects.automation.bonusPE ?? 0;
            const { conMod, desMod, keyMod, keyAttrName } = derivedStats;
            const hitDie = getClassHitDie(charClass, specialization);
            const fmtMod = (m: number) => (m >= 0 ? `+${m}` : `${m}`);
            return (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">📊 Estatísticas Base <span className="text-xs font-normal text-muted-foreground">(automáticas)</span></h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">{category === 'INIMIGO' ? 'Nível de Desafio' : 'Nível'}</label>
                  {lockedToLevel1 ? (
                    <div className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 flex items-center justify-between text-sm font-mono">
                      <span className="text-foreground font-bold">1</span>
                      <span className="text-[10px] text-muted-foreground">🔒 Players começam no Nv 1</span>
                    </div>
                  ) : (
                    <NullSafeInput value={level} onChange={setLevel} className="w-full" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground flex items-center justify-between gap-2">
                    <span>❤️ Vida Total (HP)</span>
                    <span className="text-[11px] text-hp font-bold">
                      Final: {hpMax + bHP}
                      {bHP !== 0 && (
                        <span className="text-muted-foreground font-normal"> ({hpMax} {bHP >= 0 ? '+' : '−'} {Math.abs(bHP)} origem)</span>
                      )}
                    </span>
                  </label>
                  <div className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 flex items-center justify-between text-sm font-mono">
                    <span className="text-hp font-bold">{hpMax}</span>
                    <span className="text-[10px] text-muted-foreground">d{hitDie} ({hitDie}) {fmtMod(conMod)} CON</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground flex items-center justify-between gap-2">
                    <span>⚡ Pontos de Energia (PE)</span>
                    <span className="text-[11px] text-pe font-bold">
                      Final: {peMax + bPE}
                      {bPE !== 0 && (
                        <span className="text-muted-foreground font-normal"> ({peMax} {bPE >= 0 ? '+' : '−'} {Math.abs(bPE)} origem)</span>
                      )}
                    </span>
                  </label>
                  <div className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 flex items-center justify-between text-sm font-mono">
                    <span className="text-pe font-bold">{peMax}</span>
                    <span className="text-[10px] text-muted-foreground">{getPePerLevelMult(specialization)} × Nv {keyAttrName ? `${fmtMod(keyMod)} ${keyAttrName}` : '(sem chave)'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">🛡️ Classe de Armadura (CA)</label>
                  <div className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 flex items-center justify-between text-sm font-mono">
                    <span className="text-foreground font-bold">{ca}</span>
                    <span className="text-[10px] text-muted-foreground">10 {fmtMod(desMod)} DES</span>
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-sm text-muted-foreground">🎯 CD Base</label>
                  <div className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 flex items-center justify-between text-sm font-mono">
                    <span className="text-foreground font-bold">{baseDC}</span>
                    <span className="text-[10px] text-muted-foreground">10 {keyAttrName ? `${fmtMod(keyMod)} ${keyAttrName}` : '(sem atributo-chave)'}</span>
                  </div>
                </div>
                {/* Aptidão Energia Reversa removida da criação — só pode ser adquirida via Aptidões Amaldiçoadas (ER) na ficha. */}
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground space-y-1">
                <div>💡 Estatísticas calculadas automaticamente a partir dos atributos, classe e especialização.</div>
                <div>Ajuste valores manualmente depois da criação na ficha, se necessário.</div>
              </div>
            </div>
            );
          })()}

          {/* Step 3: Fixed Attributes with Point Buy (vem ANTES das Estatísticas) */}
          {step === 3 && (() => {
            const totalSpent = Object.values(attrValues).reduce((sum, v) => sum + (POINT_BUY_COSTS[v] ?? 0), 0);
            const remaining = POINT_BUY_INITIAL - totalSpent;
            return (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">✨ Compra de Atributos</h2>
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-2">
                <span className="text-sm font-medium text-muted-foreground">Pontos restantes:</span>
                <span className={cn('text-2xl font-bold font-mono', remaining >= 0 ? 'text-primary' : 'text-hp')}>{remaining}</span>
              </div>
              <p className="text-xs text-muted-foreground">Base: 10 | Mín: {POINT_BUY_MIN} | Máx: {POINT_BUY_MAX} | Saldo inicial: {POINT_BUY_INITIAL}</p>
              <div className="grid grid-cols-2 gap-3">
                {FIXED_ATTRIBUTES.map(attr => {
                  const val = attrValues[attr];
                  const cost = POINT_BUY_COSTS[val] ?? 0;
                  const mod = Math.floor((val - 10) / 2);
                  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                  return (
                  <div key={attr} className="flex items-center gap-2 rounded-xl bg-secondary/50 border border-border px-3 py-2">
                    <span className="text-xs font-bold text-primary w-8">{ATTR_ABBR[attr]}</span>
                    <span className="flex-1 text-sm font-medium text-foreground">{attr}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { if (val > POINT_BUY_MIN) setAttrValues({ ...attrValues, [attr]: val - 1 }); }}
                        disabled={val <= POINT_BUY_MIN}
                        className="h-7 w-7 rounded-lg bg-secondary text-foreground font-bold text-sm disabled:opacity-30 hover:bg-secondary/80 transition-colors flex items-center justify-center"
                      >−</button>
                      <span className="w-8 text-center text-sm font-mono font-bold text-primary">{val}</span>
                      <button
                        onClick={() => {
                          if (val < POINT_BUY_MAX) {
                            const newCost = POINT_BUY_COSTS[val + 1] ?? 0;
                            const newTotal = totalSpent - cost + newCost;
                            if (POINT_BUY_INITIAL - newTotal >= 0) setAttrValues({ ...attrValues, [attr]: val + 1 });
                          }
                        }}
                        disabled={val >= POINT_BUY_MAX || remaining <= 0}
                        className="h-7 w-7 rounded-lg bg-secondary text-foreground font-bold text-sm disabled:opacity-30 hover:bg-secondary/80 transition-colors flex items-center justify-center"
                      >+</button>
                    </div>
                    <span className={cn('font-mono font-bold text-sm w-6 text-right', mod >= 0 ? 'text-foreground' : 'text-hp')}>{modStr}</span>
                    <span className="text-xs text-muted-foreground w-8 text-right">{cost > 0 ? `-${cost}` : cost < 0 ? `+${-cost}` : '0'}</span>
                  </div>
                  );
                })}
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground space-y-1">
                <div>💡 Custos: 8(-2) · 9(-1) · 10(0) · 11(2) · 12(3) · 13(4) · 14(5) · 15(7)</div>
                <div>Modificador = (Valor - 10) ÷ 2 arredondado para baixo.</div>
              </div>
            </div>
            );
          })()}

          {/* Step 4: Fixed Skills */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">📜 Perícias</h2>
              <p className="text-sm text-muted-foreground">Defina bônus, treinamento (T = +⌊nível/3⌋) e maestria (M = +⌊nível/2⌋). Não acumulam.</p>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                <div><strong className="text-primary">Regra:</strong> Pool unificado — Treino custa 1 ponto · Maestria custa 2 pontos · Maestria sobre uma perícia já Treinada custa apenas 1 ponto adicional.</div>
                {effects.trackers.trainingWhitelist && effects.trackers.trainingWhitelist.length > 0 && (
                  <div>
                    <strong className="text-primary">Restrição da origem/clã:</strong> apenas {effects.trackers.trainingWhitelist.join(', ')}.
                  </div>
                )}
                <div className="text-muted-foreground">No wizard, você pode desmarcar T/M para refazer a escolha. Após criar a ficha, fica permanente.</div>
              </div>
              <div className="space-y-3">
                {skillsByAttr.map(({ attr, abbr, skills: groupSkills }) => (
                  <div key={attr} className="space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                      <span className="bg-primary/20 rounded px-1.5 py-0.5">{abbr}</span>
                      {attr}
                    </div>
                    <div className="space-y-0.5">
                      {(() => null)()}
                      {groupSkills.map(sd => {
                        const trainBonus = getTrainingBonus(level, skillTrained[sd.name], skillMastery[sd.name]);
                        const whitelist = effects.trackers.trainingWhitelist;
                        const hasWhitelist = Array.isArray(whitelist) && whitelist.length > 0;
                        const inWhitelist = !hasWhitelist || whitelist!.includes(sd.name);
                        const totalBudgetCheck = wizardSkillPoolBase + effects.trackers.availableTrainings + (effects.automation.extraTrainings ?? 0);
                        const trainGated = hasWhitelist || totalBudgetCheck > 0;
                        const blockedByWhitelist = hasWhitelist && !inWhitelist;

                        // Especialista em Técnica: perícias já concedidas pela
                        // classe (apenas as fixas: Feitiçaria + Ocultismo) entram
                        // como Treinadas e NÃO consomem o pool de perícias.
                        // O T fica travado ON; o M segue disponível normalmente.
                        const tecAutoTrained = isTecnica && (
                          TEC_FIXED_SKILLS.includes(sd.name)
                          || tecOficioChoices.includes(sd.name)
                        );

                        // Pool unificado: T = 1, M = 2; M sobre T já existente = 1 (substitui o T).
                        // usedBudget soma 1 por T isolado e 2 por M (M absorve o T da mesma perícia).
                        const totalBudget = wizardSkillPoolBase + effects.trackers.availableTrainings + (effects.automation.extraTrainings ?? 0);
                        let usedBudget = 0;
                        Object.keys({ ...skillTrained, ...skillMastery }).forEach(k => {
                          if (skillMastery[k]) usedBudget += 2;
                          else if (skillTrained[k]) usedBudget += 1;
                        });

                        // Custo marginal ao marcar (considerando o estado atual da perícia).
                        const trainAddCost = (skillTrained[sd.name] || tecAutoTrained) ? 0 : 1;
                        // M custa 2 se a perícia não tem T; 1 se já tem T (substitui).
                        const masteryAddCost = skillMastery[sd.name] ? 0 : ((skillTrained[sd.name] || tecAutoTrained) ? 1 : 2);

                        const wouldExceedTrain = trainGated && !skillTrained[sd.name] && (usedBudget + trainAddCost > totalBudget);
                        const wouldExceedMastery = trainGated && !skillMastery[sd.name] && (usedBudget + masteryAddCost > totalBudget);

                        // Skills auto-treinadas pela Técnica não podem ser desmarcadas
                        // (o T vem da classe). Também nunca exibem como "excederia".
                        const cannotTrain = tecAutoTrained || blockedByWhitelist || wouldExceedTrain;
                        const cannotMastery = blockedByWhitelist || wouldExceedMastery;
                        const trainedDisplay = !!skillTrained[sd.name] || tecAutoTrained;

                        const toggleTrain = () => {
                          if (tecAutoTrained) return; // travado pela classe
                          if (cannotTrain && !skillTrained[sd.name]) return;
                          // Marcar T: se já era M, remove M.
                          const next = !skillTrained[sd.name];
                          setSkillTrained({ ...skillTrained, [sd.name]: next });
                          if (next && skillMastery[sd.name]) setSkillMastery({ ...skillMastery, [sd.name]: false });
                        };
                        const toggleMastery = () => {
                          if (cannotMastery && !skillMastery[sd.name]) return;
                          // Marcar M: mantém T (M absorve o T — desconto já aplicado).
                          setSkillMastery({ ...skillMastery, [sd.name]: !skillMastery[sd.name] });
                        };

                        return (
                        <div key={sd.name} className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-1.5">
                          {/* T/M no wizard são reversíveis. Restrições:
                              - whitelist da origem/clã (se houver);
                              - 2 Treinos XOR 1 Maestria (não misturar);
                              - orçamento total = availableTrainings (Maestria custa 2). */}
                          <button
                            onClick={toggleTrain}
                            disabled={tecAutoTrained || (cannotTrain && !skillTrained[sd.name])}
                            className={cn(
                              'w-5 h-5 rounded-sm border text-[9px] font-bold flex items-center justify-center transition-all flex-shrink-0 disabled:cursor-not-allowed',
                              trainedDisplay ? 'bg-primary/30 border-primary text-primary' : 'border-border text-muted-foreground/40 hover:border-primary/50',
                              !trainedDisplay && cannotTrain && 'opacity-30',
                              tecAutoTrained && 'cursor-not-allowed',
                            )}
                            title={
                              tecAutoTrained
                                ? 'Treinada automaticamente pela Especialização (não consome pontos).'
                                : skillTrained[sd.name]
                                ? 'Clique para devolver 1 ponto'
                                : blockedByWhitelist
                                  ? `Restrito pela origem/clã (apenas: ${whitelist!.join(', ')})`
                                  : wouldExceedTrain
                                    ? 'Sem pontos suficientes (T = 1 ponto).'
                                    : `Treinamento (custa 1 ponto · +${getMasteryBonus(level)})`
                            }
                          >T</button>
                          <button
                            onClick={toggleMastery}
                            disabled={cannotMastery && !skillMastery[sd.name]}
                            className={cn(
                              'w-5 h-5 rounded-sm border text-[9px] font-bold flex items-center justify-center transition-all flex-shrink-0 disabled:cursor-not-allowed',
                              skillMastery[sd.name] ? 'bg-pe/30 border-pe text-pe' : 'border-border text-muted-foreground/40 hover:border-pe/50',
                              !skillMastery[sd.name] && cannotMastery && 'opacity-30',
                            )}
                            title={
                              skillMastery[sd.name]
                                ? 'Clique para devolver 2 pontos'
                                : blockedByWhitelist
                                  ? `Restrito pela origem/clã (apenas: ${whitelist!.join(', ')})`
                                  : wouldExceedMastery
                                    ? `Sem pontos suficientes (M custa ${masteryAddCost}).`
                                    : skillTrained[sd.name]
                                      ? `Maestria — substitui o Treino (custa apenas 1 ponto adicional · +${2 * getMasteryBonus(level)})`
                                      : `Maestria (custa 2 pontos · +${2 * getMasteryBonus(level)})`
                            }
                          >M</button>
                          {sd.editable ? (
                            <input
                              value={oficioNames[sd.name] || ''}
                              onChange={(e) => setOficioNames({ ...oficioNames, [sd.name]: e.target.value })}
                              placeholder={`${sd.name} (nome)`}
                              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none border-b border-dashed border-border"
                            />
                          ) : (
                            <span className={cn("flex-1 text-sm", blockedByWhitelist ? 'text-muted-foreground/50 italic' : 'text-foreground')}>
                              {sd.name}
                              {blockedByWhitelist && <span className="ml-1 text-[10px]">🔒</span>}
                            </span>
                          )}
                          {trainBonus > 0 && (
                            <span className="text-xs text-pe font-medium flex-shrink-0">+{trainBonus}</span>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">+</span>
                            <input
                              type="number"
                              value={skillBonuses[sd.name]}
                              onChange={(e) => setSkillBonuses({ ...skillBonuses, [sd.name]: parseInt(e.target.value) || 0 })}
                              className="h-7 w-12 rounded border border-input bg-background px-1 text-center text-xs font-mono font-bold text-primary"
                            />
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Passives */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">⭐ Passivas</h2>
              {!isMaster && (
                <div className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/5 p-2 text-xs text-neon-yellow">
                  📨 As passivas que você criar aqui serão <strong>enviadas para análise do Mestre</strong> ao finalizar a ficha. Só serão aplicadas após aprovação.
                </div>
              )}
              <div className="space-y-1.5">
                {passives.map((p, i) => {
                  const passiveSpellLv = getPassiveSpellLevel(p);
                  const isActive = isPassiveActive(p, level);
                  const rdEntries = p.bonusRdByType ? DAMAGE_TYPES.filter(t => (p.bonusRdByType![t] || 0) !== 0) : [];
                  return (
                    <div key={p.id} className={cn(
                      'rounded-xl border px-3 py-2 text-sm transition-all',
                      isActive ? 'border-primary/20 bg-gradient-to-br from-[oklch(0.18_0.04_280)] to-[oklch(0.14_0.06_300)]' : 'border-border bg-secondary/20 opacity-60'
                    )}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-primary">⭐</span>
                          <span className="font-bold text-foreground">{p.name}</span>
                          <span className={cn(
                            'text-[10px] rounded-full border px-1.5 py-0.5 font-extrabold tracking-wider',
                            isActive ? 'bg-primary/15 text-primary border-primary/40' : 'bg-secondary/50 text-muted-foreground border-border'
                          )} title={`Nível de feitiço ${passiveSpellLv}`}>🔮 Nv.{passiveSpellLv}</span>
                          {!isActive && <span className="text-[10px] text-hp font-bold">🔒 inativa</span>}
                        </div>
                        <button onClick={() => setPassives(passives.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive text-xs">✕</button>
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                      <div className="flex gap-1.5 mt-1.5 flex-wrap text-xs font-medium">
                        {p.bonusHP !== 0 && <span className="rounded-full bg-hp/20 border border-hp/30 px-2 py-0.5 text-hp">HP{p.bonusHP >= 0 ? '+' : ''}{p.bonusHP}</span>}
                        {p.bonusPE !== 0 && <span className="rounded-full bg-pe/20 border border-pe/30 px-2 py-0.5 text-pe">PE{p.bonusPE >= 0 ? '+' : ''}{p.bonusPE}</span>}
                        {p.bonusESC !== 0 && <span className="rounded-full bg-shield/20 border border-shield/30 px-2 py-0.5 text-shield">ESC{p.bonusESC >= 0 ? '+' : ''}{p.bonusESC}</span>}
                        {p.bonusCA !== 0 && <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-primary">CA{p.bonusCA >= 0 ? '+' : ''}{p.bonusCA}</span>}
                        {p.bonusRD !== 0 && <span className="rounded-full bg-pe/15 border border-pe/30 px-2 py-0.5 text-pe" title="RD geral (todos os tipos)">🔰 RD{p.bonusRD >= 0 ? '+' : ''}{p.bonusRD}</span>}
                        {p.bonusSlots !== 0 && <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-muted-foreground">Slots{p.bonusSlots >= 0 ? '+' : ''}{p.bonusSlots}</span>}
                        {rdEntries.map(t => (
                          <span key={t} className="rounded-full bg-pe/10 border border-pe/30 px-2 py-0.5 text-pe" title={`RD ${DAMAGE_TYPE_LABELS[t]}`}>
                            🔰 {DAMAGE_TYPE_ABBR[t]}+{p.bonusRdByType![t]}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add passive form */}
              <div className="space-y-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-[oklch(0.16_0.04_280)] to-[oklch(0.12_0.05_300)] p-4 shadow-lg shadow-primary/10">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-primary uppercase tracking-wider">Nova Passiva</span>
                </div>
                <input
                  value={passForm.name}
                  onChange={(e) => setPassForm({ ...passForm, name: e.target.value })}
                  placeholder="Nome da passiva"
                  className="h-9 w-full rounded-xl border border-primary/30 bg-background/50 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
                <textarea
                  value={passForm.description}
                  onChange={(e) => setPassForm({ ...passForm, description: e.target.value })}
                  placeholder="Descrição detalhada..."
                  rows={2}
                  className="w-full rounded-xl border border-primary/30 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none resize-y"
                />
                {/* Nível de feitiço */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">🔮 Nível de feitiço</label>
                  <select
                    value={passForm.spellLevel}
                    onChange={(e) => setPassForm({ ...passForm, spellLevel: e.target.value as SpellLevel })}
                    className="h-8 w-32 rounded-lg border border-primary/30 bg-background/50 px-2 text-center text-sm font-mono font-bold text-primary focus:border-primary focus:outline-none"
                  >
                    {SPELL_LEVELS.map(lv => (
                      <option key={lv} value={lv}>{lv}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground italic">
                    {isPassiveActive({ ...passForm, id: '', bonusRD: 0 } as Passive, level) ? '✅ ativa agora' : `⚠️ requer mais nível`}
                  </span>
                </div>
                {/* Bonus grid (RD geral + RD por tipo abaixo) */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'bonusHP' as const, label: '❤️ HP', color: 'text-hp border-hp/30 focus:border-hp' },
                    { key: 'bonusPE' as const, label: '⚡ PE', color: 'text-pe border-pe/30 focus:border-pe' },
                    { key: 'bonusESC' as const, label: '🛡 ESC', color: 'text-shield border-shield/30 focus:border-shield' },
                    { key: 'bonusCA' as const, label: '🛡 CA', color: 'text-primary border-primary/30 focus:border-primary' },
                    { key: 'bonusRD' as const, label: '🔰 RD', color: 'text-pe border-pe/30 focus:border-pe' },
                    { key: 'bonusSlots' as const, label: '📦 Slots', color: 'text-muted-foreground border-border' },
                  ]).map(({ key, label, color }) => (
                    <div key={key} className="space-y-1">
                      <label className={cn('text-xs font-medium', color.split(' ')[0])}>{label}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={passForm[key] || ''}
                        onChange={(e) => { const raw = e.target.value; setPassForm({ ...passForm, [key]: raw === '' || raw === '-' ? 0 : parseInt(raw) || 0 }); }}
                        className={cn('h-8 w-full rounded-lg border bg-background/50 px-2 text-center text-sm font-mono font-bold focus:outline-none transition-colors', color)}
                      />
                    </div>
                  ))}
                </div>

                {/* RD por tipo de dano */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowPassRdPicker(!showPassRdPicker)}
                    className="flex items-center gap-1.5 text-xs font-medium text-pe hover:text-pe/80 transition-colors"
                  >
                    🔰 RD por tipo de dano {showPassRdPicker ? '▲' : '▼'}
                    {DAMAGE_TYPES.filter(t => (passForm.bonusRdByType[t] || 0) !== 0).length > 0 && (
                      <span className="rounded-full bg-pe/20 border border-pe/30 px-1.5 py-0.5 text-[10px] text-pe">
                        {DAMAGE_TYPES.filter(t => (passForm.bonusRdByType[t] || 0) !== 0).length} tipo(s)
                      </span>
                    )}
                  </button>
                  {showPassRdPicker && (
                    <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-pe/20 bg-pe/5 p-3">
                      {DAMAGE_TYPES.map(t => (
                        <div key={t} className="space-y-0.5">
                          <label className="text-[10px] font-bold text-pe uppercase">{DAMAGE_TYPE_ABBR[t]}</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={passForm.bonusRdByType[t] || ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setPassForm({
                                ...passForm,
                                bonusRdByType: {
                                  ...passForm.bonusRdByType,
                                  [t]: raw === '' ? 0 : parseInt(raw) || 0,
                                },
                              });
                            }}
                            placeholder="0"
                            className="h-7 w-full rounded-lg border border-pe/30 bg-background/50 px-1 text-center text-xs font-mono font-bold text-pe focus:border-pe focus:outline-none transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={addPassive}
                  className="h-9 w-full rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                >
                  ✨ Adicionar Passiva
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Spells (ou Técnicas de Estilo, p/ origens que bloqueiam feitiços). */}
          {step === 7 && (() => {
            // Sem Técnica (e quaisquer outras origens com blockSpells) substituem
            // a aba inteira por "Técnicas de Estilo" no padrão Dark Fantasy.
            const blockSpells = charClass === 'Feiticeiro' && effects.blockSpells;
            if (charClass === 'Não-Feiticeiro') {
              return (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-foreground">🔮 Feitiços</h2>
                  <div className="rounded-lg border border-border bg-secondary/30 p-4 text-center text-muted-foreground">
                    Humanos Comuns não possuem feitiços. Pule esta etapa.
                  </div>
                </div>
              );
            }
            if (blockSpells) {
              const maxStyles = effects.automation.extraStyleTechniques;
              const hasShadowStyle = effects.automation.hasShadowStyle;
              const tecnica = effects.automation.tecnicaAmaldicoada;
              const aptidao = effects.automation.aptidaoConcedida;
              const remaining = Math.max(0, maxStyles - styleTechniques.length);
              return (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" /> Técnicas de Estilo
                  </h2>
                  {!hasShadowStyle ? (
                    <div className="rounded-lg border border-border bg-[#1A1A1B] p-4 text-sm text-muted-foreground space-y-1">
                      <div className="text-foreground font-bold">🔒 Novo Estilo da Sombra ainda não desperto</div>
                      <div>Esta origem não possui feitiços. O Novo Estilo da Sombra desperta no <strong className="text-primary">Nível 4</strong> — eleve o nível na etapa de Estatísticas para liberar Técnicas de Estilo.</div>
                    </div>
                  ) : (
                    <>
                      {/* Cabeçalho do Estilo (Dark Fantasy: #1A1A1B + #7C3AED). */}
                      <div className="rounded-xl border bg-[#1A1A1B] p-3 space-y-2" style={{ borderColor: '#7C3AED' }}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#7C3AED' }}>Técnica Amaldiçoada</div>
                            <div className="text-base font-bold text-foreground">{tecnica}</div>
                          </div>
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: '#7C3AED', color: '#7C3AED' }}>
                            Aptidão: {aptidao}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic leading-snug">
                          Trocar a <strong>Técnica de Estilo ativa</strong> no início do turno é uma <strong>Ação Livre</strong>, enquanto o Domínio Simples permanecer ativo.
                        </p>

                        {/* Seletor de Técnica de Estilo ativa */}
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#7C3AED' }}>
                            Técnica de Estilo Ativa (Ação Livre)
                          </label>
                          <select
                            value={activeStyleTechnique}
                            onChange={(e) => setActiveStyleTechnique(e.target.value)}
                            disabled={styleTechniques.length === 0}
                            className="h-9 w-full rounded-lg border bg-[#1A1A1B] px-2 text-sm text-foreground disabled:opacity-50"
                            style={{ borderColor: '#7C3AED' }}
                          >
                            <option value="">— nenhuma —</option>
                            {styleTechniques.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Tracker de progressão */}
                      <div className="rounded-lg border bg-[#1A1A1B] p-2 text-xs space-y-1" style={{ borderColor: '#7C3AED' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Técnicas aprendidas</span>
                          <span className="font-mono font-bold" style={{ color: '#7C3AED' }}>
                            {styleTechniques.length} / {maxStyles}
                          </span>
                        </div>
                        {remaining > 0 && (
                          <div className="text-[10px] font-bold" style={{ color: '#7C3AED' }}>
                            ⚠️ Selecione +{remaining} Técnica(s) de Estilo antes de finalizar.
                          </div>
                        )}
                      </div>

                      {/* Lista de técnicas */}
                      <div className="space-y-1">
                        {styleTechniques.map((t, i) => (
                          <div key={`${t}-${i}`} className="flex items-center justify-between rounded-lg border bg-[#1A1A1B] px-3 py-1.5 text-sm" style={{ borderColor: '#7C3AED' }}>
                            <span className="font-medium text-foreground">▸ {t}</span>
                            <button
                              onClick={() => {
                                setStyleTechniques(styleTechniques.filter((_, j) => j !== i));
                                if (activeStyleTechnique === t) setActiveStyleTechnique('');
                              }}
                              className="text-destructive/60 hover:text-destructive text-xs"
                            >✕</button>
                          </div>
                        ))}
                      </div>

                      {/* Adicionar técnica */}
                      {remaining > 0 && (
                        <div className="flex items-center gap-2">
                          <input
                            value={newStyleName}
                            onChange={(e) => setNewStyleName(e.target.value)}
                            placeholder="Nome da Técnica de Estilo (ex.: Garra Negra)"
                            className="h-9 flex-1 rounded-lg border bg-[#1A1A1B] px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                            style={{ borderColor: '#7C3AED' }}
                          />
                          <button
                            onClick={() => {
                              const v = newStyleName.trim();
                              if (!v) return;
                              setStyleTechniques([...styleTechniques, v]);
                              setNewStyleName('');
                            }}
                            className="h-9 rounded-lg px-3 text-sm font-bold text-white"
                            style={{ backgroundColor: '#7C3AED' }}
                          >
                            + Adicionar
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            }
            return (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-foreground">🔮 Feitiços</h2>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground space-y-1">
                  <div>📊 Nível {level} → Máx <strong className="text-primary">{maxSpells}</strong> feitiços (passivas contam) | Até nível <strong className="text-primary">{getMaxSpellLevel(level, specialization)}</strong></div>
                  <div>🔮 Feitiços: <strong className="text-foreground">{spells.length}</strong> + Passivas: <strong className="text-foreground">{passives.length}</strong> = <strong className="text-foreground">{spells.length + passives.length}</strong> / {maxSpells}</div>
                </div>
                <div className="space-y-1">
                  {spells.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-1.5 text-sm">
                      <span className="font-medium text-foreground">{s.name} <span className="text-xs text-muted-foreground">Nv.{s.spellLevel} | PE:{s.costPE}</span></span>
                      <button onClick={() => setSpells(spells.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive text-xs">✕</button>
                    </div>
                  ))}
                  {pendingSpellProposals.map((s, i) => (
                    <div key={`prop-${s.id}`} className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm">
                      <span className="font-medium text-foreground">
                        {s.name} <span className="text-xs text-primary">📜 Proposta Nv.{s.spellLevel}</span>
                      </span>
                      <button onClick={() => setPendingSpellProposals(pendingSpellProposals.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive text-xs">✕</button>
                    </div>
                  ))}
                </div>
                {spells.length + passives.length >= maxSpells ? (
                  <div className="rounded-lg border border-hp/30 bg-hp/10 p-3 text-sm text-hp font-bold text-center">
                    🔒 Limite atingido ({spells.length + passives.length}/{maxSpells}) — passivas contam como feitiços
                  </div>
                ) : !showSpellAssist ? (
                  <button onClick={() => setShowSpellAssist(true)} className="flex items-center gap-2 rounded-lg bg-pe/10 border border-pe/20 px-4 py-2 text-sm text-pe font-medium hover:bg-pe/20 transition-colors">
                    <Wand2 className="h-4 w-4" /> Criar Feitiço com Assistente
                  </button>
                ) : (
                  <SpellCreationAssistant
                    onAdd={(spell) => { setSpells([...spells, spell]); setShowSpellAssist(false); }}
                    onCancel={() => setShowSpellAssist(false)}
                    charLevel={level}
                    currentSpellCount={spells.length + passives.length}
                    maxSpells={maxSpells}
                    availableTags={availableTags}
                    isMaster={isMaster}
                    hasEnergiaReversa={hasEnergiaReversa}
                    hasTecnicaMaxima={false}
                    hasTecnicaReversa={false}
                    onSubmitProposal={(spell) => {
                      // Player no wizard: feitiço Nv 0 (ou enviado em Modo Mestre)
                      // vira proposta para o Mestre — enviada após criar a ficha.
                      setPendingSpellProposals(prev => [...prev, spell]);
                      setShowSpellAssist(false);
                    }}
                  />
                )}
              </div>
            );
          })()}

          {/* Step 7: Finish */}
          {step === 8 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">✅ Resumo da Ficha</h2>
              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Nome:</span><span className="font-bold text-foreground">{name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Categoria:</span><span className="font-bold">{category}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Classe:</span><span className="font-bold">{charClass}</span></div>
                {charClass === 'Feiticeiro' && <div className="flex justify-between"><span className="text-muted-foreground">Especialização:</span><span>{specialization}</span></div>}
                {charClass === 'Feiticeiro' && <div className="flex justify-between"><span className="text-muted-foreground">Origem:</span><span>{origin}</span></div>}
                {charClass === 'Maldição' && <div className="flex justify-between"><span className="text-muted-foreground">Motivação:</span><span>{motivation}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Nível:</span><span className="font-bold">{level}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">HP:</span><span className="text-hp font-bold">{hpMax + (effects.automation.bonusHP ?? 0)}{(effects.automation.bonusHP ?? 0) !== 0 && <span className="text-[10px] text-muted-foreground font-normal"> ({hpMax}{(effects.automation.bonusHP ?? 0) >= 0 ? '+' : '−'}{Math.abs(effects.automation.bonusHP ?? 0)})</span>}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">PE:</span><span className="text-pe font-bold">{peMax + (effects.automation.bonusPE ?? 0)}{(effects.automation.bonusPE ?? 0) !== 0 && <span className="text-[10px] text-muted-foreground font-normal"> ({peMax}{(effects.automation.bonusPE ?? 0) >= 0 ? '+' : '−'}{Math.abs(effects.automation.bonusPE ?? 0)})</span>}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CA:</span><span>{ca}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CD:</span><span>{baseDC}</span></div>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="text-xs text-muted-foreground mb-1">Atributos:</div>
                  <div className="flex flex-wrap gap-2">
                    {FIXED_ATTRIBUTES.map(a => (
                      <span key={a} className="text-xs bg-secondary/50 rounded px-2 py-0.5">
                        <strong className="text-primary">{ATTR_ABBR[a]}</strong> {attrValues[a]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Perícias:</span><span>{FIXED_SKILLS.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Passivas:</span><span>{passives.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Feitiços:</span><span>{spells.length} (+{passives.length} passivas) / {maxSpells}</span></div>
              </div>
              <div className="rounded-lg border border-neon-green/30 bg-neon-green/10 p-3 text-sm text-neon-green">
                ✅ Tudo pronto! Após criar, você poderá editar livremente qualquer campo da ficha.
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Navigation (sticky footer) */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-border bg-card shrink-0">
          <button onClick={step === 0 ? onCancel : prev} className="flex items-center gap-1 rounded-lg bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:bg-secondary/80 transition-colors">
            {step === 0 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4" /> Voltar</>}
          </button>
          <span className="text-xs text-muted-foreground">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <button onClick={next} disabled={!canProceed()} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={charClass === 'Feiticeiro' && !isWizardClear(liveTrackers)}
              title={charClass === 'Feiticeiro' && !isWizardClear(liveTrackers) ? 'Resolva todos os Trackers antes de finalizar' : ''}
              className="flex items-center gap-1 rounded-lg bg-neon-green/20 border border-neon-green/40 px-4 py-2 text-sm text-neon-green font-bold hover:bg-neon-green/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4" /> Criar Personagem
            </button>
          )}
        </div>
      </div>
      {showTalentCatalog && (
        <TalentCatalogModal
          character={wizardCharacterDraft}
          onClose={() => setShowTalentCatalog(false)}
          onPickAny={handlePickFromCatalog}
          allowedTabs={['talent']}
          initialTab="talent"
        />
      )}
    </div>,
    document.body
  );
}
