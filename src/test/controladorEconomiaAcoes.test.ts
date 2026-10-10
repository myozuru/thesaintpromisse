import { describe, expect, it } from 'vitest';
import {
  INVOCACAO_SCHEMA_VERSION,
  ModeloInvocacaoSchema,
  type ModeloInvocacao,
} from '@/lib/invocacoes/schema';
import { novaInstanciaInvocacao } from '@/lib/controlador/estadoInvocacao';
import {
  categoriaEconomiaDaAcao,
  economiaAcoesInicial,
  gastarAcaoDaInstancia,
  gastarRecursoDaInstancia,
  podeUsarAcaoDaInstancia,
  processarResetEconomiaInstancia,
  registrarRecargaDaAcao,
  recursosInvocacaoIniciais,
} from '@/lib/controlador/economiaAcoes';

function modelo(extra: Record<string, unknown> = {}): ModeloInvocacao {
  return ModeloInvocacaoSchema.parse({
    schemaVersion: INVOCACAO_SCHEMA_VERSION,
    version: 1,
    id: 'modelo-a',
    donoCharacterId: 'dono-a',
    tipo: 'shikigami',
    nome: 'A',
    aquisicao: { estado: 'aprovada', fonte: 'mestre' },
    ...extra,
  });
}

function instancia(economiaAcoes?: ReturnType<typeof economiaAcoesInicial>, recursosAtuais?: Record<string, number>) {
  return novaInstanciaInvocacao({
    id: 'instancia-a',
    modeloId: 'modelo-a',
    donoCharacterId: 'dono-a',
    tokenId: 'token-a',
    hpAtual: 10,
    hpMaximoAtual: 10,
    economiaAcoes,
    recursosAtuais,
  });
}

