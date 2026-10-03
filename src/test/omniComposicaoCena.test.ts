import { describe, expect, it } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { anexarDadosCompostos } from '@/lib/omni/componentes/contexto';
import { dadosCena, dadosTurnos } from '@/lib/omni/componentes/cena';
const b = { CENA_TURNO_INDICE: -1, TURNO_ATUAL_INDEX: 0, ATAQUES_RESTANTES: 2, ATAQUES_NO_TURNO: 3,
  ATAQUES_NESTE_TURNO: 1, ACAO_BONUS: 1, TURNO_DURACAO_SEG: 60, TURNO_SEGUNDOS_RESTANTES: 35,
  CENA_TOKEN_X: 9, CENA_TOKEN_Y: 12, CENA_MULTIPLICADOR_TEMPO: 2, CENA_EVENTOS_HOJE: 4 };
function formula(s: string) {
  const bag = anexarDadosCompostos(anexarDadosCompostos({ ...b }, 'USUARIO', dadosTurnos(b)), 'CENA', dadosCena(b));
  return avaliarFormula(s, bag);
}
describe('escopos e operações de cena', () => {
  it.each([
    ['indice turno', 0], ['@CENA.indice turno', -1], ['maximo ataques turno', 3], ['ataques neste turno', 1],
    ['acao bonus disponivel', 1], ['acao comum disponivel', 1], ['duração turno segundos', 60],
    ['segundos restante turno', 35], ['@CENA.posicao x', 9], ['@CENA.posicao y', 12],
    ['@CENA.velocidade relogio', 2], ['@CENA.quantidade eventos hoje', 4],
  ])('%s conserva o significado', (s, valor) => { const r = formula(String(s)); expect(r.valor).toBe(valor); expect(r.diagnosticos).toEqual([]); });
  it('atualiza a cena com o contexto do evento fornecido à fórmula', () => {
    expect(avaliarFormula('@CENA.quantidade tokens', {}, undefined, { cena: { qtd_tokens: 7 } }).valor).toBe(7);
  });
});
