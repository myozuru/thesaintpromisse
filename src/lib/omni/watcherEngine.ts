/**
 * 🔭 Watcher Engine — State Listener para gatilhos dinâmicos.
 *
 * Substitui o paradigma "evento nomeado" (`ao_morrer`, `ao_receber_dano`)
 * por um listener que observa **mudanças de estado** dos recursos do
 * personagem. Cada efeito com `watcher` declara um critério (recurso,
 * operador, threshold) e o motor dispara o efeito no instante exato em
 * que a condição passa de **falsa → verdadeira** (edge-trigger).
 *
 * Fluxo:
 *  1. `useCharacterStore.subscribe` notifica este módulo a cada mudança.
 *  2. Snapshot anterior dos recursos relevantes é comparado ao novo.
 *  3. Para cada item equipado com efeito vigiando aquele recurso:
 *     - calcula `era` (snapshot) e `eh` (estado atual);
 *     - se `condição(era)=false` e `condição(eh)=true` → dispara.
 *  4. Após disparar: aplica fórmula, consome 1 uso, mostra toast.
 *
 * O snapshot é mantido em memória (Map) por personagem+recurso. Recargas
 * "naturais" (ex.: descanso longo) que ultrapassem o threshold para cima
 * resetam o estado e permitem novo disparo na próxima queda.
 */
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useLogStore } from '@/stores/useLogStore';
import { toast } from 'sonner';
import type { Character } from '@/types';
import type { CombatEffect, EntidadeOmni } from './tipos';
import { normalizarCombatData } from './tipos';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { aplicarEfeitoNoPersonagem } from './aplicarEfeito';
import { executarCombatEffect } from './executarSubEfeito';

/** Mapa Recurso (camada Omni) → campo numérico no `Character`. */
const RECURSO_PARA_CAMPO: Record<string, keyof Character> = {
  vida_atual: 'hpCurrent',
  vida: 'hpCurrent',
  hp: 'hpCurrent',
  pv: 'hpCurrent',
  vida_max: 'hpMax',
  hp_max: 'hpMax',
  pv_max: 'hpMax',
  energia: 'peCurrent',
  energia_atual: 'peCurrent',
  pe: 'peCurrent',
  pe_atual: 'peCurrent',
  energia_max: 'peMax',
  pe_max: 'peMax',
  defesa: 'ca',
  esquiva: 'escCurrent',
};

const ALIASES_RECURSO_WATCHER: Record<string, string> = {
  hp: 'vida_atual',
  pv: 'vida_atual',
  energia_atual: 'energia',
  pe_atual: 'pe',
  hp_max: 'vida_max',
  pv_max: 'vida_max',
  pe_max: 'energia_max',
};

function normalizarRecursoWatcher(recurso: string): string {
  const raw = recurso.replace(/^@?(usuario|alvo|area)\./i, '').toLowerCase();
  return ALIASES_RECURSO_WATCHER[raw] ?? raw;
}

/** Lê o valor numérico atual de um recurso de um personagem. 0 se desconhecido. */
function lerRecurso(c: Character, recurso: string): number {
  const campo = RECURSO_PARA_CAMPO[normalizarRecursoWatcher(recurso)];
  if (!campo) return 0;
  const v = c[campo] as unknown;
  return typeof v === 'number' ? v : 0;
}

/** Resolve threshold final (literal ou %). */
function resolverThreshold(c: Character, w: NonNullable<CombatEffect['watcher']>): number {
  if (!w.percent) return w.threshold;
  const base = w.percentBase ?? `${normalizarRecursoWatcher(w.resource)}_max`;
  return lerRecurso(c, base) * w.threshold;
}

/** Avalia a comparação `valor OP threshold`. */
function bate(op: NonNullable<CombatEffect['watcher']>['op'], valor: number, threshold: number): boolean {
  switch (op) {
    case '<=': return valor <= threshold;
    case '<':  return valor <  threshold;
    case '>=': return valor >= threshold;
    case '>':  return valor >  threshold;
    case '==': return valor === threshold;
    case '!=': return valor !== threshold;
  }
}

/**
 * Snapshot anterior dos recursos por personagem.
 * Estrutura: charId → { recurso → último valor visto }.
 */
const snapshotsAnteriores = new Map<string, Map<string, number>>();

function processarTodosPersonagens() {
  for (const c of useCharacterStore.getState().characters) processarPersonagem(c);
}

/**
 * Para um personagem específico, varre todos os efeitos com `watcher` em
 * itens equipados e dispara aqueles que acabaram de virar true.
 */
