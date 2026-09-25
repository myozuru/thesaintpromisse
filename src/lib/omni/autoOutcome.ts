/**
 * 🎯 Sistema Omni de SUCESSO / FALHA GARANTIDO em testes (d20).
 *
 * Análogo a `rollAdvantage`, mas em vez de modificar a rolagem (vantagem/
 * desvantagem) FORÇA o resultado: a rolagem é dispensada e o teste
 * é resolvido como sucesso (ou falha) sem rolar — útil para habilidades
 * tipo "passa automaticamente no próximo TR de Vontade", "garante 1
 * sucesso em qualquer perícia esta cena", "falha automática no próximo
 * TR" etc.
 *
 * Escopos espelham os de rollAdvantage. Persistido em `omniAutoOutcomes`
 * dentro do Character, com contadores agregados em omniFlags.
 *
 * Uso:
 *   grantAutoOutcome(charId, 'success', 'next_save', { source: 'Talento X' });
 *   grantAutoOutcome(charId, 'success', 'save_specific', { target: 'Vontade', expires: 'turn' });
 *   grantAutoOutcome(charId, 'failure', 'next_any');  // ex.: efeito de medo
 *
 * Quantidades: para "garante N sucessos", basta chamar `grantAutoOutcome`
 * N vezes com escopo apropriado — cada uso 'use' consome 1.
 */
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';

export type AutoOutcomeKind = 'success' | 'failure';

// Reaproveita o vocabulário de escopos do rollAdvantage.
export type AutoOutcomeScope =
  | 'next_any'
  | 'next_attack'
  | 'next_save'
  | 'next_skill'
  | 'next_attribute'
  | 'attack_all'
  | 'attack_melee'
  | 'attack_ranged'
  | 'attack_cursed'
  | 'save_specific'
  | 'skill_specific'
  | 'attribute_specific'
  | 'attack_weapon_group'
  | 'attack_weapon_name';

export interface AutoOutcomeModifier {
  id: string;
  kind: AutoOutcomeKind;
  scope: AutoOutcomeScope;
  /** Para *_specific: alvo (nome de TR/perícia/atributo). Comparado lowercase. */
  target?: string;
  /** 'use' = consumido na 1ª rolagem aplicável; 'turn' = expira no fim do turno; 'persistent' = manual. */
  expires: 'turn' | 'use' | 'persistent';
  source?: string;
}

const PREFIX = '__autoout__:';

declare module '@/types' {
  interface CharacterExtras {
    omniAutoOutcomes?: Record<string, AutoOutcomeModifier>;
  }
}

function readMods(c: Character): Record<string, AutoOutcomeModifier> {
  return ((c as unknown as { omniAutoOutcomes?: Record<string, AutoOutcomeModifier> }).omniAutoOutcomes) ?? {};
}

function writeMods(charId: string, mods: Record<string, AutoOutcomeModifier>): void {
  const flags = { ...((useCharacterStore.getState().characters.find(x => x.id === charId)?.omniFlags) ?? {}) };
  const succ = Object.values(mods).filter(m => m.kind === 'success').length;
  const fail = Object.values(mods).filter(m => m.kind === 'failure').length;
  flags[`${PREFIX}success`] = succ;
  flags[`${PREFIX}failure`] = fail;
  useCharacterStore.getState().updateCharacter(charId, {
    omniFlags: flags,
    // @ts-expect-error — campo extra persistido fora do tipo público.
    omniAutoOutcomes: mods,
  });
}

// ─── Contexto (espelha RollContext de rollAdvantage) ──────────────────
export type OutcomeContext =
  | { kind: 'attack'; subtype: 'melee' | 'ranged' | 'cursed'; weaponGroup?: string; weaponName?: string }
  | { kind: 'save'; name: string }
  | { kind: 'skill'; name: string }
  | { kind: 'attribute'; name: string }
  | { kind: 'any' };

