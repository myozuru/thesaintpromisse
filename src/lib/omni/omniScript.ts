/**
 * 🧪 Omni-Syntax Scripting (linguagem natural do Modo Avançado).
 *
 * Sintaxe (case-insensitive, separador decimal opcional):
 *   <comando> <expressão> em <recurso> [, <comando> <expressão> em <recurso>]…
 *
 * Comandos suportados:
 *   somar     → ADICIONAR  (recurso += resultado)
 *   subtrair  → SUBTRAIR   (recurso -= resultado)
 *   definir   → MODIFICADOR / DEFINIR (recurso = resultado)
 *
 * Tokens reservados: somar | subtrair | definir | em
 *
 * O separador `,` (vírgula) divide a string em comandos sequenciais,
 * executados em ordem. O resultado de cada comando vira `@RESULTADO_N`
 * para o próximo, mantendo compatibilidade com o engine de combate atual.
 *
 * A palavra `e` (isolada, com espaços) é um **alias semântico para `+`**
 * dentro de fórmulas matemáticas (ex: `somar treino e 2 em vida_max`
 * equivale a `somar treino + 2 em vida_max`). Identificadores como
 * `energia` permanecem intactos graças ao uso de word-boundaries.
 *
 * Inteligência de Contexto (Auto-@):
 *  - Qualquer palavra solta presente no dicionário Omni (treino, vida_max,
 *    forca, vida_atual, etc.) é automaticamente prefixada com `@USUARIO.`
 *    para o parser, removendo a necessidade de digitar `@`.
 */
import { resolverTipoDano } from './contextoDano';
import type { CombatEffect } from './tipos';
import { DICIONARIO_CHAVES_OMNI, ALIASES_FORMULA } from './constantesDoSistema';
import { recursoBonito } from './rotulosRecurso';
import { resolverGatilho, aliasPreferido } from './gatilhoAliases';
import { ALL_CONDITIONS } from '@/types/conditions';
import { transformarForaDasComposicoes } from './componentes/expressoes';
import { interpretarComposicao } from './componentes/interpretar';
import { destinoComposto } from './componentes/escrita';

/** Palavras reservadas da OmniScript. */
export const OMNI_SCRIPT_KEYWORDS = [
  'transferir', 'para',
  'somar', 'subtrair', 'definir', 'reduzir', 'anular', 'ignorar',
  'aplicar', 'remover', 'rolar', 'botao', 'botão',
  'em', 'se', 'entao', 'então',
  'quando', 'de',
] as const;
export type OmniScriptKeyword = (typeof OMNI_SCRIPT_KEYWORDS)[number];

/**
 * Mapeamento de verbos amigáveis → tipo técnico do CombatEffect.
 * - `reduzir` é alias de `subtrair` (subtração dinâmica no payload).
 * - `anular`/`ignorar` são verbos ABSOLUTOS: `anular X` é açúcar para
 *   `definir 0 em X` (o `absoluteVerb` é guardado no efeito p/ a UI).
 */
const COMANDO_PARA_TIPO: Record<string, CombatEffect['type']> = {
  somar: 'ADICIONAR',
  subtrair: 'SUBTRAIR',
  reduzir: 'SUBTRAIR',
  definir: 'MODIFICADOR',
  anular: 'MODIFICADOR',
  ignorar: 'MODIFICADOR',
};

const VERBOS_ABSOLUTOS = new Set(['anular', 'ignorar']);

/**
 * Aliases semânticos de RECURSO. O Mestre escreve uma palavra natural
 * ("dano_recebido") e o parser traduz para a chave técnica do middleware
 * ("dano_pendente") que o motor de aplicação entende.
 */
const ALIASES_RECURSO: Record<string, string> = {
  dano_recebido: 'dano_pendente',
};

function traduzirRecurso(recurso: string): string {
  if (/\s/.test(recurso)) return recurso;
  const k = recurso.toLowerCase();
  return ALIASES_RECURSO[k] ?? k;
}

/** Conjunto de chaves "ficha" (sem prefixo) reconhecidas para Auto-@. */
export function listarChavesAutoArroba(): Set<string> {
  const out = new Set<string>();
  // 1) Aliases curtos (TREINO, NIVEL, FOR, VIDA_MAX…).
  for (const k of Object.keys(ALIASES_FORMULA)) out.add(k.toLowerCase());
  // 2) Itens do dicionário Omni — apenas chaves "puras" (sem ponto).
  for (const cat of DICIONARIO_CHAVES_OMNI) {
    for (const it of cat.itens) {
      if (!it.id.includes('.') && !it.id.startsWith('@')) {
        out.add(it.id.toLowerCase());
      }
    }
  }
  return out;
}

/**
 * Aplica Auto-@: para cada palavra simples (\w+) que não esteja já
 * precedida por `@`, `.` ou um dígito, e que pertença ao dicionário,
 * prefixa `@USUARIO.`.
 */
