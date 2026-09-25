/**
 * Sistema de Níveis de Dano (canônico).
 *
 * Regras (livro p. 138):
 *   - Tabela canônica: -2, -1, padrão, +1, +2, +3.
 *   - Acima de +3: continua subindo seguindo a sequência dXXX → 1d12 → 1d12+1d4 → 1d12+1d6 → ... → 1d12+1d12 → 1d12+1d12+1d4 ...
 *   - Abaixo de -2: continua reduzindo até chegar em "1" (dano fixo 1).
 *   - Múltiplos dados (ex.: 6d6): converte usando dano máximo equivalente
 *     para encontrar a linha mais próxima na tabela.
 *   - Um dado de dano "extra" (habilidade que diz "+1 dado") = maior dado
 *     do nível atual.
 *
 * Notação aceita: "1d6", "2d4", "1d12+1d4", "1d10/1d12" (versátil — escolher
 * lado antes de chamar). Caso passe versátil, lança erro pedindo `pickHand`.
 */

export type DamageDie = { count: number; sides: number };
export type DamageDice = DamageDie[]; // soma de termos: ex. [{count:1,sides:12},{count:1,sides:4}]

const FIXED_ONE: DamageDice = [{ count: 1, sides: 1 }]; // representação de "1"

// ===== Parser ===============================================================

/** Converte "1d6", "2d4", "1d12+1d4" em DamageDice. Lança em versátil ("1d6/1d8"). */
export function parseDamage(notation: string): DamageDice {
  const n = notation.trim().toLowerCase();
  if (n === '1' || n === '0') return FIXED_ONE;
  if (n.includes('/')) {
    throw new Error(`parseDamage: notação versátil "${notation}" requer escolha de mão antes.`);
  }
  const parts = n.split('+').map(p => p.trim());
  const out: DamageDice = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)d(\d+)$/);
    if (!m) throw new Error(`parseDamage: termo inválido "${p}" em "${notation}"`);
    out.push({ count: parseInt(m[1], 10), sides: parseInt(m[2], 10) });
  }
  return out;
}

export function formatDamage(dice: DamageDice): string {
  if (dice.length === 1 && dice[0].sides === 1) return '1';
  return dice.map(d => `${d.count}d${d.sides}`).join('+');
}

// ===== Escala canônica (linhas da tabela do livro) =========================

/**
 * Cada linha = sequência de níveis [-2, -1, padrão, +1, +2, +3] para um
 * "dado base" diferente. O índice 2 é sempre o "padrão".
 */
type Raw = [number, number]; // [count, sides]
const toDice = (raw: Raw[]): DamageDice => raw.map(([count, sides]) => ({ count, sides }));

const ROWS_NORMALIZED: DamageDice[][] = [
  // base 1 → padrão = 1d4
  [toDice([[1,1]]), toDice([[1,2]]), toDice([[1,3]]), toDice([[1,4]]), toDice([[1,6]]), toDice([[1,8]])],
  // base 1d4 → padrão = 1d6
  [toDice([[1,2]]), toDice([[1,3]]), toDice([[1,4]]), toDice([[1,6]]), toDice([[1,8]]), toDice([[1,10]])],
  // base 1d6 → padrão = 1d8
  [toDice([[1,3]]), toDice([[1,4]]), toDice([[1,6]]), toDice([[1,8]]), toDice([[1,10]]), toDice([[1,12]])],
  // base 1d8 → padrão = 1d10
  [toDice([[1,4]]), toDice([[1,6]]), toDice([[1,8]]), toDice([[1,10]]), toDice([[1,12]]), toDice([[1,12],[1,4]])],
  // base 1d10 → padrão = 1d12
  [toDice([[1,6]]), toDice([[1,8]]), toDice([[1,10]]), toDice([[1,12]]), toDice([[1,12],[1,4]]), toDice([[1,12],[1,6]])],
  // base 1d12 → padrão = 1d12+1d4
  [toDice([[1,8]]), toDice([[1,10]]), toDice([[1,12]]), toDice([[1,12],[1,4]]), toDice([[1,12],[1,6]]), toDice([[1,12],[1,8]])],
  // base 2d6 → padrão = 2d10
  [toDice([[1,10]]), toDice([[2,6]]), toDice([[2,8]]), toDice([[2,10]]), toDice([[2,12]]), toDice([[2,12],[1,4]])],
];

// ===== Operações ============================================================

/** Soma do MAX dos dados (usado para encaixar em linha quando notação não bate). */
export function maxOf(dice: DamageDice): number {
  return dice.reduce((acc, d) => acc + d.count * d.sides, 0);
}

