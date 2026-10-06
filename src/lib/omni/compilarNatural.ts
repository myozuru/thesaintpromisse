import { analisarFraseNatural, type AcaoNatural, type FraseNatural, type PredicadoNatural } from './gramaticaNatural';
import { mapearAtomoEventoNatural, type EventoNaturalMapeado } from './eventosNaturais';
import { autoArrobaExpressao, parseOmniScript, type OmniScriptParseOpts, type OmniScriptResultado } from './omniScript';
import type { CombatEffect } from './tipos';

export interface DiagnosticoCompilacaoNatural { codigo: string; mensagem: string; inicio: number; fim: number }
export interface ResultadoCompilacaoNatural { efeitos: CombatEffect[]; erros: DiagnosticoCompilacaoNatural[] }

const limpar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const idCondicao = (s: string) => limpar(s).replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

function atomos(p: PredicadoNatural, out: Array<Extract<PredicadoNatural, { tipo: 'atomo' }>> = []) {
  if (p.tipo === 'atomo') out.push(p);
  else { atomos(p.esquerda, out); atomos(p.direita, out); }
  return out;
}

function contemEvento(p: PredicadoNatural): boolean {
  return p.tipo === 'atomo' ? p.classe === 'evento' : contemEvento(p.esquerda) || contemEvento(p.direita);
}
function eventoMisturadoComOu(p: PredicadoNatural): boolean {
  if (p.tipo === 'atomo') return false;
  if (p.tipo === 'ou' && (contemEvento(p.esquerda) || contemEvento(p.direita))) return true;
  return eventoMisturadoComOu(p.esquerda) || eventoMisturadoComOu(p.direita);
}

function combinarLogica(p: PredicadoNatural, eventos: Map<string, EventoNaturalMapeado>): string | undefined {
  if (p.tipo === 'atomo') {
    if (p.classe === 'evento') return '1';
    const s = limpar(p.texto);
    let m = s.match(/^(usuario|alvo) tem condicao ([\w-]+)$/);
    if (m) return `@${m[1]}.tem_condicao_${idCondicao(m[2])} > 0`;
    m = s.match(/^(usuario|alvo) condicao ([\w-]+) ha (\d+) rodadas?$/);
    if (m) return `@${m[1]}.condicao_rodadas_desde_${idCondicao(m[2])} >= ${m[3]}`;
    m = s.match(/^(usuario|alvo) rodadas_condicao ([\w-]+)\s*(>=|<=|==|=|<|>)\s*(\d+)$/);
    if (m) return `@${m[1]}.condicao_rodadas_desde_${idCondicao(m[2])} ${m[3] === '=' ? '==' : m[3]} ${m[4]}`;
    m = s.match(/^distancia\s*(<=|>=|==|=|<|>)\s*([\d.,]+)\s*(?:m|metros?)?$/);
    if (m) return `@CENA.distancia ${m[1] === '=' ? '==' : m[1]} ${m[2].replace(',', '.')}`;
    m = s.match(/^(usuario|alvo) ([a-z][a-z0-9_]*(?:\s+[a-z][a-z0-9_]*)?)\s*(>=|<=|==|=|!=|<|>)\s*(.+)$/);
    if (m) {
      const escopo = m[1].toUpperCase(), chave = idCondicao(m[2]).replace(/_/g, '_');
      return `@${escopo}.${chave} ${m[3] === '=' ? '==' : m[3]} ${m[4].replace(',', '.')}`;
    }
    // Fórmula explicitamente escrita mantém a biblioteca inteira de keys,
    // aliases e funções já suportada pelo parser em vez de inventar getters.
    if (/[<>=]/.test(s)) return autoArrobaExpressao(s);
    return undefined;
  }
  const a = combinarLogica(p.esquerda, eventos), b = combinarLogica(p.direita, eventos);
  return a && b ? `(${a}) ${p.tipo === 'e' ? '&&' : '||'} (${b})` : undefined;
}