function processarPersonagem(c: Character) {
  const inv = useInventoryStore.getState();
  const equipados = inv.listEquipped(c.id);
  if (equipados.length === 0) return;

  const omniMap = useOmniEntidadesStore.getState().entidades;
  const previous = snapshotsAnteriores.get(c.id) ?? new Map<string, number>();
  const proximoSnapshot = new Map<string, number>(previous);

  for (const inst of equipados) {
    const fresco: EntidadeOmni = omniMap?.[inst.entity.id] ?? inst.entity;
    const cd = normalizarCombatData(fresco.combatData);
    if (!cd) continue;

    const efeitos: CombatEffect[] = [
      ...(cd.effectsActive ?? []),
      ...(cd.effectsPassive ?? []),
    ].filter((e) => !!e.watcher);
    if (efeitos.length === 0) continue;

    // Pre-Hook nativo de usos: sem cargas → não dispara.
    const temUsos = typeof inst.usosRestantes === 'number' && typeof inst.usosTotais === 'number';
    if (temUsos && (inst.usosRestantes ?? 0) <= 0) continue;

    let consumiuUso = false;
    for (const eff of efeitos) {
      const w = eff.watcher!;
      const recursoObservado = normalizarRecursoWatcher(w.resource);
      const atual = lerRecurso(c, recursoObservado);
      const thr = resolverThreshold(c, w);
      const eraKey = `${inst.instanceId}::${eff.id}`;
      const era = previous.get(eraKey);
      proximoSnapshot.set(eraKey, atual);

      const condicaoAgora = bate(w.op, atual, thr);
      // Sem snapshot anterior (1ª passada): apenas grava, NÃO dispara.
      if (era === undefined) continue;
      const condicaoAntes = bate(w.op, era, thr);
      if (condicaoAntes || !condicaoAgora) continue; // Edge-trigger

      // Avaliar condição extra (`se …`) se houver.
      const variaveis = montarVariaveisDoPersonagem(c, 'USUARIO');
      if (eff.condition && eff.condition.trim()) {
        try {
          const r = avaliarFormula(eff.condition, variaveis, undefined);
          if (r.valor <= 0) continue;
        } catch {
          continue;
        }
      }

      // ─── 🎭 Keys especiais ─────────────────────────────────────
      if (eff.diceSwitch || eff.conditionApply || eff.buttonOnly) {
        const r = executarCombatEffect(eff, {
          usuarioId: c.id,
          alvoId: c.id, // watcher é sempre auto-aplicado
          usuarioVars: variaveis,
          alvoVars: variaveis,
          sourceName: fresco.nome,
        });
        consumiuUso = true;
        useLogStore.getState().addLog(
          'system',
          `🔭 ${fresco.nome} (watcher ${recursoObservado}${w.op}${w.threshold}${w.percent ? '%' : ''}): ` +
            (r.detalhe ?? 'efeito especial'),
        );
        continue;
      }
      let valor = 0;
      try {
        const r = avaliarFormula(eff.formula || '0', variaveis, undefined);
        valor = r.valor;
      } catch {
        continue;
      }
      const targetId = eff.target === 'ALVO' ? c.id : c.id; // watcher é sempre auto-aplicado
      const res = aplicarEfeitoNoPersonagem(targetId, eff.type, eff.resourcePath, valor, {
        peSpellReduction: eff.peSpellReduction,
        immunityGrant: eff.immunityGrant,
        sourceName: fresco.nome,
        damageType: eff.damageType,
      });
      consumiuUso = true;
      useLogStore.getState().addLog(
        'system',
        `🔭 ${fresco.nome} (watcher ${recursoObservado}${w.op}${w.threshold}${w.percent ? '%' : ''}): ` +
          `${eff.type} ${valor} em ${eff.resourcePath ?? 'vida_atual'}` +
          (res.absorvidoPorBloqueio ? ' (absorvido)' : ''),
      );
    }

    if (consumiuUso && temUsos) {
      inv.consumirUso(inst.instanceId, 1);
      const restantes = (inst.usosRestantes ?? 1) - 1;
      toast(`⚡ Gatilho Ativado: ${fresco.nome}`, {
        description: `1 uso consumido — restam ${restantes}/${inst.usosTotais}`,
      });
    } else if (consumiuUso) {
      toast(`⚡ Gatilho Ativado: ${fresco.nome}`, { description: 'Uso ilimitado' });
    }
  }

  snapshotsAnteriores.set(c.id, proximoSnapshot);
}

let inicializado = false;

/**
 * Inicia a escuta global. Idempotente — chamar várias vezes é seguro.
 * Deve ser chamado uma vez no bootstrap do app.
 */
export function iniciarWatcherEngine() {
  if (inicializado) return;
  inicializado = true;

  // Snapshot inicial para todos os personagens carregados.
  processarTodosPersonagens();

  // Listener global. Usa setTimeout para evitar reentrada (caso o
  // efeito disparado faça outro updateCharacter dentro do mesmo tick).
  let pendente = false;
  useCharacterStore.subscribe(() => {
    if (pendente) return;
    pendente = true;
    setTimeout(() => {
      pendente = false;
      try {
        for (const c of useCharacterStore.getState().characters) processarPersonagem(c);
      } catch (err) {
        console.warn('[watcherEngine] erro no loop:', err);
      }
    }, 0);
  });

  // Equipar/editar um item com watcher não altera o Character, então também
  // inicializamos snapshots quando o inventário ou o catálogo Omni mudam.
  // Sem isso, o primeiro dano após equipar era tratado como "1ª passada" e
  // apenas gravava o HP já zerado, perdendo o edge-trigger.
  const agendarSnapshot = () => {
    if (pendente) return;
    pendente = true;
    setTimeout(() => {
      pendente = false;
      try {
        processarTodosPersonagens();
      } catch (err) {
        console.warn('[watcherEngine] erro no snapshot:', err);
      }
    }, 0);
  };
  useInventoryStore.subscribe(agendarSnapshot);
  useOmniEntidadesStore.subscribe(agendarSnapshot);
}
