/**
 * Parser Matemático do Omni-Engine (Pilar 4).
 *
 * - Avalia fórmulas com expr-eval (proibido eval nativo).
 * - Pré-processa dados avançados: XdY, XdY!, XdYkhN (vantagem/desvantagem),
 *   XdYrN (reroll mínimos).
 * - Resolve aliases @USUARIO, @ALVO, @CENA, @TREINO, @NIVEL, etc.
 * - Suporta sobrescrita inteligente de buffs homônimos (maior vence).
 */
import { Parser } from 'expr-eval';
import { canonicalizarChave } from './keyAliases';

export interface DiagnosticoFormula {
  tipo: 'chave_ausente' | 'valor_nao_finito' | 'expressao_invalida' | 'resultado_nao_finito';
  referencia?: string;
  mensagem: string;
}

export interface ContextoAvaliacao {
  /** Variáveis simples resolvidas (ex: TREINO=3, FOR=4). */
  variaveis: Record<string, number>;
  /** Notação-base da arma; a única referência textual permitida em fórmulas. */
  armaDano?: string;
  /** Rolagens coletadas durante a avaliação (para log/transparência). */
  rolagens: ResultadoRolagem[];
  /** Sementes opcionais para testes determinísticos. */
  rng?: () => number;
  /** Informações da avaliação, sem alterar o fallback numérico legado. */
  diagnosticos?: DiagnosticoFormula[];
}

export interface ResultadoRolagem {
  notacao: string; // "2d6!", "1d20kh2"
  rolls: number[];
  total: number;
  observacao?: string; // "explosão", "vantagem", etc.
}

const parser = new Parser({
  operators: {
    add: true,
    concatenate: false,
    conditional: true,
    divide: true,
    factorial: false,
    multiply: true,
    power: true,
    remainder: true,
    subtract: true,
    logical: true,
    comparison: true,
    'in': false,
    assignment: false,
  },
});

// Funções utilitárias expostas no parser (floor, ceil, round, min, max, abs).
parser.functions.floor = Math.floor;
parser.functions.ceil = Math.ceil;
parser.functions.round = Math.round;
parser.functions.min = Math.min;
parser.functions.max = Math.max;
parser.functions.abs = Math.abs;
parser.functions.sqrt = Math.sqrt;
parser.functions.pow = Math.pow;
// `if(cond, a, b)` — útil para fórmulas geradas pelo Modo Simples (Intuitive Builder).
// Trata qualquer valor "truthy" não-zero como verdadeiro.
parser.functions.if = (cond: number | boolean, a: number, b: number): number => {
  const truthy = typeof cond === 'boolean' ? cond : Number(cond) !== 0;
  return truthy ? a : b;
};
// PR-3: clamp, between, pct.
parser.functions.clamp = (x: number, a: number, b: number): number =>
  Math.min(Math.max(Number(x), Math.min(a, b)), Math.max(a, b));
parser.functions.between = (x: number, a: number, b: number): number =>
  (Number(x) >= Math.min(a, b) && Number(x) <= Math.max(a, b)) ? 1 : 0;
parser.functions.pct = (parte: number, total: number): number =>
  Number(total) > 0 ? Math.round((Number(parte) / Number(total)) * 100) : 0;
// PR-4: utilitários de rolagem expostos como funções.
parser.functions.rand = (min: number, max: number): number => {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
};
parser.functions.coin = (): number => (Math.random() < 0.5 ? 0 : 1);
parser.functions.d = (sides: number): number => {
  const s = Math.max(1, Math.floor(Number(sides) || 0));
  return Math.floor(Math.random() * s) + 1;
};

/**
 * Mapa de "atalhos" pt-BR usado quando a fórmula referencia uma chave
 * curta após um prefixo de contexto (ex: @USUARIO.vida → VIDA).
 * Aceita variações sem acento e em qualquer caixa.
 */
