/**
 * Dice Engine — Fase 13.
 *
 * Parser e roller para expressões clássicas de RPG.
 *
 * IMPORTANTE: TODAS as rolagens agora são puxadas da física 3D
 * (`useDice3DStore.requestRoll`). Por isso `rollExpression` e
 * `rollSimple` retornam Promises.
 */

import { useDice3DStore, notationToDiceTypes } from '@/stores/useDice3DStore';
import type { DiceType } from '@/components/dice-physics';

export interface DieRoll {
  faces: number;
  value: number;
  kept: boolean;
}

export interface RollTerm {
  text: string;
  sign: 1 | -1;
  rolls: DieRoll[];
  constant?: number;
  subtotal: number;
}

export interface RollResult {
  expression: string;
  total: number;
  terms: RollTerm[];
  pretty: string;
}

const DIE_RE = /^(\d*)d(\d+)((?:k[hl]\d+|d[hl]\d+)?)$/i;

const FACE_TO_TYPE: Record<number, DiceType> = {
  4: 'D4', 6: 'D6', 8: 'D8', 10: 'D10', 12: 'D12', 20: 'D20', 100: 'D100',
};

interface ParsedTerm {
  text: string;
  sign: 1 | -1;
  constant?: number;
  faces?: number;
  n?: number;
  mod?: string;
}

function parseTerm(raw: string, sign: 1 | -1): ParsedTerm {
  const txt = raw.trim();
  if (/^\d+$/.test(txt)) {
    return { text: txt, sign, constant: parseInt(txt, 10) };
  }
  const m = txt.match(DIE_RE);
  if (!m) throw new Error(`Termo inválido: ${txt}`);
  const n = m[1] ? parseInt(m[1], 10) : 1;
  const faces = parseInt(m[2], 10);
  const mod = (m[3] ?? '').toLowerCase();
  if (n <= 0 || n > 100) throw new Error(`Quantidade inválida (${n})`);
  if (faces <= 1 || faces > 1000) throw new Error(`Faces inválidas (${faces})`);
  return { text: txt, sign, faces, n, mod };
}

function applyMod(rolls: DieRoll[], mod: string, n: number) {
  if (!mod) return;
  const op = mod.slice(0, 2);
  const count = parseInt(mod.slice(2), 10);
  const sorted = [...rolls].sort((a, b) => a.value - b.value);
  let toRemove: DieRoll[] = [];
  if (op === 'kh') toRemove = sorted.slice(0, Math.max(0, n - count));
  else if (op === 'kl') toRemove = sorted.slice(count);
  else if (op === 'dl') toRemove = sorted.slice(0, count);
  else if (op === 'dh') toRemove = sorted.slice(Math.max(0, n - count));
  for (const r of toRemove) r.kept = false;
}

export async function rollExpression(expr: string): Promise<RollResult> {
  const clean = expr.replace(/\s+/g, '');
  if (!clean) throw new Error('Expressão vazia');

  // Parse tokens.
  const tokens: { sign: 1 | -1; body: string }[] = [];
  let i = 0;
  let sign: 1 | -1 = 1;
  if (clean[0] === '+' || clean[0] === '-') {
    sign = clean[0] === '-' ? -1 : 1;
    i = 1;
  }
  let buf = '';
  while (i < clean.length) {
    const c = clean[i];
    if (c === '+' || c === '-') {
      if (!buf) throw new Error('Operador sem operando');
      tokens.push({ sign, body: buf });
      sign = c === '-' ? -1 : 1;
      buf = '';
    } else {
      buf += c;
    }
    i++;
  }
  if (!buf) throw new Error('Expressão termina em operador');
  tokens.push({ sign, body: buf });

  const parsed = tokens.map((t) => parseTerm(t.body, t.sign));

  // Junta todos os dados de TODOS os termos numa única requisição 3D.
  const allTypes: DiceType[] = [];
  for (const p of parsed) {
    if (p.faces == null || p.n == null) continue;
    const type = FACE_TO_TYPE[p.faces];
    if (!type) {
      // Faces sem dado 3D suportado — usa um fallback por dado via notação.
      // (mantém o sistema funcionando para Nd3, Nd7 etc, sem visual 3D)
      continue;
    }
    for (let k = 0; k < p.n; k++) allTypes.push(type);
  }

  let values: number[] = [];
  if (allTypes.length > 0) {
    values = await useDice3DStore.getState().requestRoll(allTypes, expr);
  }

  // Distribui valores nos termos.
  const terms: RollTerm[] = [];
  let vIdx = 0;
  for (const p of parsed) {
    if (p.constant !== undefined) {
      terms.push({ text: p.text, sign: p.sign, rolls: [], constant: p.constant, subtotal: p.constant });
      continue;
    }
    const faces = p.faces!;
    const n = p.n!;
    const type = FACE_TO_TYPE[faces];
    const rolls: DieRoll[] = [];
    for (let k = 0; k < n; k++) {
      let value: number;
      if (type) {
        value = values[vIdx++] ?? 1;
        // D10 do físico retorna 0..9, D100 retorna 0..90 — normaliza para uso aditivo.
        if (faces === 10 && value === 0) value = 10;
        if (faces === 100 && value === 0) value = 100;
      } else {
        // fallback para faces sem dado 3D (ex: d3, d7)
        value = Math.floor(Math.random() * faces) + 1;
      }
      rolls.push({ faces, value, kept: true });
    }
    applyMod(rolls, p.mod ?? '', n);
    const subtotal = rolls.reduce((s, r) => s + (r.kept ? r.value : 0), 0);
    terms.push({ text: p.text, sign: p.sign, rolls, subtotal });
  }

  const total = terms.reduce((s, t) => s + t.sign * t.subtotal, 0);

  const parts: string[] = [];
  for (const t of terms) {
    const sgn = parts.length === 0 ? (t.sign === -1 ? '-' : '') : (t.sign === -1 ? ' - ' : ' + ');
    if (t.constant !== undefined) {
      parts.push(`${sgn}${t.constant}`);
    } else {
      const detail = t.rolls
        .map((r) => (r.kept ? `${r.value}` : `~~${r.value}~~`))
        .join(',');
      parts.push(`${sgn}${t.text}[${detail}]`);
    }
  }
  const pretty = `${expr} → ${parts.join('')} = ${total}`;
  return { expression: expr, total, terms, pretty };
}

/** Roll rápido de NdM sem modificadores. */
export async function rollSimple(faces: number, count = 1, modifier = 0): Promise<RollResult> {
  const expr = `${count}d${faces}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''}`;
  return rollExpression(expr);
}

// re-export para consumidores antigos
export { notationToDiceTypes };
