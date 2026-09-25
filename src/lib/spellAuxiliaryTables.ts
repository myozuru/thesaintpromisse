// ============================================================
// DICIONÁRIO DE TABELAS AUXILIARES — BUFFS / DEBUFFS
// Indexado por [Nível do Feitiço] x [Tipo de Duração]
// Tipos de duração: 'imediata' | 'duradoura' | 'sustentada'
// ------------------------------------------------------------
// Convenção: cada entrada é uma tupla (Imediata, Duradoura, Sustentada).
// Quando o valor é 0 ou '—', o efeito não está disponível
// para aquele Nível naquele Tipo de Duração.
// ============================================================

import type { SpellLevel } from '@/types';

export type DurationKind = 'imediata' | 'duradoura' | 'sustentada';

export const DURATION_KIND_LABELS: Record<DurationKind, string> = {
  imediata: 'Imediata',
  duradoura: 'Duradoura',
  sustentada: 'Sustentada',
};

export const DURATION_KIND_DESCRIPTIONS: Record<DurationKind, string> = {
  imediata: 'Dura 1 ataque ou 1 rodada. Permite valores superiores. Pode ser usada como Reação.',
  duradoura: 'Dura uma quantidade específica de rodadas. Trava: 1 + Nível do Feitiço.',
  sustentada: 'Dura a Cena inteira, mas consome PE a cada rodada. Apenas 1 sustentado ativo por vez.',
};

/** PE/rodada para feitiços Sustentados, indexado por nível. */
export function getSustainedPEPerRound(level: SpellLevel): number {
  const lv = parseSpellLevel(level);
  if (lv >= 3) return 2;
  return 1;
}

/** Trava de duração Duradoura (rodadas). */
export function getMaxDuradouraRounds(level: SpellLevel): number {
  return 1 + parseSpellLevel(level);
}

function parseSpellLevel(level: SpellLevel): number {
  if (level === 'Técnica Máxima') return 5;
  if (level === 'Técnica Reversa') return 0;
  const n = parseInt(level as string);
  return isNaN(n) ? 0 : n;
}

// ----------------------------------------------------------------
// Tipo genérico para uma linha de tabela: (imediata, duradoura, sustentada)
// Os campos podem ser número ou rótulo especial (string).
// ----------------------------------------------------------------
export type AuxRow = readonly [number | string, number | string, number | string];

export type AuxTable = Partial<Record<SpellLevel, AuxRow>>;

// Helper para acessar valor por kind
export function pickAux(row: AuxRow | undefined, kind: DurationKind): number | string {
  if (!row) return 0;
  return kind === 'imediata' ? row[0] : kind === 'duradoura' ? row[1] : row[2];
}

// ============================================================
// 1. PREJUÍZO EM ROLAGEM (Debuff)
// ============================================================
export const PREJUIZO_ROLAGEM: AuxTable = {
  '0': [-1, 0, 0],
  '1': [-2, -1, 0],
  '2': [-4, -2, -1],
  '3': [-6, -4, -2],
  '4': [-8, -6, -4],
  '5': [-12, -9, -7],
  'Técnica Máxima': ['Falha Garantida', -12, -10],
};

// ============================================================
// 2. DEFESA (Buff)
// Nota: Imediata usada como Reação aumenta o valor base em 1.5x
// ============================================================
export const DEFESA: AuxTable = {
  '0': [1, 0, 0],
  '1': [2, 1, 0],
  '2': [4, 2, 1],
  '3': [6, 4, 2],
  '4': [9, 6, 4],
  '5': ['Esquiva Garantida', 9, 7],
  'Técnica Máxima': ['2 Esquivas', 12, 10],
};

// ============================================================
// 3. REDUÇÃO DE DANO (RD) — Buff
// Nota: cada tipo de dano extra além do primário reduz a RD em 2
// ============================================================
export const REDUCAO_DANO: AuxTable = {
  '0': [3, 2, 2],
  '1': [5, 4, 4],
  '2': [10, 8, 7],
  '3': [14, 11, 10],
  '4': [18, 14, 12],
  '5': [25, 20, 18],
  'Técnica Máxima': [35, 27, 23],
};

// ============================================================
// 4. AUMENTO DE ATRIBUTO (Buff) — pontos a distribuir
// Nota: bônus em um único atributo não pode ser maior que o Nível
// ============================================================
export const AUMENTO_ATRIBUTO: AuxTable = {
  '2': [0, 6, 4],
  '3': [0, 8, 6],
  '4': [0, 10, 8],
  '5': [0, 14, 12],
  'Técnica Máxima': [0, 18, 16],
};

// ============================================================
// 5. TESTE DE RESISTÊNCIA (Bônus) — Buff
// ============================================================
export const TR_BONUS: AuxTable = {
  '0': [1, 0, 0],
  '1': [2, 1, 0],
  '2': [4, 2, 1],
  '3': [6, 4, 2],
  '4': [9, 6, 4],
  '5': [12, 9, 7],
  'Técnica Máxima': ['Sucesso Crítico', 12, 10],
};

