/**
 * 🪶 Passivas contínuas — selector derivado.
 *
 * Percorre `Character.omniAtivos` (categoria 'passiva' / 'talento' / 'aura'),
 * coleta os `effectsPassive` que NÃO têm `trigger` (ou seja, não dependem
 * de evento), avalia `condition` no estado atual do personagem e devolve
 * os bônus que devem ser aplicados em tempo real:
 *
 *   - `skillBonuses[<skill>]` → soma a rolagens de perícia (pericia_<x>)
 *   - `peReductions[]`        → entradas extra para `getSpellCostReduction`
 *   - `immunities[]`          → escopos extra para `temImunidade`
 *
 * Diferente de `aplicarEfeitoNoPersonagem`, este selector NÃO persiste nada
 * no estado — é recalculado a cada consulta. Por isso o efeito acompanha
 * automaticamente as flags `descoberto`/`vendado`/etc.
 */

import type { Character } from '@/types';
import type { CombatEffect } from './tipos';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { canonicalizarChave } from './keyAliases';
import { SISTEMA_PERICIAS } from './constantesDoSistema';
import { resolverAcumuloOmni } from './omniBridge';
import type { OmniModifierContribution } from './omniBridge';

export interface PassivaDerivada {
  skillBonuses: Record<string, number>;
  peReductions: Array<{ id: string; filtro: string; reduce: number; min: number; origem: string }>;
  immunities: string[];
}

const VAZIO: PassivaDerivada = { skillBonuses: {}, peReductions: [], immunities: [] };
const PERICIAS_VALIDAS = new Set(
  Object.values(SISTEMA_PERICIAS).map((caminho) =>
    caminho.replace(/^pericias\./, '').toLowerCase(),
  ),
);

export function derivarPassivasContinuas(c: Character | null | undefined): PassivaDerivada {
  if (!c?.omniAtivos?.length) return VAZIO;

  const omniMap = useOmniEntidadesStore.getState().entidades;
  const out: PassivaDerivada = {
    skillBonuses: {},
    peReductions: [],
    immunities: [],
  };
  const bonusPericiaPorFonte: Record<string, OmniModifierContribution[]> = {};

  // Bag de variáveis com flags como `descoberto`, `vendado`, atributos, etc.
  let variaveis: Record<string, number> | null = null;
  const getVars = () => {
    if (!variaveis) variaveis = montarVariaveisDoPersonagem(c, 'USUARIO');
    return variaveis;
  };

  for (const vinc of c.omniAtivos) {
    const ent = omniMap?.[vinc.entidadeId];
    const cd = ent?.combatData;
    if (!cd) continue;
    const passivos: CombatEffect[] = cd.effectsPassive ?? [];
    if (passivos.length === 0) continue;

    for (const eff of passivos) {
      // Só interessa efeito SEM trigger — efeitos com trigger são tratados
      // pelo eventBus quando o evento dispara.
      if (eff.trigger) continue;
      // Keys especiais (diceSwitch/conditionApply/buttonOnly) só fazem
      // sentido em scripts ATIVOS — passivas continuas as ignoram.
      if (eff.diceSwitch || eff.conditionApply || eff.buttonOnly) continue;

      // Avalia condição (se houver). Falha ⇒ pula silenciosamente.
      if (eff.condition && eff.condition.trim()) {
        try {
          const r = avaliarFormula(eff.condition, getVars());
          if (r.diagnosticos.length || !Number.isFinite(r.valor) || r.valor <= 0) continue;
        } catch {
          continue;
        }
      }

      const sourceName = ent?.nome ?? 'Passiva';

      // Caminhos especiais (peSpellReduction, immunityGrant) não consomem
      // resourcePath numérico — vão direto pras listas derivadas.
      if (eff.peSpellReduction) {
        let valor = 0;
        try {
          const r = avaliarFormula(eff.formula || '0', getVars());
          if (r.diagnosticos.length || !Number.isFinite(r.valor)) continue;
          valor = r.valor;
        } catch { continue; }
        const reduce = Math.max(0, Math.round(valor));
        if (reduce <= 0) continue;
        out.peReductions.push({
          id: `${sourceName}__pe__${eff.peSpellReduction.filtro}`,
          filtro: eff.peSpellReduction.filtro,
          reduce,
          min: Math.max(0, eff.peSpellReduction.min),
          origem: sourceName,
        });
        continue;
      }

      if (eff.immunityGrant) {
        if (eff.immunityGrant.mode === 'grant') {
          out.immunities.push(eff.immunityGrant.escopo);
        }
        continue;
      }

      // Perícias — pericia_<sub>
      const path = canonicalizarChave(eff.resourcePath ?? '');
      if (path.startsWith('pericia_')) {
        const sub = path.slice('pericia_'.length);
        if (!PERICIAS_VALIDAS.has(sub)) continue;
        let valor = 0;
        try {
          const r = avaliarFormula(eff.formula || '0', getVars());
          if (r.diagnosticos.length || !Number.isFinite(r.valor)) continue;
          valor = r.valor;
        } catch { continue; }
        const delta =
          eff.type === 'SUBTRAIR' ? -Math.round(valor) :
          eff.type === 'ADICIONAR' ? Math.round(valor) :
          Math.round(valor); // DEFINIR: trata como bônus absoluto
        (bonusPericiaPorFonte[sub] ??= []).push({ source: `✦ ${sourceName}`, delta });
        continue;
      }

      // Outros caminhos (hp/pe/ca/fadiga/exaustão/etc.) NÃO viram passiva
      // contínua — recursos persistentes só mudam via gatilho ou ação.
    }
  }

  // A condição de cada passiva foi reavaliada acima em toda consulta. Entre
  // as fontes ainda ativas, bônus da mesma perícia usam o maior e penalidades
  // continuam cumulativas.
  for (const [pericia, contribuicoes] of Object.entries(bonusPericiaPorFonte)) {
    out.skillBonuses[pericia] = resolverAcumuloOmni(contribuicoes);
  }

  return out;
}