const ATALHOS_PT_BR: Record<string, string> = {
  vida: 'VIDA',
  vida_atual: 'VIDA',
  vidaatual: 'VIDA',
  vida_max: 'VIDA_MAX',
  vidamax: 'VIDA_MAX',
  pe: 'PE',
  pe_max: 'PE_MAX',
  pemax: 'PE_MAX',
  energia: 'PE',
  energia_atual: 'PE',
  energiaatual: 'PE',
  energia_max: 'PE_MAX',
  energiamax: 'PE_MAX',
  defesa: 'DEFESA',
  deslocamento: 'DESLOCAMENTO',
  desloc: 'DESLOCAMENTO',
  exaustao: 'EXAUSTAO',
  nivel: 'NIVEL',
  treino: 'TREINO',
  forca: 'FOR',
  destreza: 'DES',
  constituicao: 'CON',
  inteligencia: 'INT',
  sabedoria: 'SAB',
  sab: 'SAB',
  // Astúcia e Vontade são Testes de Resistência (TR), não atributos.
  astucia: 'ASTUCIA',
  vontade: 'VONTADE',
  ast: 'ASTUCIA',
  von: 'VONTADE',
  // Demais TRs.
  fortitude: 'FORTITUDE',
  integridade: 'INTEGRIDADE',
  reflexos: 'REFLEXOS',
  // Presença é atributo real. CAR/Carisma vira alias de PRE por compatibilidade.
  presenca: 'PRE',
  pre: 'PRE',
  carisma: 'PRE',
  car: 'PRE',
  esquiva: 'ESQUIVA',
  resistencia: 'RESISTENCIA',
  acerto: 'ACERTO',
  dano: 'DANO',
  rodada: 'RODADA',
  dt: 'DT',
  dificuldade: 'DT',
  distancia: 'DISTANCIA',
  bonus_treinamento: 'TREINO',
  bonustreinamento: 'TREINO',
  bonusdetreinamento: 'TREINO',
  treinamento: 'TREINO',
  for: 'FOR', des: 'DES', con: 'CON',
  int: 'INT', prs: 'PRE',
  // ─── Novos atalhos pt-BR (recursos & combate avançado) ──────────────
  vida_temp: 'VIDA_TEMP', vidatemp: 'VIDA_TEMP', vida_temporaria: 'VIDA_TEMP',
  vida_pct: 'VIDA_PCT', vidapct: 'VIDA_PCT', porcentagem_vida: 'VIDA_PCT',
  energia_pct: 'ENERGIA_PCT', energiapct: 'ENERGIA_PCT',
  pe_pct: 'PE_PCT', pepct: 'PE_PCT', porcentagem_pe: 'PE_PCT',
  pe_temp: 'PE_TEMP',
  sorte: 'SORTE', sorte_atual: 'SORTE', sorte_max: 'SORTE_MAX',
  dado_vida: 'DADO_VIDA', dadovida: 'DADO_VIDA',
  dado_vida_atual: 'DADO_VIDA_ATUAL', dado_vida_max: 'DADO_VIDA_MAX',
  reserva_pe: 'RESERVA_PE', reservape: 'RESERVA_PE',
  exaustao_nivel: 'EXAUSTAO_NIVEL',
  fome: 'FOME', fome_nivel: 'FOME_NIVEL',
  defesa_cac: 'DEFESA_CAC', defesa_corpo: 'DEFESA_CAC',
  defesa_dist: 'DEFESA_DIST', defesa_distancia: 'DEFESA_DIST',
  iniciativa: 'INICIATIVA', atencao: 'ATENCAO',
  ataques_no_turno: 'ATAQUES_NO_TURNO', ataques_restantes: 'ATAQUES_RESTANTES',
  acao_restante: 'ACAO_RESTANTE', acoes_restantes: 'ACOES_RESTANTES',
  acao_bonus: 'ACAO_BONUS',
  ado_max: 'ADO_MAX', ado_restantes: 'ADO_RESTANTES',
  reacao_disponivel: 'REACAO_DISPONIVEL',
  movimento_restante: 'MOVIMENTO_RESTANTE',
  tamanho: 'TAMANHO',
  morrendo: 'MORRENDO', esta_morrendo: 'ESTA_MORRENDO',
  morto: 'MORTO', inconsciente: 'INCONSCIENTE',
  escudo_equipado: 'ESCUDO_EQUIPADO',
  categoria: 'CATEGORIA',
  concentrando: 'CONCENTRANDO', concentrando_em: 'CONCENTRANDO',
  empolgacao: 'EMPOLGACAO', empolgacao_nivel: 'EMPOLGACAO_NIVEL',
  rodadas_em_combate: 'RODADAS_EM_COMBATE',
  // Talentos/Aptidões/Habilidades expostos
  escudo_proficiente: 'ESCUDO_PROFICIENTE',
  dual_wield_def: 'DUAL_WIELD_DEF',
  movimento_bonus_metros: 'MOVIMENTO_BONUS_METROS',
  vigor_maldito_bonus: 'VIGOR_MALDITO_BONUS',
  suporte_lv2_unlocked: 'SUPORTE_LV2_UNLOCKED',
  rd_alma: 'RD_ALMA',
  atencao_bonus: 'ATENCAO_BONUS',
  tr_vs_debuff_defesa_bonus: 'TR_VS_DEBUFF_DEFESA_BONUS',
  grupos_critico_arma: 'GRUPOS_CRITICO_ARMA',
  max_concentracao: 'MAX_CONCENTRACAO',
  max_sustentados: 'MAX_SUSTENTADOS',
  slots_liberacao_bonus: 'SLOTS_LIBERACAO_BONUS',
  pe_temp_por_rodada: 'PE_TEMP_POR_RODADA',
  aura_ca_bonus: 'AURA_CA_BONUS',
  aura_rd_fisica: 'AURA_RD_FISICA',
  aura_furtividade_bonus: 'AURA_FURTIVIDADE_BONUS',
  aura_agarrar_bonus: 'AURA_AGARRAR_BONUS',
  au: 'AU', cl: 'CL', bar: 'BAR', dom: 'DOM', er: 'ER',
  // Contadores
  qtd_talentos: 'QTD_TALENTOS',
  qtd_aptidoes: 'QTD_APTIDOES',
  qtd_habilidades: 'QTD_HABILIDADES',
  qtd_talentos_combate: 'QTD_TALENTOS_COMBATE',
  qtd_aptidoes_aura: 'QTD_APTIDOES_AURA',
  qtd_habilidades_spec: 'QTD_HABILIDADES_SPEC',
};

