/**
 * Catálogo de Armas (livro p. 131-137).
 *
 * Princípios:
 *   - Estrutura puramente declarativa. Não há mutação aqui.
 *   - Toda mecânica (acerto/dano/crítico) lê deste catálogo no combatEngine.
 *   - Propriedades são tags. Algumas carregam payload (Pesada [X], Mortal d10,
 *     Modular Ct, Recarga [12], Arremessável [6/18]).
 */

export type DamageType = 'Ct' | 'Im' | 'Pf';
export type WeaponCategory = 'simples' | 'complexa';
export type WeaponRange = 'melee' | 'ranged' | 'thrown';
export type WeaponGroup =
  | 'Faca' | 'Bastão' | 'Espada' | 'Haste' | 'Machado' | 'Martelo'
  | 'Chicote' | 'Pugilato' | 'Arco' | 'Besta' | 'Tiro' | 'Dardo';

/** Propriedades genéricas (livro p. 134-135). */
export type WeaponPropertyKind =
  | 'ampla' | 'aparar' | 'apunhaladora' | 'arremessavel' | 'duas_maos'
  | 'dupla' | 'emperrar' | 'energica' | 'especial' | 'estendida' | 'fatal'
  | 'fineza' | 'leve' | 'marcial' | 'modular' | 'mortal' | 'oscilante'
  | 'pesada' | 'recarga' | 'versatil';

export type WeaponSpecialFeatureId = 'lanca-vetorial-rubra' | 'baculo-aetheris';

export interface WeaponProperty {
  kind: WeaponPropertyKind;
  /** Pesada [X] ⇒ value = X (Força mínima). Recarga [X] ⇒ value = X. */
  value?: number;
  /** Mortal d10 ⇒ die = 10. Fatal d12 ⇒ die = 12. */
  die?: number;
  /** Modular Ct/Im/Pf ⇒ damageType. */
  damageType?: DamageType;
  /** Arremessável [6/18] ⇒ rangeShort = 6, rangeLong = 18. */
  rangeShort?: number;
  rangeLong?: number;
}

export interface Weapon {
  /** Configuração OMNI preservada sobre o modelo do catálogo. */
  omniDamageFormula?: string;
  omniDamageType?: string;
  critMultiplier?: number;
  id: string;
  name: string;
  category: WeaponCategory;
  range: WeaponRange;
  group: WeaponGroup;

  /** Dano padrão. Para versátil, use damage1H + damage2H. */
  damage?: string;
  damage1H?: string;
  damage2H?: string;
  /** Tipo de dano "padrão" (modular adiciona alternativa via property). */
  damageType: DamageType | null; // null para Faixas/Manoplas/Soco Inglês/Rede
  /** Margem de crítico (rolagem ≥ critRange é crítico). 18, 19, 20. */
  critRange: number | null;

  properties: WeaponProperty[];
  /** Alcance corpo-a-corpo padrão = null (depende do tamanho). */
  rangeShort?: number;
  rangeLong?: number;

  spaces: number;
  /** Ausente quando o preço/custo de catálogo não foi definido. */
  cost?: number;

  /** Texto da propriedade especial (livro p. 136-137). */
  specialText?: string;
  /** Identificador estável de uma mecânica exclusiva executada pela ficha. */
  specialFeatureId?: WeaponSpecialFeatureId;
}

// ===== Helpers de construção (mais legíveis no dataset) ====================

const P = {
  ampla: (): WeaponProperty => ({ kind: 'ampla' }),
  aparar: (): WeaponProperty => ({ kind: 'aparar' }),
  apunhaladora: (): WeaponProperty => ({ kind: 'apunhaladora' }),
  arremessavel: (s: number, l: number): WeaponProperty =>
    ({ kind: 'arremessavel', rangeShort: s, rangeLong: l }),
  duasMaos: (): WeaponProperty => ({ kind: 'duas_maos' }),
  dupla: (): WeaponProperty => ({ kind: 'dupla' }),
  emperrar: (): WeaponProperty => ({ kind: 'emperrar' }),
  energica: (): WeaponProperty => ({ kind: 'energica' }),
  especial: (): WeaponProperty => ({ kind: 'especial' }),
  estendida: (): WeaponProperty => ({ kind: 'estendida' }),
  fatal: (die: number): WeaponProperty => ({ kind: 'fatal', die }),
  fineza: (): WeaponProperty => ({ kind: 'fineza' }),
  leve: (): WeaponProperty => ({ kind: 'leve' }),
  marcial: (): WeaponProperty => ({ kind: 'marcial' }),
  modular: (t: DamageType): WeaponProperty => ({ kind: 'modular', damageType: t }),
  mortal: (die: number): WeaponProperty => ({ kind: 'mortal', die }),
  oscilante: (): WeaponProperty => ({ kind: 'oscilante' }),
  pesada: (x: number): WeaponProperty => ({ kind: 'pesada', value: x }),
  recarga: (x: number): WeaponProperty => ({ kind: 'recarga', value: x }),
  versatil: (): WeaponProperty => ({ kind: 'versatil' }),
};

