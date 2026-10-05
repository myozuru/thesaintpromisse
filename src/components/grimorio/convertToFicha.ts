/**
 * Converte uma criatura do Grimório em uma Ficha (Character) do sistema principal.
 *
 * v2 — corrige incompatibilidades de tipo, escala, semântica e idempotência.
 * Ver `.lovable/plan.md` para o detalhamento de cada correção.
 */
import { useCharacterStore } from '@/stores/useCharacterStore';
import type {
  Character, Attribute, Passive, Spell, DamageType, CursedAptitudesState,
  AptitudeKey, CharacterClass,
} from '@/types';
import {
  ALL_CONDITIONS, getMasteryBonus, getDefaultSavingThrowBonus,
  createDefaultCursedAptitudes,
} from '@/types';
import type { SpellCondition } from '@/types/conditions';
import { normalizeConditionExpiry } from '@/types/conditions';

type Creature = any;

// ── Tabelas de tradução ────────────────────────────────────────────────────────

const DAMAGE_NAME_TO_ID: Record<string, DamageType> = {
  cortante: 'DCO', perfurante: 'DP', impacto: 'DI', impactante: 'DI',
  'ácido': 'DA', acido: 'DA',
  congelante: 'DCG', chocante: 'DCC', queimante: 'DQ',
  'sônico': 'DS', sonico: 'DS', sonoro: 'DS',
  alma: 'DAL',
  'energia reversa': 'DNR', energia_reversa: 'DNR',
  'energia amaldiçoada': 'DNR', energia_amaldicoada: 'DNR',
  'energético': 'DE', energetico: 'DE',
  'psíquico': 'DPS', psiquico: 'DPS',
  radiante: 'DR',
  'necrótico': 'DN', necrotico: 'DN',
  venenoso: 'DV', veneno: 'DV',
};

const RD_LEVEL_TO_AMOUNT: Record<string, number> = {
  fraca: 2, media: 5, forte: 10, extrema: 20,
};

const ATTR_MAP: Record<string, string> = {
  forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição',
  inteligencia: 'Inteligência', sabedoria: 'Sabedoria', presenca: 'Presença',
};

const SAVE_KEY_TO_TR_NAME: Record<string, string> = {
  astucia: 'Astúcia', fortitude: 'Fortitude', reflexos: 'Reflexos',
  vontade: 'Vontade', integridade: 'Integridade',
};

const SAVE_KEY_TO_ATTR_NAME: Record<string, string> = {
  astucia: 'Inteligência', fortitude: 'Constituição', reflexos: 'Destreza',
  vontade: 'Sabedoria', integridade: 'Constituição',
};

// Heurística para perícias extras sem template
const SKILL_TO_ATTR: Record<string, string> = {
  'Atletismo': 'Força',
  'Acrobacia': 'Destreza', 'Furtividade': 'Destreza',
  'Prestidigitação': 'Destreza', 'Iniciativa': 'Destreza', 'Pilotagem': 'Destreza',
  'Conhecimento': 'Inteligência', 'Investigação': 'Inteligência',
  'Feitiçaria': 'Inteligência', 'Misticismo': 'Inteligência',
  'Sobrevivência': 'Sabedoria', 'Percepção': 'Sabedoria',
  'Cura': 'Sabedoria', 'Intuição': 'Sabedoria',
  'Diplomacia': 'Presença', 'Enganação': 'Presença', 'Intimidação': 'Presença',
  'Atuação': 'Presença', 'Adestramento': 'Presença',
};

const APT_KEY_MAP: Record<string, AptitudeKey> = {
  ea: 'AU', cl: 'CL', bar: 'BAR', dom: 'DOM', er: 'ER',
};

const ACTION_TYPE_TO_SPELL: Record<string, Spell['actionType']> = {
  comum: 'action', bonus: 'bonus', reacao: 'reaction',
  rapida: 'rapida', movimento: 'movimento', livre: 'free',
};

const TARGET_MODE_MAP: Record<string, NonNullable<Spell['targetMode']>> = {
  acerto: 'single_atk', tr_individual: 'single_tr', tr_area: 'area_tr', suporte: 'single_atk',
};