function expressaoFiltro(e: EventoNaturalMapeado): string[] {
  const f = e.filtros, out: string[] = [];
  if (f.sujeito === 'outro_aliado') out.push('@CENA.sujeito_eh_aliado > 0');
  if (f.sujeito === 'outro_inimigo') out.push('@CENA.sujeito_eh_aliado == 0');
  if (f.raioMetros !== undefined) out.push(`@CENA.distancia <= ${f.raioMetros}`);
  if (f.agressor === 'inimigo') out.push('@CENA.outro_eh_inimigo > 0');
  if (f.agressor === 'aliado') out.push('@CENA.outro_eh_aliado > 0');
  if (f.acerto === 'critico') out.push('@DANO.foi_critico > 0');
  if (f.tipoAtaque === 'corpo_a_corpo') out.push('@DANO.tipo_ataque == 1');
  if (f.tipoAtaque === 'a_distancia') out.push('@DANO.tipo_ataque == 2');
  return out;
}

function acaoParaComando(a: AcaoNatural): { comando?: string; erro?: string; afterDamage?: boolean; contador?: boolean } {
  const t = a.texto.trim(), n = limpar(t);
  let m = n.match(/^acumular\s+(.+?)\s+(?:em\s+)?contador_([a-z0-9_]+)(?:\s+ate\s+(.+?))?(?:\s+(por_fonte))?(?:\s+teto_aliado\s+(.+?)\s+por\s+(rodada|descanso))?$/);
  if (m) return { comando: `somar ${m[1]} em contador_${m[2]}${m[3] ? ` ate ${m[3]}` : ''}${m[4] ? ' por_fonte' : ''}${m[5] ? ` teto_aliado ${m[5]} por ${m[6]}` : ''}`, afterDamage: true, contador:true };
  m = n.match(/^causar\s+(.+?)\s+(?:de\s+)?dano\s+([a-z_]+)(?:\s+(?:em|no|na)\s+(usuario|alvo))?$/);
  if (m) return { comando: `subtrair ${m[1]} em ${m[3] ?? 'alvo'}.vida tipo ${m[2]}` };
  m = n.match(/^curar\s+(.+?)\s+(?:de\s+)?(vida|pv|pe)(?:\s+(?:em|no|na))?\s+(usuario|alvo)$/);
  if (m) return { comando: `somar ${m[1]} em ${m[3]}.${m[2] === 'pv' ? 'vida' : m[2]}` };
  m = n.match(/^(?:restaurar|recuperar)\s+(.+?)\s+(?:de\s+)?(vida|pv|pe)\s+(?:em|no|na)\s+(usuario|alvo)$/);
  if (m) return { comando: `somar ${m[1]} em ${m[3]}.${m[2] === 'pv' ? 'vida' : m[2]}` };
  m = n.match(/^aplicar\s+([\w-]+)(?:\s+por\s+(\d+)\s+rodadas?)?(?:\s+(?:em|no|na)\s+(usuario|alvo))?$/);
  if (m) return { comando: `aplicar ${m[1]}${m[2] ? ` rodadas ${m[2]}` : ''} em ${m[3] ?? 'alvo'}` };
  m = n.match(/^remover\s+([\w-]+|todas)(?:\s+(?:em|do|da|no|na)\s+(usuario|alvo))?$/);
  if (m) return { comando: `remover ${m[1]} em ${m[2] ?? 'alvo'}` };
  m = n.match(/^gastar\s+(tudo|\d+(?:[.,]\d+)?)\s+(?:em\s+)?(contador_([a-z0-9_]+)|[a-z][a-z0-9_]*)$/);
  if (m) return { comando:`subtrair ${m[1] === 'tudo' ? 'tudo' : m[1].replace(',', '.')} em usuario.contador_${m[3] ?? m[2]}` };
  m = t.match(/^(transferir|anular|ignorar|imune|desimune|rolar|bot[aã]o)\b[\s\S]*$/i);
  if (m) return { comando:t };
  m = n.match(/^(receber|conceder)\s+(.+?)\s+em\s+(usuario|alvo)\.([a-z0-9_]+)$/);
  if (m) return { comando:`somar ${m[2]} em ${m[3]}.${m[4]}` };
  // A forma canônica aceita os mesmos operadores de mutação do script existente.
  m = t.match(/^(somar|subtrair|definir|reduzir)\s+(.+?)\s+em\s+((?:usuario|alvo)\.)?[\w.]+(?:\s+tipo\s+[\w-]+)?$/i);
  if (m) return { comando: t };
  return { erro: `Ação natural ainda sem semântica executável: "${t}".` };
}

