import { describe, expect, it } from 'vitest';
import { compilarScriptNatural, parseScriptOmni } from '@/lib/omni/compilarNatural';
import { ALIASES_POR_EVENTO } from '@/lib/omni/gatilhoAliases';
import { mapearAtomoEventoNatural } from '@/lib/omni/eventosNaturais';
import { efeitosParaScript } from '@/lib/omni/omniScript';

describe('ponte executável da sintaxe natural OMNI', () => {
  it('compila acúmulo próprio pós-mitigação com teto global', () => {
    const r = compilarScriptNatural('ao sofrer dano de inimigo então acumular 1 contador_rancor até treino');
    expect(r.erros).toEqual([]);
    expect(r.efeitos).toHaveLength(1);
    expect(r.efeitos[0]).toMatchObject({
      trigger: 'aoSofrerDano', type: 'ADICIONAR', target: 'USUARIO',
      resourcePath: 'contador_rancor', counterCap: '@USUARIO.treino', triggerAfterDamage: true,
      condition: '@CENA.outro_eh_inimigo > 0 && @DANO.vida_perdida > 0',
    });
    const fonte = 'ao sofrer dano de inimigo então acumular 1 contador_rancor até treino';
    expect(efeitosParaScript(r.efeitos)).toBe(fonte);
    expect(parseScriptOmni(efeitosParaScript(r.efeitos)).efeitos[0]).toMatchObject({ triggerAfterDamage:true, naturalSource:fonte });
  });

  it('compila evento observado de aliado, raio, agressor e limite por origem/ciclo', () => {
    const r = compilarScriptNatural('quando aliado até 4.5m sofrer dano de inimigo então acumular 1 contador_rancor até treino por_fonte teto_aliado 1 por rodada');
    expect(r.erros).toEqual([]);
    expect(r.efeitos[0]).toMatchObject({
      trigger: 'aoAliadoSofrerDano', target: 'USUARIO', counterCap: '@USUARIO.treino',
      counterPerSource: true, counterSourceLimit: '1', counterSourcePeriod: 'rodada',
      triggerAfterDamage: true,
    });
    expect(r.efeitos[0].condition).toContain('@CENA.distancia <= 4.5');
    expect(r.efeitos[0].condition).toContain('@CENA.outro_eh_inimigo > 0');
  });

  it('compila consultas naturais de estado do alvo sem trocar o escopo', () => {
    const r = compilarScriptNatural('ao acertar e alvo tem condição caído e alvo vida atual <= 10 então causar 1d6 de dano cortante no alvo');
    expect(r.erros).toEqual([]);
    expect(r.efeitos[0]?.condition?.toLowerCase()).toContain('@alvo.tem_condicao_caido > 0');
    expect(r.efeitos[0]?.condition).toContain('@ALVO.vida_atual <= 10');
    expect(r.efeitos[0]?.target).toBe('ALVO');
  });

  it('converte ações de dano, cura, condição e mutação para primitivas existentes', () => {
    const casos = [
      ['ao acertar então causar 2d8 de dano psiquico no alvo', 'SUBTRAIR', 'vida', 'psiquico'],
      ['ao curar então curar 1d8 de vida no usuario', 'ADICIONAR', 'vida', undefined],
      ['ao acertar então aplicar condenado por 2 rodadas no alvo', 'MODIFICADOR', 'condition_apply', undefined],
      ['ao iniciar turno então acumular 1 contador_foco até treino', 'ADICIONAR', 'contador_foco', undefined],
      ['ao acertar então somar 2 em usuario.defesa', 'ADICIONAR', 'defesa', undefined],
    ] as const;
    for (const [source, type, resourcePath, damageType] of casos) {
      const result = parseScriptOmni(source);
      expect(result.erros, source).toEqual([]);
      expect(result.efeitos[0]?.type, source).toBe(type);
      expect(result.efeitos[0]?.resourcePath, source).toBe(resourcePath);
      if (damageType) expect(result.efeitos[0]?.damageType, source).toBe(damageType);
    }
  });

  it('gastar tudo consome o contador escolhido e mantém efeitos ativos explícitos', () => {
    const r = parseScriptOmni('ao acertar então gastar tudo em contador_rancor');
    expect(r.erros).toEqual([]);
    expect(r.efeitos[0]).toMatchObject({ type:'SUBTRAIR', target:'USUARIO', resourcePath:'contador_rancor', formula:'0' });
  });

  it('não gera efeitos parciais quando uma ação natural não tem implementação', () => {
    const r = compilarScriptNatural('ao acertar então teleportar para o alvo');
    expect(r.efeitos).toEqual([]);
    expect(r.erros[0]?.codigo).toBe('ACAO_NAO_SUPORTADA');
  });

  it('resolve o alias natural preferido de todos os gatilhos canônicos', () => {
    const falhas = Object.entries(ALIASES_POR_EVENTO).flatMap(([id, aliases]) => {
      const mapped = mapearAtomoEventoNatural(aliases[0]);
      return mapped?.evento === id ? [] : [`${id}: ${aliases[0]} → ${mapped?.evento ?? 'sem mapeamento'}`];
    });
    expect(falhas).toEqual([]);
  });
});
