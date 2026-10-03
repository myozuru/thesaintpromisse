import { interpretarComposicao } from './interpretar';
import type { NoComposicao } from './composicao';

export interface DestinoComposto { caminho: string; contador?: { nome: string; fonte?: string } }

/** Autoriza destinos pela estrutura do recurso; filtros de leitura não ganham setters. */
export function destinoComposto(texto: string): DestinoComposto | undefined {
  const p = interpretarComposicao(texto.trim());
  if (!p.referencia || p.erro || p.consumido !== texto.trim().length) return;
  const partes: string[] = [];
  let raiz: NoComposicao = p.referencia.consulta;
  let fonte: string | undefined;
  while (raiz.tipo === 'operacao' || raiz.tipo === 'qualificador' || raiz.tipo === 'filtro') {
    if (raiz.componente === 'fonte' && raiz.argumentos) fonte = String(Object.values(raiz.argumentos)[0].valor);
    else partes.unshift(raiz.componente);
    raiz = raiz.entrada;
  }
  if (raiz.tipo !== 'selecao') return;
  if (raiz.componente === 'contador') {
    const nome = String(raiz.argumentos?.nome?.valor ?? '').trim().toLowerCase();
    return nome && !partes.length ? { caminho: `contador_${nome}`, contador: { nome, fonte } } : undefined;
  }
  const maximo = partes.at(-1) === 'max' || partes.at(-1) === 'maximo';
  if (maximo) partes.pop();
  if (['restante','restantes'].includes(partes.at(-1) ?? '')) partes.pop();
  if (raiz.componente === 'pericia' && partes.length === 1 && !maximo) return { caminho: `pericia_${partes[0]}` };
  let caminho = String(raiz.componente);
  if (caminho === 'bloqueio' && partes.join(' ') === 'total' && !maximo) return { caminho: 'bloqueio_total' };
  if (caminho === 'acao' && partes.length === 1 && ['comum','bonus'].includes(partes[0])) return { caminho: partes[0] === 'comum' ? 'ataques_restantes' : 'acao_bonus' };
  if (['reacoes','reacao','ataques','oportunidade'].includes(caminho) && (!partes.length || (partes.length === 1 && ['restante','restantes'].includes(partes[0])))) {
    const base = caminho === 'ataques' ? 'ataques' : caminho === 'oportunidade' ? 'ado' : 'reacoes';
    return { caminho: base + (maximo ? '_max' : '_restantes') };
  }
  if (['vida', 'pe'].includes(caminho) && ['temporaria', 'temporario', 'temporarios'].includes(partes[0])) {
    caminho += '_temp'; partes.shift();
  } else if (caminho === 'reserva' && partes.shift() === 'pe') caminho = 'reserva_pe';
  else if (caminho === 'slots' && partes.join(' ') === 'descanso curto') { caminho = 'dado_vida'; partes.length = 0; }
  if (partes.length || !['vida','vida_temp','pe','pe_temp','sorte','dado_vida','reserva_pe','defesa','esquiva','exaustao','fome'].includes(caminho)) return;
  if (maximo && !['vida','vida_temp','pe','sorte','dado_vida'].includes(caminho)) return;
  return { caminho: caminho + (maximo ? '_max' : '') };
}
