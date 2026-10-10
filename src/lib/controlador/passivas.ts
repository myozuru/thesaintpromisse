import type { DamageType } from '@/types';
import { EfeitoPassivoInvocacaoSchema } from '@/lib/invocacoes/schema';
import type { InvocacaoControlador } from './tipos';

type Grau = NonNullable<InvocacaoControlador['grau']>;

const bonusVida: Record<Grau, number> = { quarto: 5, terceiro: 10, segundo: 15, primeiro: 20, especial: 30 };
const bonusTeste: Record<Grau, number> = { quarto: 2, terceiro: 4, segundo: 6, primeiro: 8, especial: 10 };
const reducaoDano: Record<Grau, number> = { quarto: 2, terceiro: 4, segundo: 6, primeiro: 8, especial: 12 };

function normalizar(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '');
}

function efeitos(modelo: Pick<InvocacaoControlador, 'caracteristicas'>) {
  return (modelo.caracteristicas ?? []).flatMap(caracteristica => {
    if (!caracteristica || typeof caracteristica !== 'object' || Array.isArray(caracteristica)) return [];
    const raw = (caracteristica as Record<string, unknown>).efeitoOperacional;
    const validado = EfeitoPassivoInvocacaoSchema.safeParse(raw);
    return validado.success ? [validado.data] : [];
  });
}

/** Características equivalentes não acumulam: aplica o maior bônus do mesmo tipo. */
export function bonusPVCaracteristicas(modelo: Pick<InvocacaoControlador, 'grau' | 'caracteristicas'>): number {
  if (!modelo.grau || !modelo.grau.match(/^(quarto|terceiro|segundo|primeiro|especial)$/)) return 0;
  return efeitos(modelo).some(efeito => efeito.tipo === 'pv_maximo') ? bonusVida[modelo.grau as Grau] : 0;
}

/** Bônus de característica em uma perícia específica; usa a tabela integral do livro. */
export function bonusPericiaCaracteristicas(
  modelo: Pick<InvocacaoControlador, 'grau' | 'caracteristicas'>,
  pericia: string,
): number {
  if (!modelo.grau || !modelo.grau.match(/^(quarto|terceiro|segundo|primeiro|especial)$/)) return 0;
  const chave = normalizar(pericia);
  return efeitos(modelo).some(efeito => efeito.tipo === 'bonus_pericia' && normalizar(efeito.pericia) === chave)
    ? bonusTeste[modelo.grau as Grau]
    : 0;
}

/** RD permanente por tipo; características duplicadas do mesmo tipo não acumulam. */
export function reducaoDanoCaracteristicas(
  modelo: Pick<InvocacaoControlador, 'grau' | 'caracteristicas'>,
  tipoDano?: DamageType,
): number {
  if (!tipoDano || !modelo.grau || !modelo.grau.match(/^(quarto|terceiro|segundo|primeiro|especial)$/)) return 0;
  return efeitos(modelo).some(efeito => efeito.tipo === 'reducao_dano' && efeito.tipoDano === tipoDano)
    ? reducaoDano[modelo.grau as Grau]
    : 0;
}
