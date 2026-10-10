import {
  CategoriaEconomiaInvocacaoSchema,
  InstanciaInvocacaoSchema,
  type AcaoInvocacao,
  type CategoriaEconomiaInvocacao,
  type InstanciaInvocacao,
  type LimiteResetEconomiaInvocacao,
  type ModeloInvocacao,
} from '@/lib/invocacoes/schema';

export type ResultadoEconomiaInvocacao =
  | { ok: true; instancia: InstanciaInvocacao }
  | { ok: false; motivo: string };

export type EventoResetEconomia = Exclude<LimiteResetEconomiaInvocacao, 'manual'>;

const CATEGORIAS: readonly CategoriaEconomiaInvocacao[] = CategoriaEconomiaInvocacaoSchema.options;

/** Copia os limites configurados para o estado inicial da instância. Campos ausentes seguem indefinidos. */
export function economiaAcoesInicial(modelo: Pick<ModeloInvocacao, 'economiaAcoesConfigurada'>): NonNullable<InstanciaInvocacao['economiaAcoes']> | undefined {
  const configuracao = modelo.economiaAcoesConfigurada;
  if (!configuracao) return undefined;
  const saldos: NonNullable<InstanciaInvocacao['economiaAcoes']> = {};
  for (const categoria of CATEGORIAS) {
    const maximo = configuracao[categoria];
    if (maximo !== undefined) saldos[categoria] = { atual: maximo, maximo };
  }
  return Object.keys(saldos).length ? saldos : undefined;
}

/** Cada reserva de recurso começa com o saldo definido na ficha do modelo. */
export function recursosInvocacaoIniciais(modelo: Pick<ModeloInvocacao, 'recursosConfigurados'>): Record<string, number> | undefined {
  const recursos = modelo.recursosConfigurados ?? [];
  if (!recursos.length) return undefined;
  return Object.fromEntries(recursos.map(recurso => [recurso.id, recurso.valorInicial]));
}

/** Relação do tipo de ação da ficha com seu saldo próprio, preservando as referências do livro. */
export function categoriaEconomiaDaAcao(
  acao: Pick<AcaoInvocacao, 'categoriaAcao' | 'tipo'>,
  saldos: InstanciaInvocacao['economiaAcoes'],
): CategoriaEconomiaInvocacao | undefined {
  const categoriaDireta: Record<NonNullable<AcaoInvocacao['categoriaAcao']>, CategoriaEconomiaInvocacao> = {
    acao_comum: 'acaoComum',
    acao_simples: 'acaoSimples',
    acao_complexa: 'acaoComplexa',
    acao_bonus: 'acaoBonus',
    movimento: 'acaoMovimento',
    livre: 'acaoLivre',
    reacao: 'reacao',
  };
  const solicitada = acao.categoriaAcao
    ? categoriaDireta[acao.categoriaAcao]
    : acao.tipo === 'ataque' ? 'acaoComplexa'
      : acao.tipo === 'movimento' ? 'acaoMovimento'
        : acao.tipo === 'bonus' ? 'acaoBonus'
          : undefined;
  if (!solicitada) return undefined;
  if (saldos?.[solicitada]) return solicitada;

  // Ação Simples e Ação Complexa usam, respectivamente, os saldos equivalentes
  // do livro quando a ficha não configurou os nomes específicos.
  if (solicitada === 'acaoSimples' && saldos?.acaoBonus) return 'acaoBonus';
  if (solicitada === 'acaoComplexa' && saldos?.acaoComum) return 'acaoComum';
  return solicitada;
}

export function podeUsarAcaoDaInstancia(instancia: InstanciaInvocacao, acaoId: string): boolean {
  const recarga = instancia.recargas?.[acaoId];
  if (!recarga || typeof recarga !== 'object') return true;
  const restante = (recarga as { restante?: unknown }).restante;
  return typeof restante !== 'number' || restante <= 0;
}

