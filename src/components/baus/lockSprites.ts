/**
 * Registry dos spritesheets de cadeados (Pixel Art Padlock Pack).
 * Cada folha tem N frames horizontais: frame 0 = fechado, último frame = aberto.
 */
export interface LockSpriteMeta {
  id: string;
  label: string;
  sheet: string;
  frameW: number;
  frameH: number;
  frames: number;
}

const make = (id: string, label: string, frameW: number, frameH: number, frames: number): LockSpriteMeta => ({
  id, label,
  sheet: `/assets/locks/${id}.png`,
  frameW, frameH, frames,
});

export const LOCK_SPRITES: LockSpriteMeta[] = [
  make('sturdy-padlock-gold',   'Robusto · Ouro',    20, 30, 17),
  make('sturdy-padlock-grey',   'Robusto · Prata',   20, 30, 17),
  make('sturdy-padlock-bronze', 'Robusto · Bronze',  20, 30, 17),
  make('round-padlock-gold',    'Redondo · Ouro',    20, 36, 17),
  make('round-padlock-grey',    'Redondo · Prata',   20, 36, 17),
  make('round-padlock-bronze',  'Redondo · Bronze',  20, 36, 17),
  make('hefty-padlock-gold',    'Pesado · Ouro',     24, 33, 18),
  make('hefty-padlock-grey',    'Pesado · Prata',    24, 33, 18),
  make('hefty-padlock-bronze',  'Pesado · Bronze',   24, 33, 18),
  make('old-padlock-gold',      'Velho · Ouro',      24, 32, 17),
  make('old-padlock-grey',      'Velho · Prata',     24, 32, 17),
  make('old-padlock-bronze',    'Velho · Bronze',    24, 32, 17),
];

export const LOCK_SPRITE_MAP: Record<string, LockSpriteMeta> =
  Object.fromEntries(LOCK_SPRITES.map((s) => [s.id, s]));

export const DEFAULT_LOCK_SPRITE = 'sturdy-padlock-gold';

export interface KeySpriteMeta {
  id: string;
  label: string;
  src: string;
}

const k = (id: string, label: string): KeySpriteMeta => ({
  id, label, src: `/assets/keys/${id}.png`,
});

export const KEY_SPRITES: KeySpriteMeta[] = [
  k('key-1-gold', 'Chave 1 · Ouro'),
  k('key-1-silver', 'Chave 1 · Prata'),
  k('key-1-rust', 'Chave 1 · Enferrujada'),
  k('key-2-gold', 'Chave 2 · Ouro'),
  k('key-2-silver', 'Chave 2 · Prata'),
  k('key-2-rust', 'Chave 2 · Enferrujada'),
  k('key-3-gold', 'Chave 3 · Ouro'),
  k('key-3-silver', 'Chave 3 · Prata'),
  k('key-3-rust', 'Chave 3 · Enferrujada'),
  k('key-4-gold', 'Chave 4 · Ouro'),
  k('key-4-silver', 'Chave 4 · Prata'),
  k('key-4-rust', 'Chave 4 · Enferrujada'),
  k('key-5-gold', 'Chave 5 · Ouro'),
  k('key-5-silver', 'Chave 5 · Prata'),
  k('key-5-rust', 'Chave 5 · Enferrujada'),
  k('key-6-gold', 'Chave 6 · Ouro'),
  k('key-6-silver', 'Chave 6 · Prata'),
  k('key-6-rust', 'Chave 6 · Enferrujada'),
  k('key-7-gold', 'Chave 7 · Ouro'),
  k('key-7-silvergold', 'Chave 7 · Prata+Ouro'),
  k('key-8-gold', 'Chave 8 · Ouro'),
  k('key-8-silvergold', 'Chave 8 · Prata+Ouro'),
];

export const KEY_SPRITE_MAP: Record<string, KeySpriteMeta> =
  Object.fromEntries(KEY_SPRITES.map((s) => [s.id, s]));

export const DEFAULT_KEY_SPRITE = 'key-1-gold';