// ============================================================
// 6. PERÍCIAS (Bônus) — Buff
// ============================================================
export const PERICIA_BONUS: AuxTable = {
  '0': [1, 0, 0],
  '1': [2, 1, 0],
  '2': [4, 2, 1],
  '3': [6, 4, 2],
  '4': [9, 6, 4],
  '5': [12, 9, 7],
  'Técnica Máxima': ['Garantido', 12, 10],
};

// ============================================================
// 7. MOVIMENTO (Buff = aumento; Debuff = redução proporcional)
// ============================================================
export const MOVIMENTO: AuxTable = {
  '0': [4.5, 3, 3],
  '1': [6, 4.5, 4.5],
  '2': [9, 7.5, 6],
  '3': [15, 13.5, 12],
  '4': [18, 16.5, 15],
  '5': [21, 19.5, 18],
  'Técnica Máxima': [27, 24, 21],
};

// ============================================================
// 8. DANO ADICIONAL (Durante Ataque) — Buff
// ============================================================
export const DANO_DURANTE: AuxTable = {
  '0': ['1d8', 0, '1d6'],
  '1': ['2d6', 0, '1d10'],
  '2': ['3d8', 0, '2d8'],
  '3': ['3d10', 0, '3d8'],
  '4': ['4d10', 0, '3d10'],
  '5': ['5d12', 0, '4d12'],
  'Técnica Máxima': ['6d12', 0, '5d12'],
};

// ============================================================
// 9. DANO ADICIONAL (Após Ataque) — Buff
// ============================================================
export const DANO_APOS: AuxTable = {
  '0': ['1d12', 0, '1d8'],
  '1': ['2d12', 0, '2d6'],
  '2': ['3d12', 0, '2d12'],
  '3': ['4d12', 0, '3d12'],
  '4': ['5d12', 0, '4d12'],
  '5': ['7d12', 0, '5d12'],
  'Técnica Máxima': ['9d12', 0, '6d12'],
};

// ============================================================
// 10. DANO ADICIONAL (Fixo) — Buff
// ============================================================
export const DANO_FIXO: AuxTable = {
  '0': [6, 0, 4],
  '1': [12, 0, 8],
  '2': [21, 0, 15],
  '3': [28, 0, 21],
  '4': [35, 0, 28],
  '5': [50, 0, 35],
  'Técnica Máxima': [62, 0, 42],
};

// ============================================================
// 11. NÍVEIS DE DANO ADICIONAIS — Buff
// ============================================================
export const NIVEIS_DANO_EXTRA: AuxTable = {
  '0': [1, 0, 0],
  '1': [2, 0, 1],
  '2': [4, 0, 2],
  '3': [6, 0, 3],
  '4': [8, 0, 4],
  '5': [12, 0, 6],
  'Técnica Máxima': [16, 0, 8],
};

// ============================================================
// 12. MARGEM DE CRÍTICO — Buff
// Nota: Nv 5 Imediata garante crítico. Máxima garante 3 críticos.
// ============================================================
export const MARGEM_CRITICO: AuxTable = {
  '2': [1, 0, 0],
  '3': [2, 0, 1],
  '4': [4, 0, 2],
  '5': ['Crítico Garantido', 0, 3],
  'Técnica Máxima': ['3 Críticos Garantidos', 0, 4],
};

// ============================================================
// 13. NEGAÇÃO DE RD — Debuff
// Nota: cada tipo de dano extra reduz a quebra de RD em 4
// ============================================================
export const NEGACAO_RD: AuxTable = {
  '0': [-3, -2, -2],
  '1': [-5, -4, -4],
  '2': [-10, -8, -7],
  '3': [-14, -11, -10],
  '4': [-18, -14, -12],
  '5': [-25, -20, -18],
  'Técnica Máxima': [-35, -27, -23],
};

// ============================================================
// 14. CD e TESTES DE ATAQUE — Buff
// Nota: Ataque Nv 5 Imediata = "Acerto Garantido"; Máxima = "2 Acertos Garantidos"
// ============================================================
export const CD_ATAQUE: AuxTable = {
  '0': [1, 0, 0],
  '1': [2, 1, 0],
  '2': [4, 2, 1],
  '3': [6, 4, 2],
  '4': [9, 6, 4],
  '5': ['Acerto Garantido', 9, 7],
  'Técnica Máxima': ['2 Acertos Garantidos', 12, 10],
};

// ============================================================
// 15. CURA ALVO ÚNICO — Feitiço
// ============================================================
export const HEAL_SINGLE: Record<string, string> = {
  '1': '3d6', '2': '6d6', '3': '7d8', '4': '10d10', '5': '16d10', 'Técnica Máxima': '24d10',
};

// ============================================================
// 16. CURA MÚLTIPLOS / ÁREA — Feitiço
// ============================================================
export const HEAL_AREA: Record<string, string> = {
  '1': '2d6', '2': '4d6', '3': '4d10', '4': '7d10', '5': '12d10', 'Técnica Máxima': '20d10',
};