function normalizarChavePt(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizarFormulaHumana(expressao: string): string {
  return expressao
    .replace(/÷/g, '/')
    .replace(/[×·]/g, '*')
    .replace(/[−–—]/g, '-')
    .replace(/\bmaior\s+ou\s+igual\s+a\b/gi, '>=')
    .replace(/\bmenor\s+ou\s+igual\s+a\b/gi, '<=')
    .replace(/\bdiferente\s+de\b/gi, '!=')
    .replace(/\bigual\s+a\b/gi, '==')
    .replace(/\bmaior\s+que\b/gi, '>')
    .replace(/\bmenor\s+que\b/gi, '<')
    .replace(/\bb[oô]nus\s+de\s+treinamento\b/gi, (match, offset, src) =>
      /[@.]$/.test(src.slice(0, offset)) ? match : '@USUARIO.bonus_treinamento'
    )
    .replace(/\bn[ií]vel\b/gi, (match, offset, src) =>
      /[@.]$/.test(src.slice(0, offset)) ? match : '@USUARIO.nivel'
    );
}

/** Resolve uma chave pt-BR (vida, forca, etc.) para a chave canônica (VIDA, FOR…). */
export function resolverChavePtBr(chave: string): string {
  const n = normalizarChavePt(chave);
  return ATALHOS_PT_BR[n] ?? n.toUpperCase();
}

// ============================================================================
// Rolagem de Dados
// ============================================================================

function roll(rng: () => number, sides: number): number {
  return Math.floor(rng() * sides) + 1;
}

/** Rola uma notação avançada e retorna o total. Suporta:
 *   - `XdY`            → normal
 *   - `XdY!`           → explosão em maxroll (mesma face soma + re-rola)
 *   - `XdYkhN`         → keep highest N (vantagem)
 *   - `XdYklN`         → keep lowest N (desvantagem)
 *   - `XdYrN`          → reroll resultados ≤ N (uma vez)
 */
export function rolarNotacao(notacao: string, ctx: ContextoAvaliacao): number {
  const rng = ctx.rng ?? Math.random;
  const match = notacao.match(/^(\d+)d(\d+)(.*)$/i);
  if (!match) return 0;
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const mods = match[3] || '';

  const rerollMatch = mods.match(/r(\d+)/i);
  const explode = /!/.test(mods);
  const keepHighMatch = mods.match(/kh(\d+)/i);
  const keepLowMatch = mods.match(/kl(\d+)/i);

  let rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    let r = roll(rng, sides);
    if (rerollMatch) {
      const threshold = parseInt(rerollMatch[1], 10);
      if (r <= threshold) r = roll(rng, sides);
    }
    rolls.push(r);
    if (explode) {
      let last = r;
      // Cap safety: 20 explosions
      let explosions = 0;
      while (last === sides && explosions < 20) {
        last = roll(rng, sides);
        rolls.push(last);
        explosions++;
      }
    }
  }

  let kept = rolls;
  let observacao: string | undefined;
  if (keepHighMatch) {
    const n = parseInt(keepHighMatch[1], 10);
    kept = [...rolls].sort((a, b) => b - a).slice(0, n);
    observacao = `vantagem kh${n}`;
  } else if (keepLowMatch) {
    const n = parseInt(keepLowMatch[1], 10);
    kept = [...rolls].sort((a, b) => a - b).slice(0, n);
    observacao = `desvantagem kl${n}`;
  } else if (explode) {
    observacao = 'explosão';
  } else if (rerollMatch) {
    observacao = `reroll≤${rerollMatch[1]}`;
  }

  const total = kept.reduce((a, b) => a + b, 0);
  ctx.rolagens.push({ notacao, rolls, total, observacao });
  return total;
}

