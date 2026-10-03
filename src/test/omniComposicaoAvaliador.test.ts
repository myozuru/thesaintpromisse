import { describe, expect, it } from 'vitest';
import { interpretarComposicao } from '@/lib/omni/componentes/interpretar';
import { avaliarComposicao, type DadosComposicao } from '@/lib/omni/componentes/avaliar';

describe('Composição de operações reutilizáveis', () => {
  const dados: DadosComposicao = { selecoes: {
    arma_principal: { propriedades: ['leve','versatil'], campos: { margem_critico: 18, alcance: 3 } },
    buffs: [{ id:'a', campos: { sustentados:true, ativos:true } },{ id:'b', campos: { sustentados:false, ativos:true } }],
    vida: { valor:10, campos: { max:40, maximo:40, faltante:30 } },
    cura: { campos: { recebida: { valor:6, campos: { rodada:10 } } } },
    outro: { id:'aliado' }, voce: { id:'aliado' },
    contador: { registros: { 'vida e brasas': { valor:3, campos: { fonte: { registros: { reliquia_lunar:2 }, padrao:0 } } } }, padrao:0 },
    pericia: { campos: { atletismo:7, acrobacia:4 } },
    feitico: { registros: { bola_de_fogo:true } },
  } };
  function avaliar(texto: string) {
    const r = interpretarComposicao(texto);
    expect(r.erro).toBeUndefined();
    expect(r.consumido).toBe(texto.length);
    expect(r.referencia).toBeDefined();
    return avaliarComposicao(r.referencia!,dados);
  }
  it.each([['arma_principal leve',1],['arma_principal pesada',0],['arma_principal versatil',1],['margem_critico arma_principal',18],['quantidade buffs sustentados',1],['quantidade buffs ativos',2],['vida max',40],['percentual vida',25],['vida ate 25%',1],['cura recebida',6],['cura recebida nesta rodada',10],['outro e voce',1],['contador "vida e brasas" fonte reliquia_lunar',2],['pericia atletismo',7],['tem feitico bola_de_fogo',1],['tem feitico desconhecido',0]])('%s resolve por componentes', (texto,valor) => {
    expect(avaliar(texto as string)).toEqual({ok:true,valor});
  });
  it('preserva o limiar sem arredondar a razão antes da comparação', () => {
    const ref = interpretarComposicao('vida ate 25%').referencia!;
    expect(avaliarComposicao(ref,{selecoes:{vida:{valor:10.1,campos:{maximo:40}}}})).toEqual({ok:true,valor:0});
    expect(avaliarComposicao(ref,{selecoes:{vida:{valor:0,campos:{maximo:0}}}})).toEqual({ok:true,valor:0});
  });
  it('rejeita combinações sem campo compatível em vez de retornar zero', () => {
    expect(avaliar('vida leve')).toMatchObject({ok:false});
    expect(avaliar('quantidade vida')).toMatchObject({ok:false});
    expect(avaliar('arma_principal turno')).toMatchObject({ok:false});
  });
  it('separa o início da expressão aritmética da referência', () => {
    const r = interpretarComposicao('@ALVO.vida max + 2');
    expect(r.consumido).toBe('@ALVO.vida max'.length);
    expect(r.referencia?.contexto).toBe('ALVO');
  });
  it('exige argumentos e comparadores e preserva IDs com hífen', () => {
    expect(interpretarComposicao('tem condicao').erro).toBeDefined();
    expect(interpretarComposicao('rodada 3').erro).toContain('comparador');
    expect(interpretarComposicao('distancia 6').erro).toContain('comparador');
    expect(interpretarComposicao('tem item item-001').referencia?.consulta).toMatchObject({entrada:{argumentos:{id:{valor:'item-001'}}}});
  });
});