function matchesScope(m: AutoOutcomeModifier, ctx: OutcomeContext): boolean {
  switch (m.scope) {
    case 'next_any': return true;
    case 'next_attack': return ctx.kind === 'attack';
    case 'next_save': return ctx.kind === 'save';
    case 'next_skill': return ctx.kind === 'skill';
    case 'next_attribute': return ctx.kind === 'attribute';
    case 'attack_all': return ctx.kind === 'attack';
    case 'attack_melee': return ctx.kind === 'attack' && ctx.subtype === 'melee';
    case 'attack_ranged': return ctx.kind === 'attack' && ctx.subtype === 'ranged';
    case 'attack_cursed': return ctx.kind === 'attack' && ctx.subtype === 'cursed';
    case 'save_specific':
      return ctx.kind === 'save' && (m.target ?? '') === ctx.name.toLowerCase();
    case 'skill_specific':
      return ctx.kind === 'skill' && (m.target ?? '') === ctx.name.toLowerCase();
    case 'attribute_specific':
      return ctx.kind === 'attribute' && (m.target ?? '') === ctx.name.toLowerCase();
    case 'attack_weapon_group':
      return ctx.kind === 'attack' && (m.target ?? '') === (ctx.weaponGroup ?? '').toLowerCase();
    case 'attack_weapon_name':
      return ctx.kind === 'attack' && (m.target ?? '') === (ctx.weaponName ?? '').toLowerCase();
  }
}

export function grantAutoOutcome(
  charId: string,
  kind: AutoOutcomeKind,
  scope: AutoOutcomeScope,
  opts: { target?: string; expires?: 'turn' | 'use' | 'persistent'; source?: string } = {},
): string {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return '';
  const mods = { ...readMods(c) };
  const defExp: 'use' | 'turn' = scope.startsWith('next_') ? 'use' : 'turn';
  const id = `${kind}-${scope}-${opts.target ?? 'any'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  mods[id] = {
    id, kind, scope,
    target: opts.target?.toLowerCase(),
    expires: opts.expires ?? defExp,
    source: opts.source,
  };
  writeMods(charId, mods);
  return id;
}

export function clearAllAutoOutcomes(charId: string): void {
  writeMods(charId, {});
}

export function expireAutoOutcomesEndOfTurnFor(charId: string): void {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return;
  const mods = { ...readMods(c) };
  let changed = false;
  for (const [id, m] of Object.entries(mods)) {
    if (m.expires === 'turn') {
      delete mods[id];
      changed = true;
    }
  }
  if (changed) writeMods(charId, mods);
}

interface ResolveResult {
  outcome: AutoOutcomeKind | null;
  /** Modificador escolhido (apenas o primeiro aplicável). */
  consumedId?: string;
  /** Notas para log (descrição da fonte). */
  note?: string;
}

/** Consulta + consumo de UM modificador aplicável. Sucesso prevalece sobre falha. */
export function consumeAutoOutcomeFor(charId: string, ctx: OutcomeContext): ResolveResult {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return { outcome: null };
  const mods = readMods(c);
  const matches = Object.values(mods).filter(m => matchesScope(m, ctx));
  if (matches.length === 0) return { outcome: null };
  // Sucesso prevalece (player-friendly). Se alguém quiser falha forçada
  // sem sucesso disponível, a única match será de falha.
  const chosen = matches.find(m => m.kind === 'success') ?? matches[0];
  if (chosen.expires === 'use') {
    const remaining = { ...mods };
    delete remaining[chosen.id];
    writeMods(charId, remaining);
  }
  return {
    outcome: chosen.kind,
    consumedId: chosen.id,
    note: `${chosen.kind === 'success' ? '✨ Sucesso garantido' : '💀 Falha garantida'} (${chosen.scope}${chosen.target ? `:${chosen.target}` : ''}${chosen.source ? ` · ${chosen.source}` : ''})`,
  };
}

/** Apenas inspeção (sem consumir). */
export function peekAutoOutcomeFor(charId: string, ctx: OutcomeContext): AutoOutcomeKind | null {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return null;
  const mods = readMods(c);
  const matches = Object.values(mods).filter(m => matchesScope(m, ctx));
  if (matches.length === 0) return null;
  if (matches.some(m => m.kind === 'success')) return 'success';
  return 'failure';
}