// ============================================================================
// Pré-processamento da expressão
// ============================================================================

/**
 * Converte `1d8!`, `2d6kh1`, `@USUARIO.vida`, `@ALVO.forca`, `@CENA.x`
 * e `@TREINO` em valores numéricos antes do parser.
 *
 * Regras de contexto:
 * - `@USUARIO.X` → lê `USUARIO_<X>` (resolvendo X via atalhos pt-BR).
 * - `@ALVO.X`    → lê `ALVO_<X>`.
 * - `@CENA.X`    → lê `CENA_<X>`.
 * - `@X` sem prefixo → atalho: assume `@USUARIO.X`.
 */
function registrarDiagnostico(ctx: ContextoAvaliacao, diagnostico: DiagnosticoFormula): void {
  const lista = ctx.diagnosticos ??= [];
  if (!lista.some(d => d.tipo === diagnostico.tipo && d.referencia?.toUpperCase() === diagnostico.referencia?.toUpperCase())) {
    lista.push(diagnostico);
  }
}

function valorDaReferencia(ctx: ContextoAvaliacao, referencia: string, chave: string, fallback?: string): string {
  const v = ctx.variaveis[chave] ?? (fallback ? ctx.variaveis[fallback] : undefined);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  registrarDiagnostico(ctx, {
    tipo: v === undefined ? 'chave_ausente' : 'valor_nao_finito',
    referencia,
    mensagem: v === undefined
      ? `Referência sem valor no contexto atual: ${referencia}`
      : `Referência sem valor numérico finito: ${referencia}`,
  });
  return '0';
}

