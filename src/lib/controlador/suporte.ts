import type { DamageType } from '@/types';
import type { Character } from '@/types';
import { formatDamage, parseDamage, stepDamage, type DamageDice } from '@/lib/damageStep';
import type { ConfiguracaoEfeitoSuporteInvocacao } from '@/lib/invocacoes/schema';
import type { InvocacaoControlador } from './tipos';

type Grau = NonNullable<InvocacaoControlador['grau']>;
type Efeito = ConfiguracaoEfeitoSuporteInvocacao['efeito'];

const curaUnico: Record<Grau, DamageDice> = {
  quarto: [{ count: 1, sides: 4 }],
  terceiro: [{ count: 1, sides: 8 }],
  segundo: [{ count: 1, sides: 12 }],
  primeiro: [{ count: 1, sides: 12 }, { count: 1, sides: 8 }],
  especial: [{ count: 2, sides: 12 }, { count: 1, sides: 6 }],
};

const curaMultiplos: Partial<Record<Grau, DamageDice>> = {
  terceiro: [{ count: 1, sides: 4 }],
  segundo: [{ count: 1, sides: 6 }],
  primeiro: [{ count: 1, sides: 8 }],
  especial: [{ count: 1, sides: 12 }, { count: 1, sides: 4 }],
};

const bonusAuxilio: Record<Grau, number> = {
  quarto: 1,
  terceiro: 2,
  segundo: 3,
  primeiro: 4,
  especial: 5,
};

const rdAuxilio: Record<Grau, number> = {
  quarto: 2,
  terceiro: 4,
  segundo: 6,
  primeiro: 8,
  especial: 10,
};

const danoAuxilio: Record<Grau, string> = {
  quarto: '1d6',
  terceiro: '1d10',
  segundo: '2d6',
  primeiro: '2d8',
  especial: '2d12',
};
const alcanceCura: Record<Grau, number> = { quarto: 6, terceiro: 9, segundo: 15, primeiro: 21, especial: 30 };

export function alcanceCuraInvocacao(grau: InvocacaoControlador['grau']): number | undefined {
  return grau ? alcanceCura[grau] : undefined;
}

export type EfeitoSuporteCalculado =
  | { tipo: 'cura'; dados: DamageDice; bonus: number; alvos: 'unico' | 'multiplos' }
  | { tipo: 'defesa' | 'acerto'; valor: number }
  | { tipo: 'dano_adicional'; formula: string }
  | { tipo: 'reducao_dano'; valor: number; tiposDano: DamageType[] };

export type ResultadoCalculoSuporte =
  | { ok: true; efeito: EfeitoSuporteCalculado }
  | { ok: false; motivo: string };

function modificadorAtributo(valor: number): number {
  return Math.floor((valor - 10) / 2);
}

function categoriaComplexa(acao: Pick<InvocacaoControlador['acoes'][number], 'categoriaAcao'>): boolean {
  return acao.categoriaAcao === 'acao_complexa' || acao.categoriaAcao === 'acao_comum';
}

function categoriaSimples(acao: Pick<InvocacaoControlador['acoes'][number], 'categoriaAcao'>): boolean {
  return acao.categoriaAcao === 'acao_simples' || acao.categoriaAcao === 'acao_bonus';
}

/**
 * Converte as tabelas de suporte do livro em valores executáveis. `repeticoes`
 * conta usos anteriores do mesmo tipo de auxílio pela mesma instância nesta
 * rodada; não inclui o uso que está sendo calculado.
 */
