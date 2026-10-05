import { describe, expect, it } from 'vitest';
import { criarContextoNatural, outroAliadoNatural, registrarGastoNatural, resolverParticipanteNatural } from '@/lib/omni/contextoNatural';

const fichas = [{ id: 'portador' }, { id: 'aliado' }, { id: 'inimigo' }];
const tokens = [{ id: 'u', fichaId: 'portador' }, { id: 'a1', fichaId: 'aliado' }, { id: 'a2', fichaId: 'aliado' }];
function contexto() {
  const r = criarContextoNatural('golpe-1', { usuario: { fichaId: 'portador', tokenId: 'u' }, vitima: { fichaId: 'aliado', tokenId: 'a2' }, atacante: { fichaId: 'inimigo' } }, { habilidadeId: 'passiva-1', itemId: 'lamina-1' });
  if (!r.ok) throw new Error(r.erro.mensagem);
  return r.valor;
}
describe('contexto natural explícito', () => {
  it('mantém portador, aliado ferido e atacante separados', () => {
    const c = contexto();
    expect(resolverParticipanteNatural(c, 'vitima', fichas, tokens, true)).toEqual({ ok: true, valor: { fichaId: 'aliado', tokenId: 'a2' } });
    expect(resolverParticipanteNatural(c, 'atacante', fichas, tokens)).toEqual({ ok: true, valor: { fichaId: 'inimigo' } });
    expect(resolverParticipanteNatural(c, 'alvo', fichas, tokens)).toMatchObject({ ok: false, erro: { codigo: 'PAPEL_AUSENTE' } });
  });
  it('não seleciona o primeiro token nem o único token automaticamente', () => {
    const c = contexto(); c.participantes.vitima = { fichaId: 'aliado' };
    expect(resolverParticipanteNatural(c, 'vitima', fichas, tokens, true)).toMatchObject({ ok: false, erro: { codigo: 'TOKEN_AMBIGUO' } });
    expect(resolverParticipanteNatural(c, 'vitima', fichas, tokens.slice(0, 2), true)).toMatchObject({ ok: false, erro: { codigo: 'TOKEN_AUSENTE' } });
  });
  it('recusa token vinculado a outra ficha e ficha removida', () => {
    const c = contexto(); c.participantes.vitima = { fichaId: 'aliado', tokenId: 'u' };
    expect(resolverParticipanteNatural(c, 'vitima', fichas, tokens)).toMatchObject({ ok: false, erro: { codigo: 'TOKEN_DIVERGENTE' } });
    expect(resolverParticipanteNatural(c, 'usuario', [], tokens)).toMatchObject({ ok: false, erro: { codigo: 'FICHA_AUSENTE' } });
  });
  it('não trata o portador como outro aliado nem presume relação desconhecida', () => {
    expect(outroAliadoNatural('portador', 'portador', 'aliado')).toBe(false);
    expect(outroAliadoNatural('portador', 'aliado', undefined)).toBe(false);
    expect(outroAliadoNatural('portador', 'aliado', 'aliado')).toBe(true);
    expect(outroAliadoNatural('portador', 'inimigo', 'inimigo')).toBe(false);
  });
  it('registra vários gastos nominais sem sobrescrever Rancor nem o contexto anterior', () => {
    const original = contexto(); const rancor = registrarGastoNatural(original, 'contador_rancor', 3);
    if (!rancor.ok) throw new Error('falha');
    const foco = registrarGastoNatural(rancor.valor, 'contador_foco', 2);
    expect(foco).toMatchObject({ ok: true, valor: { cargasGastas: { contador_rancor: 3, contador_foco: 2 } } });
    expect(original.cargasGastas).toEqual({});
    expect(registrarGastoNatural(rancor.valor, 'contador_rancor', 1)).toMatchObject({ ok: true, valor: { cargasGastas: { contador_rancor: 4 } } });
  });
  it.each([-1, 1.5, NaN, Infinity])('recusa quantidade inválida %s', value => {
    expect(registrarGastoNatural(contexto(), 'contador_rancor', value)).toMatchObject({ ok: false });
  });
  it('recusa consumo sem nome e IDs vazios; preserva a identidade com distinção de caixa', () => {
    expect(registrarGastoNatural(contexto(), 'por_carga', 1)).toMatchObject({ ok: false });
    expect(criarContextoNatural('', { usuario: { fichaId: 'u' } })).toMatchObject({ ok: false });
    expect(criarContextoNatural('x', { usuario: { fichaId: 'u', tokenId: ' ' } })).toMatchObject({ ok: false });
    expect(criarContextoNatural('x', { usuario: { fichaId: 'U' } })).toMatchObject({ ok: true, valor: { participantes: { usuario: { fichaId: 'U' } } } });
  });
});