// ============================================================
// 17. ALCANCE CORPO A CORPO — Buff (em metros)
// Nota: Golpeadores recebem metade. 'Global' atravessa obstáculos.
// ============================================================
export const ALCANCE_CAC: AuxTable = {
  '0': [3, 1.5, 0],
  '1': [6, 3, 1.5],
  '2': [9, 4.5, 3],
  '3': [12, 6, 4.5],
  '4': [18, 9, 7.5],
  '5': ['Cena', 15, 12],
  'Técnica Máxima': ['Global', 19.5, 15],
};

// ============================================================
// 16. ALCANCE A DISTÂNCIA — Buff
// ============================================================
export const ALCANCE_DIST: AuxTable = {
  '0': [6, 3, 1.5],
  '1': [9, 6, 3],
  '2': [12, 9, 6],
  '3': [15, 12, 9],
  '4': [21, 16.5, 12],
  '5': ['Cena', 21, 15],
  'Técnica Máxima': ['Global', 18, 18],
};

// ============================================================
// CATÁLOGO DE EFEITOS DISPONÍVEIS (para UI)
// ============================================================
export interface AuxEffect {
  key: string;
  label: string;
  table: AuxTable;
  /** Para Buff, Debuff, ou ambos. */
  side: 'buff' | 'debuff' | 'both';
  /** Sufixo de unidade (ex: "m", "d", "PE"). Vazio quando não aplicável. */
  unit?: string;
  /** Texto de nota auxiliar (regras especiais). */
  note?: string;
}

export const BUFF_EFFECTS: AuxEffect[] = [
  { key: 'defesa',         label: '🛡 Defesa (CA)',          table: DEFESA,            side: 'buff',  note: 'Imediata como Reação: valor × 1.5 (apenas para um golpe)' },
  { key: 'rd',             label: '🩸 Redução de Dano (RD)', table: REDUCAO_DANO,      side: 'buff',  note: 'Cada tipo de dano extra reduz RD recebida em 2' },
  { key: 'atributo',       label: '💪 Aumento de Atributo',  table: AUMENTO_ATRIBUTO,  side: 'buff',  unit: 'pts', note: 'Bônus em um único atributo ≤ Nível do Feitiço' },
  { key: 'tr',             label: '🎯 Teste de Resistência', table: TR_BONUS,          side: 'buff' },
  { key: 'pericia',        label: '🎓 Perícia',              table: PERICIA_BONUS,     side: 'buff' },
  { key: 'movimento_up',   label: '🏃 Aumento de Movimento', table: MOVIMENTO,         side: 'buff',  unit: 'm' },
  { key: 'dano_durante',   label: '⚔️ Dano Adicional (Durante Ataque)', table: DANO_DURANTE, side: 'buff' },
  { key: 'dano_apos',      label: '🔥 Dano Adicional (Após Ataque)',     table: DANO_APOS,    side: 'buff' },
  { key: 'dano_fixo',      label: '➕ Dano Adicional (Fixo)',  table: DANO_FIXO, side: 'buff' },
  { key: 'niveis_dano',    label: '📈 Níveis de Dano Extra', table: NIVEIS_DANO_EXTRA, side: 'buff' },
  { key: 'critico',        label: '💥 Margem de Crítico',    table: MARGEM_CRITICO,    side: 'buff' },
  { key: 'cd_ataque',      label: '🎯 CD / Bônus de Ataque', table: CD_ATAQUE,         side: 'buff' },
  { key: 'alcance_cac',    label: '🤜 Alcance Corpo a Corpo', table: ALCANCE_CAC,      side: 'buff', unit: 'm', note: 'Golpeadores recebem metade. Global atravessa obstáculos.' },
  { key: 'alcance_dist',   label: '🏹 Alcance a Distância',   table: ALCANCE_DIST,     side: 'buff', unit: 'm', note: 'Global atravessa obstáculos.' },
];

export const DEBUFF_EFFECTS: AuxEffect[] = [
  { key: 'prejuizo_rolagem', label: '🎲 Prejuízo em Rolagem', table: PREJUIZO_ROLAGEM, side: 'debuff' },
  { key: 'negacao_rd',       label: '🛡 Negação de RD',        table: NEGACAO_RD,       side: 'debuff', note: 'Cada tipo de dano extra reduz a quebra em 4' },
  { key: 'movimento_down',   label: '🐌 Redução de Movimento', table: MOVIMENTO,        side: 'debuff', unit: 'm' },
];

/** Atributos / Perícias / TRs disponíveis para o seletor "Atributo, Perícia ou TR". */
export const TR_TARGETS = [
  'Fortitude', 'Reflexos', 'Vontade',
] as const;

export const ATTR_TARGETS = [
  'FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR',
] as const;

export const SKILL_TARGETS = [
  'Acrobacia', 'Atletismo', 'Atuação', 'Concentração', 'Conhecimento',
  'Diplomacia', 'Enganação', 'Furtividade', 'Iniciativa', 'Intimidação',
  'Intuição', 'Investigação', 'Ladinagem', 'Luta', 'Medicina',
  'Misticismo', 'Percepção', 'Pontaria', 'Prestidigitação', 'Sobrevivência',
] as const;
