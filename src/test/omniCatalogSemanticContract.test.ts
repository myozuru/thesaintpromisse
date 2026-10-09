import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { DICIONARIO_CHAVES_OMNI } from '@/lib/omni/constantesDoSistema';
import { avaliarFormula, resolverChavePtBr, ATALHOS_PT_BR } from '@/lib/omni/parser';
import { LEGACY_TO_CANONICAL } from '@/lib/omni/keyAliases';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useCombatStore } from '@/stores/useCombatStore';

const personagem = (id: string, factor: number): Character => ({
  id,
  name: `Fixture ${id}`,
  level: 4,
  trainingBonus: 3,
  hpCurrent: 17 * factor,
  hpMax: 31 * factor,
  peCurrent: 11 * factor,
  peMax: 23 * factor,
  escCurrent: 2 * factor,
  escMax: 5 * factor,
  ca: 13 + factor,
  movement: 7 + factor,
  category: factor === 1 ? 'PLAYER' : 'INIMIGO',
  attributes: [
    { id: 'forca', name: 'Força', value: 11 + factor },
    { id: 'destreza', name: 'Destreza', value: 12 + factor },
    { id: 'constituicao', name: 'Constituição', value: 13 + factor },
    { id: 'inteligencia', name: 'Inteligência', value: 14 + factor },
    { id: 'sabedoria', name: 'Sabedoria', value: 15 + factor },
    { id: 'presenca', name: 'Presença', value: 16 + factor },
  ],
  skills: [
    { id: 'atletismo', name: 'Atletismo', value: 2 + factor },
    { id: 'acrobacia', name: 'Acrobacia', value: 3 + factor },
    { id: 'furtividade', name: 'Furtividade', value: 4 + factor },
    { id: 'prestidigitacao', name: 'Prestidigitação', value: 5 + factor },
    { id: 'feiticaria', name: 'Feitiçaria', value: 6 + factor },
    { id: 'historia', name: 'História', value: 7 + factor },
    { id: 'investigacao', name: 'Investigação', value: 8 + factor },
    { id: 'oficio1', name: 'Ofício 1', value: 9 + factor },
    { id: 'oficio2', name: 'Ofício 2', value: 10 + factor },
    { id: 'oficio3', name: 'Ofício 3', value: 11 + factor },
    { id: 'tecnologia', name: 'Tecnologia', value: 12 + factor },
    { id: 'teologia', name: 'Teologia', value: 13 + factor },
    { id: 'direcao', name: 'Direção', value: 14 + factor },
    { id: 'intuicao', name: 'Intuição', value: 15 + factor },
    { id: 'medicina', name: 'Medicina', value: 16 + factor },
    { id: 'ocultismo', name: 'Ocultismo', value: 17 + factor },
    { id: 'percepcao', name: 'Percepção', value: 18 + factor },
    { id: 'sobrevivencia', name: 'Sobrevivência', value: 19 + factor },
    { id: 'enganacao', name: 'Enganação', value: 20 + factor },
    { id: 'intimidacao', name: 'Intimidação', value: 21 + factor },
    { id: 'performance', name: 'Performance', value: 22 + factor },
    { id: 'persuasao', name: 'Persuasão', value: 23 + factor },
  ],
  savingThrows: [
    { id: 'astucia', name: 'Astúcia', value: 31 + factor },
    { id: 'fortitude', name: 'Fortitude', value: 32 + factor },
    { id: 'integridade', name: 'Integridade', value: 33 + factor },
    { id: 'reflexos', name: 'Reflexos', value: 34 + factor },
    { id: 'vontade', name: 'Vontade', value: 35 + factor },
  ],
  omniFlags: {
    bloqueio_total: 1,
    visao_normal: 1,
    visao_penumbra: 1,
    visao_escuridao: 1,
    na_escuridao: 1,
    na_penumbra: 1,
    esta_iluminado: 1,
    esta_oculto: 1,
    linha_de_visao: 1,
    atras_de_cobertura: 1,
    fonte_de_luz_ativa: 1,
    em_terreno_dificil: 1,
    voando: 1,
    prono: 1,
    agachado: 1,
    usou_corrida: 1,
  },
  omniCounters: {
    rancor: 4,
    fadiga: 2,
    metros_movidos: 3,
    dano_recebido_nesta_rodada: 6,
    cura_recebida_nesta_rodada: 5,
  },
  chosenTalents: [{ id: 'talento_fixture' }],
  chosenAuraAptitudes: ['aptidao_fixture'],
  chosenSpecAbilities: [{ abilityId: 'habilidade_fixture' }],
  activeConditions: [{ conditionId: 'atordoado', remainingRounds: 2, elapsedRounds: 4 }],
  spells: [{ id: 'feitico_fixture', name: 'Feitiço Fixture', spellType: 'damage', damageType: 'Fogo', costPE: 1 }],
  activeBuffs: [{ spellName: 'buff_fixture', durationRounds: 2 }],
} as unknown as Character);