function compilacaoDaFrase(ast: FraseNatural, fonteNatural: string, opcoes: OmniScriptParseOpts): ResultadoCompilacaoNatural {
  if (eventoMisturadoComOu(ast.condicao)) return { efeitos:[], erros:[{ codigo:'EVENTO_EM_DISJUNCAO', mensagem:'Não combine um evento com "ou"; escreva regras separadas para cada evento ou use "e" para acrescentar condições.', ...ast.condicao.intervalo }] };
  const eventosPredicado = atomos(ast.condicao).filter(a => a.classe === 'evento');
  if (!eventosPredicado.length) return { efeitos: [], erros: [{ codigo:'EVENTO_OBRIGATORIO', mensagem:'A regra executável precisa indicar um evento de disparo (por exemplo: ao sofrer dano).', ...ast.condicao.intervalo }] };
  const eventos: EventoNaturalMapeado[] = [];
  for (const p of eventosPredicado) {
    const e = mapearAtomoEventoNatural(p.texto);
    if (!e) return { efeitos: [], erros: [{ codigo:'EVENTO_NAO_SUPORTADO', mensagem:`Evento ainda sem ligação ao motor: "${p.texto}".`, ...p.intervalo }] };
    eventos.push(e);
  }
  if (eventos.length !== 1) return { efeitos: [], erros: [{ codigo:'EVENTOS_MULTIPLOS', mensagem:'Por enquanto cada regra executável deve ter exatamente um evento; divida eventos diferentes em regras separadas.', ...ast.condicao.intervalo }] };
  const mapped = eventos[0];
  const eventoToken = mapped.evento;
  const filtros = expressaoFiltro(mapped);
  const estados = combinarLogica(ast.condicao, new Map());
  const comandos: string[] = [];
  let afterDamage = false;
  let acumulaContador = false;
  for (const a of ast.acoes) {
    const convertido = acaoParaComando(a);
    if (!convertido.comando) return { efeitos: [], erros: [{ codigo:'ACAO_NAO_SUPORTADA', mensagem:convertido.erro!, ...a.intervalo }] };
    comandos.push(convertido.comando);
    afterDamage ||= !!convertido.afterDamage;
    acumulaContador ||= !!convertido.contador;
  }
  // Para cargas ligadas a dano, exige PV efetivamente perdidos. Perda de
  // escudo/barreira ou mitigação completa não conta como dano recebido.
  if (acumulaContador && ['aoSofrerDano','aoAliadoSofrerDano','aoInimigoSofrerDano'].includes(eventoToken)) filtros.push('@DANO.vida_perdida > 0');
  // O átomo de evento é substituído por verdadeiro; os demais estados são avaliados.
  const condicao = [ ...filtros, ...(estados && estados !== '1' ? [estados] : []) ].join(' && ');
  const fonte = `@${eventoToken} -> ${condicao ? `se ${condicao} entao ` : ''}(${comandos.join(', ')})`;
  // Contadores no modelo natural são sempre do portador; alvos explícitos
  // nos demais comandos continuam escritos no próprio comando.
  const parse = parseOmniScript(fonte, { ...opcoes, defaultTarget:'USUARIO' });
  if (parse.erros.length) return { efeitos: [], erros: parse.erros.map(e => ({ codigo:'ERRO_COMPILACAO', mensagem:e.mensagem, inicio:e.posicao, fim:e.posicao + e.trecho.length })) };
  const efeitos = parse.efeitos.map(e => ({ ...e, naturalSource:fonteNatural, ...(afterDamage ? { triggerAfterDamage:true } : {}) }));
  return { efeitos, erros:[] };
}

