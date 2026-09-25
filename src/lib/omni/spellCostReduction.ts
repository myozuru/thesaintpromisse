/**
 * 🪄 Redutores de custo de PE de feitiços (Omni).
 *
 * Aplicados pelo `SpellApplyDialog` ANTES do debit final de PE, sobre o
 * `effectiveCostPE` já descontado por Economia / O Honrado / Memorização /
 * Especialista em Técnica.
 *
 * Cada redutor é uma entrada em `character.omniSpellCostReduction[]` com:
 *   - `filtro`  — string que decide a quais feitiços o desconto se aplica.
 *   - `reduce`  — quanto subtrair do custo (mínimo 0).
 *   - `min`     — piso de custo após o desconto (default 1, nunca abaixo de 0).
 *   - `id`      — identificador único do redutor (para limpeza individual).
 *
 * Vários redutores aplicáveis ao mesmo feitiço se SOMAM (e o piso usado é o
 * MAIOR `min` entre os redutores ativos — abordagem conservadora).
 *
 * --- Sintaxe do filtro ---
 *
 *   `todos`                    → vale para qualquer feitiço.
 *   `nivel:N`                  → apenas feitiços de nível N (ex.: `nivel:1`).
 *   `nivel:A-B`                → feitiços entre níveis A e B (ex.: `nivel:1-3`).
 *   `tipo:<damage|heal|buff|condition>` → por SpellType.
 *   `acao:<action|bonus|reaction|full>` → por tipo de ação.
 *   `nome:<slug>`              → por nome (case-insensitive, normalizado).
 *   `id:<spellId>`             → por id exato.
 *
 * Filtros podem ser combinados com `&` (E lógico):
 *   `nivel:1-2&tipo:damage`    → feitiços Nv 1-2 de dano.
 */
import type { Character, Spell } from '@/types';
import { derivarPassivasContinuas } from './passivasDerivadas';

export interface SpellCostReducer {
  /** Identificador único (para REMOVER individualmente). */
  id: string;
  /** Filtro de aplicação (ver doc do módulo). */
  filtro: string;
  /** Pontos de PE a subtrair. */
  reduce: number;
  /** Piso mínimo após o desconto (default 1). */
  min: number;
  /** Origem (nome da entidade Omni que aplicou — só pra log/debug). */
  origem?: string;
}

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

/** Avalia se um único filtro atômico (ex.: `nivel:1-3`) casa com o feitiço. */
function filtroAtomicoCombina(atomico: string, spell: Spell): boolean {
  const f = atomico.trim().toLowerCase();
  if (!f || f === 'todos' || f === '*') return true;

  const [chave, valor] = f.split(':').map((x) => x.trim());
  if (!valor) return false;

  switch (chave) {
    case 'nivel':
    case 'nv':
    case 'level': {
      const spellLvlNum = parseInt(String(spell.spellLevel ?? '1'), 10);
      if (Number.isNaN(spellLvlNum)) return false;
      if (valor.includes('-')) {
        const [aStr, bStr] = valor.split('-');
        const a = parseInt(aStr, 10);
        const b = parseInt(bStr, 10);
        if (Number.isNaN(a) || Number.isNaN(b)) return false;
        return spellLvlNum >= Math.min(a, b) && spellLvlNum <= Math.max(a, b);
      }
      return spellLvlNum === parseInt(valor, 10);
    }
    case 'tipo':
    case 'type':
      return (spell.spellType ?? '').toLowerCase() === valor;
    case 'acao':
    case 'action':
      return (spell.actionType ?? '').toLowerCase() === valor;
    case 'nome':
    case 'name':
      return normalizar(spell.name ?? '') === normalizar(valor);
    case 'id':
      return spell.id === valor;
    default:
      return false;
  }
}

/** Combina filtro completo (com `&` para AND) com o feitiço. */
export function filtroCombina(filtro: string, spell: Spell): boolean {
  const partes = filtro.split('&').map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) return true;
  return partes.every((p) => filtroAtomicoCombina(p, spell));
}

/**
 * Resultado consolidado do cálculo: total a subtrair e piso a respeitar.
 * Use como: `custoFinal = max(piso, custoAntes - reduce)`.
 */
export interface SpellReductionResult {
  reduce: number;
  min: number;
  matched: SpellCostReducer[];
}

/**
 * Soma todos os redutores Omni aplicáveis ao feitiço e devolve o desconto
 * agregado mais o piso final (maior `min` entre os redutores ativos).
 */
export function getSpellCostReduction(
  source: Character,
  spell: Spell,
): SpellReductionResult {
  const persistidas: SpellCostReducer[] = source.omniSpellCostReduction ?? [];
  // 🪶 Inclui redutores derivados de passivas contínuas (sem trigger).
  const derivadas = derivarPassivasContinuas(source).peReductions;
  const lista: SpellCostReducer[] = [...persistidas, ...derivadas];
  const matched = lista.filter((r) => filtroCombina(r.filtro, spell));
  const reduce = matched.reduce((s, r) => s + Math.max(0, r.reduce), 0);
  const min = matched.reduce((m, r) => Math.max(m, Math.max(0, r.min)), 1);
  return { reduce, min, matched };
}

/**
 * Aplica o desconto agregado a um custo base, respeitando o piso.
 * Se não houver redutores ativos, devolve `custoBase` intacto.
 */
export function aplicarReducaoCustoFeitico(
  custoBase: number,
  source: Character,
  spell: Spell,
): { custoFinal: number; reducaoAplicada: number; matched: SpellCostReducer[] } {
  const { reduce, min, matched } = getSpellCostReduction(source, spell);
  if (matched.length === 0) return { custoFinal: custoBase, reducaoAplicada: 0, matched };
  const custoFinal = Math.max(min, custoBase - reduce);
  return { custoFinal, reducaoAplicada: custoBase - custoFinal, matched };
}
