import { describe, it, expect } from 'vitest';
import pacote from '../../public/omni-presets/baculo-aetheris.json';

const ent = pacote.entidades[0];
const acao = (id: string) => ent.acoesAtivas.find((a) => a.id === id)!;

describe('preset Báculo Aetheris', () => {
  it('arma de duas mãos com 2d8 Impacto e crítico 19 ×2', () => {
    expect(ent.combatData.effects[0].formula).toBe('2d8');
    expect(ent.combatData.critRange).toBe(19);
    expect(ent.combatData.critMultiplier).toBe(2);
    expect(ent.tags).toContain('mao:2');
  });
  it('Plumas: 8 PE, até 3 alvos a 18 m, 6d8', () => {
    const a = acao('aa-aetheris-plumas');
    expect([a.custoPE, a.max_alvos, a.alcanceM, a.dano]).toEqual(['8', '3', 18, '6d8']);
  });
  it('Reversão: reação de 7 PE a 9 m, 5d8 Sônico', () => {
    const a = acao('aa-aetheris-reversao');
    expect([a.acao, a.custoPE, a.alcanceM, a.dano]).toEqual(['reacao', '7', 9, '5d8']);
  });
  it('Trono: 9 PE, raio 3 m, metade no sucesso', () => {
    const a = acao('aa-aetheris-trono');
    expect([a.custoPE, a.area?.tamanho_m, a.metadeNoSucesso]).toEqual(['9', 3, true]);
    expect((a as { desfechosTR?: { falha: { efeitos: unknown[] } } }).desfechosTR?.falha.efeitos[0]).toMatchObject({ condicao: 'suspenso', ate_inicio_turno_usuario: true });
  });
  it('Réquiem: 18 PE, raio 9 m a 24 m, 15d10', () => {
    const a = acao('aa-aetheris-requiem');
    expect([a.custoPE, a.alcanceM, a.area?.tamanho_m, a.dano]).toEqual(['18', 24, 9, '15d10']);
    expect((a as { condicionais?: { mod_tr_alvo: number; se_alvo: { nome: string }[] }[] }).condicionais?.[0]).toMatchObject({ mod_tr_alvo: -2, se_alvo: [{ nome: 'suspenso' }] });
    expect([a.acao, (a as { usos_por_cena?: number }).usos_por_cena]).toEqual(['completa', 1]);
  });
  it('Ruptura: reação de 2 PE, 10d10 Sônico', () => {
    const a = acao('aa-aetheris-ruptura');
    expect([a.acao, a.custoPE, a.dano]).toEqual(['reacao', '2', '10d10']);
  });
});

describe('condição Suspenso', () => {
  it('termina no início do próximo turno de quem aplicou', async () => {
    const { useCharacterStore } = await import('@/stores/useCharacterStore');
    const { expirarCondicoesNoInicioDoTurno } = await import('@/stores/useCombatStore');
    const cond = { id: 's1', conditionId: 'suspenso', name: 'Suspenso', icon: '🌪️', remainingTurns: -1, remainingRounds: -1, expiraNoInicioDoTurnoDe: 'mago' };
    useCharacterStore.setState({ characters: [{ id: 'alvo', name: 'Alvo', activeConditions: [cond] }] as never });
    expirarCondicoesNoInicioDoTurno('outro');
    expect(useCharacterStore.getState().characters[0].activeConditions).toHaveLength(1);
    expirarCondicoesNoInicioDoTurno('mago');
    expect(useCharacterStore.getState().characters[0].activeConditions).toHaveLength(0);
  });
});