/** Compila sintaxe natural para os efeitos atômicos que o motor já executa. */
export function compilarScriptNatural(fonte: string, opcoes: OmniScriptParseOpts = {}): ResultadoCompilacaoNatural {
  const linhas = fonte.split(/\r?\n/).map((s, i) => ({ texto:s.trim(), offset:fonte.split(/\r?\n/).slice(0, i).reduce((n, l) => n + l.length + 1, 0) })).filter(x => x.texto);
  const efeitos: CombatEffect[] = [], erros: DiagnosticoCompilacaoNatural[] = [];
  if (!linhas.length) return { efeitos, erros:[{ codigo:'REGRA_VAZIA', mensagem:'Escreva ao menos uma regra natural.', inicio:0, fim:fonte.length }] };
  for (const linha of linhas) {
    const resultado = analisarFraseNatural(linha.texto);
    if (!resultado.ast) {
      erros.push(...resultado.erros.map(e => ({ codigo:'GRAMATICA_INVALIDA', mensagem:e.mensagem, inicio:e.inicio + linha.offset, fim:e.fim + linha.offset })));
      continue;
    }
    const compilado = compilacaoDaFrase(resultado.ast, linha.texto, opcoes);
    efeitos.push(...compilado.efeitos);
    erros.push(...compilado.erros.map(e => ({ ...e, inicio:e.inicio + linha.offset, fim:e.fim + linha.offset })));
  }
  return { efeitos: erros.length ? [] : efeitos, erros };
}

/** Adaptador de saída para o editor e o runtime legado do OMNI. */
export function parseScriptOmni(fonte: string, opcoes: OmniScriptParseOpts = {}): OmniScriptResultado {
  const partes: Array<{ texto:string; inicio:number }> = [];
  const adicionarParte = (inicioParte:number, fimParte:number) => {
    const bruto=fonte.slice(inicioParte,fimParte), deslocamento=bruto.length-bruto.trimStart().length, texto=bruto.trim();
    if(texto)partes.push({texto,inicio:inicioParte+deslocamento});
  };
  let inicio=0,nivel=0,aspas='';
  for(let i=0;i<fonte.length;i++){
    const ch=fonte[i];
    if(aspas){if(ch==='\\'){i++;continue;}if(ch===aspas)aspas='';continue;}
    if(ch==='"'||ch==="'"){aspas=ch;continue;}
    if(ch==='('){nivel++;continue;}if(ch===')'){nivel=Math.max(0,nivel-1);continue;}
    if(nivel===0&&(ch==='\n'||ch===';')){adicionarParte(inicio,i);inicio=i+1;}
  }
  adicionarParte(inicio,fonte.length);
  if(!partes.length)return parseOmniScript(fonte,opcoes);
  const efeitos:CombatEffect[]=[],erros:OmniScriptResultado['erros']=[];
  for(const parte of partes){
    const natural=/^(?:(?:se\s+)?(?:ao|aos|quando|no|na)\b)[\s\S]*\bent[aã]o\b/i.test(parte.texto)&&!/@|->/.test(parte.texto);
    if(natural){
      const r=compilarScriptNatural(parte.texto,opcoes);efeitos.push(...r.efeitos);
      erros.push(...r.erros.map(e=>({posicao:e.inicio+parte.inicio,trecho:fonte.slice(e.inicio+parte.inicio,e.fim+parte.inicio),mensagem:e.mensagem})));
    }else{
      const r=parseOmniScript(parte.texto,opcoes);efeitos.push(...r.efeitos);
      erros.push(...r.erros.map(e=>({...e,posicao:e.posicao+parte.inicio})));
    }
  }
  // Não deixe um script parcialmente instalado quando uma regra do mesmo
  // documento é inválida: validar e publicar as regras é uma transação única.
  return {efeitos:erros.length?[]:efeitos,erros};
}
