import type { InvocacaoControlador } from './tipos';
import { criarPacoteDezSombras, possuiTecnicaDezSombras } from './dezSombras';
import { criarFormasDerivadasDezSombras } from './dezSombrasDerivadas';

/** Prepara as fichas iniciais sem conceder domesticação que não esteja no pacote-base. */
export function criarInvocacoesIniciaisDezSombras(
  donoCharacterId: string,
  isControlador: boolean,
  tecnicaAmaldicoada?: string,
): InvocacaoControlador[] | undefined {
  if (!isControlador) return undefined;
  if (!possuiTecnicaDezSombras(tecnicaAmaldicoada)) return [];

  return [
    ...criarPacoteDezSombras(donoCharacterId),
    ...criarFormasDerivadasDezSombras(donoCharacterId),
  ];
}