export function autoArrobaExpressao(expr: string, chaves: Set<string> = listarChavesAutoArroba()): string {
  // Captura também o caractere imediatamente anterior (se houver) para evitar
  // duplo-prefixo em casos como `@USUARIO.con` (a palavra `con` está precedida
  // por `.`, indicando que já é um sub-acesso de algo).
  return transformarForaDasComposicoes(expr, trecho => trecho.replace(/(^|[^A-Za-zÀ-ÿ0-9_@.])(@?[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*)/g, (_full, sep: string, token: string) => {
    if (token.startsWith('@')) return sep + token;
    const lower = token.toLowerCase();
    // Mantém funções matemáticas e palavras-chave do parser.
    if (['floor','ceil','round','min','max','abs','if'].includes(lower)) return sep + token;
    if (chaves.has(lower)) return `${sep}@USUARIO.${lower}`;
    return sep + token;
  }));
}

export interface OmniScriptIssue {
  posicao: number;
  mensagem: string;
  trecho: string;
}

export interface OmniScriptResultado {
  efeitos: CombatEffect[];
  erros: OmniScriptIssue[];
}

/**
 * Divide um script em sub-comandos respeitando o separador `,` (vírgula).
 * Faz `trim` em cada parte, então tanto `ação1,ação2` quanto
 * `ação1, ação2` (ou ainda `ação1 , ação2`) produzem o mesmo resultado.
 *
 * 🛡 Vírgulas dentro de parênteses são PRESERVADAS — necessário para
 * sintaxes como `rolar 1d4 entao ( 1: aplicar morte, 2: aplicar cego )`
 * onde a lista de branches é separada por vírgulas internamente.
 */
/** Separa só na superfície, respeitando branches, funções e textos entre aspas. */
function dividirNoNivelSuperior(script: string, separador: RegExp): string[] {
  const partes: string[] = [];
  let inicio = 0, depth = 0, aspas = '';
  for (let i = 0; i < script.length; i++) {
    const ch = script[i];
    if (aspas) {
      if (ch === '\\') { i++; continue; }
      if (ch === aspas) aspas = '';
      continue;
    }
    if (ch === '"' || ch === '“') { aspas = ch === '“' ? '”' : '"'; continue; }
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
    const match = depth === 0 ? script.slice(i).match(separador) : null;
    if (match) {
      partes.push(script.slice(inicio, i).trim());
      i += match[0].length - 1;
      inicio = i + 1;
    }
  }
  partes.push(script.slice(inicio).trim());
  return partes.filter(Boolean);
}

function dividirPorVirgula(script: string): string[] {
  return dividirNoNivelSuperior(script, /^,/);
}

/**
 * Converte a conjunção `e` (palavra isolada, com espaços) em `+` dentro
 * de uma fórmula matemática. Usa `\b` (word boundary) para garantir que
 * identificadores como `energia`, `defesa` ou `entao` permaneçam intactos.
 */
export function normalizarConjuncaoComoSoma(expr: string): string {
  return transformarForaDasComposicoes(expr, trecho => trecho.replace(/\be\b/gi, '+'));
}

/**
 * Converte conjunções pt-BR em operadores lógicos dentro de uma condição
 * (`se ... entao` / `quando ...`):
 *   - `e`  → `&&` (E lógico)
 *   - `ou` → `||` (OU lógico)
 *
 * IMPORTANTE: NÃO usar `normalizarConjuncaoComoSoma` em condições — lá o
 * `e` significa conjunção lógica, não soma aritmética.
 */
export function normalizarConjuncaoLogica(expr: string): string {
  return transformarForaDasComposicoes(expr, trecho => trecho
    .replace(/\be\b/gi, '&&')
    .replace(/\bou\b/gi, '||')
    // Booleanos amigáveis: "on"/"off" → 1/0. Também aceita
    // sim/nao/ligado/desligado/verdadeiro/falso para flexibilidade.
    .replace(/\b(on|sim|ligado|verdadeiro|true)\b/gi, '1')
    .replace(/\b(off|nao|não|desligado|falso|false)\b/gi, '0'));
}

/** Opções de parse: permitem forçar o alvo padrão para itens passivos. */
export interface OmniScriptParseOpts {
  /**
   * Alvo padrão quando o recurso não tem prefixo explícito
   * (`usuario.` / `alvo.` / `@usuario.` / `@alvo.`). Padrão: 'ALVO'.
   *
   * Usado pelo ConstrutorEntidade para itens Passivos / Acessórios:
   * passar `'USUARIO'` faz com que `em vida_max` vire automaticamente
   * um buff aplicado ao próprio portador.
   */
  defaultTarget?: CombatEffect['target'];
}

/**
 * Extrai um eventual prefixo de alvo de uma chave de recurso.
 * Aceita: `usuario.X`, `alvo.X`, `@usuario.X`, `@alvo.X` (case-insensitive).
 */
function extrairAlvoDoRecurso(
  raw: string,
  fallback: CombatEffect['target'],
): { target: CombatEffect['target']; recurso: string } {
  const m = raw.match(/^@?(usuario|alvo|area)\.(.+)$/i);
  if (!m) return { target: fallback, recurso: /\s/.test(raw) ? raw : raw.toLowerCase() };
  const px = m[1].toUpperCase();
  const target = (px === 'USUARIO' ? 'USUARIO' : px === 'ALVO' ? 'ALVO' : 'AREA') as CombatEffect['target'];
  return { target, recurso: /\s/.test(m[2]) ? m[2] : m[2].toLowerCase() };
}

/**
 * Tenta parsear um único comando. Aceita 2 formas:
 *   1. Padrão:    `<somar|subtrair|reduzir|definir> <expr> em <recurso>`
 *   2. Absoluta:  `<anular|ignorar> <recurso>`  (≡ `definir 0 em <recurso>`)
 */
function parsearComando(
  raw: string,
  posicao: number,
  opts: OmniScriptParseOpts = {},
): { efeito?: CombatEffect; erro?: OmniScriptIssue } {
  let txt = raw.trim();
  const transferencia = txt.match(/^transferir\s+(.+?)\s+de\s+(.+?)\s+para\s+(.+?)$/i);
  if (transferencia) {
    const origem = extrairAlvoDoRecurso(transferencia[2], opts.defaultTarget ?? 'ALVO');
    const destino = extrairAlvoDoRecurso(transferencia[3], origem.target);
    if (origem.target !== destino.target || !destinoComposto(origem.recurso) || !destinoComposto(destino.recurso)) return { erro: { posicao, trecho: raw, mensagem: 'Transferência exige saldos graváveis da mesma ficha.' } };
    return { efeito: { id: crypto.randomUUID(), type: 'MODIFICADOR', target: origem.target, resourcePath: destino.recurso,
      formula: autoArrobaExpressao(normalizarConjuncaoComoSoma(transferencia[1])), transferencia: { origem: origem.recurso, destino: destino.recurso } } };
  }
  // Alvo explícito dos comandos especiais (condição, botão, imunidade, rolagem).
  const alvoEspecial = txt.match(/\s+em\s+@?(usuario|alvo|area)\s*$/i);
  if (alvoEspecial) {
    opts = { ...opts, defaultTarget: alvoEspecial[1].toUpperCase() as CombatEffect['target'] };
    txt = txt.slice(0, alvoEspecial.index).trim();
  }
  if (!txt) return { erro: { posicao, trecho: raw, mensagem: 'Comando vazio.' } };

  // 🪄 Forma especial: redutor de PE de feitiços.
  //   reduzir custo pe (de|em) feitiço(s) [filtros…] em <fórmula> [min N]
  // Filtros aceitos (em qualquer ordem, separados por espaço): nivel:X,
  // tipo:X, nome:X (X pode ser "1-3", "damage", "bola_de_fogo"…).
  const mPe = txt.match(
    /^reduzir\s+custo\s+pe\s+(?:de|em)\s+feiti[cç]os?\s*(.*?)\s+em\s+(.+?)(?:\s+min\s+(\d+))?\s*$/i,
  );
  if (mPe) {
    const filtrosTxt = (mPe[1] || '').trim();
    const formula = mPe[2].trim();
    const min = mPe[3] ? Math.max(0, parseInt(mPe[3], 10)) : 1;
    // Coleta tokens "chave:valor" (nivel:X | tipo:X | nome:X). Outros tokens
    // viram erro pra evitar capturas silenciosas.
    const partes: string[] = [];
    if (filtrosTxt) {
      for (const tok of filtrosTxt.split(/\s+/)) {
        if (!tok) continue;
        if (!/^(nivel|nv|level|tipo|type|nome|name|id|acao|action):.+$/i.test(tok)) {
          return {
            erro: {
              posicao,
              trecho: raw,
              mensagem: `Filtro inválido "${tok}". Use nivel:X, tipo:X ou nome:X (ex.: nivel:1-3).`,
            },
          };
        }
        partes.push(tok.toLowerCase());
      }
    }
    const filtro = partes.length ? partes.join('&') : 'todos';
    const formulaFinal = autoArrobaExpressao(normalizarConjuncaoComoSoma(formula));
    return {
      efeito: {
        id: crypto.randomUUID(),
        formula: formulaFinal,
        type: 'MODIFICADOR',
        target: opts.defaultTarget ?? 'USUARIO',
        // resourcePath sentinela só pra inspeção/log — o aplicador olha
        // `peSpellReduction` e ignora este campo.
        resourcePath: 'pe_spell_reduction',
        peSpellReduction: { filtro, min },
      },
    };
  }

  // 🛡 Forma especial: conceder/remover imunidade a condição.
  //   imune <escopo>     → CONCEDER_IMUNIDADE
  //   desimune <escopo>  → REMOVER_IMUNIDADE
  // Escopo aceita as mesmas formas do construtor visual:
  //   "todas" | "categoria:MENTAL" | "condicao:atordoado"
  // (também aceita o nome cru da condição, ex.: "imune atordoado" → condicao:atordoado).
  const mImu = txt.match(/^(imune|desimune|imunizar|desimunizar)\s+(.+?)\s*$/i);
  if (mImu) {
    const verbo = mImu[1].toLowerCase();
    const mode: 'grant' | 'revoke' =
      verbo.startsWith('des') ? 'revoke' : 'grant';
    let escopo = mImu[2].trim();
    // Se não veio com prefixo, assume "condicao:<nome>" (a menos que seja "todas").
    if (!/^(todas|categoria:|condicao:|condi[cç][aã]o:)/i.test(escopo)) {
      escopo = `condicao:${escopo}`;
    }
    // Normaliza "condição:" → "condicao:".
    escopo = escopo.replace(/^condi[cç][aã]o:/i, 'condicao:');
    return {
      efeito: {
        id: crypto.randomUUID(),
        formula: '0',
        type: 'MODIFICADOR',
        target: opts.defaultTarget ?? 'USUARIO',
        resourcePath: mode === 'grant' ? 'immunity_grant' : 'immunity_revoke',
        immunityGrant: { escopo, mode },
      },
    };
  }

  // 🩸 aplicar / remover <condicao> [em <alvo>]
  // Aceita id direto (`aplicar morto`, `aplicar cego`) ou nome amigável
  // (`aplicar Cego`). Default target: ALVO. Use `em usuario` p/ self-buff.
  const mCond = txt.match(/^(aplicar|remover)\s+([A-Za-zÀ-ÿ_][\w-]*)(?:\s+turnos\s+(-?\d+))?(?:\s+rodadas\s+(-?\d+))?\s*$/i);
  if (mCond) {
    const verbo = mCond[1].toLowerCase();
    const nomeRaw = mCond[2].trim();
    const target = opts.defaultTarget ?? 'ALVO';
    // Resolve nome → id da condição.
    const norm = nomeRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const def =
      ALL_CONDITIONS.find((c) => c.id === norm) ??
      ALL_CONDITIONS.find((c) => c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === norm);
    // Aliases pt-BR comuns que diferem do id canônico.
    const ALIASES_COND: Record<string, string> = { morte: 'morto', morrer: 'morto' };
    const condicaoId = def?.id ?? ALIASES_COND[norm];
    if (!condicaoId) {
      return {
        erro: {
          posicao,
          trecho: raw,
          mensagem: `Condição desconhecida: "${nomeRaw}". Use o id (ex.: cego, surdo, morto) ou o nome (ex.: "aplicar Cego").`,
        },
      };
    }
    return {
      efeito: {
        id: crypto.randomUUID(),
        formula: '0',
        type: 'MODIFICADOR',
        target,
        resourcePath: verbo === 'aplicar' ? 'condition_apply' : 'condition_remove',
        conditionApply: { id: condicaoId, mode: verbo === 'aplicar' ? 'apply' : 'remove', ...(mCond[3] ? { durationTurns: Number(mCond[3]) } : {}), ...(mCond[4] ? { durationRounds: Number(mCond[4]) } : {}) },
      },
    };
  }

  // 🔘 botao "<rótulo>" — efeito no-op que existe só para o item virar
  // botão clicável (mesmo que não tenha nenhuma outra ação atribuída).
  const mBtn = txt.match(/^bot[aã]o(?:\s+(?:"((?:\\.|[^"\\])*)"|“([^”]*)”))?\s*$/i);
  if (mBtn) {
    let label: string | undefined;
    try { label = mBtn[1] !== undefined ? JSON.parse(`"${mBtn[1]}"`) : mBtn[2]; }
    catch { return { erro: { posicao, trecho: raw, mensagem: 'Texto do botão entre aspas inválido.' } }; }
    return {
      efeito: {
        id: crypto.randomUUID(),
        formula: '0',
        type: 'MODIFICADOR',
        target: opts.defaultTarget ?? 'USUARIO',
        resourcePath: 'button_only',
        buttonOnly: { label: label || undefined },
      },
    };
  }

  // 🎲 rolar XdY entao ( N: <cmd>, M: <cmd>, ... )
  // Despacha sub-comandos baseado no resultado de uma rolagem aleatória.
  // As branches PRECISAM vir entre parênteses para que vírgulas internas
  // não sejam confundidas com separadores de comandos do segmento pai.
  // Cada branch: `<n>[-<m>]: <comando>` ou `<n>|<m>|<o>: <comando>`.
  // Comandos suportados na branch: qualquer verbo OmniScript válido
  // (aplicar/remover/somar/subtrair/definir/anular/imune/...) e até
  // diceSwitch aninhado.
  const mRoll = txt.match(/^rolar\s+(.+?)\s+ent[aã]o\s*\(\s*([\s\S]*?)\s*\)\s*$/i);
  if (mRoll) {
    const dice = autoArrobaExpressao(mRoll[1].trim());
    const corpo = mRoll[2].trim();
    const branchesTxt = dividirPorVirgula(corpo);
    const branches: NonNullable<CombatEffect['diceSwitch']>['branches'] = [];
    for (const bt of branchesTxt) {
      const mBranch = bt.match(/^([0-9|\-\s]+):\s*([\s\S]*)$/);
      if (!mBranch) {
        return {
          erro: { posicao, trecho: raw, mensagem: `Branch inválida em rolar: "${bt}". Use "<n>: <comando>".` },
        };
      }
      const valuesTxt = mBranch[1].trim();
      const cmdTxt = mBranch[2].trim();
      // Suporta: "1", "1-3", "1|2|5"
      const values = new Set<number>();
      for (const tok of valuesTxt.split('|').map((s) => s.trim()).filter(Boolean)) {
        const mRange = tok.match(/^(\d+)\s*-\s*(\d+)$/);
        if (mRange) {
          const a = parseInt(mRange[1], 10);
          const b = parseInt(mRange[2], 10);
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) values.add(i);
        } else if (/^\d+$/.test(tok)) {
          values.add(parseInt(tok, 10));
        } else {
          return { erro: { posicao, trecho: raw, mensagem: `Valor inválido na branch: "${tok}".` } };
        }
      }
      // Cada branch pode ter múltiplos sub-comandos ligados por " e ".
      const subCmds = dividirNoNivelSuperior(cmdTxt, /^\s+e\s+(?=(?:transferir|somar|subtrair|reduzir|definir|anular|ignorar|aplicar|remover|rolar|bot[aã]o|imune|desimune)\b)/i);
      const subEfeitos: CombatEffect[] = [];
      for (const sc of subCmds) {
        const sub = parsearComando(sc, posicao, opts);
        if (sub.erro) return { erro: sub.erro };
        if (sub.efeito) subEfeitos.push(sub.efeito);
      }
      branches.push({ values: [...values].sort((a, b) => a - b), effects: subEfeitos });
    }
    return {
      efeito: {
        id: crypto.randomUUID(),
        formula: dice,
        type: 'MODIFICADOR',
        target: opts.defaultTarget ?? 'ALVO',
        resourcePath: 'dice_switch',
        diceSwitch: { dice, branches },
      },
    };
  }

  // Erro orientado quando o usuário escreve `rolar … entao …` sem parens.
  if (/^rolar\s+\d+d\d+/i.test(txt) && /ent[aã]o/i.test(txt)) {
    return {
      erro: {
        posicao,
        trecho: raw,
        mensagem:
          'Rolagem condicional: envolva as branches em parênteses. Ex.: ' +
          '`rolar 1d4 entao ( 1: aplicar morto, 2: aplicar cego, 3: aplicar surdo, 4: somar 100 em vida )`.',
      },
    };
  }

  // Forma absoluta: `anular <recurso>` / `ignorar <recurso>` (sem fórmula).
  const mAbs = txt.match(/^(anular|ignorar)\s+(.+?)\s*$/i);
  if (mAbs) {
    const cmd = mAbs[1].toLowerCase() as 'anular' | 'ignorar';
    const recursoBruto = mAbs[2].trim();
    if (/\s/.test(recursoBruto) && !destinoComposto(recursoBruto)) return { erro: { posicao, trecho: raw, mensagem: 'Essa composição não identifica um recurso gravável.' } };
    const { target, recurso } = extrairAlvoDoRecurso(recursoBruto, opts.defaultTarget ?? 'ALVO');
    return {
      efeito: {
        id: crypto.randomUUID(),
        formula: '0',
        type: 'MODIFICADOR', // tradução silenciosa: definir 0
        target,
        resourcePath: traduzirRecurso(recurso),
        absoluteVerb: cmd,
      },
    };
  }

  // Forma padrão: aceita prefixos no recurso (`usuario.X`, `@alvo.Y`).
  // Sufixos opcionais de contador: `ate <teto>` e `por_fonte`.
  // Tipo do novo golpe. Aspas preservam também valores legados sem equivalência.
  let damageType: string | undefined;
  const mTipo = txt.match(/\s+tipo\s+("(?:\\.|[^"\\])*"|[A-Za-zÀ-ÿ_][\w-]*)\s*$/i);
  if (mTipo) {
    const quoted = mTipo[1].startsWith('"');
    try { damageType = quoted ? JSON.parse(mTipo[1]) : mTipo[1]; }
    catch { return { erro: { posicao, trecho: raw, mensagem: 'Tipo de dano entre aspas inválido.' } }; }
    if (!quoted && !resolverTipoDano(damageType)) return { erro: { posicao, trecho: raw, mensagem: `Tipo de dano desconhecido: ${damageType}. Use um código do motor (ex.: DQ).` } };
    txt = txt.slice(0, mTipo.index).trim();
  }
  const m = txt.match(/^(somar|subtrair|reduzir|definir)\s+(.+?)\s+em\s+(.+?)(?:\s+at[eé]\s+(.+?))?(\s+por_fonte)?\s*$/i);
  if (!m) {
    return {
      erro: {
        posicao,
        trecho: raw,
        mensagem: 'Use: <somar|subtrair|reduzir|definir> <fórmula> em <recurso>  ou  <anular|ignorar> <recurso>.',
      },
    };
  }
  const cmd = m[1].toLowerCase();
  const expr = m[2].trim();
  const recursoBruto = m[3].trim();
  if (/\s/.test(recursoBruto) && !destinoComposto(recursoBruto)) return { erro: { posicao, trecho: raw, mensagem: 'Essa composição não identifica um recurso gravável.' } };
  const tipo = COMANDO_PARA_TIPO[cmd];
  if (!tipo) {
    return { erro: { posicao, trecho: raw, mensagem: `Comando desconhecido: ${cmd}` } };
  }
  // Verbos absolutos não podem aparecer aqui (já tratados acima); guard de segurança.
  if (VERBOS_ABSOLUTOS.has(cmd)) {
    return { erro: { posicao, trecho: raw, mensagem: `${cmd} usa a forma curta: ${cmd} <recurso>.` } };
  }
  const formulaFinal = /^tudo$/i.test(expr) ? '0' : autoArrobaExpressao(normalizarConjuncaoComoSoma(expr));
  const { target, recurso } = extrairAlvoDoRecurso(recursoBruto, opts.defaultTarget ?? 'ALVO');
  return {
    efeito: {
      id: crypto.randomUUID(),
      formula: formulaFinal,
      type: tipo,
      target,
      resourcePath: traduzirRecurso(recurso),
      ...(damageType ? { damageType } : {}),
      ...(m[4] ? { counterCap: autoArrobaExpressao(m[4].trim()) } : {}),
      ...(m[5] ? { counterPerSource: true } : {}),
    },
  };
}

