/**
 * Auditoria dos grupos listados em GRUPOS_NOVOS: garante que suas keys
 * estáticas estão presentes no contexto e não usam fallback silencioso,
 * além de verificar presença
 * na bag de variáveis produzida por `montarVariaveisDoPersonagem` (para
 * escopos USUARIO/ALVO) ou avaliáveis sem erro pelo parser (escopo NENHUM).
 *
 * Predicates dinâmicos (ids contendo "<…>") são ignorados por serem
 * templates expandidos em tempo de execução.
 */
import { describe, it, expect } from 'vitest';
import { DICIONARIO_CHAVES_OMNI } from '@/lib/omni/constantesDoSistema';
import { avaliarFormula, resolverChavePtBr } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useCombatStore } from '@/stores/useCombatStore';
import type { Character } from '@/types';

// Character "rico" o bastante para acionar a maioria das ramificações.
const hero: Character = {
  id: 'hero-audit',
  name: 'Hero',
  level: 5,
  trainingBonus: 3,
  hpCurrent: 30, hpMax: 40, escCurrent: 2, escMax: 5,
  peCurrent: 8, peMax: 12, tempPE: 1,
  ca: 14, movement: 9,
  category: 'PLAYER',
  attributes: [
    { name: 'forca', value: 3 }, { name: 'destreza', value: 2 },
    { name: 'constituicao', value: 2 }, { name: 'inteligencia', value: 1 },
    { name: 'sabedoria', value: 1 }, { name: 'presenca', value: 0 },
  ],
  skills: [], savingThrows: [],
  omniFlags: { foco: 1 },
  omniCounters: { fadiga: 0 },
  luckCurrent: 2, luckMax: 3,
  hitDiceCurrent: 3, hitDiceMax: 5,
  exhaustionLevel: 0, hunger: 0,
  empolgacaoLevel: 1,
  sizeCategory: 'Médio',
  chosenTalents: [], chosenAuraAptitudes: [], chosenSpecAbilities: [],
  spells: [],
} as unknown as Character;

// Garante que useCombatStore tem estado mínimo para acionar PR-9.
useCombatStore.setState({
  inCombat: false, round: 1, currentTurnIndex: 0,
  initiativeOrder: [], movementUsedByChar: {},
  turnTimerEnabled: false, turnDurationSec: 60,
  turnRemainingAtStart: 60, turnStartedAt: 0, turnPaused: false,
} as never);

const bagUsuario = montarVariaveisDoPersonagem(hero, 'USUARIO');
const bags = { USUARIO: bagUsuario, ALVO: montarVariaveisDoPersonagem(hero, 'ALVO') };

interface Falha { grupo: string; id: string; escopo: string; motivo: string; }
const falhas: Falha[] = [];

// Apenas grupos introduzidos pelos PRs 1–9 (novas keys).
const GRUPOS_NOVOS = new Set<string>([
  '🩺 Pools',
  '👁️ Visão & Iluminação',
  '⚡ AdO & Reações',
  '🗺️ Mapa & Distância',
  '🩹 Recursos Detalhados',
  '🗡️ Empunhadura',
  '🪪 Identidade',
  '🤕 Condições (ativas)',
  '🌀 Concentração & Sustentados',
  '💰 Economia',
  '🕰️ Tempo & Calendário',
  '🎒 Inventário',
  '🎯 Cena Tática',
  '🩹 Cura & Recursos Avançados',
  '⚔️ Combate Avançado (PR-7)',
  '🔮 Magia & Técnicas',
  '🎬 Meta & Narrativa',
]);

for (const cat of DICIONARIO_CHAVES_OMNI.filter(c => GRUPOS_NOVOS.has(c.grupo))) {
  for (const item of cat.itens) {
    if (item.id.includes('<')) continue; // template dinâmico
    const keyUpper = resolverChavePtBr(item.id);

    for (const escopo of cat.escopos) {
      if (escopo === 'NENHUM') {
        const r = avaliarFormula(`@${item.id}`, bagUsuario);
        if (r.diagnosticos.length > 0) {
          falhas.push({ grupo: cat.grupo, id: item.id, escopo, motivo: r.diagnosticos.map(d => d.mensagem).join('; ') });
        }
        // Não exigimos presença na bag pessoal (são externos).
        continue;
      }

      // Cada escopo é verificado contra sua própria bag e contra o parser.
      const bag = bags[escopo];
      const presente = `${escopo}_${keyUpper}` in bag;
      if (!presente) {
        falhas.push({ grupo: cat.grupo, id: item.id, escopo, motivo: 'chave ausente na bag' });
      }
      const r = avaliarFormula(`@${escopo}.${item.id}`, bag);
      if (r.diagnosticos.length > 0) {
        falhas.push({ grupo: cat.grupo, id: item.id, escopo, motivo: r.diagnosticos.map(d => d.mensagem).join('; ') });
      }
    }
  }
}

describe('Auditoria Global — keys estáticas dos grupos auditados', () => {
  it('toda key estática dos grupos auditados tem implementação correspondente', () => {
    if (falhas.length > 0) {
      // Mostra agrupado por grupo para facilitar correção.
      const byGroup = falhas.reduce<Record<string, Falha[]>>((acc, f) => {
        (acc[f.grupo] ??= []).push(f);
        return acc;
      }, {});
      const relatorio = Object.entries(byGroup)
        .map(([g, fs]) => `\n  [${g}] (${fs.length}):\n    - ` + fs.map(f => `${f.id} (${f.escopo}) — ${f.motivo}`).join('\n    - '))
        .join('');
      throw new Error(`${falhas.length} chave(s) não automatizada(s):${relatorio}`);
    }
    expect(falhas).toHaveLength(0);
  });

  it('parser avalia as chaves estáticas dos grupos auditados sem fallback silencioso', () => {
    const naoFinitas: string[] = [];
    for (const cat of DICIONARIO_CHAVES_OMNI.filter(c => GRUPOS_NOVOS.has(c.grupo))) {
      for (const item of cat.itens) {
        if (item.id.includes('<')) continue;
        const escopo = cat.escopos[0];
        const expr = escopo === 'NENHUM'
          ? `@${item.id.toUpperCase()}`
          : `@${escopo}.${item.id}`;
        const r = avaliarFormula(expr, escopo === 'NENHUM' ? bagUsuario : bags[escopo]);
        if (!Number.isFinite(r.valor) || r.diagnosticos.length > 0) naoFinitas.push(`${cat.grupo}::${item.id}`);
      }
    }
    expect(naoFinitas).toEqual([]);
  });
});
