/**
 * 🎲 Sistema Omni de Vantagem / Desvantagem em rolagens.
 *
 * Permite que ações Omni concedam vantagem ou desvantagem em escopos variados
 * (próxima rolagem qualquer, próximo ataque, próximo TR, próxima perícia,
 * categoria de ataque CaC/Distância/Amaldiçoado, atributo específico,
 * perícia específica, TR específico, ou "até fim do turno").
 *
 * Persistência: armazenado em `Character.omniFlags` para não exigir mudança
 * de schema. Cada modificador é uma chave `omniFlags['__advmod__:<id>']`
 * cujo valor é um JSON serializado com `{kind, scope, target?, expiresAt}`.
 *
 * Consumo: chamadas a `consumeAdvantageFor()` resolvem a melhor combinação
 * (vantagem + desvantagem cancelam) e removem mods de escopo "uma vez".
 *
 * Expiração: `expireEndOfTurnFor()` é chamado pelo emissor `noFimDoTurno`
 * para limpar os modificadores de escopo turno.
 */
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';

// ─── Modelo ────────────────────────────────────────────────────────────
export type AdvKind = 'advantage' | 'disadvantage';

/** Escopo de aplicação. Determina QUAIS rolagens consomem o modificador. */
export type AdvScope =
  // Casts gerais
  | 'next_any'              // próxima rolagem qualquer (1 uso)
  | 'next_attack'           // próximo ataque (qualquer tipo) — 1 uso
  | 'next_save'             // próximo TR — 1 uso
  | 'next_skill'            // próxima perícia — 1 uso
  | 'next_attribute'        // próximo teste de atributo puro — 1 uso
  // Específicos por categoria de ataque
  | 'attack_melee'          // todos os ataques CaC enquanto ativo
  | 'attack_ranged'         // todos os ataques à Distância enquanto ativo
  | 'attack_cursed'         // todos os ataques Amaldiçoados enquanto ativo
  | 'attack_all'            // todos os ataques enquanto ativo
  // Específicos com TARGET (target = id ou nome do alvo)
  | 'save_specific'         // TR específico (target = nome do TR, ex: "Reflexos")
  | 'skill_specific'        // perícia específica (target = nome)
  | 'attribute_specific'    // atributo específico (target = "FOR", "DES", etc)
  | 'attack_weapon_group'   // ataques com armas de um grupo (target = "Machado", "Espada", etc)
  | 'attack_weapon_name';   // ataques com uma arma específica (target = nome da arma)

export interface AdvModifier {
  id: string;
  kind: AdvKind;
  scope: AdvScope;
  /** Para *_specific: alvo (nome de TR/perícia/atributo). Comparado lowercase. */
  target?: string;
  /** Marcador de expiração: 'turn' = limpa no fim do turno; 'use' = consumido na 1ª rolagem aplicável. */
  expires: 'turn' | 'use' | 'persistent';
  /** Origem para log. */
  source?: string;
  /** charId de quem concedeu (ex: Apoiar do Suporte) — usado para expirar
   *  o efeito no início do próximo turno do concedente. */
  grantedBy?: string;
  /** Bônus fixo (ex: Apoio Focado do Suporte). Mods com `bonus` NÃO contam
   *  como vantagem/desvantagem — são somados ao total da rolagem. */
  bonus?: number;
}

const PREFIX = '__advmod__:';

// ─── Persistência via omniFlags ────────────────────────────────────────
// `omniFlags` é Record<string, number>; serializamos JSON em chaves separadas
// guardando o JSON num REGISTRY paralelo dentro do próprio personagem
// (`omniFlags` recebe apenas o "marcador" 1; o JSON vive em uma nova chave
// no objeto plano do personagem: `omniAdvMods`).

declare module '@/types' {
  interface CharacterExtras {
    omniAdvMods?: Record<string, AdvModifier>;
  }
}

function readMods(c: Character): Record<string, AdvModifier> {
  return ((c as unknown as { omniAdvMods?: Record<string, AdvModifier> }).omniAdvMods) ?? {};
}

function writeMods(charId: string, mods: Record<string, AdvModifier>): void {
  const flags = { ...((useCharacterStore.getState().characters.find(x => x.id === charId)?.omniFlags) ?? {}) };
  // Mantém um contador agregado em omniFlags pra fácil inspeção via UI/Omni.
  const adv = Object.values(mods).filter(m => m.kind === 'advantage').length;
  const dis = Object.values(mods).filter(m => m.kind === 'disadvantage').length;
  flags[`${PREFIX}adv`] = adv;
  flags[`${PREFIX}dis`] = dis;
  useCharacterStore.getState().updateCharacter(charId, {
    omniFlags: flags,
    // @ts-expect-error — campo extra persistido fora do tipo público.
    omniAdvMods: mods,
  });
}