/**
 * Desconstrói um script avançado em suas etapas:
 *  1. Gatilho dinâmico:  `quando <recurso> <op|alias> <valor[%][ de X]> -> <resto>`
 *  2. Gatilho legado:    `<trigger_nomeado> -> <resto>`
 *  3. Condição:          `se <cond> entao <resto>`
 *  4. Parênteses externos: removidos do bloco de ações.
 *  5. Resto:             string pronta para ser dividida por ` e `.
 */
export interface DesconstrucaoOmniScript {
  trigger?: string;
  condition?: string;
  watcher?: NonNullable<CombatEffect['watcher']>;
  acoes: string;
  /** True quando as ações vinham envolvidas em parênteses externos
   *  (`@evento -> ( A, B )`) — sinaliza agrupamento explícito sob o
   *  mesmo gatilho/condição, suprimindo o erro de "vírgula reseta gatilho". */
  agrupado?: boolean;
}

/**
 * Aliases pt-BR → operador matemático para gatilhos `quando …`.
 * Reescritos como tokens únicos (substituídos no texto antes da regex final).
 */
const ALIASES_OPERADOR: Array<[RegExp, string]> = [
  [/\b(chegar|chega|chegou)\s+a\b/gi, '<='],
  [/\b(baixar|baixa|baixou|cair|cai|caiu)\s+(para|a|em)\b/gi, '<='],
  [/\b(subir|sobe|subiu|atingir|atinge|atingiu)\s+(para|a|em)?\b/gi, '>='],
  [/\b(igual\s+a)\b/gi, '=='],
  [/\b(diferente\s+de)\b/gi, '!='],
  [/\b(maior\s+ou\s+igual\s+a)\b/gi, '>='],
  [/\b(menor\s+ou\s+igual\s+a)\b/gi, '<='],
  [/\b(maior\s+que)\b/gi, '>'],
  [/\b(menor\s+que)\b/gi, '<'],
];

