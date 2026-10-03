import { describe, expect, it } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';

const casos: Array<[string, string, Record<string, number>, number]> = [
  ['@CENA.dt', '@CENA.dificuldade', { CENA_DT: 18 }, 18],
  ['@CENA.distancia', '@CENA.distancia_m', { CENA_DISTANCIA: 6 }, 6],
  ['@CENA.distancia_xy', '@CENA.distancia_plana', { CENA_DISTANCIA_XY: 5 }, 5],
  ['@CENA.distancia_manhattan', '@CENA.distancia_grade', { CENA_DISTANCIA_MANHATTAN: 7 }, 7],
  ['@CENA.elevacao_diff', '@CENA.diferenca_altura', { CENA_ELEVACAO_DIFF: 3 }, 3],
  ['@CENA.sujeito_eh_aliado', '@CENA.sujeito_aliado', { CENA_SUJEITO_EH_ALIADO: 1 }, 1],
  ['@CENA.outro_eh_inimigo', '@CENA.outro_inimigo', { CENA_OUTRO_EH_INIMIGO: 1 }, 1],
  ['@CENA.outro_eh_aliado', '@CENA.outro_aliado', { CENA_OUTRO_EH_ALIADO: 1 }, 1],
  ['@CENA.outro_eh_voce', '@CENA.outro_e_voce', { CENA_OUTRO_EH_VOCE: 1 }, 1],
  ['@CENA.turno_de', '@CENA.turno_indice', { CENA_TURNO_INDICE: 2 }, 2],
  ['@USUARIO.dual_wield', '@USUARIO.duas_armas', { USUARIO_DUAL_WIELD: 1 }, 1],
  ['@USUARIO.dual_wield_def', '@USUARIO.defesa_duas_armas', { USUARIO_DUAL_WIELD_DEF: 2 }, 2],
  ['@USUARIO.movimento_bonus_metros', '@USUARIO.bonus_movimento', { USUARIO_MOVIMENTO_BONUS_METROS: 3 }, 3],
  ['@USUARIO.tr_vs_debuff_defesa_bonus', '@USUARIO.bonus_tr_defesa_reduzida', { USUARIO_TR_VS_DEBUFF_DEFESA_BONUS: 2 }, 2],
  ['@USUARIO.rd_alma', '@USUARIO.reducao_dano_alma', { USUARIO_RD_ALMA: 4 }, 4],
  ['@USUARIO.max_concentracao', '@USUARIO.concentracao_maxima', { USUARIO_MAX_CONCENTRACAO: 3 }, 3],
  ['@USUARIO.max_sustentados', '@USUARIO.sustentados_maximos', { USUARIO_MAX_SUSTENTADOS: 2 }, 2],
  ['@USUARIO.slots_liberacao_bonus', '@USUARIO.bonus_slots_liberacao', { USUARIO_SLOTS_LIBERACAO_BONUS: 1 }, 1],
  ['@USUARIO.aura_ca_bonus', '@USUARIO.aura_bonus_defesa', { USUARIO_AURA_CA_BONUS: 2 }, 2],
  ['@USUARIO.aura_rd_fisica', '@USUARIO.aura_reducao_dano_fisico', { USUARIO_AURA_RD_FISICA: 3 }, 3],
  ['@USUARIO.aura_furtividade_bonus', '@USUARIO.aura_bonus_furtividade', { USUARIO_AURA_FURTIVIDADE_BONUS: 2 }, 2],
  ['@USUARIO.aura_agarrar_bonus', '@USUARIO.aura_bonus_agarrar', { USUARIO_AURA_AGARRAR_BONUS: 2 }, 2],
  ['@USUARIO.arma_principal_eh_cac', '@USUARIO.arma_principal_corpo_a_corpo', { USUARIO_ARMA_PRINCIPAL_EH_CAC: 1 }, 1],
  ['@USUARIO.arma_principal_eh_distancia', '@USUARIO.arma_principal_a_distancia', { USUARIO_ARMA_PRINCIPAL_EH_DISTANCIA: 1 }, 1],
  ['@USUARIO.arma_principal_crit_range', '@USUARIO.arma_margem_critico', { USUARIO_ARMA_PRINCIPAL_CRIT_RANGE: 19 }, 19],
  ['@USUARIO.spell_attack_bonus', '@USUARIO.bonus_ataque_magia', { USUARIO_SPELL_ATTACK_BONUS: 8 }, 8],
  ['@USUARIO.tecnica_amaldicoada_definida', '@USUARIO.tem_tecnica', { USUARIO_TECNICA_AMALDICOADA_DEFINIDA: 1 }, 1],
  ['@USUARIO.qtd_fundamentos_tecnica', '@USUARIO.qtd_fundamentos', { USUARIO_QTD_FUNDAMENTOS_TECNICA: 4 }, 4],
  ['@USUARIO.qtd_habilidades_spec', '@USUARIO.qtd_habilidades_especializacao', { USUARIO_QTD_HABILIDADES_SPEC: 2 }, 2],
  ['@USUARIO.pe_por_rodada_sustentado', '@USUARIO.pe_sustentacao_por_rodada', { USUARIO_PE_POR_RODADA_SUSTENTADO: 2 }, 2],
  ['@USUARIO.turno_atual_index', '@USUARIO.indice_turno_atual', { USUARIO_TURNO_ATUAL_INDEX: 1 }, 1],
  ['@USUARIO.turnos_ate_meu', '@USUARIO.turnos_ate_meu_turno', { USUARIO_TURNOS_ATE_MEU: 3 }, 3],
  ['@USUARIO.proximo_no_turno', '@USUARIO.sou_proximo_no_turno', { USUARIO_PROXIMO_NO_TURNO: 1 }, 1],
  ['@USUARIO.ultimo_no_turno', '@USUARIO.sou_ultimo_no_turno', { USUARIO_ULTIMO_NO_TURNO: 1 }, 1],
  ['@USUARIO.turno_duracao_seg', '@USUARIO.duracao_turno_segundos', { USUARIO_TURNO_DURACAO_SEG: 60 }, 60],
  ['@USUARIO.turno_segundos_restantes', '@USUARIO.segundos_restantes_turno', { USUARIO_TURNO_SEGUNDOS_RESTANTES: 30 }, 30],
  ['@USUARIO.qtd_flags_omni', '@USUARIO.qtd_flags', { USUARIO_QTD_FLAGS_OMNI: 5 }, 5],
  ['@USUARIO.qtd_contadores_omni', '@USUARIO.qtd_contadores', { USUARIO_QTD_CONTADORES_OMNI: 7 }, 7],
  ['@USUARIO.reacao_usada_nesta_rodada', '@USUARIO.reacao_usada', { USUARIO_REACAO_USADA_NESTA_RODADA: 1 }, 1],
  ['@USUARIO.reacoes_usadas_nesta_rodada', '@USUARIO.reacoes_usadas', { USUARIO_REACOES_USADAS_NESTA_RODADA: 2 }, 2],
  ['@USUARIO.metros_movidos_neste_turno', '@USUARIO.metros_movidos', { USUARIO_METROS_MOVIDOS_NESTE_TURNO: 6 }, 6],
  ['@DANO.id_origem', '@DANO.tem_atacante', { DANO_ID_ORIGEM: 1 }, 1],
  ['@DANO.id_alvo', '@DANO.tem_alvo', { DANO_ID_ALVO: 1 }, 1],
  ['@USUARIO.origem_id_inato', '@USUARIO.origem_inato', { USUARIO_ORIGEM_ID_INATO: 1 }, 1],
  ['@ALVO.especializacao_id_suporte', '@ALVO.especializacao_suporte', { ALVO_ESPECIALIZACAO_ID_SUPORTE: 1 }, 1],
  ['@USUARIO.condicao_idade_rodadas_atordoado', '@USUARIO.condicao_rodadas_desde_atordoado', { USUARIO_CONDICAO_IDADE_RODADAS_ATORDOADO: 4 }, 4],
  ['@USUARIO.condicao_idade_conhecida_atordoado', '@USUARIO.condicao_tem_idade_atordoado', { USUARIO_CONDICAO_IDADE_CONHECIDA_ATORDOADO: 1 }, 1],
  ['@USUARIO.condicao_rodadas_atordoado', '@USUARIO.condicao_rodadas_restantes_atordoado', { USUARIO_CONDICAO_RODADAS_ATORDOADO: 2 }, 2],
  ['@USUARIO.qtd_feiticos_elemento_fogo', '@USUARIO.qtd_feiticos_tipo_fogo', { USUARIO_QTD_FEITICOS_ELEMENTO_FOGO: 3 }, 3],
];

describe('aliases de nomes amigáveis OMNI', () => {
  it.each(casos)('%s continua compatível com %s', (antiga, nova, variaveis, esperado) => {
    const a = avaliarFormula(antiga, variaveis);
    const b = avaliarFormula(nova, variaveis);
    expect(a.valor).toBe(esperado);
    expect(b.valor).toBe(esperado);
    expect(a.diagnosticos).toEqual([]);
    expect(b.diagnosticos).toEqual([]);
  });
});
