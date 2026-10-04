import { capturarCadeiaOmni } from './cadeiaEventos';
import { SEP_FONTE } from './contadores';

/** Dano sofrido tem a vítima como origem da carga; observação tem a vítima em ALVO. */
export function fonteDoContador(evento: string | undefined, usuarioId?: string, alvoId?: string): string | undefined {
  return evento === 'aoSofrerDano' ? usuarioId : alvoId ?? usuarioId;
}

/** Uma notificação por contador alterado; o orçamento acompanha callbacks assíncronos. */
export function notificarAtualizacaoContadores(usuarioId: string, antes: Record<string, number> = {}, depois: Record<string, number> = {}, incluirPassivas = false) {
  const nomes = new Set([...Object.keys(antes), ...Object.keys(depois)].filter(k => antes[k] !== depois[k]).map(k => k.split(SEP_FONTE)[0]));
  if (!nomes.size) return;
  const cadeia = capturarCadeiaOmni();
  void import('./eventBus').then(({ emitirEvento }) => {
    for (const nome of nomes) emitirEvento('aoAtualizarContador', {
      cadeia, usuarioId, origemNome: `Contador: ${nome}`,
      cena: { contador_anterior: antes[nome] ?? 0, contador_valor: depois[nome] ?? 0 },
      incluirPassivas,
    });
  });
}