// ===== ARMAS SIMPLES =======================================================

export const SIMPLE_MELEE: Weapon[] = [
  { id: 'adaga', name: 'Adaga', category: 'simples', range: 'melee', group: 'Faca',
    damage: '1d6', damageType: 'Pf', critRange: 18, spaces: 1, cost: 1,
    properties: [P.apunhaladora(), P.arremessavel(6, 18), P.fineza(), P.leve(), P.marcial(), P.modular('Ct')] },
  { id: 'bastao', name: 'Bastão', category: 'simples', range: 'melee', group: 'Bastão',
    damage1H: '1d6', damage2H: '1d8', damageType: 'Im', critRange: 19, spaces: 2, cost: 1,
    properties: [P.ampla(), P.dupla(), P.marcial(), P.versatil()] },
  { id: 'clava', name: 'Clava', category: 'simples', range: 'melee', group: 'Bastão',
    damage1H: '1d8', damage2H: '1d10', damageType: 'Im', critRange: 20, spaces: 1, cost: 1,
    properties: [P.versatil()] },
  { id: 'espada-curta', name: 'Espada Curta', category: 'simples', range: 'melee', group: 'Espada',
    damage: '1d6', damageType: 'Ct', critRange: 19, spaces: 1, cost: 1,
    properties: [P.fineza(), P.leve(), P.marcial(), P.modular('Pf')] },
  { id: 'faixas', name: 'Faixas', category: 'simples', range: 'melee', group: 'Pugilato',
    damageType: null, critRange: null, spaces: 1, cost: 1,
    properties: [P.especial()],
    specialText: 'Faixas não são consideradas armas; ataques com elas são desarmados, usando o dano desarmado e habilidades correspondentes.' },
  { id: 'foice', name: 'Foice', category: 'simples', range: 'melee', group: 'Haste',
    damage: '1d6', damageType: 'Ct', critRange: 19, spaces: 1, cost: 1,
    properties: [P.fineza(), P.leve(), P.marcial()] },
  { id: 'lanca', name: 'Lança', category: 'simples', range: 'melee', group: 'Haste',
    damage1H: '1d6', damage2H: '1d8', damageType: 'Pf', critRange: 19, spaces: 1, cost: 1,
    properties: [P.arremessavel(6, 18), P.estendida(), P.versatil()] },
  { id: 'leque', name: 'Leque', category: 'simples', range: 'melee', group: 'Faca',
    damage: '1d6', damageType: 'Im', critRange: 18, spaces: 1, cost: 1,
    properties: [P.fineza(), P.energica(), P.leve(), P.especial()],
    specialText: 'Fechado: dano de impacto, grupo Bastão. Aberto: dano cortante, grupo Faca. Alternar é ação livre. +2 em Enganação para Fintar.' },
  { id: 'machado', name: 'Machado', category: 'simples', range: 'melee', group: 'Machado',
    damage1H: '1d8', damage2H: '1d10', damageType: 'Ct', critRange: 20, spaces: 1, cost: 1,
    properties: [P.versatil()] },
  { id: 'mangual', name: 'Mangual', category: 'simples', range: 'melee', group: 'Chicote',
    damage: '1d8', damageType: 'Im', critRange: 20, spaces: 1, cost: 1,
    properties: [P.ampla(), P.energica()] },
  { id: 'manoplas', name: 'Manoplas', category: 'simples', range: 'melee', group: 'Pugilato',
    damageType: null, critRange: null, spaces: 1, cost: 2,
    properties: [P.aparar(), P.duasMaos(), P.dupla(), P.especial(), P.pesada(16)],
    specialText: 'Usa dano desarmado. Permite carregar/agarrar mas não manejar outras armas. Dano desarmado +1 nível para cada 2 no Mod. FOR.' },
  { id: 'martelo', name: 'Martelo', category: 'simples', range: 'melee', group: 'Martelo',
    damage1H: '1d8', damage2H: '1d10', damageType: 'Im', critRange: 20, spaces: 1, cost: 1,
    properties: [P.versatil()] },
  { id: 'soco-ingles', name: 'Soco Inglês', category: 'simples', range: 'melee', group: 'Pugilato',
    damageType: null, critRange: null, spaces: 1, cost: 2,
    properties: [P.energica(), P.especial(), P.fineza(), P.marcial()],
    specialText: 'Usa dano desarmado. Aplica efeitos críticos do grupo Faca. CD de TR contra crítico +1 a cada 2 no Mod. FOR ou DES.' },
  { id: 'tridente', name: 'Tridente', category: 'simples', range: 'melee', group: 'Haste',
    damage1H: '1d6', damage2H: '1d8', damageType: 'Pf', critRange: 19, spaces: 1, cost: 1,
    properties: [P.arremessavel(6, 18), P.estendida(), P.versatil()] },
];