/** Debita apenas a economia da instância e grava o requestId para replay seguro. */
export function gastarAcaoDaInstancia(
  instancia: InstanciaInvocacao,
  categoria: CategoriaEconomiaInvocacao,
  quantidade = 1,
  requestId?: string,
): ResultadoEconomiaInvocacao {
  if (!Number.isInteger(quantidade) || quantidade < 1) return { ok: false, motivo: 'Custo de ação inválido.' };
  if (requestId && instancia.eventosAcoesProcessados?.includes(requestId)) {
    return { ok: false, motivo: 'Este comando já foi processado.' };
  }
  const saldo = instancia.economiaAcoes?.[categoria];
  if (!saldo) return { ok: false, motivo: `Ação própria ${categoria} não configurada.` };
  if (saldo.atual < quantidade) return { ok: false, motivo: `Ação própria ${categoria} indisponível.` };
  return {
    ok: true,
    instancia: InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      economiaAcoes: {
        ...instancia.economiaAcoes,
        [categoria]: { ...saldo, atual: saldo.atual - quantidade },
      },
      ...(requestId ? { eventosAcoesProcessados: [...(instancia.eventosAcoesProcessados ?? []), requestId].slice(-200) } : {}),
    }),
  };
}

/** Registra a recarga somente depois de o comando passar pelas validações. */
export function registrarRecargaDaAcao(
  instancia: InstanciaInvocacao,
  acao: Pick<AcaoInvocacao, 'id' | 'recargaConfigurada'>,
): InstanciaInvocacao {
  const recarga = acao.recargaConfigurada;
  if (!recarga) return instancia;
  return InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    recargas: {
      ...instancia.recargas,
      [acao.id]: { restante: recarga.quantidade, unidade: recarga.unidade },
    },
  });
}

/** Consome um recurso individual configurado, sem misturar saldo com o do dono. */
export function gastarRecursoDaInstancia(
  instancia: InstanciaInvocacao,
  recursoId: string,
  quantidade: number,
): ResultadoEconomiaInvocacao {
  if (!recursoId.trim() || !Number.isFinite(quantidade) || quantidade < 0) return { ok: false, motivo: 'Custo de recurso inválido.' };
  const saldo = instancia.recursosAtuais?.[recursoId];
  if (saldo === undefined) return { ok: false, motivo: 'Recurso próprio não configurado.' };
  if (saldo < quantidade) return { ok: false, motivo: 'Saldo próprio insuficiente.' };
  return {
    ok: true,
    instancia: InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      recursosAtuais: { ...instancia.recursosAtuais, [recursoId]: saldo - quantidade },
    }),
  };
}

/** Aplica reset configurado e reduz recargas apenas no marco correspondente, uma vez por evento. */
export function processarResetEconomiaInstancia(
  instancia: InstanciaInvocacao,
  modelo: {
    economiaAcoesConfigurada?: ModeloInvocacao['economiaAcoesConfigurada'];
    acoes?: readonly Pick<AcaoInvocacao, 'id' | 'recargaConfigurada'>[];
    recursosConfigurados?: ModeloInvocacao['recursosConfigurados'];
  },
  escopo: LimiteResetEconomiaInvocacao,
  eventoId: string,
): InstanciaInvocacao {
  if (!eventoId.trim() || instancia.marcadoresResetEconomia?.[escopo] === eventoId) return instancia;

  const economiaAcoes = { ...instancia.economiaAcoes };
  for (const categoria of CATEGORIAS) {
    const saldo = economiaAcoes[categoria];
    if (saldo && modelo.economiaAcoesConfigurada?.resetPorCategoria?.[categoria] === escopo) {
      economiaAcoes[categoria] = { ...saldo, atual: saldo.maximo };
    }
  }

  const recargas = { ...instancia.recargas };
  for (const acao of modelo.acoes ?? []) {
    if (acao.recargaConfigurada?.unidade !== escopo) continue;
    const estado = recargas[acao.id];
    if (!estado || typeof estado !== 'object') continue;
    const restante = (estado as { restante?: unknown }).restante;
    if (typeof restante !== 'number' || restante <= 0) continue;
    const novoRestante = Math.max(0, restante - 1);
    if (novoRestante === 0) delete recargas[acao.id];
    else recargas[acao.id] = { ...(estado as Record<string, unknown>), restante: novoRestante };
  }

  const recursosAtuais = { ...instancia.recursosAtuais };
  for (const recurso of modelo.recursosConfigurados ?? []) {
    if (recurso.recargaConfigurada?.unidade !== escopo) continue;
    const saldo = recursosAtuais[recurso.id];
    if (saldo === undefined) continue;
    const novoSaldo = saldo + recurso.recargaConfigurada.quantidade;
    recursosAtuais[recurso.id] = recurso.valorMaximo === undefined
      ? novoSaldo
      : Math.min(recurso.valorMaximo, novoSaldo);
  }

  return InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    economiaAcoes,
    recargas,
    marcadoresResetEconomia: { ...instancia.marcadoresResetEconomia, [escopo]: eventoId },
    recursosAtuais,
  });
}
