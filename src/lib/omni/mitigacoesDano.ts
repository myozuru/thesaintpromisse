import { DAMAGE_TYPES, type Character, type DamageType } from '@/types';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { chaveMitigacao, interpretarChaveMitigacao, PREFIXOS_MITIGACAO, type Mitigacao } from './chavesMitigacao';
import type { OmniModifierDiagnostic } from './omniBridge';

interface ResultadoMitigacoesDano {
  mitigacoes: Record<Mitigacao, DamageType[]>;
  diagnostics: OmniModifierDiagnostic[];
}

function calcularMitigacoesDano(c: Character, incluirScripts = true): ResultadoMitigacoesDano {
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
  const diagnostics: OmniModifierDiagnostic[] = [];
  const adicionarDiagnostico = (diagnostic: OmniModifierDiagnostic) => {
    if (!diagnostics.some(item => item.source === diagnostic.source && item.key === diagnostic.key && item.formula === diagnostic.formula && item.message === diagnostic.message)) {
      diagnostics.push(diagnostic);
    }
  };
  for (const grupo of PREFIXOS_MITIGACAO) for (const tipo of DAMAGE_TYPES) {
    if ((c.omniFlags?.[chaveMitigacao(grupo, tipo)] ?? 0) > 0) out[grupo].push(tipo);
  }
  if (!incluirScripts) return { mitigacoes: out, diagnostics };
  // Avaliação sobre fontes-base evita recursão e ciclos entre passivas.
  let vars: Record<string, number> | undefined;
  for (const fonte of fontes) for (const efeito of fonte.combatData?.effectsPassive ?? []) {
    if (efeito.trigger || efeito.target !== 'USUARIO') continue;
    const resourcePath = efeito.resourcePath ?? '';
    const key = interpretarChaveMitigacao(resourcePath);
    if (!key) {
      if (/^(resistencia|resistente|vulnerabilidade|vulneravel|imunidade|imune)[._]/i.test(resourcePath)) {
        adicionarDiagnostico({ source: `✦ ${fonte.nome}`, key: resourcePath, message: `Tipo de dano não reconhecido na key ${resourcePath}.` });
      }
      continue;
    }
    if (efeito.type === 'SUBTRAIR') continue;
    vars ??= montarVariaveisDoPersonagem(c, 'USUARIO', false);
    const condicao = efeito.condition ? avaliarFormula(efeito.condition, vars) : undefined;
    if (condicao?.diagnosticos.length || (condicao && !Number.isFinite(condicao.valor))) {
      for (const diagnostic of condicao.diagnosticos) {
        adicionarDiagnostico({ source: `✦ ${fonte.nome}`, key: resourcePath, formula: efeito.condition, message: `Condição inválida: ${diagnostic.mensagem}` });
      }
      continue;
    }
    if (condicao?.rolagens.length) {
      adicionarDiagnostico({ source: `✦ ${fonte.nome}`, key: resourcePath, formula: efeito.condition, message: 'Condição de mitigação não pode depender de dados aleatórios.' });
      continue;
    }
    if (condicao && condicao.valor <= 0) continue;
    const valor = avaliarFormula(efeito.formula || '0', vars);
    if (valor.diagnosticos.length || !Number.isFinite(valor.valor)) {
      for (const diagnostic of valor.diagnosticos) {
        adicionarDiagnostico({ source: `✦ ${fonte.nome}`, key: resourcePath, formula: efeito.formula, message: diagnostic.mensagem });
      }
      continue;
    }
    if (valor.rolagens.length) {
      adicionarDiagnostico({ source: `✦ ${fonte.nome}`, key: resourcePath, formula: efeito.formula, message: 'Mitigação passiva precisa ser determinística; esta fórmula rola dados.' });
      continue;
    }
    if (valor.valor > 0) out[key.grupo].push(key.tipo);
  }
  return { mitigacoes: out, diagnostics };
}

/** Dano e chaves usam as mesmas fontes. Remover um script não remove outra fonte. */
export function coletarMitigacoesDano(c: Character, incluirScripts = true): Record<Mitigacao, DamageType[]> {
  return calcularMitigacoesDano(c, incluirScripts).mitigacoes;
}

export function listarDiagnosticosMitigacaoDano(c: Character): OmniModifierDiagnostic[] {
  return calcularMitigacoesDano(c).diagnostics;
}

export function variaveisMitigacao(c: Character, incluirScripts = true): Record<string, number> {
  const mitigacoes = calcularMitigacoesDano(c, incluirScripts).mitigacoes;
  return Object.fromEntries(PREFIXOS_MITIGACAO.flatMap(grupo => DAMAGE_TYPES.map(tipo =>
    [chaveMitigacao(grupo, tipo).toUpperCase(), mitigacoes[grupo].includes(tipo) ? 1 : 0],
  )));
}
