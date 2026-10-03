/**
 * 🌉 OmniBridge — Ponte de chaves entre o effectEngine (Omni-Script) e o
 * estado real do `Character` (useCharacterStore).
 *
 * Esta camada:
 *  1. **Mapeia chaves** semânticas (`vida_max`, `pericia_feiticaria`, `treino`,
 *     `defesa`, …) → caminho real dentro do `Character`. Aceita variações
 *     de escrita (camelCase, snake_case, com/sem acento).
 *  2. **Lê valores base** com `resolveOmniKey(character, "treino") → number`,
 *     reaproveitando a projeção já usada pelo parser
 *     (`projetarPersonagemParaOmni` + `montarVariaveisDoPersonagem`).
 *  3. **Calcula modificadores** de itens equipados como **estado derivado**
 *     (sem mutar o store) através de `selectOmniModifiers(...)`. Cada
 *     fórmula de cada acessório é avaliada com o valor *atual* do
 *     personagem, então qualquer mudança em `attributes`, `level` ou
 *     `inventoryItems` recalcula automaticamente o mapa de modificadores
 *     na próxima renderização.
 *
 * Filosofia: NÃO sobrescrevemos o `valorBase` da ficha. Os componentes
 * visuais somam `valorBase + modifiers[chave]` na renderização. Assim,
 * desequipar um item remove o modificador instantaneamente — sem
 * "limpeza" manual, sem dessincronização possível.
 */
import type { Character } from '@/types';
import type { EntidadeOmni } from './tipos';
import { normalizarCombatData } from './tipos';
import {
  montarVariaveisDoPersonagem,
  lerCaminhoOmni,
  projetarPersonagemParaOmni,
} from './resolvedor';
import { avaliarFormula } from './parser';
import { derivarBonusEquipadoDosEfeitos } from './derivarBonusEquipado';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Key Mapper
// ─────────────────────────────────────────────────────────────────────────────

/** Chaves "passivas" oficialmente reconhecidas pela ficha (acessórios). */
export type OmniBonusKey = 'hp' | 'pe' | 'ca' | 'rd' | 'esc' | 'slots';
export type OmniRollBonusKey = 'integridade' | 'vontade' | 'fortitude' | 'reflexos' | 'astucia';

/**
 * Normaliza qualquer chave/recurso escrito pelo Mestre em uma string
 * canônica (lowercase, snake_case, sem acento, sem prefixo `@USUARIO.`).
 */
