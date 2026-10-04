import { describe, expect, it } from 'vitest';
import inventario from '../../docs/omni-auditoria/etapa-01-inventario.json';
import { avaliarFormula } from '@/lib/omni/parser';
import { anexarDadosCompostos } from '@/lib/omni/componentes/contexto';
import { parseOmniScript } from '@/lib/omni/omniScript';

describe('auditoria etapa 2: todos os atalhos registrados do parser', () => {
  it.each(Object.entries(inventario.atalhosParser))('%s → %s mantém a referência de usuário', (alias, destino) => {
    const r = avaliarFormula(`@USUARIO.${alias}`, { [`USUARIO_${destino}`]: 37, ...(alias === 'exaustao_nivel' ? { USUARIO_EXAUSTAO: 37 } : {}) });
    expect(r.diagnosticos).toEqual([]);
    expect(r.valor).toBe(37);
  });
});
const bagRancor = (n: number) => anexarDadosCompostos({ USUARIO_CONTADOR_RANCOR: n }, 'USUARIO', { selecoes: { contador: { registros: { rancor: n } } } });
describe('comparações e dados dinâmicos na autoria', () => {
  it.each(['=', '==', 'igual a'])('igualdade com %s aceita o estado correto', operador => {
    const script = parseOmniScript(`@acertar -> se @USUARIO.contador rancor ${operador} 3 entao subtrair 1 em @ALVO.vida`);
    expect(script.erros).toEqual([]);
    const c = script.efeitos[0].condition!;
    expect(avaliarFormula(c, bagRancor(3)).valor).toBe(1);
    expect(avaliarFormula(c, bagRancor(2)).valor).toBe(0);
  });
  it.each(['(@USUARIO.contador rancor)d4', '(@USUARIO.contador_rancor)d4'])('notação %s usa o contador e preserva zero', expr => {
    expect(avaliarFormula(expr, bagRancor(3), () => 0).valor).toBe(3);
    expect(avaliarFormula(expr, bagRancor(0), () => 0).valor).toBe(0);
  });
  it('erros de dado dinâmico fracionário e negativo não viram dano silencioso', () => {
    for (const n of [-1, 1.5]) {
      const r = avaliarFormula('(@USUARIO.contador rancor)d4', bagRancor(n), () => 0);
      expect(r.diagnosticos.length).toBeGreaterThan(0);
    }
  });
});