/**
 * Tenta interpretar a parte ESQUERDA de um `quando … ->` como watcher.
 * Retorna `undefined` se a sintaxe não bate (cai no parser legado).
 */
function parsearWatcherQuando(esquerda: string): NonNullable<CombatEffect['watcher']> | undefined {
  let txt = esquerda.trim();
  // Aceita "quando" no início (case-insensitive). Sem ele, não é watcher.
  const mPrefix = txt.match(/^quando\s+(.+)$/i);
  if (!mPrefix) return undefined;
  txt = mPrefix[1].trim();

  // Normaliza aliases para operadores matemáticos.
  for (const [re, op] of ALIASES_OPERADOR) txt = txt.replace(re, ` ${op} `);
  txt = txt.replace(/\s+/g, ' ').trim();

  // Forma final esperada: <recurso> <op> <numero[%]> [de <recurso_base>]
  const re = /^(.+?)\s*(<=|>=|==|!=|<|>)\s*(-?\d+(?:[.,]\d+)?)(%?)(?:\s+de\s+(.+?))?$/i;
  const m = txt.match(re);
  if (!m) return undefined;
  for (const recurso of [m[1], m[5]].filter(Boolean)) {
    if (!/^@?[A-Za-zÀ-ÿ_][\w.]*$/.test(recurso.trim())) {
      const p = interpretarComposicao(recurso.trim());
      if (!p.referencia || p.erro || p.consumido !== recurso.trim().length) return undefined;
    }
  }
  const recurso = m[1].replace(/^@?(usuario|alvo|cena)\./i, '').toLowerCase();
  const op = m[2] as NonNullable<CombatEffect['watcher']>['op'];
  const numero = Number(m[3].replace(',', '.'));
  const isPercent = m[4] === '%';
  const baseExplicita = m[5]?.replace(/^@?(usuario|alvo|cena)\./i, '').toLowerCase();
  // Mapa de recursos "atuais" → seu recurso "máximo" correspondente,
  // usado quando o usuário escreve só `<recurso> <op> N%` sem `de X`.
  const MAX_PADRAO: Record<string, string> = {
    vida_atual: 'vida_max',
    vida: 'vida_max',
    pe: 'pe_max',
    energia: 'energia_max',
    pe_atual: 'pe_max',
  };
  const baseImplicita = MAX_PADRAO[recurso] ?? (/\s/.test(recurso) ? `maximo ${recurso}` : `${recurso}_max`);
  return {
    resource: recurso,
    op,
    threshold: isPercent ? numero / 100 : numero,
    percent: isPercent || undefined,
    percentBase: isPercent ? (baseExplicita ?? baseImplicita) : undefined,
  };
}