function diceEqual(a: DamageDice, b: DamageDice): boolean {
  if (a.length !== b.length) return false;
  return a.every((d, i) => d.count === b[i].count && d.sides === b[i].sides);
}

/** Procura a célula `dice` em todas as linhas; retorna {row, col} ou null. */
function findCell(dice: DamageDice): { row: number; col: number } | null {
  for (let r = 0; r < ROWS_NORMALIZED.length; r++) {
    for (let c = 0; c < ROWS_NORMALIZED[r].length; c++) {
      if (diceEqual(ROWS_NORMALIZED[r][c], dice)) return { row: r, col: c };
    }
  }
  return null;
}

/** Encontra a linha cujo `padrão` (col=2) tem max mais próximo do max(dice). */
function approximateRow(dice: DamageDice): number {
  const target = maxOf(dice);
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let r = 0; r < ROWS_NORMALIZED.length; r++) {
    const diff = Math.abs(maxOf(ROWS_NORMALIZED[r][2]) - target);
    if (diff < bestDiff) { bestDiff = diff; best = r; }
  }
  return best;
}

/**
 * Sequência canônica de "próximos passos" após o fim das linhas
 * (1d12 → 1d12+1d4 → 1d12+1d6 → 1d12+1d8 → 1d12+1d10 → 1d12+1d12 → 1d12+1d12+1d4 → ...).
 */
function stepUpOverflow(dice: DamageDice): DamageDice {
  // Sobe o ÚLTIMO dado adicional; se chegou a d12, adiciona um novo d4.
  const out = dice.map(d => ({ ...d }));
  const last = out[out.length - 1];
  const ladder = [4, 6, 8, 10, 12];
  const idx = ladder.indexOf(last.sides);
  if (idx >= 0 && idx < ladder.length - 1) {
    last.sides = ladder[idx + 1];
    return out;
  }
  // último é d12 (ou não-canônico): adiciona um novo d4.
  out.push({ count: 1, sides: 4 });
  return out;
}

function stepDownBelowMin(dice: DamageDice): DamageDice {
  // Reduz o último termo seguindo d12→d10→d8→d6→d4→d3→d2→1.
  const out = dice.map(d => ({ ...d }));
  const last = out[out.length - 1];
  const ladder = [12, 10, 8, 6, 4, 3, 2, 1];
  const idx = ladder.indexOf(last.sides);
  if (idx >= 0 && idx < ladder.length - 1) {
    last.sides = ladder[idx + 1];
    if (last.sides === 1) return FIXED_ONE;
    return out;
  }
  return FIXED_ONE;
}

/**
 * Aplica `delta` níveis de dano (+ ou -) a `dice`.
 * Retorna a nova notação. Idempotente para delta=0.
 */
export function stepDamage(dice: DamageDice, delta: number): DamageDice {
  if (delta === 0) return dice.map(d => ({ ...d }));

  // Localiza na tabela ou aproxima
  let pos = findCell(dice);
  let row: number;
  let col: number;
  if (pos) { row = pos.row; col = pos.col; }
  else { row = approximateRow(dice); col = 2; }

  let current: DamageDice = ROWS_NORMALIZED[row][col].map(d => ({ ...d }));
  let remaining = delta;

  while (remaining > 0) {
    if (col < 5) { col += 1; current = ROWS_NORMALIZED[row][col].map(d => ({ ...d })); }
    else { current = stepUpOverflow(current); }
    remaining -= 1;
  }
  while (remaining < 0) {
    if (col > 0) { col -= 1; current = ROWS_NORMALIZED[row][col].map(d => ({ ...d })); }
    else { current = stepDownBelowMin(current); if (diceEqual(current, FIXED_ONE)) break; }
    remaining += 1;
  }
  return current;
}

/** Açúcar: aceita string. */
export function stepDamageStr(notation: string, delta: number): string {
  return formatDamage(stepDamage(parseDamage(notation), delta));
}

/** Maior dado presente em `dice` (usado por "+1 dado de dano"). */
export function biggestDie(dice: DamageDice): DamageDie {
  return dice.reduce((max, d) => (d.sides > max.sides ? d : max), dice[0]);
}

/** Adiciona N dados extras do MAIOR dado da expressão. */
export function addBonusDice(dice: DamageDice, count: number): DamageDice {
  if (count <= 0) return dice.map(d => ({ ...d }));
  const big = biggestDie(dice);
  const out = dice.map(d => ({ ...d }));
  // tenta agrupar com termo existente do mesmo lado
  const existing = out.find(d => d.sides === big.sides);
  if (existing) existing.count += count;
  else out.push({ count, sides: big.sides });
  return out;
}
