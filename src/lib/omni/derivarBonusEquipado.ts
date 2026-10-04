/**
 * 🔁 Conversão automática: efeitos do Plano de Execução → bônus passivos
 * aplicados ao equipar um item.
 *
 * Quando uma EntidadeOmni é um item equipável (slotType ≠ 'nenhum') e os
 * efeitos do Plano (`combatData.effects`) miram o usuário em recursos
 * persistentes (vida_max, energia_max, defesa, esquiva, slots, redução
 * de dano), eles passam a contar como **bônus passivo** — somados na
 * ficha automaticamente enquanto o item estiver equipado.
 *
 * Isso evita a duplicidade de o Mestre precisar preencher tanto o Plano
 * quanto a aba "Bônus ao equipar".
 */
import type { CombatEffect, EntidadeOmni } from './tipos';
import { normalizarCombatData } from './tipos';

export type ChaveBonusPassivo = 'hp' | 'pe' | 'ca' | 'rd' | 'esc' | 'slots' | 'deslocamento';

/**
 * Mapeia `resourcePath` semânticos para a chave usada em `bonusEquipado`.
 * Aceita variações comuns escritas pelo Mestre (com ou sem acento, _ ou .).
 */
function chaveDoRecurso(resourcePath?: string): ChaveBonusPassivo | null {
  if (!resourcePath) return null;
  const norm = resourcePath
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s.-]/g, '_');

  if (/(^|_)(vida_max|hp_max|status_vida_max|max_hp)(_|$)/.test(norm)) return 'hp';
  if (/(^|_)(energia_max|pe_max|energia_amaldicoada_max|energiaamaldicoada_max|status_energia_amaldicoada_max|status_energiaamaldicoada_max|max_pe)(_|$)/.test(norm)) return 'pe';
  if (/(^|_)(defesa|ca|status_defesa|armor_class)(_|$)/.test(norm)) return 'ca';
  if (/(^|_)(esquiva|esc)(_|$)/.test(norm)) return 'esc';
  if (/(^|_)(desloc|deslocamento)(_|$)/.test(norm)) return 'deslocamento';
  if (/(^|_)(slots|slots_acao|slots_max)(_|$)/.test(norm)) return 'slots';
  if (/(^|_)(rd|reducao_dano|reducao_de_dano|resistencia)(_|$)/.test(norm)) return 'rd';
  return null;
}

/** Sinal que cada tipo de efeito imprime no bônus passivo. */
function sinalDoEfeito(type: CombatEffect['type']): 1 | -1 | 0 {
  if (type === 'ADICIONAR') return 1;       // soma ao recurso
  if (type === 'SUBTRAIR') return -1;       // subtrai do recurso
  if (type === 'MODIFICADOR') return 1;     // sinal já está embutido na fórmula
  return 0;
}

/**
 * Para cada chave de bônus passivo, devolve uma fórmula equivalente derivada
 * dos efeitos do Plano de Execução que miram o usuário e o recurso correto.
 *
 * Múltiplos efeitos para a mesma chave são concatenados com `+` (já com
 * o sinal aplicado por `SUBTRAIR`).
 */
export function derivarBonusEquipadoDosEfeitos(
  entidade: EntidadeOmni,
  options: { exigirSlot?: boolean } = {},
): Partial<Record<ChaveBonusPassivo, string>> {
  // Por padrão, só itens equipáveis ativam bônus passivo automaticamente.
  // Passivas/talentos/auras vinculados chamam com `exigirSlot: false`, pois
  // vivem na ficha sem slot de equipamento.
  const exigirSlot = options.exigirSlot ?? true;
  if (exigirSlot && (!entidade.slotType || entidade.slotType === 'nenhum')) return {};

  const cd = normalizarCombatData(entidade.combatData);
  if (!cd) return {};

  // Preferimos a lista explícita de efeitos passivos (Script Passivo).
  // Fallback: efeitos antigos quando o item não era declarado ativo.
  const efeitosPassivos: CombatEffect[] = cd.effectsPassive && cd.effectsPassive.length > 0
    ? cd.effectsPassive
    : (cd.isActive === true ? [] : cd.effects);

  if (efeitosPassivos.length === 0) return {};

  const acumulado: Partial<Record<ChaveBonusPassivo, string[]>> = {};

  for (const ef of efeitosPassivos) {
    // Efeitos com watcher não são bônus contínuos de equipamento: eles são
    // reações que devem rodar só quando o limite observado for cruzado.
    if (ef.watcher || ef.trigger?.trim()) continue;
    // Aceita @USUARIO (canônico) e @ALVO (legado: itens passivos antigos
    // costumavam nascer com target=ALVO; ao equipar, o "alvo" é o portador).
    if (ef.target !== 'USUARIO' && ef.target !== 'ALVO') continue;
    const chave = chaveDoRecurso(ef.resourcePath);
    if (!chave) continue;
    const sinal = sinalDoEfeito(ef.type);
    if (sinal === 0) continue;

    const formulaLimpa = (ef.formula || '').trim();
    if (!formulaLimpa) continue;

    const valor = sinal === -1 ? `-(${formulaLimpa})` : `(${formulaLimpa})`;
    const expr = ef.condition?.trim() ? `if((${ef.condition}), ${valor}, 0)` : valor;
    (acumulado[chave] ??= []).push(expr);
  }

  const out: Partial<Record<ChaveBonusPassivo, string>> = {};
  for (const [k, partes] of Object.entries(acumulado) as Array<[ChaveBonusPassivo, string[]]>) {
    out[k] = partes.join(' + ');
  }
  return out;
}
