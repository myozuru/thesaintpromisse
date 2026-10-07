import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS, type DamageType } from '@/types';
import { resolverTipoDano } from './contextoDano';

export const PREFIXOS_MITIGACAO = ['resistencia', 'vulnerabilidade', 'imunidade'] as const;
export type Mitigacao = typeof PREFIXOS_MITIGACAO[number];
export const chaveMitigacao = (grupo: Mitigacao, tipo: DamageType) => `${grupo}_${tipo.toLowerCase()}`;

/** Aceita nomes, códigos e sinônimos sem confundir resistência percentual com RD. */
export function interpretarChaveMitigacao(raw: string): { grupo: Mitigacao; tipo: DamageType; chave: string } | undefined {
  const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^@?(usuario|alvo|area)\./, '');
  const match = norm.match(/^(resistencia|resistente|vulnerabilidade|vulneravel|imunidade|imune)[._](.+)$/);
  if (!match) return undefined;
  const tipo = resolverTipoDano(match[2].replace(/_/g, ' '));
  if (!tipo) return undefined;
  const grupo: Mitigacao = /^(resistencia|resistente)$/.test(match[1]) ? 'resistencia' : /^(vulnerabilidade|vulneravel)$/.test(match[1]) ? 'vulnerabilidade' : 'imunidade';
  return { grupo, tipo, chave: chaveMitigacao(grupo, tipo) };
}

export const CHAVES_MITIGACAO = PREFIXOS_MITIGACAO.flatMap(grupo => DAMAGE_TYPES.map(tipo => ({
  id: chaveMitigacao(grupo, tipo),
  label: `${grupo === 'resistencia' ? 'Resistência' : grupo === 'vulnerabilidade' ? 'Vulnerabilidade' : 'Imunidade'} — ${DAMAGE_TYPE_LABELS[tipo]}`,
  hint: '1 se presente, 0 se ausente. Definir 1 concede; definir 0 remove a concessão do script, sem remover outras fontes.',
})));