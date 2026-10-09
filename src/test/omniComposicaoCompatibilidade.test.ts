import { afterEach, describe, expect, it } from 'vitest';
import { canonicalizarChave } from '@/lib/omni/keyAliases';
import { simplificarKeysEntidade } from '@/lib/omni/simplificarKeys';
import { interpretarComposicao } from '@/lib/omni/componentes/interpretar';
import { projetarDadosLegados, mesclarDados } from '@/lib/omni/componentes/legado';
import { avaliarFormula, resolverChavePtBr } from '@/lib/omni/parser';
import { novaEntidade } from '@/lib/omni/tipos';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
afterEach(() => useOmniEntidadesStore.setState({ entidades: {} }));
describe('compatibilidade e persistência de composições', () => {
  it('mantém componentes separados e IDs dentro de argumentos', () => {
    expect(canonicalizarChave('vida temporaria maximo')).toBe('vida temporaria maximo');
    const e = { ...novaEntidade('item'), custos: [{ caminhoRecurso: 'reserva pe', valor: { tipo: 'formula' as const, expressao: 'contador "status.vida.atual" fonte ALVO-01' } }] };
    const m = simplificarKeysEntidade(e);
    expect(m.custos).toEqual(e.custos);
    expect(simplificarKeysEntidade(m)).toEqual(m);
  });
  it('exporta e importa a árvore sem perder o caminho de compatibilidade', () => {
    const composicao = interpretarComposicao('vida temporaria maximo').referencia!;
    const e = { ...novaEntidade('item'), gatilhos: [{ id: 'g', evento: 'aoEquipar' as const, blocos: [{ id: 'b', modo: 'todas' as const,
      condicoes: [{ id: 'c', esquerdo: { tipo: 'ref' as const, ref: { alvo: 'USUARIO' as const, caminho: 'vida temporaria maximo', composicao } },
        operador: 'MAIOR_QUE' as const, direito: { tipo: 'fixo' as const, valor: 0 } }], acoes: [] }] }] };
    useOmniEntidadesStore.setState({ entidades: { [e.id]: e } });
    const p = JSON.parse(JSON.stringify(useOmniEntidadesStore.getState().exportarPacote()));
    expect(useOmniEntidadesStore.getState().importarPacote(p, 'substituir')).toBe(1);
    expect(useOmniEntidadesStore.getState().entidades[e.id].gatilhos[0].blocos[0].condicoes[0].esquerdo).toEqual(e.gatilhos[0].blocos[0].condicoes[0].esquerdo);
  });
  it('validação de pacote preserva a árvore da referência composta', () => {
    const composicao = interpretarComposicao('vida temporaria maximo').referencia!;
    const e = { ...novaEntidade('item'), gatilhos: [{ id: 'g', evento: 'aoEquipar' as const, blocos: [{ id: 'b', modo: 'todas' as const,
      condicoes: [{ id: 'c', esquerdo: { tipo: 'ref' as const, ref: { alvo: 'USUARIO' as const, caminho: 'vida temporaria maximo', composicao } },
        operador: 'MAIOR_QUE' as const, direito: { tipo: 'fixo' as const, valor: 0 } }], acoes: [] }] }] };
    const pacote = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'Teste', geradoEm: 0, entidades: [e] });
    expect(pacote.entidades[0].gatilhos[0].blocos[0].condicoes[0].esquerdo).toMatchObject({
      tipo: 'ref', ref: { caminho: 'vida temporaria maximo', composicao },
    });
  });
  it('projeta fatos legados em campos reutilizáveis', () => {
    const dados = projetarDadosLegados({ MAX_CONCENTRACAO: 3, BLOQUEIO_TOTAL: 1 }, 'USUARIO', resolverChavePtBr);
    expect(avaliarFormula('maximo concentracao + bloqueio total', {}, undefined, { composicoes: { USUARIO: dados } }).valor).toBe(4);
  });
  it('não deixa a compatibilidade sobrescrever coleções nativas', () => {
    const d = mesclarDados({ selecoes: { buffs: { campos: { sustentados: { quantidade: 9 } } } } },
      { selecoes: { buffs: [{ campos: { sustentados: true } }, { campos: { sustentados: false } }] } });
    expect(avaliarFormula('quantidade buffs sustentados', {}, undefined, { composicoes: { USUARIO: d } }).valor).toBe(1);
  });
  it('resolve o novo seletor simples e a identidade informada pelo evento', () => {
    expect(avaliarFormula('vida', {}, undefined, { composicoes: { USUARIO: { selecoes: { vida: 12 } } } }).valor).toBe(12);
    expect(avaliarFormula('@CENA.outro e voce', {}, undefined, { cena: { outro_eh_voce: 1 } }).valor).toBe(1);
  });
});