export const SIMPLE_RANGED: Weapon[] = [
  { id: 'arco-curto', name: 'Arco Curto', category: 'simples', range: 'ranged', group: 'Arco',
    damage: '1d6', damageType: 'Pf', critRange: 19, spaces: 2, cost: 1,
    rangeShort: 24, rangeLong: 48,
    properties: [P.duasMaos(), P.mortal(10)] },
  { id: 'besta-leve', name: 'Besta Leve', category: 'simples', range: 'ranged', group: 'Arco',
    damage: '1d8', damageType: 'Pf', critRange: 19, spaces: 1, cost: 1,
    rangeShort: 24, rangeLong: 48,
    properties: [P.mortal(10), P.leve(), P.recarga(1)] },
  { id: 'pistola', name: 'Pistola', category: 'simples', range: 'ranged', group: 'Tiro',
    damage: '1d10', damageType: 'Pf', critRange: 20, spaces: 1, cost: 2,
    rangeShort: 36, rangeLong: 72,
    properties: [P.emperrar(), P.leve(), P.recarga(12)] },
];

export const SIMPLE_THROWN: Weapon[] = [
  { id: 'azagaia', name: 'Azagaia', category: 'simples', range: 'thrown', group: 'Dardo',
    damage: '1d6', damageType: 'Pf', critRange: 20, spaces: 1, cost: 1,
    rangeShort: 12, rangeLong: 24,
    properties: [P.leve()] },
  { id: 'dardo', name: 'Dardo', category: 'simples', range: 'thrown', group: 'Dardo',
    damage: '1d4', damageType: 'Pf', critRange: 18, spaces: 1, cost: 1,
    rangeShort: 12, rangeLong: 24,
    properties: [P.leve(), P.especial()],
    specialText: 'Especialmente efetivo para venenos: enquanto coberto, CD do veneno +2 ao acertar.' },
  { id: 'faca-arremesso', name: 'Faca de Arremesso', category: 'simples', range: 'thrown', group: 'Faca',
    damage: '1d6', damageType: 'Pf', critRange: 20, spaces: 1, cost: 1,
    rangeShort: 12, rangeLong: 24,
    properties: [P.leve(), P.modular('Ct')] },
];

// ===== ARMAS COMPLEXAS =====================================================