const SIZE_MAP: Record<string, 'Pequeno' | 'Médio' | 'Grande'> = {
  minusculo: 'Pequeno', pequeno: 'Pequeno', medio: 'Médio',
  grande: 'Grande', enorme: 'Grande', colossal: 'Grande',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizedKey(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function currentOrMax(value: unknown, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
    ? value
    : max;
}

function dmgIdFromName(n: string | undefined | null): DamageType | undefined {
  if (!n) return undefined;
  const raw = String(n).toLowerCase().trim();
  return DAMAGE_NAME_TO_ID[raw]
    ?? DAMAGE_NAME_TO_ID[normalizedKey(raw)]
    ?? DAMAGE_NAME_TO_ID[normalizedKey(raw).replace(/_/g, ' ')];
}

function conditionIdFromName(s: string): string {
  const norm = normalizedKey(s);
  const found = ALL_CONDITIONS.find(c => normalizedKey(c.id) === norm || normalizedKey(c.name) === norm);
  return found?.id ?? norm;
}

function skillAttrName(skillName: string): string {
  const found = Object.entries(SKILL_TO_ATTR).find(([name]) => normalizedKey(name) === normalizedKey(skillName));
  return found?.[1] ?? 'Destreza';
}

function readNumberByKey(source: Record<string, unknown>, key: string): number | undefined {
  const entry = Object.entries(source ?? {}).find(([k]) => normalizedKey(k) === key);
  return typeof entry?.[1] === 'number' && Number.isFinite(entry[1]) ? entry[1] : undefined;
}

// ── Patch builder ──────────────────────────────────────────────────────────────

function buildPatch(creature: Creature, current: Character): Partial<Character> {
  const stats = creature.stats ?? {};
  const saves = creature.saves ?? {};
  const attrs = creature.attributes ?? {};
  const defs = creature.defenses ?? {};
  const core = creature.core ?? {};

  // Nível clampado a 20 (tabelas de jogador só vão até 20).
  const ndRaw = finiteNumber(core.nd, current.level);
  const level = Math.max(1, Math.min(20, ndRaw));
  const maestria = getMasteryBonus(level);
  const halfLevel = Math.floor(level / 2);
  const defaultSaveBonus = getDefaultSavingThrowBonus(level);

  // ── Atributos (clamp 1..30) ─────────────────────────────────────────────────
  const nextAttributes: Attribute[] = current.attributes.map((a) => {
    const key = Object.keys(ATTR_MAP).find((k) => ATTR_MAP[k] === a.name);
    if (!key) return a;
    const v = readNumberByKey(attrs, key);
    return typeof v === 'number'
      ? { ...a, value: Math.max(1, Math.min(30, v)) }
      : a;
  });

  const attrIdByName = new Map(nextAttributes.map(a => [a.name, a.id]));
  const modByAttrName = (n: string): number => {
    const a = nextAttributes.find(x => x.name === n);
    return a ? Math.floor((a.value - 10) / 2) : 0;
  };

  // ── TR: gravar como externalBonus para não duplicar ─────────────────────────
  const nextSaves: Attribute[] = current.savingThrows.map((s) => {
    const key = Object.keys(SAVE_KEY_TO_TR_NAME).find(
      (k) => SAVE_KEY_TO_TR_NAME[k] === s.name,
    );
    if (!key) return s;
    const v = readNumberByKey(saves, key);
    if (typeof v !== 'number') return s;
    const am = modByAttrName(SAVE_KEY_TO_ATTR_NAME[key]);
    return { ...s, value: 0, externalBonus: v - defaultSaveBonus - am };
  });

  // ── Perícias: idem (externalBonus) ──────────────────────────────────────────
  const computeSkillExternal = (
    creatureMod: number, linkedAttrName: string,
    trained: boolean, mastery: boolean,
  ): number => {
    const am = modByAttrName(linkedAttrName);
    const train = mastery ? 2 * maestria : trained ? maestria : 0;
    return creatureMod - (halfLevel + am + train);
  };

  const nextSkills: Attribute[] = current.skills.map((sk) => {
    const found = (creature.skills ?? []).find(
      (cs: any) => normalizedKey(cs.name ?? '') === normalizedKey(sk.name),
    );
    if (!found || typeof found.mod !== 'number') return sk;
    const trained = Boolean(found.mastered) || sk.trained;
    const mastery = Boolean(found.mastered) || sk.mastery;
    const linkedAttrName =
      (sk.linkedAttribute
        ? nextAttributes.find(a => a.id === sk.linkedAttribute)?.name
        : null) ?? SKILL_TO_ATTR[sk.name] ?? 'Destreza';
    return {
      ...sk,
      value: 0,
      trained, mastery,
      externalBonus: computeSkillExternal(found.mod, linkedAttrName, !!trained, !!mastery),
    };
  });

  const existingNames = new Set(current.skills.map((s) => normalizedKey(s.name)));
  for (const cs of creature.skills ?? []) {
    if (!cs?.name) continue;
    if (existingNames.has(normalizedKey(cs.name))) continue;
    const trained = Boolean(cs.mastered);
    const mastery = Boolean(cs.mastered);
    const linkedAttrName = skillAttrName(cs.name);
    const linkedId = attrIdByName.get(linkedAttrName) ?? '';
    nextSkills.push({
      id: crypto.randomUUID(),
      name: cs.name,
      value: 0,
      linkedAttribute: linkedId,
      trained, mastery,
      externalBonus: computeSkillExternal(
        typeof cs.mod === 'number' ? cs.mod : 0,
        linkedAttrName, trained, mastery,
      ),
    });
  }

  // ── Vulnerabilidades / Imunidades ───────────────────────────────────────────
  const vulnIds: DamageType[] = (defs.vulnerabilidades ?? [])
    .map((r: any) => dmgIdFromName(r?.tipo))
    .filter((x: any): x is DamageType => !!x);
  const immIds: DamageType[] = (defs.imunidades ?? [])
    .map((r: any) => dmgIdFromName(r?.tipo))
    .filter((x: any): x is DamageType => !!x);

  // ── Passivas ────────────────────────────────────────────────────────────────
  const nextPassives: Passive[] = [];
  const pushPassive = (
    name: string, description: string, extra: Partial<Passive> = {},
  ) => {
    nextPassives.push({
      id: crypto.randomUUID(),
      name, description,
      bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusSlots: 0, bonusRD: 0, bonusCA: 0,
      ...extra,
    });
  };

  const featureSources: Array<{ list: any[]; tag: string }> = [
    { list: creature.features ?? [], tag: 'Característica' },
    { list: creature.dotes ?? [], tag: 'Dote' },
    { list: creature.treinamentos ?? [], tag: 'Treinamento' },
    { list: creature.aptidoesEspeciais ?? [], tag: 'Apt. Amaldiçoada' },
  ];
  for (const { list, tag } of featureSources) {
    for (const f of (list ?? [])) {
      // Bug #11 fix: aceita campos pt-BR (nome/descricao) E inglês (name/description)
      const fname = f?.name ?? f?.nome ?? '';
      const fdesc = f?.description ?? f?.descricao ?? '';
      if (!fname && !fdesc) continue;
      pushPassive(fname ? `[${tag}] ${fname}` : `[${tag}]`, fdesc);
    }
  }

  // RD numérica por tipo
  for (const r of defs.resistencias ?? []) {
    const id = dmgIdFromName(r?.tipo);
    const amount = RD_LEVEL_TO_AMOUNT[normalizedKey(r?.nivel)] ?? 0;
    if (!id || !amount) continue;
    pushPassive(
      `[Resistência] ${r.tipo} (${r.nivel})`,
      `RD ${amount} contra dano ${r.tipo}.`,
      { bonusRdByType: { [id]: amount } as Partial<Record<DamageType, number>> },
    );
  }

  // Imunidades a condições (não há campo nativo — passiva descritiva)
  if ((defs.condicoesImunes ?? []).length) {
    pushPassive(
      '[Imune a Condições]',
      (defs.condicoesImunes ?? [])
        .map((c: string) => ALL_CONDITIONS.find(x => x.id === c)?.name ?? c)
        .join(', '),
    );
  }

  // Stats avançados de Maldição
  const advStats: string[] = [];
  if (typeof stats.guardaInabavalMax === 'number' && Number.isFinite(stats.guardaInabavalMax) && stats.guardaInabavalMax !== 0) advStats.push(`Guarda Inabalável: ${stats.guardaInabavalMax}`);
  if (typeof stats.rdIrredutivel === 'number' && Number.isFinite(stats.rdIrredutivel) && stats.rdIrredutivel !== 0) advStats.push(`RD Irredutível: ${stats.rdIrredutivel}`);
  if (typeof stats.ignorarRd === 'number' && Number.isFinite(stats.ignorarRd) && stats.ignorarRd !== 0) advStats.push(`Ignorar RD: ${stats.ignorarRd}`);
  if (typeof stats.vidaTempPorAtaque === 'number' && Number.isFinite(stats.vidaTempPorAtaque) && stats.vidaTempPorAtaque !== 0) advStats.push(`Vida Temp/Ataque: ${stats.vidaTempPorAtaque}`);
  if (typeof stats.resistenciaParcialMax === 'number' && Number.isFinite(stats.resistenciaParcialMax) && stats.resistenciaParcialMax !== 0) advStats.push(`Resist. Parcial: ${stats.resistenciaParcialMax}`);
  if (typeof stats.resistenciaTotalMax === 'number' && Number.isFinite(stats.resistenciaTotalMax) && stats.resistenciaTotalMax !== 0) advStats.push(`Resist. Total: ${stats.resistenciaTotalMax}`);
  if (typeof stats.espaco === 'number' && Number.isFinite(stats.espaco) && stats.espaco !== 0) advStats.push(`Espaço: ${stats.espaco}m`);
  if (advStats.length) pushPassive('[Stats de Maldição]', advStats.join(' · '));

  // Ações Rápida/Movimento (não têm tracker nativo)
  const totalActions = creature.actions?.total ?? {};
  const extraActLines: string[] = [];
  if (typeof totalActions.rapida === 'number' && Number.isFinite(totalActions.rapida) && totalActions.rapida > 0) extraActLines.push(`Rápidas: ${totalActions.rapida}`);
  if (typeof totalActions.movimento === 'number' && Number.isFinite(totalActions.movimento) && totalActions.movimento > 0) extraActLines.push(`Movimento: ${totalActions.movimento}`);
  if (extraActLines.length) pushPassive('[Ações Extras]', extraActLines.join(' · '));

  if (ndRaw > 20) {
    pushPassive('[ND Real]', `ND original: ${ndRaw} (clampado a 20 para compatibilidade com tabelas).`);
  }
  if (creature.narratorNotes) {
    pushPassive('[Notas do Mestre]', String(creature.narratorNotes));
  }

  // ── Ações como Spells (rolagem individual no AttackPanel) ───────────────────
  const nextSpells: Spell[] = [];
  for (const act of creature.actions?.list ?? []) {
    if (!act?.name) continue;
    const dmg = act.damage ?? {};
    const damageType = dmgIdFromName(dmg.type);
    const attackTypeKey = normalizedKey(act.attackType);
    const actionTypeKey = normalizedKey(act.type);
    const targetMode = TARGET_MODE_MAP[attackTypeKey] ?? 'single_atk';
    // Apenas-efeito (suporte ou noDamage=true) vira buff; demais viram damage.
    const effectOnly = attackTypeKey === 'suporte' || act.noDamage === true;
    const spellType: Spell['spellType'] = effectOnly ? 'buff' : 'damage';
    const actionType: Spell['actionType'] = ACTION_TYPE_TO_SPELL[actionTypeKey] ?? 'action';
    // Bug #5 fix: runtime grava `condition` singular; aceita ambos por compat
    const rawConds: any[] = Array.isArray(act.conditions)
      ? act.conditions
      : (act.condition && act.condition.tier && act.condition.tier !== "nenhuma" ? [act.condition] : []);
    const spellConditions: SpellCondition[] = rawConds
      .filter((c: any) => c?.name || c?.id || c?.nameKey)
      .map((c: any) => {
        const requestedMode = (c.durationMode === 'tr_todo_round' || c.durationMode === 'ate_passar_tr' || c.durationMode === 'ate_acabar')
          ? c.durationMode
          : 'ate_acabar';
        const conditionId = conditionIdFromName(c.id || c.name || c.nameKey);
        const usesEndTR = requestedMode === 'tr_todo_round' || requestedMode === 'ate_passar_tr';
        const expiry = normalizeConditionExpiry({
          conditionId,
          durationMode: requestedMode,
          endCD: usesEndTR && typeof act.cd === 'number' ? act.cd : undefined,
          endTrType: usesEndTR ? (c.removeTrType || c.applyTrType || act.trType) || undefined : undefined,
        });
        const mode = expiry.durationMode ?? requestedMode;
        const turns = typeof c.durationTurns === 'number' && c.durationTurns > 0 ? c.durationTurns : 1;
        return {
          conditionId,
          durationTurns: mode === 'ate_passar_tr' ? 0 : turns,
          durationRounds: typeof c.durationRounds === 'number' ? c.durationRounds : 0,
          durationMode: mode,
          endCD: expiry.endCD,
          endTrType: expiry.endTrType,
          applyTrType: c.applyTrType || undefined,
        };
      });
    // Para TR em Área, anexa "Área: <Forma> (<N>m[ x 1.5m])" na descrição,
    // formato esperado por getAoEFromSpell para abrir o template no mapa.
    let finalDescription = act.description ?? '';
    if (attackTypeKey === 'tr_area') {
      const shapeLabelMap: Record<string, string> = {
        circle: 'Esfera', square: 'Cubo', cone: 'Cone', cone_attached: 'Cone Aderente', line: 'Linha', line_attached: 'Linha Aderente',
      };
      const shapeKey = String(act.areaShape ?? 'circle').toLowerCase();
      const shapeLabel = shapeLabelMap[shapeKey] ?? 'Esfera';
      const areaNum = parseFloat(String(act.area ?? '').replace(',', '.').match(/[\d.]+/)?.[0] ?? '0');
      if (areaNum > 0) {
        const lineWidth = Number(act.lineWidth) > 0 ? Number(act.lineWidth) : 1.5;
        const sizeStr = (shapeKey === 'line' || shapeKey === 'line_attached')
          ? `${areaNum}m x ${lineWidth}m`
          : `${areaNum}m`;
        const areaLine = `Área: ${shapeLabel} (${sizeStr})`;
        finalDescription = finalDescription
          ? `${finalDescription}\n${areaLine}`
          : areaLine;
      }
    }
    // Separa "XdY+N" (formato do grimório) em damageDice="XdY" + fixedDamage=N,
    // para que as regex de bônus de técnica (Encadeada/Máxima/Focada) reconheçam
    // o lado sólido e o "+N" não seja contado em dobro.
    const rawRoll = typeof dmg.roll === 'string' ? dmg.roll.trim() : '';
    const rollMatch = rawRoll.match(/^(\d+d\d+)\s*([+-]\s*\d+)?$/i);
    const damageDiceClean = rollMatch ? rollMatch[1] : rawRoll;
    const fixedDamageFromRoll = rollMatch && rollMatch[2]
      ? parseInt(rollMatch[2].replace(/\s+/g, ''), 10) || 0
      : 0;
    // Buff de Ação Bônus/Reação do grimório: se efeito for "area" ou "range",
    // propaga como SpellBuff (spellArea/spellRange) — assim, aumenta a área/alcance
    // dos PRÓXIMOS feitiços do conjurador enquanto durar.
    const builtSpellBuffs: any[] = [];
    if (effectOnly && act.buff && typeof act.buff === 'object') {
      const eff = String(act.buff.effect ?? '').toLowerCase();
      const rawVal = act.buff.customValue ?? act.buff.value;
      const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal ?? ''));
      if ((eff === 'area' || eff === 'range') && Number.isFinite(numVal) && numVal !== 0) {
        builtSpellBuffs.push({
          type: eff === 'area' ? 'spellArea' : 'spellRange',
          value: numVal,
          durationTurns: 1, // tabela do grimório: dura até o fim da rodada
        });
      }
    }
    nextSpells.push({
      id: crypto.randomUUID(),
      name: act.name,
      costPE: nonNegativeNumber(act.cost, 0),
      description: finalDescription,
      damageDice: damageDiceClean,
      damageBonus: 0,
      fixedDamage: fixedDamageFromRoll,
      spellType,
      actionType,
      damageType,
      buffs: builtSpellBuffs,
      conditions: spellConditions,
      spellLevel: '1',
      durationRounds: 0,
      range: act.range || '',
      targetMode,
      bonusDC: typeof act.cd === 'number' ? act.cd : undefined,
      saveAttr: SAVE_KEY_TO_TR_NAME[normalizedKey(act.trType)] ?? undefined,
      persistentArea: act.persistentArea && act.persistentArea.enabled
        ? {
            enabled: true,
            durationTurns: Math.max(1, Math.min(99, Number(act.persistentArea.durationTurns) || 3)),
            effectMode: ['dano','condicao','ambos'].includes(act.persistentArea.effectMode) ? act.persistentArea.effectMode : 'ambos',
            applyOnEnter: act.persistentArea.applyOnEnter !== false,
            applyOnTurn: act.persistentArea.applyOnTurn !== false,
            trMode: ['uma_vez','todo_round','todo_turno'].includes(act.persistentArea.trMode) ? act.persistentArea.trMode : 'todo_turno',
            residual: {
              mode: act.persistentArea.residual?.mode === 'manter_turnos' ? 'manter_turnos' : 'nenhum',
              turns: Math.max(1, Math.min(20, Number(act.persistentArea.residual?.turns) || 1)),
              keepDamage: !!act.persistentArea.residual?.keepDamage,
              keepCondition: act.persistentArea.residual?.keepCondition !== false,
            },
          }
        : undefined,
    });
  }

  // Bug #22 fix: usar mediana dos `toHit` evita uma ação outlier inflar o bônus
  // genérico da ficha. Ações específicas continuam expostas como Spells.
  const toHitList = (creature.actions?.list ?? [])
    .map((a: any) => (typeof a.toHit === 'number' && Number.isFinite(a.toHit) ? a.toHit : 0))
    .filter((v: number) => v > 0)
    .sort((a: number, b: number) => a - b);
  const medianToHit = toHitList.length === 0
    ? 0
    : toHitList.length % 2 === 1
      ? toHitList[(toHitList.length - 1) >> 1]
      : Math.round((toHitList[toHitList.length / 2 - 1] + toHitList[toHitList.length / 2]) / 2);

  // ── Aptidões numéricas ──────────────────────────────────────────────────────
  const cursedApt: CursedAptitudesState = createDefaultCursedAptitudes();
  for (const [k, v] of Object.entries(creature.aptidoes ?? {})) {
    const key = APT_KEY_MAP[normalizedKey(k)];
    if (key && typeof v === 'number') {
      cursedApt[key] = Math.max(0, Math.min(5, v));
    }
  }

  // ── Classe e origem ─────────────────────────────────────────────────────────
  const originType = normalizedKey(core.origin?.type);
  const characterClass: CharacterClass | undefined =
    originType === 'maldicao' ? 'Maldição' :
    originType === 'feiticeiro' ? 'Feiticeiro' :
    originType ? 'Não-Feiticeiro' : undefined;

  // ── HP/PE — preserva combatState quando disponível ──────────────────────────
  const hpMax = nonNegativeNumber(stats.hpMax, current.hpMax);
  const peMax = nonNegativeNumber(stats.peMax, current.peMax);
  const cs = creature.combatState ?? {};
  const hpCurrent = currentOrMax(cs.hpCurrent, hpMax);
  const peCurrent = currentOrMax(cs.peCurrent, peMax);

  // ── CD base e atributo-chave da CD ──────────────────────────────────────────
  const baseDC = finiteNumber(stats.cdBase, current.baseDC);
  const cdAttrKey = normalizedKey(creature.cdAttr);
  const dcLinkedAttrId = cdAttrKey
    ? (attrIdByName.get(ATTR_MAP[cdAttrKey]) ?? current.dcLinkedAttr)
    : current.dcLinkedAttr;

  const patch: Partial<Character> = {
    __allowEnemyLevelUpdate: true,
    isGrimorioCreature: true,
    level,
    hiddenFromPlayers: true,
    hpMax, hpCurrent,
    peMax, peCurrent,
    hpStartingBase: hpMax,
    peStartingBase: peMax,
    levelHistory: [],
    ca: finiteNumber(stats.defesa, current.ca),
    baseDC,
    dcLinkedAttr: dcLinkedAttrId,
    rd: nonNegativeNumber(stats.rdGeral, 0),
    movement: nonNegativeNumber(stats.deslocamento, current.movement),
    // Bug #21 fix: iniciativa/atenção nunca negativas (Lacaio iniciativa = modDex pode ser -)
    initiativeBonus: Math.max(0, finiteNumber(stats.iniciativa, 0)),
    attention: Math.max(0, finiteNumber(stats.atencao, 0)),
    customHitBonus: medianToHit,
    actionsMax: Math.min(2, nonNegativeNumber(totalActions.comum, 1)),
    actionsCurrent: Math.min(2, nonNegativeNumber(totalActions.comum, 1)),
    bonusActionsMax: nonNegativeNumber(totalActions.bonus, 1),
    bonusActionsCurrent: nonNegativeNumber(totalActions.bonus, 1),
    reactionsMax: nonNegativeNumber(totalActions.reacao, 1),
    reactionsCurrent: nonNegativeNumber(totalActions.reacao, 1),
    opportunityMax: 0,
    opportunityCurrent: 0,
    attributes: nextAttributes,
    savingThrows: nextSaves,
    skills: nextSkills,
    passives: nextPassives,
    spells: nextSpells,
    vulnerabilities: vulnIds,
    immunities: immIds,
    cursedAptitudes: cursedApt,
    // Snapshots idempotentes resetados (próximo recalc parte limpo)
    __anatomyAppliedSnapshot: undefined,
    __cursedExclusiveAppliedSnapshot: undefined,
    __dotesAppliedSnapshot: undefined,
  } as any;

  if (characterClass) patch.characterClass = characterClass;
  // Bug #12 fix: "Aumento de Energia" não é "Energia Reversa" — não atribuir.
  // O bônus de PE adicional deve vir via calculatePE quando suportado.
  // (atribuição errada `patch.hasEnergiaReversa = true` removida)
  const sizeCat = SIZE_MAP[normalizedKey(core.size)];
  if (sizeCat) patch.sizeCategory = sizeCat;

  return patch;
}