/**
 * Mapeamento de gatilhos legados nomeados → watcher dinâmico equivalente.
 * Mantido para compatibilidade com itens antigos / scripts já salvos.
 *
 * Nota: alguns gatilhos (ex.: `ao_atacar`) não têm tradução natural para
 * recurso → continuam como `trigger` string e são processados pelo
 * eventBus tradicional (`triggerEfeitos.ts`).
 */
const GATILHO_LEGADO_PARA_WATCHER: Record<string, NonNullable<CombatEffect['watcher']>> = {
  ao_morrer: { resource: 'vida_atual', op: '<=', threshold: 0 },
  aomorrer: { resource: 'vida_atual', op: '<=', threshold: 0 },
};

export function desconstruirScript(script: string): DesconstrucaoOmniScript {
  let txt = (script || '').trim();
  let trigger: string | undefined;
  let condition: string | undefined;
  let watcher: NonNullable<CombatEffect['watcher']> | undefined;

  // Passo 1 — Gatilho (->). Pode ser dinâmico (quando…) ou legado nomeado.
  const partesSeta = dividirNoNivelSuperior(txt, /^->/);
  if (partesSeta.length > 1) {
    const left = partesSeta[0];
    const right = partesSeta.slice(1).join('->').trim();
    if (left) {
      const w = parsearWatcherQuando(left);
      if (w) {
        watcher = w;
      } else {
        const bruto = left.replace(/^@/, '').toLowerCase();
        // 1) Migração legada para watcher (ex.: ao_morrer → vida_atual <= 0)
        //    tem prioridade — preserva comportamento histórico.
        const migrado = GATILHO_LEGADO_PARA_WATCHER[bruto];
        if (migrado) {
          watcher = migrado;
          trigger = undefined;
        } else {
          // 2) Tenta resolver via aliases pt-BR (`fim_turno` → `noFimDoTurno`).
          //    Se reconhecer, salva o GatilhoId canônico — assim o disparador
          //    casa direto sem depender de tabela de aliases secundária.
          const canon = resolverGatilho(bruto);
          trigger = canon ?? bruto;
        }
      }
    }
    txt = right;
  }

  // Passo 2 — Condicional (se ... [entao] ...).
  // IMPORTANTE: a condição não pode atravessar vírgulas — cada comando
  // separado por `,` deve poder ter sua própria `se ... entao` independente.
  // Por isso a captura proíbe `,` no corpo da condição.
  // 🆕 A palavra `entao`/`então` é OPCIONAL: quando ausente, a condição
  // vai até o primeiro verbo de comando (somar/subtrair/...).
  let mCond = txt.match(/^\s*se\s+([^,]+?)\s+ent[aã]o\s+([\s\S]+)$/i);
  if (!mCond) {
    mCond = txt.match(/^\s*se\s+([^,]+?)\s+(?=(?:transferir|somar|subtrair|reduzir|definir|anular|ignorar|aplicar|remover|rolar|bot[aã]o)\b)([\s\S]+)$/i);
  }
  if (mCond) {
    condition = mCond[1].trim();
    txt = mCond[2].trim();
  }

  // Passo 3 — Limpeza de parênteses externos.
  let agrupado = false;
  while (txt.startsWith('(') && txt.endsWith(')')) {
    let depth = 0;
    let envolveTudo = true;
    let aspas = '';
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (aspas) {
        if (ch === '\\') { i++; continue; }
        if (ch === aspas) aspas = '';
        continue;
      }
      if (ch === '"' || ch === '“') { aspas = ch === '“' ? '”' : '"'; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0 && i < txt.length - 1) { envolveTudo = false; break; }
      }
    }
    if (envolveTudo) { txt = txt.slice(1, -1).trim(); agrupado = true; }
    else break;
  }

  return { trigger, condition, watcher, acoes: txt, agrupado };
}

/**
 * Quebra o script em **segmentos independentes** sempre que aparecer
 * `, <novo_gatilho> -> …`. Suporta tanto o gatilho legado nomeado
 * (`ao_morrer ->`) quanto o dinâmico (`quando vida_atual <= 0 ->`).
 */
function dividirPorNovoGatilho(script: string): string[] {
  // Lookahead: `,` (com espaços opcionais) seguido por (a) um identificador
  // (com `@` opcional) + ->, ou (b) a palavra `quando` (gatilho dinâmico).
  return dividirNoNivelSuperior(script, /^,\s*(?=(?:@?[A-Za-zÀ-ÿ_][\w.]*\s*->|quando\s+))/i);
}