describe('economia própria por instância de Shikigami', () => {
  it('inicializa saldos configurados e deixa categorias ausentes sem limite inventado', () => {
    const economy = economiaAcoesInicial({ economiaAcoesConfigurada: { acaoComum: 2, acaoLivre: 1 } });
    expect(economy).toEqual({
      acaoComum: { atual: 2, maximo: 2 },
      acaoLivre: { atual: 1, maximo: 1 },
    });
    expect(economiaAcoesInicial({ economiaAcoesConfigurada: undefined })).toBeUndefined();
  });

  it('traduz ação complexa para o saldo comum quando a ficha usa a referência do livro', () => {
    const economy = economiaAcoesInicial({ economiaAcoesConfigurada: { acaoComum: 1 } });
    expect(categoriaEconomiaDaAcao({ tipo: 'ataque' }, economy)).toBe('acaoComum');
    expect(categoriaEconomiaDaAcao({ categoriaAcao: 'acao_complexa' }, economy)).toBe('acaoComum');
    expect(categoriaEconomiaDaAcao({ categoriaAcao: 'acao_complexa' }, { acaoComplexa: { atual: 1, maximo: 1 } })).toBe('acaoComplexa');
  });

  it('consome somente o saldo da instância e impede replay do mesmo requestId', () => {
    const inicial = instancia(economiaAcoesInicial({ economiaAcoesConfigurada: { acaoComum: 1 } }));
    const gasto = gastarAcaoDaInstancia(inicial, 'acaoComum', 1, 'pedido-ataque-1');
    expect(gasto).toMatchObject({ ok: true, instancia: { economiaAcoes: { acaoComum: { atual: 0, maximo: 1 } } } });
    if (!gasto.ok) return;
    expect(gastarAcaoDaInstancia(gasto.instancia, 'acaoComum', 1, 'pedido-ataque-1')).toEqual({ ok: false, motivo: 'Este comando já foi processado.' });
    expect(gastarAcaoDaInstancia(gasto.instancia, 'acaoComum')).toEqual({ ok: false, motivo: 'Ação própria acaoComum indisponível.' });
  });

  it('mantém os saldos separados entre duas instâncias do mesmo modelo', () => {
    const saldos = economiaAcoesInicial({ economiaAcoesConfigurada: { acaoComum: 1 } });
    const primeira = instancia(saldos);
    const segunda = novaInstanciaInvocacao({
      id: 'instancia-b', modeloId: 'modelo-a', donoCharacterId: 'dono-a', tokenId: 'token-b',
      hpAtual: 10, hpMaximoAtual: 10, economiaAcoes: saldos,
    });
    const gasto = gastarAcaoDaInstancia(primeira, 'acaoComum');
    expect(gasto.ok).toBe(true);
    if (!gasto.ok) return;
    expect(gasto.instancia.id).toBe('instancia-a');
    expect(gasto.instancia.economiaAcoes?.acaoComum?.atual).toBe(0);
    expect(segunda.economiaAcoes?.acaoComum?.atual).toBe(1);
  });

  it('inicia recarga e só a reduz no escopo definido, com aplicação idempotente por marco', () => {
    const configurado = modelo({
      economiaAcoesConfigurada: { acaoComum: 2, resetPorCategoria: { acaoComum: 'inicio_turno_dono' } },
      acoes: [{
        id: 'mordida', nome: 'Mordida', tipoExecucao: 'manual', tipo: 'ataque',
        recargaConfigurada: { quantidade: 2, unidade: 'inicio_turno_dono' },
      }],
    });
    const inicial = instancia({ acaoComum: { atual: 0, maximo: 2 } });
    const recarregando = registrarRecargaDaAcao(inicial, configurado.acoes![0]);
    expect(podeUsarAcaoDaInstancia(recarregando, 'mordida')).toBe(false);

    const rodada = processarResetEconomiaInstancia(recarregando, configurado, 'inicio_rodada', 'combate-1:rodada:2');
    expect(rodada.recargas?.mordida).toMatchObject({ restante: 2 });
    expect(rodada.economiaAcoes?.acaoComum?.atual).toBe(0);

    const primeiroTurno = processarResetEconomiaInstancia(rodada, configurado, 'inicio_turno_dono', 'combate-1:turno:2:0:dono-a');
    expect(primeiroTurno.economiaAcoes?.acaoComum).toEqual({ atual: 2, maximo: 2 });
    expect(primeiroTurno.recargas?.mordida).toMatchObject({ restante: 1 });
    expect(podeUsarAcaoDaInstancia(primeiroTurno, 'mordida')).toBe(false);

    const mesmoTurno = processarResetEconomiaInstancia(primeiroTurno, configurado, 'inicio_turno_dono', 'combate-1:turno:2:0:dono-a');
    expect(mesmoTurno).toBe(primeiroTurno);
    const segundoTurno = processarResetEconomiaInstancia(primeiroTurno, configurado, 'inicio_turno_dono', 'combate-1:turno:3:0:dono-a');
    expect(segundoTurno.recargas?.mordida).toBeUndefined();
    expect(podeUsarAcaoDaInstancia(segundoTurno, 'mordida')).toBe(true);
  });

  it('inicializa e consome recursos da própria invocação sem alterar o dono', () => {
    const configurado = modelo({ recursosConfigurados: [
      { id: 'cargas', nome: 'Cargas', valorInicial: 3, valorMaximo: 5 },
    ] });
    const recursos = recursosInvocacaoIniciais(configurado);
    expect(recursos).toEqual({ cargas: 3 });
    const gasto = gastarRecursoDaInstancia(instancia(undefined, recursos), 'cargas', 2);
    expect(gasto).toMatchObject({ ok: true, instancia: { recursosAtuais: { cargas: 1 } } });
    if (!gasto.ok) return;
    expect(gastarRecursoDaInstancia(gasto.instancia, 'cargas', 2)).toEqual({ ok: false, motivo: 'Saldo próprio insuficiente.' });
    expect(gastarRecursoDaInstancia(gasto.instancia, 'energia', 1)).toEqual({ ok: false, motivo: 'Recurso próprio não configurado.' });
  });

  it('recupera recursos próprios no marco escolhido e respeita o máximo configurado', () => {
    const configurado = modelo({ recursosConfigurados: [{
      id: 'cargas', nome: 'Cargas', valorInicial: 2, valorMaximo: 5,
      recargaConfigurada: { quantidade: 2, unidade: 'inicio_turno_dono' },
    }] });
    const atual = instancia(undefined, { cargas: 4 });
    const recuperado = processarResetEconomiaInstancia(atual, configurado, 'inicio_turno_dono', 'combate-1:turno:1:0:dono-a');
    expect(recuperado.recursosAtuais?.cargas).toBe(5);
    expect(processarResetEconomiaInstancia(recuperado, configurado, 'inicio_turno_dono', 'combate-1:turno:1:0:dono-a')).toBe(recuperado);
  });
});
