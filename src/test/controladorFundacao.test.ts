import { describe, expect, it } from 'vitest';
import { getKeyAttrForSpec, recalcPeMaxBySpec, recalcPeMaxFromHistory } from '@/lib/levelEngine';
import {
  limiteInvocacoesConhecidas,
  limiteInvocacoesAtivas,
  limiteAtivasPersonagem,
  pvControlador,
  validarCatalogoControlador,
  type InvocacaoControlador,
} from '@/lib/controlador/tipos';
import type { Attribute, Character } from '@/types';
import { specDCFor } from '@/lib/golpeEspecial';
import { avaliarSubmissaoAprovacao, validarDecisaoAprovacao, podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';

const attrs = [
  { id: 'sab', name: 'Sabedoria', value: 18 },
  { id: 'pre', name: 'Presença', value: 14 },
] as Attribute[];

const shikigami: InvocacaoControlador = {
  id: 'lobo', nome: 'Lobo Divino', tipo: 'shikigami', donoCharacterId: 'mestre',
  origem: { tipo: 'grimorio', entidadeId: 'criatura-lobo' },
  hpAtual: 12, hpMaximo: 12, defesa: 14, deslocamentoM: 9, porte: 'Médio',
  custoInvocacaoPE: 3, custoSustentacaoPE: 1,
  acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque', alcanceM: 1.5, dano: '1d6' }],
};

describe('Controlador — atributo-chave e progressão', () => {
  it('aceita Sabedoria ou Presença mantendo fallback de fichas antigas', () => {
    expect(getKeyAttrForSpec('Controlador')).toBe('Sabedoria');
    expect(getKeyAttrForSpec('Controlador', 'Presença')).toBe('Presença');
    expect(recalcPeMaxBySpec(1, 'Controlador', attrs, 0, 'Sabedoria')).toBe(9);
    expect(recalcPeMaxBySpec(1, 'Controlador', attrs, 0, 'Presença')).toBe(7);
    expect(recalcPeMaxBySpec(6, 'Controlador', attrs, 0, 'Presença')).toBe(32);
    expect(recalcPeMaxFromHistory(10, 0, 'Controlador', attrs, 0, 1, 'Presença')).toBe(12);
  });
  it('usa o atributo escolhido na CD sem duplicar o modificador já salvo pelo wizard', () => {
    const char = (attr: 'Presença' | 'Sabedoria', baseDC: number): Character => ({
      specialization: 'Controlador', keyAttribute: attr, attributes: attrs,
      level: 1, baseDC,
    } as Character);
    expect(specDCFor(char('Sabedoria', 14))).toBe(16);
    expect(specDCFor(char('Presença', 12))).toBe(14);
    expect(specDCFor(char('Presença', 10))).toBe(14);
  });
  it('PV inicial 10+CON, depois d8 ou média 5 + CON', () => {
    expect(pvControlador(1, 2)).toBe(12);
    expect(pvControlador(3, 2)).toBe(26);
    expect(pvControlador(3, 2, [8, 1])).toBe(25);
    expect(() => pvControlador(2, 0, [9])).toThrow();
  });
  it.each([[1,2],[3,2],[4,3],[6,3],[7,4],[9,4],[10,5],[12,5],[13,6],[16,7],[19,8]])('nível %i permite %i invocações conhecidas', (nivel, esperado) => {
    expect(limiteInvocacoesConhecidas(nivel)).toBe(esperado);
  });
  it('todas as especializações mantêm uma invocação em campo por padrão', () => {
    expect(limiteAtivasPersonagem('Lutador', 10)).toBe(1);
    expect(limiteAtivasPersonagem('Suporte', 4)).toBe(1);
    expect(limiteAtivasPersonagem('Controlador', 2)).toBe(3);
  });
  it('até duas ativas com +1 em Controle, sem confundir com treino geral', () => {
    expect(limiteInvocacoesAtivas(1)).toBe(2);
    expect(limiteInvocacoesAtivas(2)).toBe(3);
    expect(limiteInvocacoesAtivas(0)).toBe(1);
  });
});
describe('Controlador — catálogo', () => {
  it('preserva vínculo com Grimório/OMNI e valida propriedade', () => {
    expect(validarCatalogoControlador('mestre', 1, [shikigami])).toEqual({ ok: true });
    expect(validarCatalogoControlador('intruso', 1, [shikigami]).ok).toBe(false);
    expect(validarCatalogoControlador('mestre', 1, [shikigami, shikigami]).ok).toBe(false);
    const tres = [shikigami, { ...shikigami, id: 'b' }, { ...shikigami, id: 'c' }];
    expect(validarCatalogoControlador('mestre', 1, tres).ok).toBe(true); // Excesso de catálogo é aviso, não bloqueio
    expect(validarCatalogoControlador('mestre', 3, tres).ok).toBe(true);
  });
});


describe('Controlador — política pura de aprovação', () => {
  const submissao = {
    requesterUserId: 'player-1',
    requesterIsMaster: false,
    ownerUserId: 'player-1',
    ownerCharacterId: 'ficha-1',
    invocationOwnerCharacterId: 'ficha-1',
  };

  it('jogador dono pode submeter para revisão, outro jogador não', () => {
    expect(avaliarSubmissaoAprovacao(submissao)).toEqual({ ok: true, estado: 'pendente' });
    expect(avaliarSubmissaoAprovacao({ ...submissao, requesterUserId: 'player-2' })).toMatchObject({ ok: false });
  });

  it('Mestre pode aprovar uma submissão em qualquer ficha', () => {
    expect(avaliarSubmissaoAprovacao({
      ...submissao,
      requesterUserId: 'master-1',
      requesterIsMaster: true,
      ownerUserId: 'player-2',
    })).toEqual({ ok: true, estado: 'aprovada' });
  });

  it('rejeita conta ausente e invocação ligada a outra ficha', () => {
    expect(avaliarSubmissaoAprovacao({ ...submissao, requesterUserId: ' ' })).toMatchObject({ ok: false });
    expect(avaliarSubmissaoAprovacao({ ...submissao, invocationOwnerCharacterId: 'ficha-2' })).toMatchObject({ ok: false });
  });

  it('somente Mestre decide uma solicitação pendente e rejeição exige motivo', () => {
    expect(validarDecisaoAprovacao({
      requesterIsMaster: false, estadoAtual: 'pendente', decisao: 'aprovada',
    })).toMatchObject({ ok: false });
    expect(validarDecisaoAprovacao({
      requesterIsMaster: true, estadoAtual: 'pendente', decisao: 'aprovada',
    })).toEqual({ ok: true, estado: 'aprovada' });
    expect(validarDecisaoAprovacao({
      requesterIsMaster: true, estadoAtual: 'pendente', decisao: 'rejeitada',
    })).toMatchObject({ ok: false });
    expect(validarDecisaoAprovacao({
      requesterIsMaster: true, estadoAtual: 'pendente', decisao: 'rejeitada', motivo: 'Ajustar a ficha.',
    })).toEqual({ ok: true, estado: 'rejeitada' });
  });

  it('impede nova decisão depois que a solicitação saiu de pendente', () => {
    expect(validarDecisaoAprovacao({
      requesterIsMaster: true, estadoAtual: 'aprovada', decisao: 'rejeitada', motivo: 'Revisar.',
    })).toMatchObject({ ok: false });
    expect(validarDecisaoAprovacao({
      requesterIsMaster: true, estadoAtual: 'rejeitada', decisao: 'aprovada',
    })).toMatchObject({ ok: false });
  });

  it('libera somente a versão aprovada e mantém compatibilidade com fichas legadas', () => {
    expect(podeUsarVersaoAprovada({ estado: 'aprovada', versaoAtual: 2, versaoAprovada: 2 })).toBe(true);
    expect(podeUsarVersaoAprovada({ estado: 'aprovada', versaoAtual: 3, versaoAprovada: 2 })).toBe(false);
    expect(podeUsarVersaoAprovada({ estado: 'pendente', versaoAtual: 1 })).toBe(false);
    expect(podeUsarVersaoAprovada({ estado: 'rejeitada', versaoAtual: 1 })).toBe(false);
    expect(podeUsarVersaoAprovada({})).toBe(true);
    expect(podeUsarVersaoAprovada({ estado: 'aprovada' })).toBe(true);
    expect(podeUsarVersaoAprovada({ estado: 'aprovada', versaoAtual: 0, versaoAprovada: 0 })).toBe(false);
  });
});
