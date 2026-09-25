/**
 * 🍰 Receitas de Bolo do Omni-Engine
 *
 * Cada receita é um conjunto pronto de efeitos que pode ser injetado
 * diretamente em `combatData.effects` da entidade que está sendo editada.
 * Servem como atalho didático para o Mestre — clicar em "Drenar Vida"
 * preenche os 2 efeitos (dano + cura) automaticamente.
 */
import type { CombatEffect } from './tipos';

export interface ReceitaOmni {
  id: string;
  emoji: string;
  nome: string;
  descricao: string;
  /** Categoria visual: dano | cura | buff | misto */
  cor: 'dano' | 'cura' | 'buff' | 'misto';
  /** Fábrica para gerar IDs novos a cada inserção. */
  build: () => CombatEffect[];
}

const eff = (e: Omit<CombatEffect, 'id'>): CombatEffect => ({
  id: crypto.randomUUID(),
  ...e,
});

export const RECEITAS_OMNI: ReceitaOmni[] = [
  // ➜ Receita-teste pedida pelo Mestre. Aplica ADICIONAR em vida_max
  //   (não MODIFICADOR), de modo que cada uso some `treino × 2` à
  //   Vida Máxima do usuário.
  {
    id: 'vitalidade-dinamica',
    emoji: '💪',
    nome: 'Vitalidade Dinâmica',
    descricao: 'Aumenta a Vida Máxima do usuário em 2× o bônus de Treinamento (Adicionar em vida_max).',
    cor: 'cura',
    build: () => [
      eff({
        formula: '(@USUARIO.treino * 2)',
        type: 'ADICIONAR',
        target: 'USUARIO',
        damageType: 'Vida Máxima',
        resourcePath: 'vida_max',
      }),
    ],
  },
  {
    id: 'drenar-vida',
    emoji: '🩸',
    nome: 'Drenar Vida',
    descricao: 'Causa dano no alvo e cura o usuário em metade do dano.',
    cor: 'misto',
    build: () => [
      eff({ formula: '1d6 + @USUARIO.forca', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Necrótico', resourcePath: 'vida_atual' }),
      eff({ formula: '@RESULTADO_1 / 2', type: 'ADICIONAR', target: 'USUARIO', damageType: 'Cura', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'cura-por-nivel',
    emoji: '✚',
    nome: 'Cura por Nível',
    descricao: 'Restaura vida proporcional ao nível do usuário (1d8 + nível).',
    cor: 'cura',
    build: () => [
      eff({ formula: '1d8 + @USUARIO.nivel', type: 'ADICIONAR', target: 'ALVO', damageType: 'Cura', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'dano-critico-massivo',
    emoji: '💥',
    nome: 'Dano Crítico Massivo',
    descricao: 'Dano explosivo: 3d10 + Força com dados explosivos.',
    cor: 'dano',
    build: () => [
      eff({ formula: '3d10! + @USUARIO.forca', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Cortante', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'sacrificio',
    emoji: '💀',
    nome: 'Pacto de Sacrifício',
    descricao: 'Custa 10% da vida do usuário e causa esse mesmo valor x3 ao alvo.',
    cor: 'misto',
    build: () => [
      eff({ formula: 'floor(@USUARIO.vida * 0.1)', type: 'SUBTRAIR', target: 'USUARIO', damageType: 'Necrótico', resourcePath: 'vida_atual' }),
      eff({ formula: '@RESULTADO_1 * 3', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Sombrio', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'golpe-misericordia',
    emoji: '⚔',
    nome: 'Golpe de Misericórdia',
    descricao: 'Causa dano igual à metade da vida atual do alvo.',
    cor: 'dano',
    build: () => [
      eff({ formula: '@ALVO.vida / 2', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Cortante', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'buff-forca',
    emoji: '✦',
    nome: 'Buff de Força (+5)',
    descricao: 'Aplica modificador positivo de +5 na Força do usuário.',
    cor: 'buff',
    build: () => [
      eff({ formula: '@USUARIO.forca + 5', type: 'MODIFICADOR', target: 'USUARIO', damageType: 'Buff', resourcePath: 'forca' }),
    ],
  },
  {
    id: 'cura-percentual',
    emoji: '💚',
    nome: 'Cura 25% Vida Máx.',
    descricao: 'Restaura 25% da vida máxima do alvo.',
    cor: 'cura',
    build: () => [
      eff({ formula: '@ALVO.vida_max * 0.25', type: 'ADICIONAR', target: 'ALVO', damageType: 'Cura', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'maldicao-equilibrio',
    emoji: '⚖',
    nome: 'Maldição de Equilíbrio',
    descricao: 'Diferença absoluta entre a vida do usuário e do alvo.',
    cor: 'dano',
    build: () => [
      eff({ formula: 'abs(@USUARIO.vida - @ALVO.vida)', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Psíquico', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'choque-encadeado',
    emoji: '⚡',
    nome: 'Choque Encadeado',
    descricao: 'Dano em duas etapas: a segunda é metade da primeira.',
    cor: 'dano',
    build: () => [
      eff({ formula: '2d6 + @USUARIO.inteligencia', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Elétrico', resourcePath: 'vida_atual' }),
      eff({ formula: 'floor(@RESULTADO_1 / 2)', type: 'SUBTRAIR', target: 'AREA', damageType: 'Elétrico', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'vitalidade-treino',
    emoji: '❤',
    nome: 'Vitalidade por Treino',
    descricao: 'Aumenta a Vida Máxima do usuário em 2× o bônus de treinamento.',
    cor: 'buff',
    build: () => [
      eff({ formula: '@USUARIO.treino * 2', type: 'ADICIONAR', target: 'USUARIO', damageType: 'Buff', resourcePath: 'vida_max' }),
    ],
  },
  {
    id: 'drenagem-vampirica',
    emoji: '🧛',
    nome: 'Drenagem Vampírica (Lifesteal)',
    descricao: 'Causa dano e cura o usuário em metade do dano causado.',
    cor: 'misto',
    build: () => [
      eff({ formula: '1d8 + @USUARIO.forca', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Necrótico', resourcePath: 'vida_atual' }),
      eff({ formula: 'floor(@RESULTADO_1 * 0.5)', type: 'ADICIONAR', target: 'USUARIO', damageType: 'Cura', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'escalonamento-percentual',
    emoji: '📈',
    nome: 'Escalonamento por % (15%)',
    descricao: 'Causa dano igual a 15% da vida máxima do alvo (ignora resistências escalares).',
    cor: 'dano',
    build: () => [
      eff({ formula: '@ALVO.vida_max * 0.15', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Verdadeiro', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'vitalidade-mestre',
    emoji: '👑',
    nome: 'Vitalidade do Mestre',
    descricao: 'Fixa a Vida Máxima do usuário como (vida_max + treino × 2). Use em passivas/itens permanentes.',
    cor: 'buff',
    build: () => [
      eff({
        formula: '(@USUARIO.vida_max + (@USUARIO.treino * 2))',
        type: 'MODIFICADOR',
        target: 'USUARIO',
        damageType: 'Vida Máxima',
        resourcePath: 'vida_max',
      }),
    ],
  },
];