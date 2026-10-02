import { describe, expect, it } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { DICIONARIO_CHAVES_OMNI } from '@/lib/omni/constantesDoSistema';

describe('Diagnóstico de fórmulas sem alterar o fallback legado', () => {
  it('distingue zero real de referência ausente', () => {
    const real = avaliarFormula('@USUARIO.vida', { USUARIO_VIDA: 0 });
    const ausente = avaliarFormula('@USUARIO.vida', {});
    expect(real.valor).toBe(0);
    expect(real.diagnosticos).toEqual([]);
    expect(ausente.valor).toBe(0);
    expect(ausente.diagnosticos).toEqual([{ tipo: 'chave_ausente', referencia: '@USUARIO.vida',
      mensagem: 'Referência sem valor no contexto atual: @USUARIO.vida' }]);
  });

  it('uma referência desconhecida mantém o resultado numérico anterior', () => {
    const r = avaliarFormula('@USUARIO.key_inexistente + 7');
    expect(r.valor).toBe(7);
    expect(r.diagnosticos[0].tipo).toBe('chave_ausente');
  });

  it('deduplica ocorrências da mesma referência, sem diferenciar caixa', () => {
    const r = avaliarFormula('@ALVO.pe + @alvo.PE');
    expect(r.diagnosticos).toHaveLength(1);
  });

  it('não usa os valores do usuário quando falta o contexto de alvo', () => {
    const r = avaliarFormula('@ALVO.vida', { VIDA: 9, USUARIO_VIDA: 9 });
    expect(r.valor).toBe(0);
    expect(r.diagnosticos[0].referencia).toBe('@ALVO.vida');
  });

  it('atalhos sem escopo continuam lendo o usuário em uma bag combinada', () => {
    const r = avaliarFormula('@VIDA + @ALVO.vida', { VIDA: 23, USUARIO_VIDA: 17, ALVO_VIDA: 23 });
    expect(r.valor).toBe(40);
    expect(r.diagnosticos).toEqual([]);
  });

  it.each([NaN, Infinity, -Infinity])('diagnostica valor de referência não finito (%s)', valor => {
    const r = avaliarFormula('@USUARIO.pe + 2', { USUARIO_PE: valor });
    expect(r.valor).toBe(2);
    expect(r.diagnosticos[0].tipo).toBe('valor_nao_finito');
  });

  it.each(['(((', 'abc_inexistente + 1'])('diagnostica expressão inválida: %s', expr => {
    const r = avaliarFormula(expr);
    expect(r.valor).toBe(0);
    expect(r.diagnosticos[0].tipo).toBe('expressao_invalida');
  });

  it('diagnostica resultado não finito', () => {
    const r = avaliarFormula('1 / 0');
    expect(r.valor).toBe(0);
    expect(r.diagnosticos[0].tipo).toBe('resultado_nao_finito');
  });

  it('consome toda a referência desconhecida em vez de deixar um caminho truncado', () => {
    const r = avaliarFormula('@AREA.raio + 3');
    expect(r.valor).toBe(3);
    expect(r.expressaoResolvida).toBe('0 + 3');
    expect(r.diagnosticos[0].referencia).toBe('@AREA.raio');
  });

  it('não mantém diagnósticos entre avaliações', () => {
    avaliarFormula('@USUARIO.pe');
    expect(avaliarFormula('@USUARIO.pe', { PE: 4 }).diagnosticos).toEqual([]);
  });
});

describe('Contextos dinâmicos numéricos', () => {
  it('aceita campos em minúsculas e aliases pt-BR', () => {
    const r = avaliarFormula('@USUARIO.vida + @ALVO.forca + @CENA.distancia + @ITEM.usos_restantes',
      { usuario_vida: 17 }, undefined, { alvo: { forca: 11 }, cena: { distancia: 6 }, item: { usos_restantes: 2 } });
    expect(r.valor).toBe(36);
    expect(r.diagnosticos).toEqual([]);
  });

  it('aceita uma bag de alvo já prefixada sem duplicar o prefixo', () => {
    const r = avaliarFormula('@ALVO.vida', {}, undefined, { alvo: { ALVO_VIDA: 23 } });
    expect(r.valor).toBe(23);
    expect(r.diagnosticos).toEqual([]);
  });

  it('atalhos nus aceitam os mesmos aliases e caminhos legados do usuário', () => {
    const r = avaliarFormula('@hp + @status.vida.atual', { USUARIO_VIDA: 17 });
    expect(r.valor).toBe(34);
    expect(r.diagnosticos).toEqual([]);
  });

  it('preserva variáveis nuas legadas com nomes em camelCase', () => {
    const r = avaliarFormula('customFlag + @USUARIO.pe', { customFlag: 5, usuario_pe: 1 });
    expect(r.valor).toBe(6);
    expect(r.diagnosticos).toEqual([]);
  });

  it('resolve caminhos legados completos do usuário e do alvo', () => {
    const r = avaliarFormula('@USUARIO.status.vida.atual + @ALVO.atributos.forca',
      { VIDA: 17 }, undefined, { alvo: { forca: 11 } });
    expect(r.valor).toBe(28);
    expect(r.diagnosticos).toEqual([]);
  });

  it('mantém item, cena, dano e alvo independentes', () => {
    const r = avaliarFormula('@ALVO.valor_final + @CENA.valor_final + @ITEM.valor_final + @DANO.valor_final',
      {}, undefined, { alvo: { valor_final: 2 }, cena: { valor_final: 3 }, item: { valor_final: 5 }, dano: { valor_final: 7 } });
    expect(r.valor).toBe(17);
    expect(r.diagnosticos).toEqual([]);
  });

  it('DANO sem contexto é diagnosticado como ausente', () => {
    const r = avaliarFormula('@DANO.valor_final');
    expect(r.valor).toBe(0);
    expect(r.diagnosticos[0].referencia).toBe('@DANO.valor_final');
    expect(r.diagnosticos[0].tipo).toBe('chave_ausente');
  });

  it.each(DICIONARIO_CHAVES_OMNI.find(c => c.grupo === '💥 Dano (contexto)')!.itens)
   ('$id resolve o campo de dano explicitamente fornecido', ({ id }) => {
      const campo = id.slice('DANO.'.length);
      const r = avaliarFormula(`@${id}`, {}, undefined, { dano: { [campo]: 13 } });
      expect(r.valor).toBe(13);
      expect(r.diagnosticos).toEqual([]);
    });

  it('resultados encadeados mantêm zero válido e detectam índice inexistente', () => {
    const r = avaliarFormula('@RESULTADO_1 + @RESULTADO_2', {}, undefined, { resultados: [0, 7] });
    expect(r.valor).toBe(7);
    expect(r.diagnosticos).toEqual([]);
    expect(avaliarFormula('@RESULTADO_3', {}, undefined, { resultados: [0, 7] }).diagnosticos[0].tipo).toBe('chave_ausente');
  });
});