export const COMPLEX_MELEE: Weapon[] = [
  { id: 'adagas-duplas', name: 'Adagas Duplas', category: 'complexa', range: 'melee', group: 'Faca',
    damage: '2d4', damageType: 'Pf', critRange: 18, spaces: 2, cost: 2,
    properties: [P.apunhaladora(), P.duasMaos(), P.fineza(), P.leve(), P.marcial(), P.modular('Ct'), P.especial()],
    specialText: 'Não pode ser desarmado. Conta como uma única arma de duas mãos.' },
  { id: 'adaga-aparar', name: 'Adaga de Aparar', category: 'complexa', range: 'melee', group: 'Faca',
    damage: '1d4', damageType: 'Pf', critRange: 18, spaces: 1, cost: 1,
    properties: [P.aparar(), P.apunhaladora(), P.fineza(), P.leve(), P.marcial(), P.modular('Ct')] },
  { id: 'alabarda', name: 'Alabarda', category: 'complexa', range: 'melee', group: 'Haste',
    damage: '1d10', damageType: 'Ct', critRange: 20, spaces: 2, cost: 2,
    properties: [P.duasMaos(), P.estendida(), P.modular('Pf'), P.pesada(14), P.especial()],
    specialText: '+2 em testes da manobra Derrubar.' },
  { id: 'chicote', name: 'Chicote', category: 'complexa', range: 'melee', group: 'Chicote',
    damage: '1d4', damageType: 'Ct', critRange: 19, spaces: 1, cost: 1,
    properties: [P.estendida(), P.fineza(), P.leve(), P.especial()],
    specialText: 'Pode usar Agarrar mesmo com a mão ocupada pelo chicote, se o alvo estiver no alcance. +2 em Agarrar com chicote.' },
  { id: 'chicote-corrente', name: 'Chicote de Corrente', category: 'complexa', range: 'melee', group: 'Chicote',
    damage1H: '1d6', damage2H: '1d8', damageType: 'Im', critRange: 19, spaces: 2, cost: 2,
    properties: [P.estendida(), P.pesada(14), P.versatil(), P.especial()],
    specialText: 'Tem o traço de chicote. Ação bônus: enrolar a corrente em arma corpo-a-corpo, herdando alcance e crítico do chicote (ocupa 2 mãos).' },
  { id: 'chicote-espinhento', name: 'Chicote Espinhento', category: 'complexa', range: 'melee', group: 'Chicote',
    damage: '1d6+1d6', damageType: 'Ct', critRange: 19, spaces: 1, cost: 3,
    properties: [P.estendida(), P.fineza(), P.leve(), P.especial()],
    specialText: 'Causa 1d6 cortante + 1d6 perfurante. Subir nível de dano sobe cada dado individualmente. Apenas o menor RD/Resistência conta.' },
  { id: 'clava-pesada', name: 'Clava Pesada', category: 'complexa', range: 'melee', group: 'Bastão',
    damage: '2d6', damageType: 'Im', critRange: 20, spaces: 2, cost: 2,
    properties: [P.duasMaos(), P.pesada(16), P.oscilante()] },
  { id: 'corrente-aco', name: 'Corrente de Aço', category: 'complexa', range: 'melee', group: 'Chicote',
    damage1H: '2d4', damage2H: '2d6', damageType: 'Im', critRange: 20, spaces: 2, cost: 1,
    properties: [P.estendida(), P.energica(), P.pesada(14), P.versatil()] },
  { id: 'espada-gancho', name: 'Espada de Gancho', category: 'complexa', range: 'melee', group: 'Espada',
    damage: '1d8', damageType: 'Ct', critRange: 20, spaces: 1, cost: 2,
    properties: [P.fineza(), P.leve(), P.marcial(), P.especial()],
    specialText: 'Ao acertar, puxa o alvo 1,5m em sua direção (sem entrar no quadrado). Empunhando duas, ambas ganham Estendida.' },
  { id: 'espada-longa', name: 'Espada Longa', category: 'complexa', range: 'melee', group: 'Espada',
    damage1H: '1d8', damage2H: '1d10', damageType: 'Ct', critRange: 20, spaces: 1, cost: 1,
    properties: [P.modular('Pf'), P.versatil()] },
  { id: 'katana', name: 'Katana', category: 'complexa', range: 'melee', group: 'Espada',
    damage1H: '1d6', damage2H: '1d8', damageType: 'Ct', critRange: 19, spaces: 1, cost: 1,
    properties: [P.versatil(), P.fatal(10), P.fineza()] },
  { id: 'espada-grande', name: 'Espada Grande', category: 'complexa', range: 'melee', group: 'Espada',
    damage: '1d12', damageType: 'Ct', critRange: 20, spaces: 2, cost: 2,
    properties: [P.ampla(), P.duasMaos(), P.modular('Pf'), P.pesada(14)] },
  { id: 'espada-colossal', name: 'Espada Colossal', category: 'complexa', range: 'melee', group: 'Espada',
    damage: '2d8', damageType: 'Ct', critRange: 20, spaces: 4, cost: 3,
    properties: [P.ampla(), P.duasMaos(), P.modular('Im'), P.pesada(20), P.especial()],
    specialText: 'Como Ampla, mas escolhe uma TERCEIRA criatura adjacente ao alvo do primeiro ataque para também sofrer os efeitos.' },
  { id: 'foice-grande', name: 'Foice Grande', category: 'complexa', range: 'melee', group: 'Haste',
    damage1H: '1d8', damage2H: '1d10', damageType: 'Ct', critRange: 20, spaces: 2, cost: 2,
    properties: [P.ampla(), P.versatil()] },
  { id: 'kusarigama', name: 'Kusarigama', category: 'complexa', range: 'melee', group: 'Haste',
    damage: '1d6+1d6', damageType: 'Ct', critRange: 19, spaces: 1, cost: 2,
    properties: [P.duasMaos(), P.dupla(), P.especial(), P.estendida(), P.energica()],
    specialText: 'Foice (Ct) + peso (Im). +2 em testes de manobra. Subir nível sobe cada dado individualmente.' },
  { id: 'lanca-grande', name: 'Lança Grande', category: 'complexa', range: 'melee', group: 'Haste',
    damage: '1d12', damageType: 'Pf', critRange: 20, spaces: 2, cost: 1,
    properties: [P.duasMaos(), P.energica(), P.estendida(), P.pesada(14)] },
  { id: 'machado-grande', name: 'Machado Grande', category: 'complexa', range: 'melee', group: 'Machado',
    damage: '1d10', damageType: 'Ct', critRange: 20, spaces: 2, cost: 1,
    properties: [P.ampla(), P.duasMaos(), P.pesada(16)] },
  { id: 'martelo-grande', name: 'Martelo Grande', category: 'complexa', range: 'melee', group: 'Martelo',
    damage: '1d12', damageType: 'Im', critRange: 20, spaces: 2, cost: 1,
    properties: [P.duasMaos(), P.pesada(16)] },
  { id: 'nunchaku', name: 'Nunchaku', category: 'complexa', range: 'melee', group: 'Bastão',
    damage: '1d8', damageType: 'Im', critRange: 19, spaces: 1, cost: 1,
    properties: [P.dupla(), P.energica(), P.fineza(), P.marcial()] },
  { id: 'nunchaku-pesado', name: 'Nunchaku Pesado', category: 'complexa', range: 'melee', group: 'Bastão',
    damage: '2d6', damageType: 'Im', critRange: 20, spaces: 2, cost: 2,
    properties: [P.duasMaos(), P.dupla(), P.estendida(), P.marcial(), P.pesada(14), P.energica()] },
  { id: 'rapieira', name: 'Rapieira', category: 'complexa', range: 'melee', group: 'Espada',
    damage: '1d8', damageType: 'Pf', critRange: 19, spaces: 1, cost: 1,
    properties: [P.fineza(), P.mortal(10)] },
];

