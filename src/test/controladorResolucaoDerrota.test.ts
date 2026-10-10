import { describe, expect, it } from 'vitest';
import { InstanciaInvocacaoSchema } from '@/lib/invocacoes/schema';
import { resolverDerrotaManualInvocacao } from '@/lib/controlador/estadoInvocacao';

function derrotada() {
  return InstanciaInvocacaoSchema.parse({
    schemaVersion: 1,
    version: 2,
    id: 'instancia-1',
    modeloId: 'shiki-1',
    donoCharacterId: 'personagem-1',
    donoProfileId: 'perfil-dono',
    tokenId: 'token-1',
    estado: 'derrotada',
    hpAtual: -12,
    hpMaximoAtual: 12,
  });
}

describe('resolução manual de derrota de invocação', () => {
  it('permite apenas o dono ou o Mestre', () => {
    expect(resolverDerrotaManualInvocacao(derrotada(), { resultado: 'perda_permanente' }, {
      isMaster: false, profileId: 'outro-perfil', ownerProfileId: 'perfil-dono',
    })).toMatchObject({ ok: false });

    expect(resolverDerrotaManualInvocacao(derrotada(), { resultado: 'perda_permanente' }, {
      isMaster: true, profileId: 'perfil-mestre', ownerProfileId: 'perfil-dono',
    })).toMatchObject({ ok: true });
  });

  it('registra PV escolhidos manualmente e mantém o PV da derrota no histórico', () => {
    const resultado = resolverDerrotaManualInvocacao(derrotada(), {
      resultado: 'recuperada', pvRecuperados: 7,
    }, { isMaster: false, profileId: 'perfil-dono', ownerProfileId: 'perfil-dono' });

    expect(resultado).toMatchObject({
      ok: true,
      pvCatalogo: 7,
      perdaPermanente: false,
      instancia: {
        estado: 'dissipada',
        hpAtual: 7,
        resolucaoDerrota: { resultado: 'recuperada', pvNaDerrota: -12, pvRecuperados: 7, resolvidaPorProfileId: 'perfil-dono' },
      },
    });
  });

  it.each([0, -1, 13, 1.5])('recusa PV de recuperação inválidos (%s)', pv => {
    expect(resolverDerrotaManualInvocacao(derrotada(), {
      resultado: 'recuperada', pvRecuperados: pv,
    }, { isMaster: true })).toMatchObject({ ok: false });
  });

  it('arquiva a perda permanente sem apagar a ficha nem reescrever a derrota', () => {
    const resultado = resolverDerrotaManualInvocacao(derrotada(), { resultado: 'perda_permanente' }, {
      isMaster: false, profileId: 'perfil-dono', ownerProfileId: 'perfil-dono',
    });

    expect(resultado).toMatchObject({
      ok: true,
      pvCatalogo: 0,
      perdaPermanente: true,
      instancia: {
        estado: 'derrotada',
        hpAtual: -12,
        resolucaoDerrota: { resultado: 'perda_permanente', pvNaDerrota: -12, resolvidaPorProfileId: 'perfil-dono' },
      },
    });
  });

  it('não permite resolver novamente uma instância já resolvida', () => {
    const recuperada = resolverDerrotaManualInvocacao(derrotada(), {
      resultado: 'recuperada', pvRecuperados: 3,
    }, { isMaster: true });
    expect(recuperada.ok && resolverDerrotaManualInvocacao(recuperada.instancia, {
      resultado: 'perda_permanente',
    }, { isMaster: true })).toMatchObject({ ok: false });
  });
});
