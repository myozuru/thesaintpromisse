/**
 * Pechincha: regras puras. A CD e as faixas pertencem ao mercador e nunca
 * aparecem na interface do jogador — ele só vê o resultado narrado.
 */
export type HumorMercador = 'amigavel' | 'neutro' | 'hostil';
export type FaixaPechincha = 'falha_critica' | 'falha' | 'sucesso' | 'sucesso_maior' | 'critico';

export interface PechinchaConfig {
  ativa: boolean;
  /** CD base secreta do mercador. */
  cd: number;
  humor: HumorMercador;
  /** Perícias aceitas (nomes exatos da ficha). */
  pericias: string[];
  /** Percentuais (0–100). */
  descontoSucesso: number;
  descontoSucessoMaior: number;
  descontoCritico: number;
  /** Quanto o preço sobe numa falha crítica. */
  aumentoFalhaCritica: number;
  /** Tentativas por personagem por dia do mundo. */
  tentativasPorDia: number;
}

export interface PechinchaEstado {
  /** Dia do mundo (contador absoluto) da última tentativa. */
  dia: number;
  tentativas: number;
  /** Ajuste atual em % (negativo = desconto, positivo = preço maior). */
  ajuste: number;
  irritado: boolean;
  updatedAt: number;
}

export const PECHINCHA_PADRAO: PechinchaConfig = {
  ativa: true, cd: 15, humor: 'neutro', pericias: ['Persuasão', 'Enganação', 'Intimidação'],
  descontoSucesso: 10, descontoSucessoMaior: 20, descontoCritico: 30, aumentoFalhaCritica: 15, tentativasPorDia: 1,
};

export const HUMOR_AJUSTE_CD: Record<HumorMercador, number> = { amigavel: -2, neutro: 0, hostil: 5 };
export const HUMOR_LABEL: Record<HumorMercador, string> = { amigavel: 'Amigável', neutro: 'Neutro', hostil: 'Hostil' };

/** CD efetiva: base + humor + 5 se o mercador ficou irritado com esse personagem. */
export function cdEfetiva(cfg: PechinchaConfig, estado?: PechinchaEstado): number {
  return cfg.cd + HUMOR_AJUSTE_CD[cfg.humor] + (estado?.irritado ? 5 : 0);
}

/** Classifica o resultado. d20 natural 20 = crítico, 1 = falha crítica. */
export function faixaPechincha(natural: number, total: number, cd: number): FaixaPechincha {
  if (natural === 20) return 'critico';
  if (natural === 1) return 'falha_critica';
  if (total >= cd + 5) return 'sucesso_maior';
  if (total >= cd) return 'sucesso';
  return 'falha';
}

export function ajustePorFaixa(cfg: PechinchaConfig, f: FaixaPechincha): number {
  switch (f) {
    case 'critico': return -cfg.descontoCritico;
    case 'sucesso_maior': return -cfg.descontoSucessoMaior;
    case 'sucesso': return -cfg.descontoSucesso;
    case 'falha': return 0;
    case 'falha_critica': return cfg.aumentoFalhaCritica;
  }
}

export function tentativasRestantes(cfg: PechinchaConfig, estado: PechinchaEstado | undefined, diaAtual: number): number {
  if (!estado || estado.dia !== diaAtual) return cfg.tentativasPorDia;
  return Math.max(0, cfg.tentativasPorDia - estado.tentativas);
}

/** Novo estado após uma tentativa (o ajuste vale até o fim do dia do mundo). */
export function registrarTentativa(cfg: PechinchaConfig, estado: PechinchaEstado | undefined, diaAtual: number, f: FaixaPechincha): PechinchaEstado {
  const mesmoDia = estado && estado.dia === diaAtual;
  return {
    dia: diaAtual,
    tentativas: (mesmoDia ? estado!.tentativas : 0) + 1,
    ajuste: ajustePorFaixa(cfg, f),
    irritado: f === 'falha_critica' ? true : (estado?.irritado ?? false),
    updatedAt: Date.now(),
  };
}

/** Ajuste vigente hoje (dias anteriores não contam). */
export function ajusteVigente(estado: PechinchaEstado | undefined, diaAtual: number): number {
  return estado && estado.dia === diaAtual ? estado.ajuste : 0;
}

/** Comprar: desconto reduz. Vender: desconto vira mercador pagando mais (sinal invertido). */
export function precoAjustado(base: number, ajuste: number, modo: 'comprar' | 'vender'): number {
  const pct = modo === 'comprar' ? ajuste : -ajuste;
  return Math.max(0, Math.round(base * (1 + pct / 100)));
}

export function mensagemFaixa(f: FaixaPechincha, ajuste: number): string {
  const v = Math.abs(ajuste);
  switch (f) {
    case 'critico': return `O mercador ri e se rende: cede ${v}% hoje.`;
    case 'sucesso_maior': return `Você convence o mercador com folga: ele cede ${v}% hoje.`;
    case 'sucesso': return `O mercador cede ${v}% hoje.`;
    case 'falha': return 'O mercador não arreda o pé.';
    case 'falha_critica': return `O mercador se ofende: preços ${v}% mais caros para você hoje.`;
  }
}
