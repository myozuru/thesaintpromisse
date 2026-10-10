import { describe, it, expect } from 'vitest';
import { listarConquistas } from '@/stores/useConquistaStore';
import { CONQUISTAS_PADRAO, RARIDADES } from '@/lib/conquistas/tipos';

describe('conquistas', () => {
  it('tem as 5 raridades na ordem', () => {
    expect(RARIDADES).toEqual(['comum', 'raro', 'epico', 'lendario', 'impossivel']);
  });
  it('apagar uma padrão a remove do catálogo', () => {
    const id = CONQUISTAS_PADRAO[0].id;
    const lista = listarConquistas({ [id]: { ...CONQUISTAS_PADRAO[0], deletedAt: 1, updatedAt: 1 } });
    expect(lista.find((c) => c.id === id)).toBeUndefined();
  });
  it('primeiro combate é automático', () => {
    expect(CONQUISTAS_PADRAO.find((c) => c.id === 'primeira-vez')?.gatilho).toBe('primeiro_combate');
  });
  it('recompensas imediatas só aparecem em conquistas comuns', () => {
    const imediatas = ['recuperar_pe', 'recuperar_vida', 'pvt', 'reduzir_exaustao'];
    const comBonus = CONQUISTAS_PADRAO.filter((c) => c.recompensas.some((r) => imediatas.includes(r.tipo)));
    expect(comBonus.length).toBeGreaterThan(0);
    expect(comBonus.every((c) => c.raridade === 'comum')).toBe(true);
  });
});

describe('títulos com buff OMNI', () => {
  it('equipar título vincula o buff e trocar remove o anterior', async () => {
    const { useCharacterStore } = await import('@/stores/useCharacterStore');
    const { useOmniEntidadesStore } = await import('@/stores/useOmniEntidadesStore');
    const { useConquistaStore } = await import('@/stores/useConquistaStore');
    const { equiparTituloComBuff, instanciaTitulo } = await import('@/lib/conquistas/motor');
    const ent = useOmniEntidadesStore.getState().criar('passiva', 'Buff Teste');
    useCharacterStore.setState({ characters: [{ id: 'cT', name: 'T', category: 'PLAYER', omniAtivos: [] } as never] });
    useConquistaStore.setState({
      defs: { tt: { id: 'tt', titulo: 'x', descricao: '', requisito: '', icone: '', raridade: 'raro', secreta: false, gatilho: 'manual', recompensas: [{ tipo: 'titulo', texto: 'Herói', entidadeId: ent.id }], updatedAt: 1 } },
      desbloqueios: { 'cT:tt': { charId: 'cT', conquistaId: 'tt', em: 1, concedidaPor: 'mestre', recompensasEntregues: true, updatedAt: 1 } },
    });
    equiparTituloComBuff('cT', 'Herói');
    const ativos = () => useCharacterStore.getState().characters[0].omniAtivos ?? [];
    expect(ativos().filter((a) => a.instanceId === instanciaTitulo('cT')).map((a) => a.entidadeId)).toEqual([ent.id]);
    equiparTituloComBuff('cT', '');
    expect(ativos().length).toBe(0);
  });
});