export const COMPLEX_RANGED: Weapon[] = [
  { id: 'arco-longo', name: 'Arco Longo', category: 'complexa', range: 'ranged', group: 'Arco',
    damage: '1d10', damageType: 'Pf', critRange: 19, spaces: 2, cost: 1,
    rangeShort: 30, rangeLong: 60,
    properties: [P.duasMaos(), P.mortal(12)] },
  { id: 'bazuca', name: 'Bazuca', category: 'complexa', range: 'ranged', group: 'Tiro',
    damage: '3d12', damageType: 'Im', critRange: 19, spaces: 4, cost: 4,
    rangeShort: 9, rangeLong: 18,
    properties: [P.duasMaos(), P.emperrar(), P.recarga(1), P.especial(), P.pesada(16)],
    specialText: 'Compara o ataque contra Defesa de todos os alvos a 7,5m do alvo original. Recarga = ação completa. Munição custa 1 espaço/1 custo.' },
  { id: 'besta-pesada', name: 'Besta Pesada', category: 'complexa', range: 'ranged', group: 'Besta',
    damage: '1d12', damageType: 'Pf', critRange: 20, spaces: 2, cost: 1,
    rangeShort: 45, rangeLong: 90,
    properties: [P.pesada(14), P.recarga(1), P.mortal(12)] },
  { id: 'escopeta', name: 'Escopeta', category: 'complexa', range: 'ranged', group: 'Tiro',
    damage: '2d6', damageType: 'Pf', critRange: 20, spaces: 2, cost: 2,
    rangeShort: 9, rangeLong: 18,
    properties: [P.duasMaos(), P.emperrar(), P.especial(), P.recarga(2)],
    specialText: 'Cone 3m: compara ataque contra Defesa de cada criatura na área. Recarga = ação comum.' },
  { id: 'metralhadora', name: 'Metralhadora', category: 'complexa', range: 'ranged', group: 'Tiro',
    damage: '1d12', damageType: 'Pf', critRange: 19, spaces: 4, cost: 3,
    rangeShort: 30, rangeLong: 60,
    properties: [P.duasMaos(), P.emperrar(), P.especial(), P.recarga(30)],
    specialText: 'Pode usar ação bônus para ataque adicional consumindo +1 munição. Recarga = ação comum.' },
  { id: 'rifle', name: 'Rifle', category: 'complexa', range: 'ranged', group: 'Tiro',
    damage: '2d8', damageType: 'Pf', critRange: 20, spaces: 2, cost: 2,
    rangeShort: 60, rangeLong: 120,
    properties: [P.duasMaos(), P.emperrar(), P.recarga(20)] },
  { id: 'rifle-precisao', name: 'Rifle de Precisão', category: 'complexa', range: 'ranged', group: 'Tiro',
    damage: '2d10', damageType: 'Pf', critRange: 19, spaces: 4, cost: 3,
    rangeShort: 120, rangeLong: 240,
    properties: [P.duasMaos(), P.emperrar(), P.recarga(5)] },
];