function preprocessar(expressao: string, ctx: ContextoAvaliacao): string {
  let out = normalizarFormulaHumana(expressao);

  // Expande a notação declarativa da arma antes de rolar os grupos de dados.
  out = out.replace(/@ARMA\.DANO\b/gi, (referencia) => {
    if (ctx.armaDano?.trim()) return `(${ctx.armaDano})`;
    registrarDiagnostico(ctx, { tipo: 'chave_ausente', referencia, mensagem: 'A arma não tem dano-base disponível neste contexto.' });
    return '0';
  });

  // 1) Substitui notações de dado por números rolados.
  out = out.replace(/(\d+d\d+(?:!|kh\d+|kl\d+|r\d+)*)/gi, (match) =>
    String(rolarNotacao(match, ctx))
  );

  // 2) Substitui @PREFIXO.subchave (ex: @USUARIO.vida, @ALVO.forca, @CENA.x, @ITEM.usos_restantes, @ARMA.passo).
  out = out.replace(
    /@(USUARIO|ALVO|CENA|ITEM|DANO|ARMA)\.([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*(?:\.[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*)*)/gi,
    (referencia, prefixo: string, sub: string) => {
      const px = prefixo.toUpperCase();
      // ITEM/DANO têm campos próprios. Personagens aceitam caminhos legados.
      const chave = px === 'ITEM' || px === 'DANO' ? sub.toUpperCase()
        : resolverChavePtBr(px === 'USUARIO' || px === 'ALVO' ? canonicalizarChave(sub) : sub);
      const namespaced = `${px}_${chave}`;
      return valorDaReferencia(ctx, referencia, namespaced, px === 'USUARIO' ? chave : undefined);
    }
  );

  // 3) Substitui @ALIAS sem prefixo (atalho → @USUARIO.X).
  out = out.replace(/@([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*(?:\.[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*)*)/gi, (referencia, key: string) => {
    const chave = resolverChavePtBr(canonicalizarChave(key));
    // Bags combinadas podem conter uma chave nua sobrescrita pelo ALVO.
    // O atalho sem escopo sempre pertence ao USUARIO quando ele está presente.
    return valorDaReferencia(ctx, referencia, `USUARIO_${chave}`, chave);
  });

  // 3b) Dados com quantidade dinâmica: `(@USUARIO.rancor)d4` → `(3)d4` → rola.
  //     Também cobre `@CENA.consumido d8` escrito como `(@CENA.consumido)d8`.
  out = out.replace(/\(\s*(\d+)\s*\)\s*d(\d+)/gi, (_m, n: string, f: string) =>
    String(Number(n) > 0 ? rolarNotacao(`${n}d${f}`, ctx) : 0)
  );


  // 4) Açúcar sintático de arredondamento sufixo:
  //    EXPR<  →  floor(EXPR)     EXPR>  →  ceil(EXPR)
  //
  // O sufixo só é interpretado como arredondamento quando vem em "posição
  // pós-fixa" — ou seja, seguido por fim de string, espaço, `)`, `,`, ou
  // outro operador (`+ - * / %`). Assim preservamos `a < b` / `a > b` como
  // comparação normal (sufixo seguido por letra/dígito = operador binário).
  //
  // Captura à esquerda: o maior trecho de expressão "encadeada" — termos
  // ligados por `* / % + -` — parando em `(`, `,`, espaço, ou início.
  // Permite `treinamento/2<`, `(@TREINO+1)/2>`, `1d20+for<`, etc.
  out = aplicarArredondamentoSufixo(out);

  return out;
}

/** Aplica recursivamente `EXPR<` → `floor(EXPR)` e `EXPR>` → `ceil(EXPR)`. */
function aplicarArredondamentoSufixo(s: string): string {
  // Regex: encontra um `<` ou `>` que NÃO é seguido por letra/dígito/`=`/`.`
  // (ou seja, está em posição pós-fixa, não comparativo).
  // Espaços seguidos de operando (`4 > 3`, `x < (y)`) também são comparação.
  const re = /([<>])(?!\s*[A-Za-zÀ-ÿ0-9_=.(@])/;
  let out = s;
  // Loop até não haver mais sufixos a converter (processa do mais à esquerda).
  for (let guarda = 0; guarda < 50; guarda++) {
    const m = re.exec(out);
    if (!m) break;
    const idxOp = m.index;
    const op = m[1];
    // Acha o início do operando à esquerda.
    const inicio = acharInicioOperandoEsquerda(out, idxOp);
    if (inicio === idxOp) {
      // Sem operando — remove o caractere para evitar loop infinito.
      out = out.slice(0, idxOp) + out.slice(idxOp + 1);
      continue;
    }
    const operando = out.slice(inicio, idxOp);
    const fn = op === '<' ? 'floor' : 'ceil';
    out = out.slice(0, inicio) + `${fn}(${operando})` + out.slice(idxOp + 1);
  }
  return out;
}

/**
 * A partir da posição do operador, anda pra trás capturando uma cadeia
 * de termos ligados por `+ - * / %`. Respeita parênteses balanceados.
 */
function acharInicioOperandoEsquerda(s: string, idxOp: number): number {
  let i = idxOp - 1;
  // pula espaços imediatamente antes do operador
  while (i >= 0 && s[i] === ' ') i--;
  let depth = 0;
  let limite = i + 1; // posição final (exclusiva) do operando
  while (i >= 0) {
    const c = s[i];
    if (c === ')') { depth++; i--; continue; }
    if (c === '(') {
      if (depth === 0) break; // chegamos no delimitador externo
      depth--; i--; continue;
    }
    if (depth === 0) {
      // Caracteres válidos dentro do operando (em nível 0):
      // letras, dígitos, `_`, `.`, `@`, espaço, e operadores `+ - * / %`.
      if (c === ',' || c === '<' || c === '>') break;
      // Operadores binários: continuam a cadeia, mas só se houver algo à esquerda
      // que pareça operando (letra/dígito/`)`).
      if (/[+\-*/%]/.test(c)) {
        // espia 1 char não-espaço à esquerda
        let j = i - 1;
        while (j >= 0 && s[j] === ' ') j--;
        if (j < 0) break;
        const prev = s[j];
        if (!/[A-Za-zÀ-ÿ0-9_.)@]/.test(prev)) break;
        i--; continue;
      }
      if (!/[A-Za-zÀ-ÿ0-9_.@ ]/.test(c)) break;
    }
    i--;
  }
  // remove espaços iniciais
  let inicio = i + 1;
  while (inicio < limite && s[inicio] === ' ') inicio++;
  return inicio;
}

// ============================================================================
// Avaliação principal
// ============================================================================

export function avaliarFormula(
  expressao: string,
  variaveis: Record<string, number> = {},
  rng?: () => number,
  extras?: {
    alvo?: Record<string, number>;
    cena?: Record<string, number>;
    /** Bag de variáveis do item ativo. Acessíveis via `@ITEM.X`. */
    item?: Record<string, number>;
    /** Campos numéricos de um evento de dano, acessíveis via @DANO.X. */
    dano?: Record<string, number>;
    /** Dano-base da arma e valores acessíveis via @ARMA.DADOS, @ARMA.PASSO etc. */
    arma?: { dano?: string; [chave: string]: number | string | undefined };
    /**
     * Resultados de efeitos anteriores em uma cadeia (1-indexado).
     * Expostos como `RESULTADO_1`, `RESULTADO_2`, … na bag de variáveis,
     * acessíveis na fórmula via `@RESULTADO_1`.
     */
    resultados?: number[];
  }
): { valor: number; rolagens: ResultadoRolagem[]; expressaoResolvida: string; diagnosticos: DiagnosticoFormula[] } {
  // Mantém nomes originais para variáveis nuas em fórmulas legadas.
  const bag: Record<string, number> = { ...variaveis };
  for (const [k, v] of Object.entries(variaveis)) bag[k.toUpperCase()] = v;
  for (const [prefixo, campos] of Object.entries({ ALVO: extras?.alvo, CENA: extras?.cena, ITEM: extras?.item, DANO: extras?.dano, ARMA: extras?.arma })) {
    for (const [k, v] of Object.entries(campos ?? {})) {
      if (prefixo === 'ARMA' && k.toUpperCase() === 'DANO') continue;
      const semPrefixo = k.replace(new RegExp(`^${prefixo}_`, 'i'), '');
      const chave = prefixo === 'ALVO' ? resolverChavePtBr(canonicalizarChave(semPrefixo))
        : prefixo === 'CENA' ? resolverChavePtBr(semPrefixo) : semPrefixo.toUpperCase();
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      bag[`${prefixo}_${chave}`] = v;
    }
  }
  if (extras?.resultados) {
    extras.resultados.forEach((v, i) => {
      bag[`RESULTADO_${i + 1}`] = v;
    });
  }
  const ctx: ContextoAvaliacao = { variaveis: bag, armaDano: extras?.arma?.dano, rolagens: [], rng, diagnosticos: [] };
  const resolvida = preprocessar(expressao, ctx);
  try {
    const expr = parser.parse(resolvida);
    const escopoAvaliacao: Record<string, number> = {};
    for (const [k, v] of Object.entries(bag)) {
      escopoAvaliacao[k] = v;
      escopoAvaliacao[k.toLowerCase()] = v;
    }
    const valor = expr.evaluate(escopoAvaliacao);
    const num = typeof valor === 'boolean'
      ? (valor ? 1 : 0)
      : typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
    if (typeof valor !== 'boolean' && (typeof valor !== 'number' || !Number.isFinite(valor))) {
      registrarDiagnostico(ctx, { tipo: 'resultado_nao_finito', mensagem: 'A fórmula não produziu um número finito.' });
    }
    return { valor: num, rolagens: ctx.rolagens, expressaoResolvida: resolvida, diagnosticos: ctx.diagnosticos! };
  } catch {
    registrarDiagnostico(ctx, { tipo: 'expressao_invalida', mensagem: 'Não foi possível avaliar a expressão.' });
    return { valor: 0, rolagens: ctx.rolagens, expressaoResolvida: resolvida, diagnosticos: ctx.diagnosticos! };
  }
}

// ============================================================================
// Sobrescrita Inteligente de Buffs Homônimos (maior vence)
// ============================================================================

export interface BuffNumerico {
  nome: string;
  caminho: string;
  valor: number;
}

/** Ao aplicar vários buffs com o mesmo (nome, caminho), mantém só o maior. */
export function sobrescreverBuffsHomonimos(buffs: BuffNumerico[]): BuffNumerico[] {
  const map = new Map<string, BuffNumerico>();
  for (const b of buffs) {
    const chave = `${b.nome}::${b.caminho}`;
    const existente = map.get(chave);
    if (!existente || b.valor > existente.valor) {
      map.set(chave, b);
    }
  }
  return Array.from(map.values());
}
