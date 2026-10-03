import type { EntidadeOmni } from './tipos';
import { localizarComposicoes } from './componentes/expressoes';
import type { NoComposicao } from './componentes/composicao';

/** Liga o mostrador às referências da entidade, não a todos os contadores da ficha. */
export function contadoresDaEntidade(entidade: EntidadeOmni): string[] {
  const nomes = new Set<string>();
  const adicionar = (s: unknown) => { if (typeof s === 'string' && s.trim()) nomes.add(s.trim().toLowerCase()); };
  const arvore = (no: NoComposicao) => {
    if (no.tipo === 'selecao' && no.componente === 'contador') adicionar(no.argumentos?.nome?.valor);
    if ('entrada' in no) arvore(no.entrada);
    if (no.tipo === 'comparacao') { arvore(no.esquerdo); arvore(no.direito); }
    if (no.tipo === 'vinculo') arvore(no.referencia);
  };
  const campos = new Set(['formula','expressao','condition','condicao','counterCap','caminho','caminhoAlvo','caminhoRecurso','resourcePath','dano','dadosPorCarga','custoPE']);
  function visitar(v: unknown, campo = '') {
    if (typeof v === 'string') {
      if (!campos.has(campo)) return;
      for (const t of localizarComposicoes(v, true)) if (t.referencia.contexto === 'USUARIO') arvore(t.referencia.consulta);
      for (const m of v.matchAll(/(?:@?(USUARIO|ALVO|CENA)\.)?\bcontador_([\p{L}\p{N}_-]+)/giu)) if (!m[1] || m[1].toUpperCase() === 'USUARIO') adicionar(m[2]);
      return;
    }
    if (Array.isArray(v)) { v.forEach(x => visitar(x)); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (o.alvo === 'ALVO' || o.formato === 'omni.composicao.v1' && o.contexto !== 'USUARIO') return;
    if (o.formato === 'omni.composicao.v1') { arvore(o.consulta as NoComposicao); return; }
    if (typeof o.acao === 'string' && o.acao.endsWith('_CONTADOR') && o.alvoAplicacao !== 'ALVO') adicionar(typeof o.caminhoAlvo === 'string' ? o.caminhoAlvo.replace(/^contador_/, '') : o.caminhoAlvo);
    for (const [k, x] of Object.entries(o)) {
      if (['consumirContador','gastar_cargas'].includes(k) && x && typeof x === 'object') adicionar((x as { nome?: string }).nome);
      if (k === 'caminhoAlvo' && o.alvoAplicacao === 'ALVO') continue;
      visitar(x, k);
    }
  }
  visitar(entidade);
  return [...nomes].sort((a, b) => a.localeCompare(b));
}