/** Compila um script completo em uma lista de CombatEffects. */
export function parseOmniScript(
  script: string,
  opts: OmniScriptParseOpts = {},
): OmniScriptResultado {
  // Quebras de linha (`\n`) e ponto-e-vírgula (`;`) separam scripts
  // independentes — cada linha é parseada isoladamente, exatamente como
  // se o usuário tivesse criado vários scripts separados. Isso permite
  // misturar passivas contínuas e gatilhos no mesmo terminal sem que a
  // vírgula de um interfira no outro.
  const linhas = dividirNoNivelSuperior(script || '', /^[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const segmentos = linhas.flatMap((l) => dividirPorNovoGatilho(l));
  const efeitos: CombatEffect[] = [];
  const erros: OmniScriptIssue[] = [];

  segmentos.forEach((segmento) => {
    const { trigger, condition, watcher, acoes, agrupado } = desconstruirScript(segmento);
    const condicaoSegmento = condition ? autoArrobaExpressao(normalizarConjuncaoLogica(condition)) : undefined;
    const partes = dividirPorVirgula(acoes);

    // 🚨 Guarda explícita: se o segmento tem gatilho/watcher (`@evento ->`
    // ou `quando … ->`) E o usuário escreveu várias ações separadas por
    // vírgula SEM agrupá-las em parênteses, o gatilho só vale para a
    // PRIMEIRA — as outras viram passivas contínuas silenciosamente e
    // podem nunca disparar (ex.: somar em fadiga/exaustão/PE só acontece
    // via gatilho). Em vez de aceitar e confundir, devolvemos um erro
    // orientando a sintaxe correta.
    if ((trigger || watcher) && partes.length > 1 && !agrupado) {
      erros.push({
        posicao: 0,
        trecho: segmento,
        mensagem:
          'Vírgula reseta o gatilho — apenas o primeiro comando após "@evento ->" será disparado pelo evento. ' +
          'Para encadear várias ações no MESMO gatilho, una com " e " (ex.: "@fim_rodada -> somar 1 em fadiga e somar 1 em exaustao") ' +
          'ou agrupe entre parênteses (ex.: "@fim_rodada -> ( ação1, ação2 )"). ' +
          'Para vários gatilhos, repita o cabeçalho (ex.: "@fim_rodada -> A, @fim_rodada -> B").',
      });
      return;
    }

    let cursor = 0;
    partes.forEach((parte, idxParte) => {
      // A condição-guarda-chuva e o trigger do segmento se aplicam:
      //  - apenas ao PRIMEIRO comando quando vírgula isola (modo padrão);
      //  - a TODOS os comandos quando o segmento veio agrupado em parênteses.
      const propagar = agrupado || idxParte === 0;
      const condicaoSegmentoEfetiva = propagar ? condicaoSegmento : undefined;
      // 🆕 Cada comando pode ter sua PRÓPRIA condição inline
      // (ex.: "se X igual a 2 entao definir 0 em X"), independente da
      // condição "guarda-chuva" do segmento.
      let restante = parte;
      let condicaoInline: string | undefined;
      let mInline = parte.match(/^\s*se\s+([^,]+?)\s+ent[aã]o\s+([\s\S]+)$/i);
      if (!mInline) {
        mInline = parte.match(/^\s*se\s+([^,]+?)\s+(?=(?:transferir|somar|subtrair|reduzir|definir|anular|ignorar|aplicar|remover|rolar|bot[aã]o)\b)([\s\S]+)$/i);
      }
      if (mInline) {
        condicaoInline = autoArrobaExpressao(normalizarConjuncaoLogica(mInline[1].trim()));
        restante = mInline[2].trim();
      }

      // 🆕 Açúcar: "se COND entao CMD1 e CMD2 [e CMD3...]" — múltiplos
      // comandos compartilhando a mesma condição, ligados por " e ".
      // Só dividimos quando o trecho APÓS o " e " começa com um verbo de
      // comando (somar/subtrair/definir/reduzir/anular/ignorar/se), para
      // que o " e " usado como SOMA dentro de uma fórmula
      // (ex.: "somar nivel e treinamento em X") não seja confundido com
      // separador de comandos.
      // 🆕 Sempre permitimos `<cmd> e <cmd>` como atalho — independente de
      // ter ou não condição inline. O lookahead garante que `e` usado como
      // soma dentro de fórmula ("somar nivel e treinamento em X") não seja
      // confundido com separador, pois exige verbo de comando à direita.
      const subComandos = dividirNoNivelSuperior(restante, /^\s+e\s+(?=(?:transferir|somar|subtrair|reduzir|definir|anular|ignorar|aplicar|remover|rolar|bot[aã]o|se|imune|desimune)\b)/i);

      // 🛡 Açúcar especial: "imune A e B e C" → vira ["imune A", "imune B", "imune C"].
      // Aplica APÓS o split de condição inline, então também funciona dentro
      // de "se X então imune A e B".
      const subComandosExpandidos: string[] = [];
      for (const cmd of subComandos) {
        const mImuLista = cmd.match(/^(imune|desimune|imunizar|desimunizar)\s+(.+)$/i);
        if (mImuLista) {
          const verboImu = mImuLista[1];
          const lista = mImuLista[2]
            .split(/\s+e\s+/i)
            .map((s) => s.trim())
            .filter(Boolean);
          for (const escopo of lista) {
            subComandosExpandidos.push(`${verboImu} ${escopo}`);
          }
        } else {
          subComandosExpandidos.push(cmd);
        }
      }

      // 🆕 Trigger e watcher do segmento (`@fim_rodada -> ...`) também
      // só se aplicam ao PRIMEIRO comando — vírgulas seguintes nascem
      // como efeitos passivos contínuos (sem gatilho), regidos apenas
      // por sua própria `se ...` se houver. Mesma regra da condição.
      const triggerEfetivo = propagar ? trigger : undefined;
      const watcherEfetivo = propagar ? watcher : undefined;
      subComandosExpandidos.forEach((comandoTxt) => {
        const { efeito, erro } = parsearComando(comandoTxt, cursor, opts);
        if (efeito) {
          if (triggerEfetivo) efeito.trigger = triggerEfetivo;
          const combinada = condicaoSegmentoEfetiva && condicaoInline
            ? `(${condicaoSegmentoEfetiva}) && (${condicaoInline})`
            : condicaoSegmentoEfetiva ?? condicaoInline;
          if (combinada) efeito.condition = combinada;
          if (watcherEfetivo) efeito.watcher = watcherEfetivo;
          efeitos.push(efeito);
        }
        if (erro) erros.push(erro);
      });
      cursor += parte.length + 2; // +2 ≈ ", "
    });
  });

  return { efeitos, erros };
}

/**
 * Reconstrói um script humano a partir de uma lista de efeitos. Útil para
 * abrir um item antigo (criado no modo de selectors) já no terminal.
 *
 * Quando o efeito tem um `target` diferente do `defaultTarget`, o recurso
 * é prefixado com `usuario.` / `alvo.` / `area.` para preservar a intenção.
 */
export function efeitosParaScript(
  efeitos: CombatEffect[],
  opts: OmniScriptParseOpts = {},
): string {
  const inverso: Record<CombatEffect['type'], string> = {
    ADICIONAR: 'somar',
    SUBTRAIR: 'subtrair',
    MODIFICADOR: 'definir',
  };
  const def = opts.defaultTarget ?? 'ALVO';

  // Serializa um único efeito como `<verbo> <formula> em <recurso>` (ou forma absoluta).
  const renderEfeito = (e: CombatEffect, defaultTarget = def): string => {
    if (e.transferencia) {
      const prefixo = e.target !== defaultTarget ? `${e.target.toLowerCase()}.` : '';
      return `transferir ${e.formula} de ${prefixo}${e.transferencia.origem} para ${prefixo}${e.transferencia.destino}`;
    }
    const alvoEspecial = e.target !== defaultTarget ? ` em ${e.target.toLowerCase()}` : '';
    if (e.buttonOnly) return `botao${e.buttonOnly.label ? ` ${JSON.stringify(e.buttonOnly.label)}` : ''}${alvoEspecial}`;
    if (e.diceSwitch) {
      const branches = e.diceSwitch.branches.map(b => `${b.values.join('|')}: ${b.effects.map(sub => renderEfeito(sub, e.target)).join(' e ')}`);
      return `rolar ${e.diceSwitch.dice} entao ( ${branches.join(', ')} )${alvoEspecial}`;
    }
    if (e.conditionApply) {
      const ca = e.conditionApply;
      const turnos = ca.durationTurns !== undefined ? ` turnos ${ca.durationTurns}` : '';
      const rodadas = ca.durationRounds !== undefined ? ` rodadas ${ca.durationRounds}` : '';
      return `${ca.mode === 'apply' ? 'aplicar' : 'remover'} ${ca.id}${turnos}${rodadas}${alvoEspecial}`;
    }
    if (e.immunityGrant) return `${e.immunityGrant.mode === 'grant' ? 'imune' : 'desimune'} ${e.immunityGrant.escopo}${alvoEspecial}`;
    if (e.peSpellReduction) {
      const filtro = e.peSpellReduction.filtro === 'todos' ? '' : e.peSpellReduction.filtro.replace(/&/g, ' ');
      return `reduzir custo pe de feitico ${filtro} em ${e.formula || '0'} min ${e.peSpellReduction.min}${alvoEspecial}`;
    }
    const recursoBase = (e.resourcePath || 'vida_atual').toLowerCase();
    const prefixo = e.target !== defaultTarget
      ? (e.target === 'USUARIO' ? 'usuario.' : e.target === 'ALVO' ? 'alvo.' : 'area.')
      : '';
    if (e.absoluteVerb) return `${e.absoluteVerb} ${prefixo}${recursoBase}`;
    const formula = (e.formula || '0').replace(/@USUARIO\./gi, '');
    const cap = e.counterCap ? ` ate ${e.counterCap.replace(/@USUARIO\./gi, '')}` : '';
    const pf = e.counterPerSource ? ' por_fonte' : '';
    const tipo = e.damageType ? ` tipo ${JSON.stringify(e.damageType)}` : '';
    return `${inverso[e.type]} ${formula} em ${prefixo}${recursoBase}${cap}${pf}${tipo}`;
  };

  // Reemite o cabeçalho do segmento (gatilho dinâmico, trigger nomeado e condição).
  const renderCabecalho = (e: CombatEffect): string => {
    const partes: string[] = [];
    if (e.watcher) {
      const w = e.watcher;
      const valor = w.percent
        ? `${Math.round((w.threshold ?? 0) * 100)}%${w.percentBase ? ` de ${w.percentBase}` : ''}`
        : String(w.threshold);
      partes.push(`quando ${w.resource} ${w.op} ${valor} ->`);
    } else if (e.trigger) {
      // Se o trigger é um GatilhoId conhecido, mostra o alias amigável
      // (`@fim_turno` em vez de `noFimDoTurno`). Caso contrário, preserva
      // o trigger custom como salvo.
      const canon = resolverGatilho(e.trigger);
      const tag = canon ? `@${aliasPreferido(canon)}` : e.trigger;
      partes.push(`${tag} ->`);
    }
    if (e.condition) {
      const cond = e.condition.replace(/@USUARIO\./gi, '');
      partes.push(`se ${cond} entao`);
    }
    return partes.join(' ');
  };

  // Chave que identifica um "segmento" (mesmo gatilho + condição) para agrupar
  // múltiplos efeitos sob o mesmo cabeçalho usando ` e `.
  const chaveSegmento = (e: CombatEffect): string =>
    JSON.stringify([e.trigger ?? null, e.condition ?? null, e.watcher ?? null]);

  const segmentos: string[] = [];
  let bufferKey: string | null = null;
  let buffer: CombatEffect[] = [];
  const finalizar = () => {
    if (!buffer.length) return;
    const cab = renderCabecalho(buffer[0]);
    const texto = buffer.map(e => renderEfeito(e)).join(', ');
    segmentos.push(cab ? `${cab} (${texto})` : texto);
  };
  for (const e of efeitos) {
    const key = chaveSegmento(e);
    if (key !== bufferKey) { finalizar(); buffer = []; bufferKey = key; }
    buffer.push(e);
  }
  finalizar();
  return segmentos.join(';\n');
}

/** Tokeniza para syntax highlighting: retorna uma lista de spans. */
export interface OmniToken {
  texto: string;
  tipo: 'keyword' | 'numero' | 'identificador' | 'operador' | 'espaco';
}

export function tokenizarOmniScript(script: string): OmniToken[] {
  const out: OmniToken[] = [];
  // Ordem importa: keywords compostas primeiro, depois operadores multi-char
  // (->, >=, <=, ==, !=) antes dos single-char.
  const regex = /(\s+)|(transferir|somar|subtrair|reduzir|anular|ignorar|definir|em|se|ent[aã]o|quando|de|chegar|chega|chegou|baixar|baixa|baixou|cair|cai|caiu|subir|sobe|subiu|atingir|atinge|atingiu|para|igual|diferente|maior|menor)\b|(\d+(?:\.\d+)?(?:d\d+[!a-z\d]*)?%?)|([A-Za-zÀ-ÿ_@][\w.@]*)|(->|>=|<=|==|!=|[+\-*/()=<>%,]|\be\b)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(script)) !== null) {
    if (m.index > last) out.push({ texto: script.slice(last, m.index), tipo: 'identificador' });
    if (m[1]) out.push({ texto: m[1], tipo: 'espaco' });
    else if (m[2]) out.push({ texto: m[2], tipo: 'keyword' });
    else if (m[3]) out.push({ texto: m[3], tipo: 'numero' });
    else if (m[4]) out.push({ texto: m[4], tipo: 'identificador' });
    else if (m[5]) out.push({ texto: m[5], tipo: 'operador' });
    last = regex.lastIndex;
  }
  if (last < script.length) out.push({ texto: script.slice(last), tipo: 'identificador' });
  return out;
}

