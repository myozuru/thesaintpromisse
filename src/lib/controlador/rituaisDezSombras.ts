import type { InvocacaoControlador, RitualDezSombras, TipoRitualDezSombras } from './tipos';

interface ComponenteQuimera {
  id: string;
  nome: string;
}

export interface EstadoComponenteQuimera extends ComponenteQuimera {
  encontrado: boolean;
  domado: boolean;
}

const COMPONENTES_POR_QUIMERA: Record<string, readonly ComponenteQuimera[]> = {
  totalidade: [
    { id: 'cao-branco', nome: 'Cão Divino Branco' },
    { id: 'cao-preto', nome: 'Cão Divino Preto' },
  ],
  'abismo-desconhecido-do-poco': [
    { id: 'sapo', nome: 'Gama' },
    { id: 'nue', nome: 'Nue' },
  ],
  'nue-totalidade': [
    { id: 'nue', nome: 'Nue' },
    { id: 'grande-serpente', nome: 'Orochi (Grande Serpente)' },
  ],
  agito: [
    { id: 'nue', nome: 'Nue' },
    { id: 'grande-serpente', nome: 'Orochi (Grande Serpente)' },
    { id: 'cervo-circular', nome: 'Cervo Circular' },
    { id: 'tigre-funebre', nome: 'Tigre Fúnebre' },
  ],
};

const ESTADOS_ATIVOS = new Set<RitualDezSombras['estado']>(['solicitado', 'em_andamento']);

export function idPerfilDezSombras(invocacao: Pick<InvocacaoControlador, 'subcategoria'>): string | null {
  const prefixo = 'dez-sombras:';
  if (!invocacao.subcategoria?.startsWith(prefixo)) return null;
  return invocacao.subcategoria.slice(prefixo.length);
}

export function tipoRitualDezSombras(invocacao: InvocacaoControlador): TipoRitualDezSombras | null {
  if (invocacao.pacoteRegras !== 'dez-sombras' || invocacao.domado !== false || invocacao.perdaPermanente) return null;
  return invocacao.formaDerivada ? 'quimera' : 'domesticacao';
}

export function requisitosComponentesQuimera(
  forma: InvocacaoControlador,
  catalogo: readonly InvocacaoControlador[],
): EstadoComponenteQuimera[] {
  const idForma = idPerfilDezSombras(forma);
  const componentes = idForma ? COMPONENTES_POR_QUIMERA[idForma] : undefined;
  if (!componentes) return [];

  return componentes.map(componente => {
    const ficha = catalogo.find(item =>
      item.pacoteRegras === 'dez-sombras' &&
      !item.formaDerivada &&
      idPerfilDezSombras(item) === componente.id,
    );
    return {
      ...componente,
      encontrado: Boolean(ficha),
      domado: ficha?.domado === true,
    };
  });
}

export function ritualPodeComecar(
  invocacao: InvocacaoControlador,
  catalogo: readonly InvocacaoControlador[],
): boolean {
  const tipo = tipoRitualDezSombras(invocacao);
  if (!tipo) return false;
  if (tipo === 'domesticacao') return true;
  const requisitos = requisitosComponentesQuimera(invocacao, catalogo);
  return requisitos.length > 0 && requisitos.every(item => item.encontrado && item.domado);
}

export function ritualAtivoParaAlvo(
  rituais: readonly RitualDezSombras[],
  invocacaoId: string,
): RitualDezSombras | undefined {
  return [...rituais].reverse().find(ritual =>
    ritual.alvoInvocacaoId === invocacaoId && ESTADOS_ATIVOS.has(ritual.estado),
  );
}

export function ritualPodeSerConcluido(
  ritual: RitualDezSombras,
  catalogo: readonly InvocacaoControlador[],
): boolean {
  if (ritual.estado !== 'em_andamento') return false;
  const alvo = catalogo.find(item => item.id === ritual.alvoInvocacaoId);
  return Boolean(alvo && ritualPodeComecar(alvo, catalogo));
}
