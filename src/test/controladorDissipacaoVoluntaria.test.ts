import { describe, expect, it } from 'vitest';
import { validarDissipacaoVoluntaria } from '@/lib/controlador/estadoInvocacao';

const contexto = {
  estado: 'ativa' as const,
  emCombate: true,
  turnoDoDono: true,
  rodadaAtual: 4,
  rodadaCriacao: 3,
};

describe('dissipação voluntária de invocações', () => {
  it('permite dissipar no turno do dono depois da rodada de criação', () => {
    expect(validarDissipacaoVoluntaria(contexto)).toEqual({ ok: true });
  });

  it('bloqueia a dissipação no turno de outro personagem', () => {
    expect(validarDissipacaoVoluntaria({ ...contexto, turnoDoDono: false })).toMatchObject({ ok: false });
  });

  it('bloqueia a dissipação na mesma rodada em que foi invocada', () => {
    expect(validarDissipacaoVoluntaria({ ...contexto, rodadaAtual: 3 })).toMatchObject({ ok: false });
  });

  it('permite recolher uma invocação caída se os demais requisitos forem cumpridos', () => {
    expect(validarDissipacaoVoluntaria({ ...contexto, estado: 'caida' })).toEqual({ ok: true });
  });

  it('não permite transformar derrota definitiva em dissipação voluntária', () => {
    expect(validarDissipacaoVoluntaria({ ...contexto, estado: 'derrotada' })).toMatchObject({ ok: false });
  });

  it('permite dissipar fora de combate, sem exigir turno ou rodada de criação', () => {
    expect(validarDissipacaoVoluntaria({
      estado: 'ativa', emCombate: false, turnoDoDono: false,
    })).toEqual({ ok: true });
  });
});
