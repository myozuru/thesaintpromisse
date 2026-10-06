import { describe, expect, it } from 'vitest';
import { PacoteOmniSchema } from '@/lib/omni/validacao';

describe('round-trip de pacotes OMNI', () => {
  it('preserva configurações de combate, usos, réplicas e ações lógicas', () => {
    const effect = {
      id: 'effect-main', formula: '2d6', type: 'SUBTRAIR', target: 'ALVO',
      damageType: 'Fogo', resourcePath: 'vida_atual', counterCap: '3', counterPerSource: true,
      counterSourceLimit: '1', counterSourcePeriod: 'rodada',
      trigger: 'aoReceberDano', condition: '@USUARIO.vida_atual > 0', absoluteVerb: 'ignorar',
      watcher: { resource: 'vida_atual', op: '<=', threshold: 0.25, percent: true, percentBase: 'vida_max' },
      peSpellReduction: { filtro: 'tipo:damage', min: 1 },
      immunityGrant: { escopo: 'condicao:atordoado', mode: 'grant' },
      conditionApply: { id: 'cego', mode: 'apply', durationRounds: 2, durationTurns: 3 },
      diceSwitch: { dice: '1d4', branches: [{ values: [4], effects: [
        { id: 'effect-nested', formula: '1', type: 'ADICIONAR', target: 'ALVO', resourcePath: 'vida_atual' },
      ] }] },
      buttonOnly: { label: 'Ativar' },
    };
    const pacote = {
      formato: 'omni-engine.v1', nome: 'Round-trip', geradoEm: 1,
      entidades: [{
        id: 'item-test', versao: 1, nome: 'Item de teste', categoria: 'item',
        descricao: '', tags: [], duracao: { tipo: 'permanente' }, custos: [],
        gatilhos: [{
          id: 'trigger-test', evento: 'aoEquipar',
          blocos: [{
            id: 'block-test', condicoes: [], modo: 'todas',
            acoes: [{
              id: 'action-test', acao: 'INCREMENTAR_CONTADOR', alvoAplicacao: 'USUARIO',
              caminhoAlvo: 'contador_rancor', tipoDano: 'Fogo',
              valor: { tipo: 'formula', expressao: '1' },
              teto: { tipo: 'formula', expressao: '@USUARIO.treino' },
              escopoTeto: 'porFonte',
            }],
          }],
        }],
        combatData: {
          effects: [effect], effectsPassive: [{ ...effect, id: 'passive-effect' }],
          effectsActive: [{ ...effect, id: 'active-effect' }],
          critRange: 19, critMultiplier: 3, actionCost: 'action_bonus',
          rangeType: 'ranged', aoeShape: 'line', aoeSize: 9,
        },
        usos: { total: 3, recarga: 'porCena' },
        replica: { porte: 'grande', peInvocacao: 4, peSustentacao: 2, desintegrarAoSoltar: true, cobrarPorRodada: false },
        criadoEm: 1, atualizadoEm: 2,
      }],
    };

    const resultado = PacoteOmniSchema.parse(JSON.parse(JSON.stringify(pacote)));
    expect(resultado.entidades[0]).toMatchObject({
      combatData: pacote.entidades[0].combatData,
      usos: pacote.entidades[0].usos,
      replica: pacote.entidades[0].replica,
      gatilhos: pacote.entidades[0].gatilhos,
    });
  });

  it('rejeita quota por fonte sem periodicidade declarada', () => {
    const pacote = {
      formato: 'omni-engine.v1', nome: 'Quota incompleta', geradoEm: 1,
      entidades: [{
        id: 'item-test', versao: 1, nome: 'Item de teste', categoria: 'item',
        descricao: '', tags: [], duracao: { tipo: 'permanente' }, custos: [], gatilhos: [],
        combatData: {
          effects: [{ id: 'e', formula: '1', type: 'ADICIONAR', target: 'USUARIO', counterSourceLimit: '1' }],
          critRange: 20, critMultiplier: 2,
        },
      }],
    };
    expect(() => PacoteOmniSchema.parse(pacote)).toThrow(/periodicidade explícita/i);
  });

  it('aceita apenas perícias canônicas nas disputas de ações ativas', () => {
    const criarPacote = (pericia_usuario: string, pericias_alvo: string[]) => ({
      formato: 'omni-engine.v1', nome: 'Disputa', geradoEm: 1,
      entidades: [{
        id: 'arma-disputa', versao: 1, nome: 'Manobra', categoria: 'arma',
        descricao: '', tags: [], duracao: { tipo: 'permanente' }, custos: [], gatilhos: [],
        acoesAtivas: [{ id: 'disputa', nome: 'Derrubar', acao: 'comum', custoPE: '0', alcanceM: 1.5,
          teste: 'disputa', pericia_usuario, pericias_alvo }],
        criadoEm: 1, atualizadoEm: 1,
      }],
    });

    expect(PacoteOmniSchema.safeParse(criarPacote('atletismo', ['atletismo', 'acrobacia'])).success).toBe(true);
    expect(PacoteOmniSchema.safeParse(criarPacote('Atletismo', ['Acrobacia'])).success).toBe(true);
    expect(PacoteOmniSchema.safeParse(criarPacote('destreza', ['atletismo'])).success).toBe(false);
    expect(PacoteOmniSchema.safeParse(criarPacote('atletismo', ['tr_fortitude'])).success).toBe(false);
  });
});