// ─── Humanização do Plano de Execução ───────────────────────────────────

/** Verbo amigável para cada tipo, sem repetir o nome do recurso. */
const VERBO_ACAO: Record<CombatEffect['type'], string> = {
  ADICIONAR: 'Somar',
  SUBTRAIR: 'Subtrair',
  MODIFICADOR: 'Definir',
};

/** Mapa chave-técnica → nome amigável (alimentado pelo dicionário Omni). */
function mapaNomesAmigaveis(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const cat of DICIONARIO_CHAVES_OMNI) {
    for (const it of cat.itens) {
      // Remove emojis e prefixos curtos (ex.: "FOR — Força" → "Força").
      const limpo = it.label.replace(/^[A-Z]{2,4}\s*[—-]\s*/, '').trim();
      m[it.id.toLowerCase()] = limpo;
    }
  }
  // Aliases curtos (TREINO, NIVEL, FOR…)
  const aliasLabels: Record<string, string> = {
    treino: 'Treino', nivel: 'Nível',
    for: 'Força', des: 'Destreza', con: 'Constituição',
    int: 'Inteligência', ast: 'Astúcia', von: 'Vontade',
    vida: 'Vida', vida_max: 'Vida Máxima',
    pe: 'Energia', pe_max: 'Energia Máxima',
    defesa: 'Defesa',
    'status.vida.atual': 'Vida Atual',
    'status.vida.max': 'Vida Máxima',
    'status.energiaamaldicoada.atual': 'Energia Atual',
    'status.energiaamaldicoada.max': 'Energia Máxima',
    'status.defesa': 'Defesa',
    'status.bonustreinamento': 'Bônus de Treinamento',
    'atributos.forca': 'Força',
    'atributos.destreza': 'Destreza',
    'atributos.constituicao': 'Constituição',
    'atributos.inteligencia': 'Inteligência',
    'atributos.astucia': 'Astúcia',
    'atributos.vontade': 'Vontade',
    dano_pendente: 'Dano Recebido',
    dano_recebido: 'Dano Recebido',
  };
  return { ...aliasLabels, ...m };
}

