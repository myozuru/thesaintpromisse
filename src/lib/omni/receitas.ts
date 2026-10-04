/**
 * 🍰 Receitas de Bolo do Omni-Engine
 *
 * Cada receita é um conjunto pronto de efeitos que pode ser injetado
 * diretamente em `combatData.effects` da entidade que está sendo editada.
 * Servem como atalho didático para o Mestre — clicar em "Drenar Vida"
 * configura o gatilho pós-dano que concede a cura.
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
    descricao: 'Após causar dano, cura o portador em metade do dano final, arredondada para baixo. Ex.: dano bruto 10 reduzido a 6 cura 3 PV; não inicia outro ataque.',
    cor: 'misto',
    build: () => [
      eff({ formula: 'floor(@DANO.valor_final / 2)', trigger: 'aoCausarDano', type: 'ADICIONAR', target: 'USUARIO', damageType: 'Cura', resourcePath: 'vida_atual' }),
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
    descricao: 'Rola 3d10 explosivos e soma Força. Um d10 com 10 rola novamente e acrescenta o novo resultado. Isso não rola acerto nem torna o ataque crítico: configure teste Ataque na ação.',
    cor: 'dano',
    build: () => [
      eff({ formula: '3d10! + @USUARIO.forca', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Cortante', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'sacrificio',
    emoji: '💀',
    nome: 'Pacto de Sacrifício',
    descricao: 'Aplica dano Necrótico ao usuário igual a 10% dos PV e usa RESULTADO_1×3 no alvo, numa cadeia que forneça esse resultado. Ambos passam por mitigação; para custo sacrificial sem mitigação, configure custo_pv na ação ativa.',
    cor: 'misto',
    build: () => [
      eff({ formula: 'floor(@USUARIO.vida * 0.1)', type: 'SUBTRAIR', target: 'USUARIO', damageType: 'Necrótico', resourcePath: 'vida_atual' }),
      eff({ formula: '@RESULTADO_1 * 3', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Necrótico', resourcePath: 'vida_atual' }),
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
    nome: 'Proteção pela Força',
    descricao: 'Usa Força como escala para conceder PV temporários: Força 3 concede 11 (3×2 + 5). Não altera o atributo base.',
    cor: 'buff',
    build: () => [
      eff({ formula: '@USUARIO.for * 2 + 5', type: 'ADICIONAR', target: 'USUARIO', damageType: 'Buff', resourcePath: 'vida_temp' }),
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
    descricao: 'Duas descargas no mesmo alvo: segunda usa metade de RESULTADO_1 numa cadeia que forneça esse resultado. Cada descarga passa por mitigação. Para vários alvos, configure Área na ação ativa.',
    cor: 'dano',
    build: () => [
      eff({ formula: '2d6 + @USUARIO.inteligencia', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Elétrico', resourcePath: 'vida_atual' }),
      eff({ formula: 'floor(@RESULTADO_1 / 2)', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Elétrico', resourcePath: 'vida_atual' }),
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
    descricao: 'Cura 50% do dano final no evento ao causar dano. Com 9 efetivos, cura 4; com 0, não cura. Use como passiva do portador, sem duplicar o dano-base.',
    cor: 'misto',
    build: () => [
      eff({ formula: 'floor(@DANO.valor_final * 0.5)', trigger: 'aoCausarDano', type: 'ADICIONAR', target: 'USUARIO', damageType: 'Cura', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'escalonamento-percentual',
    emoji: '📈',
    nome: 'Escalonamento por % (15%)',
    descricao: 'Aplica dano Energético bruto de 15% da Vida Máxima. Máximo 100 gera 15 antes de mitigação; o motor continua respeitando RD, resistências e imunidades.',
    cor: 'dano',
    build: () => [
      eff({ formula: '@ALVO.vida_max * 0.15', type: 'SUBTRAIR', target: 'ALVO', damageType: 'Energético', resourcePath: 'vida_atual' }),
    ],
  },
  {
    id: 'vitalidade-mestre',
    emoji: '👑',
    nome: 'Vitalidade do Mestre',
    descricao: 'Ao executar, define Vida Máxima como máximo atual + Treino×2. Máximo 40 e Treino 3 passam a 46; repetir passa a 52. Para bônus fixo de equipamento, use bonusEquipado, evitando reaplicação.',
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