function normalizarChaveOmni(raw: string): string {
  return raw
    .replace(/^@?(usuario|alvo|cena|area)\./i, '')
    .replace(/^@/, '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s.-]/g, '_');
}

/**
 * Mapa de aliases → caminho na projeção `projetarPersonagemParaOmni`.
 * Usado por `resolveOmniKey` para localizar o valor base em O(1).
 *
 * Quando a chave normalizada começa com `pericia_`, usamos o
 * fallback dinâmico `pericias.<sufixo>`.
 */
const ALIAS_PARA_CAMINHO: Record<string, string> = {
  // Atributos (6 oficiais da ficha)
  forca: 'atributos.forca',
  destreza: 'atributos.destreza',
  constituicao: 'atributos.constituicao',
  inteligencia: 'atributos.inteligencia',
  sabedoria: 'atributos.sabedoria',
  presenca: 'atributos.presenca',
  carisma: 'atributos.presenca', // alias D&D
  for: 'atributos.forca',
  des: 'atributos.destreza',
  con: 'atributos.constituicao',
  int: 'atributos.inteligencia',
  sab: 'atributos.sabedoria',
  pre: 'atributos.presenca',

  // Testes de Resistência (5 TR canônicos — NÃO são atributos)
  astucia: 'tr.astucia',
  vontade: 'tr.vontade',
  fortitude: 'tr.fortitude',
  integridade: 'tr.integridade',
  reflexos: 'tr.reflexos',
  ast: 'tr.astucia',
  von: 'tr.vontade',
  for_tr: 'tr.fortitude',
  int_tr: 'tr.integridade',
  ref: 'tr.reflexos',
  // aliases com prefixo "tr."
  'tr_astucia': 'tr.astucia',
  'tr_vontade': 'tr.vontade',
  'tr_fortitude': 'tr.fortitude',
  'tr_integridade': 'tr.integridade',
  'tr_reflexos': 'tr.reflexos',

  // Status / recursos
  vida: 'status.vida.atual',
  vida_atual: 'status.vida.atual',
  hp: 'status.vida.atual',
  vida_max: 'status.vida.max',
  hp_max: 'status.vida.max',
  pe: 'status.energiaAmaldicoada.atual',
  energia: 'status.energiaAmaldicoada.atual',
  energia_atual: 'status.energiaAmaldicoada.atual',
  energia_amaldicoada: 'status.energiaAmaldicoada.atual',
  pe_max: 'status.energiaAmaldicoada.max',
  energia_max: 'status.energiaAmaldicoada.max',
  energia_amaldicoada_max: 'status.energiaAmaldicoada.max',

  defesa: 'status.defesa',
  ca: 'status.defesa',
  deslocamento: 'status.deslocamento',
  treino: 'status.bonusTreinamento',
  bonus_treinamento: 'status.bonusTreinamento',
  nivel: 'status.nivel',
  level: 'status.nivel',
  exaustao: 'status.nivelExaustao',
};

/**
 * Resolve o **valor numérico atual** de uma chave Omni dentro do Character.
 * Funciona tanto para chaves curtas (`treino`, `vida_max`) quanto para
 * caminhos completos (`status.vida.max`, `pericia_feiticaria`,
 * `@USUARIO.forca`). Sempre devolve um número (0 quando não encontrado).
 *
 * Exemplo:
 *   resolveOmniKey(c, 'vida_max')          → 42
 *   resolveOmniKey(c, 'treino')            → 3
 *   resolveOmniKey(c, 'pericia_feiticaria') → 5
 *   resolveOmniKey(c, '@USUARIO.defesa')   → 14
 */
export function resolveOmniKey(character: Character, keyString: string): number {
  if (!keyString || typeof keyString !== 'string') return 0;
  const norm = normalizarChaveOmni(keyString);

  // 1) Caminho direto reconhecido.
  const caminho = ALIAS_PARA_CAMINHO[norm];
  if (caminho) return lerCaminhoOmni(character, caminho);

  // 2) Perícia: `pericia_<chave>`.
  if (norm.startsWith('pericia_')) {
    const sub = norm.slice('pericia_'.length);
    return lerCaminhoOmni(character, `pericias.${sub}`);
  }

  // 3) Caminho com pontos já completo (ex.: "status.vida.max").
  if (keyString.includes('.')) {
    return lerCaminhoOmni(character, keyString);
  }

  // 4) Último recurso: tenta como chave nua na projeção (perícias livres).
  const proj = projetarPersonagemParaOmni(character);
  const pericias = (proj.pericias as Record<string, number>) ?? {};
  if (norm in pericias) return pericias[norm];

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Math Parser com contexto real
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Avalia uma fórmula Omni (`treino * 2`, `@USUARIO.forca + 1d6`, …)
 * usando o estado **atual** do personagem como contexto. Retorna um
 * inteiro (arredondado) — adequado para somar como modificador.
 *
 * O parser interno já consulta `montarVariaveisDoPersonagem`, que por sua
 * vez delega ao `resolveOmniKey`-equivalente (ver `resolvedor.ts`).
 */
export function avaliarFormulaNaFicha(
  character: Character,
  formula: string | undefined,
): number {
  const expr = (formula ?? '').trim();
  if (!expr) return 0;
  try {
    const vars = montarVariaveisDoPersonagem(character, 'USUARIO');
    const r = avaliarFormula(expr, vars);
    return Math.round(r.valor || 0);
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Modifier Selector (estado derivado, sem mutar o store)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estrutura de uma instância de inventário equipada — espelha o shape
 * exposto por `useInventoryStore` sem criar um import circular pesado.
 */
export interface OmniEquippedRef {
  instanceId: string;
  equippedSlot?: string | null;
  /** Snapshot da entidade no momento em que foi adicionada ao inventário. */
  entity: EntidadeOmni;
}

/** Origem detalhada de uma contribuição numérica para uma chave. */
export interface OmniModifierContribution {
  /** Nome amigável da fonte (ex.: "◇ Amuleto do Treino"). */
  source: string;
  /** Quanto somou (já com sinal). */
  delta: number;
}

/** Mapa final de modificadores e suas origens, indexado por chave de bônus. */
export interface OmniModifierBag {
  totals: Record<OmniBonusKey, number>;
  origins: Record<OmniBonusKey, OmniModifierContribution[]>;
  pericias: Record<string, number>;
  periciaOrigins: Record<string, OmniModifierContribution[]>;
  trs: Partial<Record<OmniRollBonusKey, number>>;
  trOrigins: Partial<Record<OmniRollBonusKey, OmniModifierContribution[]>>;
  deslocamento: number;
  deslocamentoOrigins: OmniModifierContribution[];
}

export interface OmniPassiveBonusBag extends OmniModifierBag {
  rollTotals: Partial<Record<OmniRollBonusKey, number>>;
  rollOrigins: Partial<Record<OmniRollBonusKey, OmniModifierContribution[]>>;
}

const CHAVES_PASSIVAS: readonly OmniBonusKey[] = ['hp', 'pe', 'ca', 'rd', 'esc', 'slots'] as const;
const CHAVES_ROLAGEM_PASSIVA: readonly OmniRollBonusKey[] = ['integridade', 'vontade', 'fortitude', 'reflexos', 'astucia'] as const;

function vazio(): OmniModifierBag {
  return {
    totals: { hp: 0, pe: 0, ca: 0, rd: 0, esc: 0, slots: 0 },
    origins: { hp: [], pe: [], ca: [], rd: [], esc: [], slots: [] },
    pericias: {}, periciaOrigins: {}, trs: {}, trOrigins: {},
    deslocamento: 0, deslocamentoOrigins: [],
  };
}

function vazioPassivo(): OmniPassiveBonusBag {
  return { ...vazio(), rollTotals: {}, rollOrigins: {} };
}

function chaveRolagemDoRecurso(resourcePath?: string): OmniRollBonusKey | null {
  if (!resourcePath) return null;
  const norm = normalizarChaveOmni(resourcePath);
  if (norm.includes('integridade')) return 'integridade';
  if (norm.includes('vontade')) return 'vontade';
  if (norm.includes('fortitude')) return 'fortitude';
  if (norm.includes('reflexos') || norm.includes('reflexo')) return 'reflexos';
  if (norm.includes('astucia')) return 'astucia';
  return null;
}

function avaliarBonusPorRecurso(character: Character, ent: EntidadeOmni, resourceKey: OmniRollBonusKey): number {
  const cd = normalizarCombatData(ent.combatData);
  const efeitosPassivos = cd?.effectsPassive ?? [];
  return efeitosPassivos.reduce((total, ef) => {
    if (ef.watcher || (ef.target !== 'USUARIO' && ef.target !== 'ALVO')) return total;
    if (chaveRolagemDoRecurso(ef.resourcePath) !== resourceKey) return total;
    const valor = avaliarFormulaNaFicha(character, ef.formula);
    if (ef.type === 'SUBTRAIR') return total - valor;
    if (ef.type === 'ADICIONAR' || ef.type === 'MODIFICADOR') return total + valor;
    return total;
  }, 0);
}

/** Junta uma fórmula explícita com a derivada do Plano de Execução. */
function fundirFormula(explicita?: string, derivada?: string): string {
  const a = (explicita ?? '').trim();
  const b = (derivada ?? '').trim();
  if (a && b) return `(${a}) + (${b})`;
  return a || b || '';
}

/**
 * Calcula o **mapa de modificadores Omni** de um personagem a partir das
 * suas instâncias equipadas. Não mexe no store — é puro estado derivado:
 * basta chamar a função com a versão mais recente de `equipped` /
 * `omniEntidadesMap` dentro do componente que renderiza a ficha.
 *
 * Cada modificador final é a soma de:
 *   • `entity.bonusEquipado[k]`  (fixo)
 *   • avaliação de `entity.bonusEquipadoFormula[k]` (fórmula explícita)
 *   • avaliação da fórmula derivada do Plano de Execução
 *     (efeitos `target=USUARIO` em recursos passivos)
 *
 * O `omniEntidadesMap` é opcional e serve como "fonte da verdade" — quando
 * passado, usamos a versão atual da entidade em vez do snapshot do
 * inventário (importante para itens editados depois de equipados).
 */
export function selectOmniModifiers(
  character: Character,
  equipped: OmniEquippedRef[],
  omniEntidadesMap?: Record<string, EntidadeOmni>,
): OmniModifierBag {
  const out = vazio();
  if (!equipped || equipped.length === 0) return out;

  const resolverEntidade = (inv: OmniEquippedRef): EntidadeOmni =>
    omniEntidadesMap?.[inv.entity.id] ?? inv.entity;

  for (const inv of equipped) {
    const ent = resolverEntidade(inv);
    // Acessórios passivos só contam quando estão num slot.
    if (!ent.slotType || ent.slotType === 'nenhum') continue;

    const fixos = ent.bonusEquipado ?? {};
    const formulas = ent.bonusEquipadoFormula ?? {};
    const derivadas = derivarBonusEquipadoDosEfeitos(ent);

    for (const k of CHAVES_PASSIVAS) {
      const fixo = fixos[k] ?? 0;
      const formulaCombinada = fundirFormula(formulas[k], derivadas[k]);
      const formulaVal = avaliarFormulaNaFicha(character, formulaCombinada);
      const total = fixo + formulaVal;
      if (total !== 0) {
        out.totals[k] += total;
        out.origins[k].push({ source: `◇ ${ent.nome}`, delta: total });
      }
    }
    const deslocamento = Number(fixos.deslocamento) || 0;
    if (deslocamento !== 0) {
      out.deslocamento += deslocamento;
      out.deslocamentoOrigins.push({ source: `◇ ${ent.nome}`, delta: deslocamento });
    }
    for (const [rawKey, rawValue] of Object.entries(fixos.pericias ?? {})) {
      const key = normalizarChaveOmni(rawKey).replace(/^pericia(s)?_/, '');
      const value = Number(rawValue) || 0;
      if (!key || value === 0) continue;
      out.pericias[key] = (out.pericias[key] ?? 0) + value;
      (out.periciaOrigins[key] ??= []).push({ source: `◇ ${ent.nome}`, delta: value });
    }
    for (const [rawKey, rawValue] of Object.entries(fixos.trs ?? {})) {
      const key = normalizarChaveOmni(rawKey) as OmniRollBonusKey;
      const value = Number(rawValue) || 0;
      if (!CHAVES_ROLAGEM_PASSIVA.includes(key) || value === 0) continue;
      out.trs[key] = (out.trs[key] ?? 0) + value;
      (out.trOrigins[key] ??= []).push({ source: `◇ ${ent.nome}`, delta: value });
    }
  }

  return out;
}

/**
 * Calcula o mapa de modificadores Omni a partir de **passivas vinculadas
 * à ficha** (`Character.omniAtivos` filtrado por `categoria === 'passiva'`).
 *
 * Diferente de `selectOmniModifiers`, esta função:
 *  - NÃO exige `slotType` (passivas não têm slot — são "sempre ativas").
 *  - Aceita uma lista direta de `EntidadeOmni` em vez de instâncias de
 *    inventário (o vínculo já carrega `entidadeId` para resolver no map).
 *
 * O resto da matemática é idêntica: soma `bonusEquipado` fixo +
 * `bonusEquipadoFormula` + fórmula derivada de `effectsPassive`.
 *
 * Triggers (`por_rodada`, `ao_atacar`, etc.) NÃO são tratadas aqui — esta
 * função cuida apenas dos modificadores **estáticos** (Script Passivo).
 */
export function selectOmniPassiveBonuses(
  character: Character,
  passivas: EntidadeOmni[],
): OmniPassiveBonusBag {
  const out = vazioPassivo();
  if (!passivas || passivas.length === 0) return out;

  for (const ent of passivas) {
    const fixos = ent.bonusEquipado ?? {};
    const formulas = ent.bonusEquipadoFormula ?? {};
    const derivadas = derivarBonusEquipadoDosEfeitos(ent, { exigirSlot: false });

    for (const k of CHAVES_PASSIVAS) {
      const fixo = fixos[k] ?? 0;
      const formulaCombinada = fundirFormula(formulas[k], derivadas[k]);
      const formulaVal = avaliarFormulaNaFicha(character, formulaCombinada);
      const total = fixo + formulaVal;
      if (total !== 0) {
        out.totals[k] += total;
        out.origins[k].push({ source: `✦ ${ent.nome}`, delta: total });
      }
    }

    for (const k of CHAVES_ROLAGEM_PASSIVA) {
      const total = avaliarBonusPorRecurso(character, ent, k);
      if (total !== 0) {
        out.rollTotals[k] = (out.rollTotals[k] ?? 0) + total;
        (out.rollOrigins[k] ??= []).push({ source: `✦ ${ent.nome}`, delta: total });
      }
    }
  }

  return out;
}

/**
 * Versão "modifiers map" mais próxima do que o pedido pede literalmente
 * (`modifiers['vida_max'] += resultado`). É um espelho de `selectOmniModifiers`
 * indexado pelas chaves semânticas que o Mestre digita no Omni-Script,
 * útil para tooltips/painéis externos que querem ler "vida_max" diretamente.
 *
 * Para os componentes da ficha, `selectOmniModifiers().totals` já é mais
 * conveniente (as chaves curtas hp/pe/ca/rd/esc/slots casam com o estado).
 */
export function asSemanticModifiers(bag: OmniModifierBag): Record<string, number> {
  return {
    vida_max: bag.totals.hp,
    energia_max: bag.totals.pe,
    defesa: bag.totals.ca,
    rd: bag.totals.rd,
    esquiva: bag.totals.esc,
    slots: bag.totals.slots,
  };
}
