import type { Character } from '@/types';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { ROTULOS_PERICIAS } from '@/lib/omni/constantesDoSistema';
import type { InvocacaoControlador } from './tipos';
import { bonusPericiaCaracteristicas } from './passivas';

type AcaoComRolagem = InvocacaoControlador['acoes'][number];

const normalizar = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function modificadorAtributoInvocacao(valor: number): number {
  return Math.floor((valor - 10) / 2);
}

function atributoDaFicha(modelo: InvocacaoControlador, atributo: string | undefined): number | null {
  if (!atributo) return null;
  const valor = modelo.atributos?.[atributo as keyof NonNullable<InvocacaoControlador['atributos']>];
  return Number.isFinite(valor) ? valor! : null;
}

function lerConfiguracao(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

export interface BonusAtaqueInvocacao {
  total: number;
  atributo: 'forca' | 'destreza';
  tipo: 'corpo_a_corpo' | 'distancia';
  modificadorAtributo: number;
  metadeNivel: number;
  treinamento: number;
  bonusConfigurado: number;
}

/** Usa FOR/DEX e treinamento individual da ficha; o nível e bônus de treino
 * seguem a progressão do dono, como nas regras base de Shikigami. */
export function calcularBonusAtaqueInvocacao(
  dono: Pick<Character, 'level'>,
  modelo: InvocacaoControlador,
  acao: AcaoComRolagem,
): BonusAtaqueInvocacao | null {
  const treinoTipo = lerConfiguracao(modelo.ataqueTreinado, 'tipo');
  const tipo = acao.tipoAtaque
    ?? (treinoTipo === 'corpo_a_corpo' || treinoTipo === 'distancia' ? treinoTipo : undefined)
    ?? ((acao.alcanceM ?? 1.5) > 1.5 ? 'distancia' : 'corpo_a_corpo');
  const treinoAtributo = lerConfiguracao(modelo.ataqueTreinado, 'atributo');
  const atributo = acao.atributoAtaque
    ?? (treinoAtributo === 'forca' || treinoAtributo === 'destreza' ? treinoAtributo : undefined)
    ?? (tipo === 'distancia' ? 'destreza' : 'forca');
  // Fichas legadas sem o bloco de atributos usam modificador neutro; os
  // bônus de ataque explicitamente gravados continuam valendo.
  const valorAtributo = atributoDaFicha(modelo, atributo) ?? 10;

  const nivel = Math.max(1, Math.trunc(dono.level || 1));
  const metadeNivel = Math.floor(nivel / 2);
  const treinado = treinoTipo === tipo;
  const treinamento = treinado ? getTrainingBonusByLevel(nivel) : 0;
  const bonusTreinado = treinado && Number.isFinite(Number(lerConfiguracao(modelo.ataqueTreinado, 'bonus')))
    ? Number(lerConfiguracao(modelo.ataqueTreinado, 'bonus'))
    : 0;
  const bonusConfigurado = (acao.bonusAtaque ?? 0) + bonusTreinado;
  const modificadorAtributo = modificadorAtributoInvocacao(valorAtributo);

  return {
    total: modificadorAtributo + metadeNivel + treinamento + bonusConfigurado,
    atributo,
    tipo,
    modificadorAtributo,
    metadeNivel,
    treinamento,
    bonusConfigurado,
  };
}

export interface BonusPericiaInvocacao {
  total: number;
  atributo: 'inteligencia' | 'sabedoria';
  modificadorAtributo: number;
  metadeNivel: number;
  treinamento: number;
  treinada: boolean;
  bonusCaracteristica?: number;
}

export function invocacaoTreinadaNaPericia(modelo: InvocacaoControlador, pericia: string): boolean {
  const rotulo = ROTULOS_PERICIAS[pericia as keyof typeof ROTULOS_PERICIAS];
  const nomes = new Set([normalizar(pericia), ...(rotulo ? [normalizar(rotulo)] : [])]);
  return (modelo.periciasTreinadas ?? []).some(item => nomes.has(normalizar(item)));
}

export function calcularBonusPericiaInvocacao(
  dono: Pick<Character, 'level'>,
  modelo: InvocacaoControlador,
  pericia: string,
): BonusPericiaInvocacao | null {
  const atributo = modelo.atributoBasePericias;
  if (atributo !== 'inteligencia' && atributo !== 'sabedoria') return null;
  const valorAtributo = atributoDaFicha(modelo, atributo);
  if (valorAtributo === null) return null;

  const nivel = Math.max(1, Math.trunc(dono.level || 1));
  const treinada = invocacaoTreinadaNaPericia(modelo, pericia);
  const metadeNivel = Math.floor(nivel / 2);
  const treinamento = treinada ? getTrainingBonusByLevel(nivel) : 0;
  const modificadorAtributo = modificadorAtributoInvocacao(valorAtributo);
  const bonusCaracteristica = bonusPericiaCaracteristicas(modelo, pericia);
  return {
    total: modificadorAtributo + metadeNivel + treinamento + bonusCaracteristica,
    atributo,
    modificadorAtributo,
    metadeNivel,
    treinamento,
    treinada,
    ...(bonusCaracteristica > 0 ? { bonusCaracteristica } : {}),
  };
}

/** Bônus fixo de dano previsto na tabela oficial; grau especial soma o dobro
 * do modificador. A ficha pode sobrescrever o multiplicador para regras próprias. */
export function calcularBonusDanoInvocacao(
  modelo: InvocacaoControlador,
  acao: AcaoComRolagem,
  teste: 'ataque' | 'resistencia',
): number {
  const atributo = acao.atributoDano
    ?? (teste === 'ataque' ? acao.atributoAtaque : acao.atributoCD);
  const valor = atributoDaFicha(modelo, atributo);
  if (valor === null) return 0;
  const padrao = modelo.grau === 'especial' ? 2 : 1;
  const configurado = acao.multiplicadorDanoAtributo;
  const multiplicador = Number.isInteger(configurado)
    ? Math.max(0, Math.min(5, configurado!))
    : padrao;
  return modificadorAtributoInvocacao(valor) * multiplicador;
}

export function calcularCDInvocacao(
  dono: Pick<Character, 'level'>,
  modelo: InvocacaoControlador,
  atributo: AcaoComRolagem['atributoCD'],
): number | null {
  if (!atributo) return null;
  const valor = atributoDaFicha(modelo, atributo);
  if (valor === null) return null;
  const nivel = Math.max(1, Math.trunc(dono.level || 1));
  return 10 + Math.max(1, Math.floor(nivel / 2)) + modificadorAtributoInvocacao(valor);
}

export function resolverAcertoInvocacao(
  natural: number,
  bonus: number,
  defesa: number,
  margemCritico = 20,
): { total: number; acertou: boolean; critico: boolean; falhaCritica: boolean } {
  const total = natural + bonus;
  const falhaCritica = natural === 1;
  const critico = !falhaCritica && natural >= margemCritico;
  return {
    total,
    acertou: critico || (!falhaCritica && total >= defesa),
    critico,
    falhaCritica,
  };
}

export interface FormulaDanoInvocacao {
  dados: { count: number; sides: number }[];
  fixo: number;
}

/** Parser restrito a dados e bônus fixos; não avalia código, variáveis ou
 * operadores arbitrários. Aceita, por exemplo, 2d12+1d6+3. */
export function parseFormulaDanoInvocacao(formula: string): FormulaDanoInvocacao | null {
  const normalizada = formula.replace(/\s+/g, '').toLowerCase();
  if (!normalizada || normalizada.length > 160 || normalizada.startsWith('+') || normalizada.endsWith('+')) return null;
  const partes = normalizada.split('+');
  const dados: FormulaDanoInvocacao['dados'] = [];
  let fixo = 0;
  let quantidadeTotal = 0;
  for (const parte of partes) {
    const dado = parte.match(/^(\d{1,2})d(4|6|8|10|12|20)$/);
    if (dado) {
      const count = Number(dado[1]);
      const sides = Number(dado[2]);
      if (count < 1 || count > 40) return null;
      quantidadeTotal += count;
      if (quantidadeTotal > 40) return null;
      dados.push({ count, sides });
      continue;
    }
    if (!/^\d{1,4}$/.test(parte)) return null;
    fixo += Number(parte);
    if (fixo > 2000) return null;
  }
  return dados.length ? { dados, fixo } : null;
}

export function multiplicarDadosCriticos(
  dados: FormulaDanoInvocacao['dados'],
  multiplicador: number,
): FormulaDanoInvocacao['dados'] {
  const fator = Number.isInteger(multiplicador) ? Math.min(5, Math.max(1, multiplicador)) : 2;
  return dados.map(dado => ({ ...dado, count: dado.count * fator }));
}