export const COMPLEX_THROWN: Weapon[] = [
  { id: 'chakram', name: 'Chakram', category: 'complexa', range: 'thrown', group: 'Faca',
    damage: '2d4', damageType: 'Ct', critRange: 20, spaces: 1, cost: 1,
    rangeShort: 12, rangeLong: 24,
    properties: [P.especial(), P.leve()],
    specialText: 'Sempre retorna à mão após o ataque de arremesso.' },
  { id: 'kunai', name: 'Kunai', category: 'complexa', range: 'thrown', group: 'Dardo',
    damage: '1d6', damageType: 'Pf', critRange: 19, spaces: 1, cost: 1,
    rangeShort: 9, rangeLong: 18,
    properties: [P.apunhaladora(), P.fineza(), P.leve()] },
  { id: 'rede', name: 'Rede', category: 'complexa', range: 'thrown', group: 'Dardo',
    damageType: null, critRange: null, spaces: 1, cost: 2,
    rangeShort: 9, rangeLong: 27,
    properties: [P.especial()] },
  { id: 'shuriken', name: 'Shuriken', category: 'complexa', range: 'thrown', group: 'Dardo',
    damage: '1d4', damageType: 'Ct', critRange: 18, spaces: 1, cost: 1,
    rangeShort: 12, rangeLong: 24,
    properties: [P.mortal(8), P.leve()] },
];

// ===== Catálogos consolidados ==============================================

export const ALL_WEAPONS: Weapon[] = [
  ...SIMPLE_MELEE, ...SIMPLE_RANGED, ...SIMPLE_THROWN,
  ...COMPLEX_MELEE, ...COMPLEX_RANGED, ...COMPLEX_THROWN,
];

