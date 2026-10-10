import { describe, expect, it } from 'vitest';
import { validarIntermediarioInvocacao } from '@/lib/controlador/intermediario';
import type { InventoryItem } from '@/stores/useInventoryStore';
import type { Character } from '@/types';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';

const dono = { id: 'dono', tecnicaAmaldicoada: 'Dez Sombras' } as Character;

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    instanceId: 'talisma-1',
    ownerId: 'dono',
    entity: { id: 'talisma-template', nome: 'Talismã da Sombra', categoria: 'item', slotType: 'nenhum' } as InventoryItem['entity'],
    acquiredAt: 1,
    emMaos: true,
    ...overrides,
  };
}

function shikigami(intermediario?: InvocacaoControlador['intermediario']): Pick<InvocacaoControlador, 'id' | 'tipo' | 'intermediario'> {
  return { id: 'sombra', tipo: 'shikigami', intermediario };
}

describe('validação de intermediários de invocação', () => {
  it('deixa pendente uma ficha sem vínculo', () => {
    expect(validarIntermediarioInvocacao(shikigami(), dono, {})).toMatchObject({ ok: false, motivo: expect.stringContaining('pendente') });
  });

  it('exige o item certo, a posse atual e que esteja em mãos', () => {
    const inv = shikigami({ tipo: 'talisma', itemInventarioId: 'talisma-1' });
    expect(validarIntermediarioInvocacao(inv, dono, { 'talisma-1': item() })).toMatchObject({ ok: true, via: 'item' });
    expect(validarIntermediarioInvocacao(inv, dono, {})).toMatchObject({ ok: false, motivo: expect.stringContaining('removido') });
    expect(validarIntermediarioInvocacao(inv, dono, { 'talisma-1': item({ emMaos: false }) })).toMatchObject({ ok: false, motivo: expect.stringContaining('em mãos') });
    expect(validarIntermediarioInvocacao(inv, dono, { 'talisma-1': item({ ownerId: 'outro' }) })).toMatchObject({ ok: false, motivo: expect.stringContaining('não pertence') });
  });

  it('bloqueia intermediário quebrado, item de categoria errada e vínculo duplicado', () => {
    const inv = shikigami({ tipo: 'talisma', itemInventarioId: 'talisma-1' });
    expect(validarIntermediarioInvocacao(inv, dono, { 'talisma-1': item({ quebrado: true }) })).toMatchObject({ ok: false, motivo: expect.stringContaining('quebrado') });
    expect(validarIntermediarioInvocacao(inv, dono, { 'talisma-1': item({ entity: { id: 'arma', nome: 'Arma', categoria: 'arma' } as InventoryItem['entity'] }) })).toMatchObject({ ok: false, motivo: expect.stringContaining('item comum') });
    expect(validarIntermediarioInvocacao(inv, dono, { 'talisma-1': item() }, [{ id: 'outra', intermediario: { tipo: 'talisma', itemInventarioId: 'talisma-1' } }])).toMatchObject({ ok: false, motivo: expect.stringContaining('outra invocação') });
  });

  it('aceita a técnica registrada do dono como exceção ao talismã', () => {
    expect(validarIntermediarioInvocacao(shikigami({ tipo: 'tecnica', tecnicaId: 'Dez Sombras' }), dono, {})).toMatchObject({ ok: true, via: 'tecnica' });
    expect(validarIntermediarioInvocacao(shikigami({ tipo: 'tecnica', tecnicaId: 'outra' }), dono, {})).toMatchObject({ ok: false, motivo: expect.stringContaining('não corresponde') });
    expect(validarIntermediarioInvocacao(shikigami({ tipo: 'tecnica', tecnicaId: 'Dez Sombras' }), { id: 'dono' } as Character, {})).toMatchObject({ ok: false, motivo: expect.stringContaining('não tem técnica') });
  });

  it('exige o dispositivo próprio para Corpo Amaldiçoado', () => {
    const corpo = { id: 'corpo', tipo: 'corpo_amaldicoado', intermediario: { tipo: 'dispositivo', itemInventarioId: 'device-1' } } as Pick<InvocacaoControlador, 'id' | 'tipo' | 'intermediario'>;
    const device = item({ instanceId: 'device-1', entity: { id: 'device', nome: 'Dispositivo', categoria: 'item' } as InventoryItem['entity'] });
    expect(validarIntermediarioInvocacao(corpo, dono, { 'device-1': device })).toMatchObject({ ok: true, via: 'item' });
    expect(validarIntermediarioInvocacao({ ...corpo, intermediario: { tipo: 'talisma', itemInventarioId: 'device-1' } }, dono, { 'device-1': device })).toMatchObject({ ok: false, motivo: expect.stringContaining('dispositivo') });
  });
});