const usuario = personagem('contract-user', 1);
const alvo = personagem('contract-target', 2);
const bagUsuario = montarVariaveisDoPersonagem(usuario, 'USUARIO');
const bagAlvo = montarVariaveisDoPersonagem(alvo, 'ALVO');
const bagCombinado = { ...bagUsuario, ...bagAlvo };

describe('Contrato semântico do catálogo oficial OMNI', () => {
  it('cada key estática de USUARIO e ALVO existe no bag do escopo e preserva seu valor', () => {
    const falhas: string[] = [];

    for (const grupo of DICIONARIO_CHAVES_OMNI) {
      for (const item of grupo.itens) {
        if (item.id.includes('<')) continue;

        for (const escopo of grupo.escopos) {
          if (escopo === 'NENHUM') continue;

          const bag = escopo === 'USUARIO' ? bagUsuario : bagAlvo;
          const chaveResolvida = resolverChavePtBr(item.id);
          const direta = bag[`${escopo}_${chaveResolvida}`];
          const esperada = direta ?? (escopo === 'USUARIO' ? bag[chaveResolvida] : undefined);
          const referencia = `@${escopo}.${item.id}`;
          const resultado = avaliarFormula(referencia, bagCombinado);

          if (typeof esperada !== 'number' || !Number.isFinite(esperada)) {
            falhas.push(`${referencia}: não existe valor numérico no bag projetado para ${chaveResolvida}`);
            continue;
          }
          if (resultado.diagnosticos.length) {
            falhas.push(`${referencia}: diagnóstico ${resultado.diagnosticos.map(d => d.mensagem).join('; ')}`);
            continue;
          }
          if (resultado.valor !== esperada) {
            falhas.push(`${referencia}: parser=${resultado.valor}, projeção=${esperada}`);
          }
        }
      }
    }

    expect(falhas, falhas.slice(0, 80).join('\n')).toEqual([]);
  });

  it('os fixtures distinguem usuario e alvo, evitando falso positivo por valores iguais', () => {
    const referencias = [
      ['@USUARIO.vida', 17], ['@ALVO.vida', 34],
      ['@USUARIO.forca', 12], ['@ALVO.forca', 13],
      ['@USUARIO.pericia_atletismo', 3], ['@ALVO.pericia_atletismo', 4],
      ['@USUARIO.fortitude', 33], ['@ALVO.fortitude', 34],
    ] as const;

    for (const [referencia, valor] of referencias) {
      const resultado = avaliarFormula(referencia, bagCombinado);
      expect(resultado.valor, referencia).toBe(valor);
      expect(resultado.diagnosticos, referencia).toEqual([]);
    }
  });

  it('keys de cena, item e dano leem o contexto externo declarado', () => {
    useCombatStore.setState({
      inCombat: true,
      round: 6,
      currentTurnIndex: 1,
      initiativeOrder: [{ charId: 'outro' }, { charId: usuario.id }, { charId: alvo.id }],
    } as never);
    const varsAtuais = {
      ...montarVariaveisDoPersonagem(usuario, 'USUARIO'),
      ...montarVariaveisDoPersonagem(alvo, 'ALVO'),
      DANO: 11,
    };

    const cena = {
      rodada: 6,
      dificuldade: 17,
      distancia: 4.5,
      distancia_m: 4.5,
      no_mapa: 1,
      sujeito_aliado: 1,
      outro_inimigo: 0,
      outro_aliado: 1,
      outro_e_voce: 0,
      consumido: 2,
      dano: 11,
      distancia_xy: 3.5,
      distancia_plana: 3.5,
      distancia_manhattan: 4,
      distancia_grade: 4,
      elevacao_diff: 1.25,
      diferenca_altura: 1.25,
      terreno: 2,
      hora: 14,
      minuto: 23,
      segundo: 45,
      dia: 9,
      mes: 10,
      ano: 2026,
      eh_dia: 1,
      eh_noite: 0,
      eh_amanhecer: 0,
      eh_anoitecer: 0,
      relogio_ativo: 1,
      multiplicador_tempo: 2,
      timestamp_segundos: 50645,
      eventos_hoje: 2,
      token_x: 8.5,
      token_y: 9.5,
      qtd_tokens: 4,
      qtd_aliados: 2,
      qtd_inimigos: 1,
    };
    const extras = {
      cena,
      item: { usos_restantes: 2, usos_totais: 5 },
      dano: {
        tipo: 12,
        fonte: 3,
        foi_critico: 1,
        foi_falha_critica: 0,
        valor_inicial: 19,
        valor_final: 13,
        vida_perdida: 9,
        absorvido: 6,
        id_origem: 1,
        id_alvo: 1,
        alcance: 4.5,
        foi_ataque_oportunidade: 1,
        foi_furtivo: 1,
        tipo_ataque: 1,
      },
    };
    const variaveis = varsAtuais;
    const esperados: Record<string, number> = {
      'ITEM.usos_restantes': 2,
      'ITEM.usos_totais': 5,
      DANO: 11,
      'CENA.rodada': 6,
      'CENA.dificuldade': 17,
      'CENA.distancia_m': 4.5,
      'CENA.no_mapa': 1,
      'CENA.sujeito_aliado': 1,
      'CENA.outro_inimigo': 0,
      'CENA.outro_aliado': 1,
      'CENA.outro_e_voce': 0,
      'CENA.consumido': 2,
      'CENA.dano': 11,
      'CENA.turno_indice': 1,
      'CENA.rodadas_em_combate': 6,
      'CENA.distancia_plana': 3.5,
      'CENA.distancia_grade': 4,
      'CENA.diferenca_altura': 1.25,
      'CENA.terreno': 2,
      'CENA.hora': 14,
      'CENA.minuto': 23,
      'CENA.segundo': 45,
      'CENA.dia': 9,
      'CENA.mes': 10,
      'CENA.ano': 2026,
      'CENA.eh_dia': 1,
      'CENA.eh_noite': 0,
      'CENA.eh_amanhecer': 0,
      'CENA.eh_anoitecer': 0,
      'CENA.relogio_ativo': 1,
      'CENA.multiplicador_tempo': 2,
      'CENA.timestamp_segundos': 50645,
      'CENA.eventos_hoje': 2,
      'CENA.token_x': 8.5,
      'CENA.token_y': 9.5,
      'CENA.qtd_tokens': 4,
      'CENA.qtd_aliados': 2,
      'CENA.qtd_inimigos': 1,
      'DANO.tipo': 12,
      'DANO.fonte': 3,
      'DANO.foi_critico': 1,
      'DANO.foi_falha_critica': 0,
      'DANO.valor_inicial': 19,
      'DANO.valor_final': 13,
      'DANO.vida_perdida': 9,
      'DANO.absorvido': 6,
      'DANO.tem_atacante': 1,
      'DANO.tem_alvo': 1,
      'DANO.alcance': 4.5,
      'DANO.foi_ataque_oportunidade': 1,
      'DANO.foi_furtivo': 1,
      'DANO.tipo_ataque': 1,
    };
    const falhas: string[] = [];

    for (const grupo of DICIONARIO_CHAVES_OMNI) {
      if (!grupo.escopos.includes('NENHUM')) continue;
      for (const item of grupo.itens) {
        if (item.id.includes('<')) continue;

        const referencia = item.id === 'DANO' ? '@DANO' : `@${item.id}`;
        const resolvido = avaliarFormula(referencia, variaveis, undefined, extras);
        const esperado = esperados[item.id] ?? (() => {
          const chave = resolverChavePtBr(item.id);
          return bagUsuario[chave] ?? bagUsuario[`USUARIO_${chave}`];
        })();

        if (typeof esperado !== 'number' || !Number.isFinite(esperado)) {
          falhas.push(`${referencia}: fixture não forneceu valor esperado`);
        } else if (resolvido.diagnosticos.length) {
          falhas.push(`${referencia}: ${resolvido.diagnosticos.map(d => d.mensagem).join('; ')}`);
        } else if (resolvido.valor !== esperado) {
          falhas.push(`${referencia}: parser=${resolvido.valor}, esperado=${esperado}`);
        }
      }
    }

    expect(falhas, falhas.slice(0, 80).join('\n')).toEqual([]);
  });

  it('cada atalho registrado no parser aponta ao mesmo valor canônico', () => {
    const alvos = [...new Set(Object.values(ATALHOS_PT_BR))].sort();
    const canonicos = Object.fromEntries(alvos.map((alvo, index) => [alvo, 101 + index]));
    const variaveis: Record<string, number> = {};

    for (const [alvo, valor] of Object.entries(canonicos)) {
      variaveis[alvo] = valor;
      for (const escopo of ['USUARIO', 'ALVO'] as const) {
        variaveis[`${escopo}_${alvo}`] = valor;
      }
    }

    const falhas: string[] = [];
    for (const [atalho, alvo] of Object.entries(ATALHOS_PT_BR)) {
      const esperado = canonicos[alvo];
      for (const referencia of [`@USUARIO.${atalho}`, `@ALVO.${atalho}`, `@${atalho}`]) {
        const resultado = avaliarFormula(referencia, variaveis);
        if (resultado.diagnosticos.length || resultado.valor !== esperado) {
          falhas.push(`${referencia} → ${alvo}: parser=${resultado.valor}, esperado=${esperado}; ${resultado.diagnosticos.map(d => d.mensagem).join('; ')}`);
        }
      }
    }

    expect(falhas, falhas.slice(0, 80).join('\n')).toEqual([]);
  });

  it('cada alias legado centralizado preserva a mesma chave canônica', () => {
    const canonicos = [...new Set(Object.values(LEGACY_TO_CANONICAL))];
    const variaveis: Record<string, number> = {};
    for (const [index, canonico] of canonicos.entries()) {
      const chave = resolverChavePtBr(canonico);
      const valor = 401 + index;
      variaveis[`USUARIO_${chave}`] = valor;
      variaveis[chave] = valor;
    }

    const falhas: string[] = [];
    for (const [alias, canonico] of Object.entries(LEGACY_TO_CANONICAL)) {
      const esperado = variaveis[`USUARIO_${resolverChavePtBr(canonico)}`];
      const resultado = avaliarFormula(`@USUARIO.${alias}`, variaveis);
      if (resultado.diagnosticos.length || resultado.valor !== esperado) {
        falhas.push(`@USUARIO.${alias} → ${canonico}: parser=${resultado.valor}, esperado=${esperado}; ${resultado.diagnosticos.map(d => d.mensagem).join('; ')}`);
      }
    }

    expect(falhas, falhas.slice(0, 80).join('\n')).toEqual([]);
  });
});
