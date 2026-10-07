import { DAMAGE_TYPES, type Character, type DamageType } from '@/types';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { chaveMitigacao, interpretarChaveMitigacao, PREFIXOS_MITIGACAO, type Mitigacao } from './chavesMitigacao';

/** Dano e chaves usam as mesmas fontes. Remover um script não remove outra fonte. */
export function coletarMitigacoesDano(c: Character, incluirScripts = true): Record<Mitigacao, DamageType[]> {
  const entidades = useOmniEntidadesStore.getState().entidades;
  const fontes = [
    ...useInventoryStore.getState().listEquipped(c.id)
      .filter(i => i.entity.slotType && i.entity.slotType !== 'nenhum')
      .map(i => entidades[i.entity.id] ?? i.entity),
    ...(c.omniAtivos ?? []).filter(v => ['passiva', 'talento', 'aura'].includes(v.categoria))
      .flatMap(v => entidades[v.entidadeId] ? [entidades[v.entidadeId]] : []),
  ];
  const out: Record<Mitigacao, DamageType[]> = {
    resistencia: fontes.flatMap(e => e.resistencias ?? []),
    vulnerabilidade: [...(c.vulnerabilities ?? []), ...fontes.flatMap(e => e.vulnerabilidades ?? [])],
    imunidade: [...(c.immunities ?? []), ...fontes.flatMap(e => e.imunidades_dano ?? [])],
  };
  for (const grupo of PREFIXOS_MITIGACAO) for (const tipo of DAMAGE_TYPES) {
    if ((c.omniFlags?.[chaveMitigacao(grupo, tipo)] ?? 0) > 0) out[grupo].push(tipo);
  }
  if (!incluirScripts) return out;
  // Avaliação sobre fontes-base evita recursão e ciclos entre passivas.
  let vars: Record<string, number> | undefined;
  for (const fonte of fontes) for (const efeito of fonte.combatData?.effectsPassive ?? []) {
    if (efeito.trigger || efeito.target !== 'USUARIO') continue;
    const key = interpretarChaveMitigacao(efeito.resourcePath ?? '');
    if (!key || efeito.type === 'SUBTRAIR') continue;
    vars ??= montarVariaveisDoPersonagem(c, 'USUARIO', false);
    const condicao = efeito.condition ? avaliarFormula(efeito.condition, vars) : undefined;
    if (condicao && (condicao.diagnosticos.length || condicao.valor <= 0)) continue;
    const valor = avaliarFormula(efeito.formula || '0', vars);
    if (!valor.diagnosticos.length && valor.valor > 0) out[key.grupo].push(key.tipo);
  }
  return out;
}

export function variaveisMitigacao(c: Character, incluirScripts = true): Record<string, number> {
  const mitigacoes = coletarMitigacoesDano(c, incluirScripts);
  return Object.fromEntries(PREFIXOS_MITIGACAO.flatMap(grupo => DAMAGE_TYPES.map(tipo =>
    [chaveMitigacao(grupo, tipo).toUpperCase(), mitigacoes[grupo].includes(tipo) ? 1 : 0],
  )));
}
