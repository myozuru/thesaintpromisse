// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa, limparMesa } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { criarContextoNatural, registrarGastoNatural } from '@/lib/omni/contextoNatural';
import { consultarNatural, type AmbienteConsultaNatural } from '@/lib/omni/consultasNaturais';

afterEach(limparMesa);
function mesa() {
  montarMesa([
    ficha('u', { hpCurrent: 17, peCurrent: 0, omniCounters: { rancor: 3, vida: 99 }, attributes: [{ id: 'forca', name: 'Força', value: 4, externalBonus: 2, mastery: false }] }),
    ficha('v', { hpCurrent: 8 }), ficha('i', { hpCurrent: 42 }),
  ], {});
  const c = criarContextoNatural('exec', { usuario: { fichaId: 'u', tokenId: 'tu' }, vitima: { fichaId: 'v', tokenId: 'tv' }, atacante: { fichaId: 'i' } });
  if (!c.ok) throw Error(c.erro.mensagem);
  const ambiente: AmbienteConsultaNatural = { fichas: useCharacterStore.getState().characters, tokens: [{ id: 'tu', fichaId: 'u' }, { id: 'tv', fichaId: 'v' }], podeConsultar: () => true };
  return { contexto: c.valor, ambiente };
}
describe('ponte estrita de consultas naturais', () => {
  it('lê vítima e atacante da ficha correta mesmo sem alvo selecionado', () => {
    const { contexto, ambiente } = mesa();
    expect(consultarNatural({ tipo: 'recurso', papel: 'vitima', chave: 'vida_atual' }, contexto, ambiente)).toEqual({ ok: true, valor: 8 });
    expect(consultarNatural({ tipo: 'recurso', papel: 'atacante', chave: 'vida' }, contexto, ambiente)).toEqual({ ok: true, valor: 42 });
    expect(consultarNatural({ tipo: 'recurso', papel: 'alvo', chave: 'vida' }, contexto, ambiente)).toMatchObject({ ok: false, erro: { codigo: 'PAPEL_AUSENTE' } });
  });
  it('distingue saldo zero de key inexistente e preserva somaAtr', () => {
    const { contexto, ambiente } = mesa();
    expect(consultarNatural({ tipo: 'recurso', papel: 'usuario', chave: 'pe' }, contexto, ambiente)).toEqual({ ok: true, valor: 0 });
    expect(consultarNatural({ tipo: 'recurso', papel: 'usuario', chave: 'Força' }, contexto, ambiente)).toEqual({ ok: true, valor: 6 });
    expect(consultarNatural({ tipo: 'recurso', papel: 'usuario', chave: 'key_inventada' }, contexto, ambiente)).toMatchObject({ ok: false, erro: { codigo: 'CHAVE_DESCONHECIDA' } });
  });
  it('consulta contador nominal sem confundir com key de vida', () => {
    const { contexto, ambiente } = mesa();
    expect(consultarNatural({ tipo: 'recurso', papel: 'usuario', chave: 'contador_vida' }, contexto, ambiente)).toEqual({ ok: true, valor: 99 });
    expect(consultarNatural({ tipo: 'recurso', papel: 'usuario', chave: 'vida' }, contexto, ambiente)).toEqual({ ok: true, valor: 17 });
    expect(consultarNatural({ tipo: 'recurso', papel: 'usuario', chave: 'contador_foco' }, contexto, ambiente)).toEqual({ ok: true, valor: 0 });
  });
  it('bloqueia consulta não autorizada antes de projetar o valor', () => {
    const { contexto, ambiente } = mesa(); ambiente.podeConsultar = id => id === 'u';
    expect(consultarNatural({ tipo: 'recurso', papel: 'atacante', chave: 'defesa' }, contexto, ambiente)).toMatchObject({ ok: false, erro: { codigo: 'CONSULTA_NEGADA' } });
  });
  it('exige medidor da cena e identifica exatamente os tokens de usuário/vítima', () => {
    const { contexto, ambiente } = mesa();
    expect(consultarNatural({ tipo: 'distancia', de: 'usuario', ate: 'vitima' }, contexto, ambiente)).toMatchObject({ ok: false, erro: { codigo: 'DISTANCIA_AUSENTE' } });
    ambiente.medirDistancia = vi.fn(() => 4.5);
    expect(consultarNatural({ tipo: 'distancia', de: 'usuario', ate: 'vitima' }, contexto, ambiente)).toEqual({ ok: true, valor: 4.5 });
    expect(ambiente.medirDistancia).toHaveBeenCalledWith('tu', 'tv');
  });
  it('distância sem token não retorna zero', () => {
    const { contexto, ambiente } = mesa();
    expect(consultarNatural({ tipo: 'distancia', de: 'usuario', ate: 'atacante' }, contexto, ambiente)).toMatchObject({ ok: false, erro: { codigo: 'TOKEN_AUSENTE' } });
  });
  it('gasto ausente é diferente de gasto explicitamente registrado como zero', () => {
    const { contexto, ambiente } = mesa();
    expect(consultarNatural({ tipo: 'contador_gasto', contador: 'contador_rancor' }, contexto, ambiente)).toMatchObject({ ok: false, erro: { codigo: 'GASTO_AUSENTE' } });
    const pago = registrarGastoNatural(contexto, 'contador_rancor', 0);
    if (!pago.ok) throw Error('falha');
    expect(consultarNatural({ tipo: 'contador_gasto', contador: 'contador_rancor' }, pago.valor, ambiente)).toEqual({ ok: true, valor: 0 });
  });
  it.each(['vida + 1', '@ALVO.vida', 'usuario.vida'])('recusa expressão ou sujeito embutido em %s', chave => {
    const { contexto, ambiente } = mesa();
    expect(consultarNatural({ tipo: 'recurso', papel: 'usuario', chave }, contexto, ambiente)).toMatchObject({ ok: false, erro: { codigo: 'CHAVE_INVALIDA' } });
  });
});