// ── Entry point ────────────────────────────────────────────────────────────────

/**
 * Aplica HP/PE em segundo passe SEM `attributes` para escapar do recálculo
 * automático do store (que sobrescreveria os valores grandes da criatura).
 */
function applyHpPeOverride(id: string, creature: Creature, fallback: Character) {
  const store = useCharacterStore.getState();
  const stats = creature.stats ?? {};
  const cs = creature.combatState ?? {};
  const hpMax = nonNegativeNumber(stats.hpMax, fallback.hpMax);
  const peMax = nonNegativeNumber(stats.peMax, fallback.peMax);
  store.updateCharacter(id, {
    hpMax, peMax,
    hpCurrent: currentOrMax(cs.hpCurrent, hpMax),
    peCurrent: currentOrMax(cs.peCurrent, peMax),
    hpStartingBase: hpMax,
    peStartingBase: peMax,
  });
}

export function importCreatureToFichas(
  creature: Creature,
): { id: string; created: boolean } | null {
  const store = useCharacterStore.getState();
  const baseName = (creature?.name?.trim()) || 'Inimigo';

  // Update existing (vínculo prévio)
  if (creature.linkedFichaId) {
    const existing = store.characters.find((c) => c.id === creature.linkedFichaId);
    if (existing) {
      store.updateCharacter(existing.id, buildPatch(creature, existing));
      applyHpPeOverride(existing.id, creature, existing);
      return { id: existing.id, created: false };
    }
  }

  // Nome único
  let finalName = baseName;
  let n = 2;
  while (store.isNameTaken(finalName)) finalName = `${baseName} (${n++})`;

  // Track ids antes/depois (mais robusto que buscar por nome)
  const idsBefore = new Set(store.characters.map((c) => c.id));
  store.addCharacter(finalName, 'INIMIGO', 'MASTER');
  const created = useCharacterStore.getState().characters.find((c) => !idsBefore.has(c.id));
  if (!created) return null;

  store.updateCharacter(created.id, buildPatch(creature, created));
  applyHpPeOverride(created.id, creature, created);
  return { id: created.id, created: true };
}
