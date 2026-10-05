import type { Character } from '@/types';
import { DICIONARIO_CHAVES_OMNI } from './constantesDoSistema';
import { canonicalizarChave, CANONICAL_TO_LEGACY_PATH } from './keyAliases';
import { montarVariaveisDoPersonagem, projetarPersonagemParaOmni } from './resolvedor';
import { avaliarFormula } from './parser';
import { resolverParticipanteNatural, type ContextoNatural, type PapelNatural } from './contextoNatural';

export type ConsultaNatural =
  | { tipo: 'recurso'; papel: PapelNatural; chave: string }
  | { tipo: 'contador_gasto'; contador: string }
  | { tipo: 'distancia'; de: PapelNatural; ate: PapelNatural };

export interface AmbienteConsultaNatural {
  fichas: readonly Character[];
  tokens: readonly { id: string; fichaId: string }[];
  /** Obrigatória: o chamador define consultas internas autorizadas versus consultas do jogador. */
  podeConsultar: (fichaId: string, chave: string) => boolean;
  /** Usar o medidor oficial da cena; este módulo não inventa uma métrica. */
  medirDistancia?: (tokenOrigemId: string, tokenDestinoId: string) => number | undefined;
}

export type ResultadoConsultaNatural =
  | { ok: true; valor: number }
  | { ok: false; erro: { codigo: string; mensagem: string } };
const erro = (codigo: string, mensagem: string): ResultadoConsultaNatural => ({ ok: false, erro: { codigo, mensagem } });
const normalizar = (s: string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const recursosDaFicha = new Set(DICIONARIO_CHAVES_OMNI
  .filter(grupo => grupo.escopos.includes('USUARIO'))
  .flatMap(grupo => grupo.itens)
  .filter(item => !item.id.includes('<') && !item.id.includes('.'))
  .map(item => canonicalizarChave(item.id)));

/** Ponte estrita para consultas numéricas; não modifica parser ou fallback legados. */
export function consultarNatural(
  consulta: ConsultaNatural,
  contexto: ContextoNatural,
  ambiente: AmbienteConsultaNatural,
): ResultadoConsultaNatural {
  if (consulta.tipo === 'contador_gasto') {
    if (!/^contador_[a-z0-9_]+$/.test(consulta.contador)) return erro('CONTADOR_INVALIDO', 'Informe o contador nominal gasto.');
    if (!Object.hasOwn(contexto.cargasGastas, consulta.contador)) return erro('GASTO_AUSENTE', 'Não há gasto registrado deste contador nesta execução.');
    const quantidade = contexto.cargasGastas[consulta.contador];
    return Number.isSafeInteger(quantidade) && quantidade >= 0 ? { ok: true, valor: quantidade } : erro('VALOR_INVALIDO', 'Gasto registrado inválido.');
  }
  if (consulta.tipo === 'distancia') {
    const origem = resolverParticipanteNatural(contexto, consulta.de, ambiente.fichas, ambiente.tokens, true);
    if (!origem.ok) return origem;
    const destino = resolverParticipanteNatural(contexto, consulta.ate, ambiente.fichas, ambiente.tokens, true);
    if (!destino.ok) return destino;
    if (!ambiente.podeConsultar(origem.valor.fichaId, 'posicao') || !ambiente.podeConsultar(destino.valor.fichaId, 'posicao')) return erro('CONSULTA_NEGADA', 'Posição indisponível para esta consulta.');
    const distancia = ambiente.medirDistancia?.(origem.valor.tokenId!, destino.valor.tokenId!);
    return distancia !== undefined && Number.isFinite(distancia) && distancia >= 0
      ? { ok: true, valor: distancia }
      : erro('DISTANCIA_AUSENTE', 'A cena não forneceu uma distância válida entre os tokens.');
  }
  const sujeito = resolverParticipanteNatural(contexto, consulta.papel, ambiente.fichas, ambiente.tokens);
  if (!sujeito.ok) return sujeito;
  const raw = normalizar(consulta.chave);
  // Referências estruturadas já possuem sujeito: não aceitar uma expressão ou outro escopo como nome.
  if (!/^[a-z][a-z0-9_]*$/.test(raw)) return erro('CHAVE_INVALIDA', 'Use uma chave simples; sujeito e operações são informados separadamente.');
  const chave = canonicalizarChave(raw);
  const contador = /^contador_([a-z0-9_]+)$/.exec(raw);
  const flag = /^flag_[a-z0-9_]+$/.test(raw);
  if (!contador && !flag && !recursosDaFicha.has(chave)) return erro('CHAVE_DESCONHECIDA', 'Chave não registrada para consulta de ficha.');
  if (!ambiente.podeConsultar(sujeito.valor.fichaId, chave)) return erro('CONSULTA_NEGADA', 'Informação indisponível para esta consulta.');
  const ficha = ambiente.fichas.find(c => c.id === sujeito.valor.fichaId)!;
  if (contador || flag) {
    // Ler o namespace diretamente evita colisões com VIDA, FOR e outras variáveis do bag legado.
    const valor = contador ? ficha.omniCounters?.[contador[1]] ?? 0 : ficha.omniFlags?.[raw] ?? 0;
    return Number.isFinite(valor) ? { ok: true, valor } : erro('VALOR_INVALIDO', 'O recurso dinâmico contém valor não finito.');
  }
  const caminho = CANONICAL_TO_LEGACY_PATH[chave];
  if (caminho) {
    // Recursos/atributos de ficha não podem ser substituídos por um contador homônimo no bag.
    let valor: unknown = projetarPersonagemParaOmni(ficha);
    for (const parte of caminho.split('.')) valor = valor && typeof valor === 'object' ? (valor as Record<string, unknown>)[parte] : undefined;
    return typeof valor === 'number' && Number.isFinite(valor) ? { ok: true, valor } : erro('RECURSO_INDISPONIVEL', 'A ficha não expõe o recurso solicitado.');
  }
  const resultado = avaliarFormula(`@USUARIO.${raw}`, montarVariaveisDoPersonagem(ficha));
  if (resultado.diagnosticos.length) return erro('RECURSO_INDISPONIVEL', resultado.diagnosticos.map(d => d.mensagem).join('; '));
  return Number.isFinite(resultado.valor) ? { ok: true, valor: resultado.valor } : erro('VALOR_INVALIDO', 'O recurso não contém um valor finito.');
}