export const EXTERNAL_WEAPONS: Weapon[] = [
  {
    id: 'lanca-vetorial-rubra',
    name: 'Lança Vetorial Rubra',
    category: 'complexa',
    range: 'melee',
    group: 'Haste',
    damage: '1d10',
    damageType: 'Pf',
    critRange: 19,
    properties: [P.estendida(), P.duasMaos(), P.especial()],
    spaces: 3,
    specialFeatureId: 'lanca-vetorial-rubra',
    specialText: 'Ferramenta Amaldi\u00e7oada - Grau 1 - Raridade \u00c9pico. N\u00facleo Carmesim: cada acerto aplica 1 Marca Vetorial (m\u00e1ximo 3); acertos cr\u00edticos aplicam 2. Somente um inimigo pode estar marcado por vez. Com 1 marca, o portador recebe +2 nos ataques contra o alvo. Com 2, os ataques ignoram 3 pontos de Defesa e causam +2d8 de dano uma vez por rodada. Com 3, a margem de cr\u00edtico passa a 18\u201320 contra o alvo. Avan\u00e7o Escarlate (A\u00e7\u00e3o Comum, 4 PE): avance em linha reta at\u00e9 3 m e ataque; no acerto, causa o dano normal e aplica exatamente 2 marcas, inclusive em cr\u00edtico. Senten\u00e7a Rubra (A\u00e7\u00e3o Comum, 10 PE; exige 3 marcas): no acerto, causa o dano-base +10d8 Perfurante, impede Rea\u00e7\u00f5es do alvo at\u00e9 o in\u00edcio do pr\u00f3ximo turno do portador e consome as marcas. Em cr\u00edtico, dobra os dados-base e os 10d8, sem dobrar modificadores fixos. Senten\u00e7a Rubra n\u00e3o recebe o +2d8 de Fratura Energ\u00e9tica. As marcas desaparecem ao fim do combate.',
  },
  {
    id: 'baculo-aetheris',
    name: 'Báculo Aetheris',
    category: 'complexa',
    range: 'melee',
    group: 'Haste',
    damage: '2d8',
    damageType: 'Im',
    critRange: 19,
    properties: [P.duasMaos(), P.estendida(), P.especial()],
    spaces: 2,
    specialFeatureId: 'baculo-aetheris',
    specialText: 'Arma de duas mãos, ocupa 2 espaços, alcance corpo a corpo de 3 m. Ataque básico: 2d8 Impacto, crítico 19–20. Asas do Firmamento: +3 m de deslocamento, ignora terreno difícil natural e reduz dano de queda para a distância que exceder 18 m. Rajada Sônica: no primeiro acerto de cada rodada, +3d8 Sônico e empurrão de 3 m. Julgamento dos Ventos: em crítico, +5d8 Sônico e TR de Fortitude; falha suprime Reações até o início do próximo turno do portador. Ruptura do Firmamento: após um crítico, pode gastar 2 PE e uma Reação para causar +10d10 Sônico, empurrar 6 m e exigir TR de Fortitude para Caído. Plumas da Tempestade (Ação Comum, 8 PE): até 3 ataques de 6d8 Cortante, alcance 18 m, com até 4,5 m de movimento sem Ataques de Oportunidade após o disparo. Reversão dos Ventos (Reação, 7 PE): +5 Defesa para o portador ou aliado a até 9 m contra ataque à distância; se o bônus fizer o ataque errar, libera contra-ataque de 5d8 Sônico a até 18 m. Trono das Nuvens (Ação Comum, 9 PE): raio 3 m a até 18 m, 5d8 Impacto e suspensão a 4,5 m em falha no TR de Fortitude até o próximo turno do portador. Réquiem dos Céus (Ação Completa, 18 PE, 1× por cena): raio 9 m, 15d10 Sônico, empurrão de 6 m e Caído em falha no TR de Fortitude; até 3 aliados podem ser transportados em segurança até 9 m.',
  },
];

export function findWeaponModelById(id: string | null | undefined): Weapon | undefined {
  if (!id) return undefined;
  return ALL_WEAPONS.find((w) => w.id === id) ?? EXTERNAL_WEAPONS.find((w) => w.id === id);
}

export function getWeaponById(id: string): Weapon | undefined {
  return ALL_WEAPONS.find(w => w.id === id);
}

export function getWeaponsByGroup(group: WeaponGroup): Weapon[] {
  return ALL_WEAPONS.filter(w => w.group === group);
}

export function hasProperty(w: Weapon, kind: WeaponPropertyKind): boolean {
  return w.properties.some(p => p.kind === kind);
}

export function getProperty(w: Weapon, kind: WeaponPropertyKind): WeaponProperty | undefined {
  return w.properties.find(p => p.kind === kind);
}

/** Resolve dano da arma para a mão escolhida (versátil). */
export function resolveWeaponDamage(w: Weapon, twoHanded = false): string | null {
  if (w.omniDamageFormula) return w.omniDamageFormula;
  if (w.damage) return w.damage;
  if (twoHanded && w.damage2H) return w.damage2H;
  if (w.damage1H) return w.damage1H;
  if (w.damage2H) return w.damage2H;
  return null;
}

// ===== Ocupação de mãos =====================================================

/** True se a arma SEMPRE precisa das duas mãos (Duas-mãos pura, ou Pesada sem fineza). */
export function requiresTwoHands(w: Weapon): boolean {
  return hasProperty(w, 'duas_maos');
}

/** True se a arma é Leve (pode ser empunhada como secundária sem talento). */
export function isLight(w: Weapon): boolean {
  return hasProperty(w, 'leve');
}

/** True se a arma é Versátil (1 ou 2 mãos à escolha). */
export function isVersatile(w: Weapon): boolean {
  return hasProperty(w, 'versatil');
}

/** Procura uma arma do catálogo por nome (case-insensitive, trim). */
export function findWeaponByName(name: string): Weapon | undefined {
  const target = name.trim().toLowerCase();
  return ALL_WEAPONS.find(w => w.name.trim().toLowerCase() === target);
}