// ─── API pública ───────────────────────────────────────────────────────
export function grantAdvantage(
  charId: string,
  kind: AdvKind,
  scope: AdvScope,
  opts: { target?: string; expires?: 'turn' | 'use' | 'persistent'; source?: string; grantedBy?: string } = {},
): string {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return '';
  const mods = { ...readMods(c) };
  // Default expires: scopes "next_*" → 'use'; "attack_*" / "*_specific" → 'turn'.
  const defExp: 'use' | 'turn' = scope.startsWith('next_') ? 'use' : 'turn';
  const id = `${kind}-${scope}-${opts.target ?? 'any'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  mods[id] = {
    id, kind, scope,
    target: opts.target?.toLowerCase(),
    expires: opts.expires ?? defExp,
    source: opts.source,
    grantedBy: opts.grantedBy,
  };
  writeMods(charId, mods);
  return id;
}

/** Remove, em TODOS os personagens, os modificadores concedidos por `grantorId`.
 *  Usado pelo Apoiar (Suporte): o efeito expira no início do próximo turno
 *  de quem apoiou. */
export function expireGrantedBy(grantorId: string): void {
  const chars = useCharacterStore.getState().characters;
  for (const c of chars) {
    const mods = readMods(c);
    const ids = Object.values(mods).filter(m => m.grantedBy === grantorId).map(m => m.id);
    if (ids.length === 0) continue;
    const remaining = { ...mods };
    for (const id of ids) delete remaining[id];
    writeMods(c.id, remaining);
  }
}

export function clearAllAdvantage(charId: string): void {
  writeMods(charId, {});
}

/** Limpa todos os modificadores cujo escopo expira no fim do turno. */
export function expireEndOfTurnFor(charId: string): void {
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

// ─── Resolução por contexto de rolagem ─────────────────────────────────
export type RollContext =
  | { kind: 'attack'; subtype: 'melee' | 'ranged' | 'cursed'; weaponGroup?: string; weaponName?: string }
  | { kind: 'save'; name: string }      // ex: "Reflexos"
  | { kind: 'skill'; name: string }     // ex: "Furtividade"
  | { kind: 'attribute'; name: string } // ex: "FOR"
  | { kind: 'any' };                    // dado avulso

interface ResolveResult {
  net: 'advantage' | 'disadvantage' | 'normal';
  /** IDs de modificadores consumíveis (escopo 'use') que devem ser removidos. */
  consumedIds: string[];
  /** Notas para log (descrição das fontes). */
  notes: string[];
}

function matchesScope(m: AdvModifier, ctx: RollContext): boolean {
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

/** Consulta + consumo. Use em qualquer ponto onde uma rolagem ocorre. */
export function consumeAdvantageFor(charId: string, ctx: RollContext, extra: { advantage?: boolean; disadvantage?: boolean } = {}): ResolveResult {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return { net: 'normal', consumedIds: [], notes: [] };
  const mods = readMods(c);
  const matches: AdvModifier[] = Object.values(mods).filter(m => matchesScope(m, ctx) && m.bonus == null);
  const advCount = matches.filter(m => m.kind === 'advantage').length + (extra.advantage ? 1 : 0);
  const disCount = matches.filter(m => m.kind === 'disadvantage').length + (extra.disadvantage ? 1 : 0);
  let net: ResolveResult['net'] = 'normal';
  if (advCount > 0 && disCount === 0) net = 'advantage';
  else if (disCount > 0 && advCount === 0) net = 'disadvantage';
  // (vantagem e desvantagem se cancelam mutuamente — regra padrão)

  const consumedIds = matches.filter(m => m.expires === 'use').map(m => m.id);
  if (consumedIds.length > 0) {
    const remaining = { ...mods };
    for (const id of consumedIds) delete remaining[id];
    writeMods(charId, remaining);
  }
  const notes = matches.map(m =>
    `${m.kind === 'advantage' ? '🟢 vantagem' : '🔴 desvantagem'} (${m.scope}${m.target ? `:${m.target}` : ''}${m.source ? ` · ${m.source}` : ''})`
  );
  return { net, consumedIds, notes };
}

/** Apenas inspeção (sem consumir) — útil pra UI mostrar badge. */
export function peekAdvantageFor(charId: string, ctx: RollContext): ResolveResult['net'] {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return 'normal';
  const mods = readMods(c);
  const matches = Object.values(mods).filter(m => matchesScope(m, ctx) && m.bonus == null);
  if (matches.length === 0) return 'normal';
  const adv = matches.some(m => m.kind === 'advantage');
  const dis = matches.some(m => m.kind === 'disadvantage');
  if (adv && !dis) return 'advantage';
  if (dis && !adv) return 'disadvantage';
  return 'normal';
}

// ─── Bônus fixo em rolagens (ex: Apoio Focado do Suporte) ───────────────

/** Concede um bônus fixo (não é vantagem) no escopo indicado. */
export function grantFlatBonus(
  charId: string,
  scope: AdvScope,
  bonus: number,
  opts: { target?: string; expires?: 'turn' | 'use' | 'persistent'; source?: string; grantedBy?: string } = {},
): string {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return '';
  const mods = { ...readMods(c) };
  const id = `flat-${scope}-${opts.target ?? 'any'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  mods[id] = {
    id,
    kind: 'advantage', // placeholder — mods com `bonus` não entram na contagem de vantagem
    scope,
    target: opts.target?.toLowerCase(),
    expires: opts.expires ?? 'use',
    source: opts.source,
    grantedBy: opts.grantedBy,
    bonus,
  };
  writeMods(charId, mods);
  return id;
}

/** Resolve e consome os bônus fixos aplicáveis ao contexto. */
export function consumeFlatBonusFor(charId: string, ctx: RollContext): { bonus: number; notes: string[] } {
  const c = useCharacterStore.getState().characters.find(x => x.id === charId);
  if (!c) return { bonus: 0, notes: [] };
  const mods = readMods(c);
  const matches = Object.values(mods).filter(m => m.bonus != null && matchesScope(m, ctx));
  if (matches.length === 0) return { bonus: 0, notes: [] };
  const consumedIds = matches.filter(m => m.expires === 'use').map(m => m.id);
  if (consumedIds.length > 0) {
    const remaining = { ...mods };
    for (const id of consumedIds) delete remaining[id];
    writeMods(charId, remaining);
  }
  // Todos os bônus positivos que alcançam o mesmo teste concorrem na mesma
  // categoria; aplica-se somente o maior. Penalidades não são bônus e seguem
  // somadas. Os efeitos de uso único correspondentes são consumidos juntos,
  // mesmo quando um bônus maior prevalece.
  const maiorBonus = Math.max(0, ...matches.map((m) => m.bonus ?? 0));
  let bonusPositivoAplicado = false;
  const bonus = matches.reduce((total, modifier) => {
    const value = modifier.bonus ?? 0;
    if (value < 0) return total + value;
    if (value > 0 && !bonusPositivoAplicado && value === maiorBonus) {
      bonusPositivoAplicado = true;
      return total + value;
    }
    return total;
  }, 0);
  const indexBonusAplicado = matches.findIndex((m) => (m.bonus ?? 0) > 0 && m.bonus === maiorBonus);
  return {
    bonus,
    notes: matches.map((m, index) => {
      const value = m.bonus ?? 0;
      const aplicado = value < 0 || index === indexBonusAplicado;
      const detalhe = `${value >= 0 ? '+' : ''}${value} (${m.scope}${m.source ? ` · ${m.source}` : ''})`;
      return aplicado ? `➕ ${detalhe}` : `↳ ${detalhe} — não acumula com o maior bônus`;
    }),
  };
}

/** Helper para handlers de rolagem: aplica vantagem/desvantagem rolando 2d20. */
export async function applyAdvantageToD20(
  net: 'advantage' | 'disadvantage' | 'normal',
  rollOnce: () => number | Promise<number>,
): Promise<{ d20: number; rolls: number[]; modeLabel: string }> {
  if (net === 'normal') {
    const d = await rollOnce();
    return { d20: d, rolls: [d], modeLabel: '' };
  }
  const a = await rollOnce();
  const b = await rollOnce();
  if (net === 'advantage') {
    return { d20: Math.max(a, b), rolls: [a, b], modeLabel: ` [Vantagem 2d20(${a},${b})→${Math.max(a, b)}]` };
  }
  return { d20: Math.min(a, b), rolls: [a, b], modeLabel: ` [Desvantagem 2d20(${a},${b})→${Math.min(a, b)}]` };
}