const NOMES_AMIGAVEIS = mapaNomesAmigaveis();

/** Traduz um identificador (com ou sem @USUARIO./@ALVO.) em nome humano. */
function humanizarIdentificador(ident: string): string {
  const limpo = ident
    .replace(/^@?(USUARIO|ALVO|CENA)\./i, '')
    .replace(/^@/, '')
    .toLowerCase();
  if (NOMES_AMIGAVEIS[limpo]) return NOMES_AMIGAVEIS[limpo];
  // Perícias (pericia_xxx) → "Perícia Xxx"
  if (limpo.startsWith('pericia_')) {
    const nome = limpo.slice('pericia_'.length).replace(/_/g, ' ');
    return `Perícia de ${nome.replace(/\b\w/g, (c) => c.toUpperCase())}`;
  }
  return limpo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Converte uma fórmula crua em uma frase humana.
 * Ex.: "@USUARIO.treino * 2"  → "Dobro do Treino"
 *      "@USUARIO.treino * 3"  → "Treino × 3"
 *      "@USUARIO.forca + 2"   → "Força + 2"
 *      "10"                   → "10"
 */
export function humanizarFormula(formula: string): string {
  const f = (formula || '').trim();
  if (!f) return '0';

  // Número puro
  if (/^-?\d+(?:\.\d+)?$/.test(f)) return f;

  // Padrão "<id> * N" ou "N * <id>" → atalhos "Dobro/Triplo/Metade"
  const mulRight = f.match(/^(@?[A-Za-zÀ-ÿ_][\w.]*)\s*\*\s*(\d+(?:\.\d+)?)$/);
  const mulLeft  = f.match(/^(\d+(?:\.\d+)?)\s*\*\s*(@?[A-Za-zÀ-ÿ_][\w.]*)$/);
  const par = mulRight
    ? { id: mulRight[1], n: Number(mulRight[2]) }
    : mulLeft
      ? { id: mulLeft[2], n: Number(mulLeft[1]) }
      : null;
  if (par) {
    const nome = humanizarIdentificador(par.id);
    if (par.n === 2) return `Dobro do ${nome}`;
    if (par.n === 3) return `Triplo do ${nome}`;
    if (par.n === 0.5) return `Metade do ${nome}`;
    return `${nome} × ${par.n}`;
  }

  // Padrão "<id> / 2" → "Metade do <nome>"
  const half = f.match(/^(@?[A-Za-zÀ-ÿ_][\w.]*)\s*\/\s*2$/);
  if (half) return `Metade do ${humanizarIdentificador(half[1])}`;

  // Caso geral — substitui cada identificador pelo nome amigável e
  // remove símbolos exóticos (@). Mantém + - × ÷.
  const traduzido = f.replace(/(@?[A-Za-zÀ-ÿ_][\w.]*)/g, (id) => humanizarIdentificador(id));
  return traduzido
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Verbo de ação amigável (sem repetir o recurso). */
export function verboAcao(tipo: CombatEffect['type']): string {
  return VERBO_ACAO[tipo];
}

/** Nome amigável de um recurso (path técnico → label de RPG). */
export function nomeAmigavelRecurso(path?: string): string {
  const p = (path || 'vida_atual').toLowerCase();
  return NOMES_AMIGAVEIS[p] ?? recursoBonito(p);
}

/**
 * Monta a frase do Plano de Execução para um efeito.
 * Se `valorMock` for fornecido, anexa "(... : N)".
 */
export function frasePlanoExecucao(
  efeito: CombatEffect,
  valorMock?: number,
): string {
  const recurso = nomeAmigavelRecurso(efeito.resourcePath);
  // Verbos absolutos: renderização limpa, sem expor "Definir 0".
  if (efeito.absoluteVerb) {
    const v = efeito.absoluteVerb === 'anular' ? 'Anular' : 'Ignorar';
    return `${v} ${recurso}`;
  }
  const verbo = verboAcao(efeito.type);
  const expr = humanizarFormula(efeito.formula || '0');
  const corpo = valorMock != null ? `(${expr}: ${valorMock})` : `(${expr})`;
  return `${verbo} ${corpo} em ${recurso}`;
}

/**
 * Humaniza um watcher dinâmico em uma frase pt-BR amigável.
 * Ex.: { resource:'vida_atual', op:'<=', threshold:0 }
 *      → "Quando Vida Atual baixar para 0"
 *      { resource:'vida_atual', op:'<=', threshold:0.2, percent:true }
 *      → "Quando Vida Atual baixar para 20% de Vida Máxima"
 */
export function humanizarWatcher(w: NonNullable<CombatEffect['watcher']>): string {
  const recurso = nomeAmigavelRecurso(w.resource);
  const verbo =
    w.op === '<=' ? 'baixar para' :
    w.op === '<'  ? 'ficar abaixo de' :
    w.op === '>=' ? 'atingir' :
    w.op === '>'  ? 'ultrapassar' :
    w.op === '==' ? 'for igual a' :
                    'for diferente de';
  let valorTxt: string;
  if (w.percent) {
    const pct = Math.round((w.threshold ?? 0) * 100);
    const base = w.percentBase ? ` de ${nomeAmigavelRecurso(w.percentBase)}` : '';
    valorTxt = `${pct}%${base}`;
  } else {
    valorTxt = String(w.threshold);
  }
  return `Quando ${recurso} ${verbo} ${valorTxt}`;
}
