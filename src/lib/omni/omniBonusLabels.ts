/**
 * 🏷️ Rótulos legíveis para os bônus passivos do Omni-Engine.
 *
 * Faz a ponte entre as chaves técnicas usadas em `EntidadeOmni.bonusEquipado`
 * (hp, pe, ca, rd, esc, slots) e os rótulos canônicos do dicionário do
 * sistema (`ROTULOS_RECURSOS`), garantindo que todo feedback ao usuário use
 * a mesma terminologia da ficha.
 */
import type { EntidadeOmni } from './tipos';
import { ROTULOS_RECURSOS } from './constantesDoSistema';
import { derivarBonusEquipadoDosEfeitos } from './derivarBonusEquipado';

export type ChaveBonusEquipado = 'hp' | 'pe' | 'ca' | 'rd' | 'esc' | 'slots';
export type ChaveRecursoEquipado = ChaveBonusEquipado | 'deslocamento';

/** Mapeia chave curta → rótulo humano oficial (alinhado com SISTEMA_RECURSOS). */
export const ROTULO_BONUS_EQUIPADO: Record<ChaveRecursoEquipado, string> = {
  hp: ROTULOS_RECURSOS.VIDA_MAX,        // "Vida Máxima"
  pe: ROTULOS_RECURSOS.ENERGIA_MAX,     // "Energia Amaldiçoada Máx."
  ca: ROTULOS_RECURSOS.DEFESA,          // "Defesa"
  rd: 'Redução de Dano',
  esc: ROTULOS_RECURSOS.ESQUIVA,        // "Esquiva"
  slots: 'Slots de Ação',
  deslocamento: 'Deslocamento',
};

/**
 * Lista todas as chaves de recurso efetivamente alteradas por uma entidade
 * Omni quando ela é equipada — considera tanto valores fixos quanto fórmulas.
 */
export function listarRecursosAlterados(entidade: EntidadeOmni): ChaveRecursoEquipado[] {
  const b = entidade.bonusEquipado ?? {};
  const f = entidade.bonusEquipadoFormula ?? {};
  const fAuto = derivarBonusEquipadoDosEfeitos(entidade);
  const chaves: ChaveRecursoEquipado[] = ['hp', 'pe', 'ca', 'rd', 'esc', 'slots', 'deslocamento'];
  return chaves.filter((k) => {
    const val = (b as Record<string, number | undefined>)[k] ?? 0;
    const formula = (f as Record<string, string | undefined>)[k];
    const formulaAuto = fAuto[k];
    return val !== 0 || !!(formula && formula.trim().length > 0) || !!(formulaAuto && formulaAuto.trim().length > 0);
  });
}

/**
 * Constrói a string estruturada do toast no formato exigido:
 * "Equipado: <Rótulo> alterada | <Rótulo> alterada".
 */
export function montarMensagemEquipar(entidade: EntidadeOmni): string {
  const recursos = listarRecursosAlterados(entidade);
  if (recursos.length === 0) return `Equipado: ${entidade.nome}`;
  const rotulos = recursos.map((k) => `${ROTULO_BONUS_EQUIPADO[k]} alterada`);
  return `Equipado: ${rotulos.join(' | ')}`;
}