export function calcularEfeitoSuporte(
  modelo: Pick<InvocacaoControlador, 'grau' | 'atributos'>,
  acao: Pick<InvocacaoControlador['acoes'][number], 'categoriaAcao' | 'efeitoSuporte'>,
  repeticoes = 0,
): ResultadoCalculoSuporte {
  const config = acao.efeitoSuporte;
  if (!config) return { ok: false, motivo: 'Ação de suporte sem efeito estruturado.' };
  if (!modelo.grau || !(modelo.grau in curaUnico)) return { ok: false, motivo: 'Defina o grau da invocação na ficha.' };
  if (!Number.isInteger(repeticoes) || repeticoes < 0) return { ok: false, motivo: 'Contagem de auxílios inválida.' };

  const grau = modelo.grau as Grau;
  const complexa = categoriaComplexa(acao);
  const simples = categoriaSimples(acao);
  if (!complexa && !simples) return { ok: false, motivo: 'A ação precisa estar configurada como Simples/Bônus ou Complexa/Comum.' };

  if (config.efeito === 'cura') {
    if (!complexa) return { ok: false, motivo: 'Ações de cura exigem uma Ação Complexa.' };
    const dados = config.alvos === 'multiplos' ? curaMultiplos[grau] : curaUnico[grau];
    if (!dados) return { ok: false, motivo: 'O livro não oferece cura para múltiplos alvos neste grau.' };
    const atributo = config.atributoCura;
    if (atributo !== 'sabedoria' && atributo !== 'presenca') return { ok: false, motivo: 'Escolha Sabedoria ou Presença como atributo de cura na ficha.' };
    const valorAtributo = modelo.atributos?.[atributo];
    if (!Number.isFinite(valorAtributo)) return { ok: false, motivo: `Defina ${atributo === 'sabedoria' ? 'Sabedoria' : 'Presença'} na ficha.` };
    const multiplicador = grau === 'especial' ? 2 : 1;
    return {
      ok: true,
      efeito: {
        tipo: 'cura',
        dados: dados.map(dado => ({ ...dado })),
        bonus: modificadorAtributo(valorAtributo!) * multiplicador,
        alvos: config.alvos,
      },
    };
  }

  if (config.alvos !== 'unico') return { ok: false, motivo: 'Este tipo de auxílio atende um alvo por uso.' };

  if (config.efeito === 'defesa' || config.efeito === 'acerto') {
    if (!simples) return { ok: false, motivo: 'O bônus Complexo exige uma regra de arredondamento para valores fracionários; configure esta ação como Simples.' };
    return { ok: true, efeito: { tipo: config.efeito, valor: Math.max(0, bonusAuxilio[grau] - repeticoes) } };
  }

  if (config.efeito === 'dano_adicional') {
    let delta = (complexa ? 3 : 0) - 2 * repeticoes;
    const dados = stepDamage(parseDamage(danoAuxilio[grau]), delta);
    const dano = dados.reduce((total, dado) => total + dado.count * dado.sides, 0) < 4
      ? [{ count: 1, sides: 4 }]
      : dados;
    return { ok: true, efeito: { tipo: 'dano_adicional', formula: formatDamage(dano) } };
  }

  const tiposDano = (config.tiposDano ?? []) as DamageType[];
  if (!tiposDano.length) return { ok: false, motivo: 'Escolha ao menos um tipo de dano para a redução.' };
  const valorBase = rdAuxilio[grau] - 2 * (tiposDano.length - 1);
  const complexo = complexa ? valorBase * 1.5 : valorBase;
  return {
    ok: true,
    efeito: { tipo: 'reducao_dano', valor: Math.max(0, complexo - repeticoes), tiposDano },
  };
}

export function ehEfeitoSuporteInvocacao(efeito: unknown): efeito is Efeito {
  return efeito === 'cura' || efeito === 'defesa' || efeito === 'acerto' || efeito === 'dano_adicional' || efeito === 'reducao_dano';
}

export function capacidadeEnergiaReversaInvocacao(modelo: Pick<InvocacaoControlador, 'possuiEnergiaReversa'>, dono: Pick<Character, 'hasEnergiaReversa'>): boolean {
  return Boolean(modelo.possuiEnergiaReversa || dono.hasEnergiaReversa);
}
