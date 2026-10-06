import { estadoRemotoEmAplicacao } from './estadoRemoto';
import { coletarFontesGatilho } from './fontesGatilho';
import { capturarCadeiaOmni, executarNaCadeiaOmni, reservarPassoOmni } from './cadeiaEventos';
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

/** Recurso desconhecido nunca é interpretado como zero para disparar um watcher. */
function lerRecurso(c: Character, recurso: string): number {
  const campo = RECURSO_PARA_CAMPO[normalizarRecursoWatcher(recurso)];
  if (campo) { const v = c[campo]; return typeof v === 'number' && Number.isFinite(v) ? v : NaN; }
  const r = avaliarFormula(recurso, montarVariaveisDoPersonagem(c));
  return r.diagnosticos.length || !Number.isFinite(r.valor) ? NaN : r.valor;
}

/** Percentuais usam o máximo do pool, não uma chave inventada *_atual_max. */
function resolverThreshold(c: Character, w: NonNullable<CombatEffect['watcher']>): number {
  if (!w.percent) return w.threshold;
  const campo = RECURSO_PARA_CAMPO[normalizarRecursoWatcher(w.resource)];
  const base = w.percentBase ?? (campo === 'hpCurrent' ? 'vida_max' : campo === 'peCurrent' ? 'pe_max' : `${normalizarRecursoWatcher(w.resource)} maximo`);
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

function processarTodosPersonagens(apenasSnapshot = false) {
  for (const c of useCharacterStore.getState().characters) processarPersonagem(c, apenasSnapshot);
}

/**
 * Para um personagem específico, varre todos os efeitos com `watcher` em
 * itens equipados e dispara aqueles que acabaram de virar true.
 */
function processarPersonagem(c: Character, apenasSnapshot = false) {
  if (apenasSnapshot) return processarPersonagemNaCadeia(c, true);
  const cadeia = reservarPassoOmni();
  if (cadeia) executarNaCadeiaOmni(cadeia, () => processarPersonagemNaCadeia(c, false));
}

function processarPersonagemNaCadeia(c: Character, apenasSnapshot: boolean) {
  const baseExecucao = useCharacterStore.getState().characters.find(x => x.id === c.id);
  if (!baseExecucao) { snapshotsAnteriores.delete(c.id); return; }
  const inv = useInventoryStore.getState();
  const fontes = coletarFontesGatilho(baseExecucao);
  const equipados = [...fontes.equipados, ...fontes.vinculados];
  if (equipados.length === 0) { snapshotsAnteriores.delete(c.id); return; }

  const omniMap = useOmniEntidadesStore.getState().entidades;
  const previous = snapshotsAnteriores.get(c.id) ?? new Map<string, number>();
  const proximoSnapshot = new Map<string, number>();

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
      const eraKey = `${inst.instanceId}::${eff.id}::${JSON.stringify(eff)}`;
      if (!Number.isFinite(atual) || !Number.isFinite(thr)) continue;
      const era = previous.get(eraKey);
      proximoSnapshot.set(eraKey, atual);
      if (apenasSnapshot) continue;

      const condicaoAgora = bate(w.op, atual, thr);
      // Sem snapshot anterior (1ª passada): apenas grava, NÃO dispara.
      if (era === undefined) continue;
      const condicaoAntes = bate(w.op, era, thr);
      if (condicaoAntes || !condicaoAgora) continue; // Edge-trigger

      // Avaliar condição extra (`se …`) se houver.
      const vivo = useCharacterStore.getState().characters.find(x => x.id === c.id) ?? c;
      // A condição usa o estado da travessia; efeitos anteriores deste
      // processamento continuam visíveis nos campos que acabaram de mudar.
      const mudancas = Object.fromEntries(Object.entries(vivo).filter(([key, value]) => value !== baseExecucao[key as keyof Character]));
      const atualChar = { ...c, ...mudancas } as Character;
      const variaveis = { ...montarVariaveisDoPersonagem(atualChar, 'USUARIO'), ...montarVariaveisDoPersonagem(atualChar, 'ALVO') };
      const itemBag = { usos_restantes: inst.usosRestantes ?? 0, usos_totais: inst.usosTotais ?? 0 };
      if (eff.condition && eff.condition.trim()) {
        try {
          const r = avaliarFormula(eff.condition, variaveis, undefined, { item: itemBag });
          if (r.diagnosticos.length || !Number.isFinite(r.valor) || r.valor <= 0) continue;
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
          itemVars: itemBag,
          sourceName: fresco.nome,
          sourceEntityId: fresco.id,
          sourceInstanceId: inst.instanceId,
        });
        if (r.invalido) continue;
        consumiuUso = true;
        useLogStore.getState().addLog(
          'system',
          `🔭 ${fresco.nome} (watcher ${recursoObservado}${w.op}${w.threshold}${w.percent ? '%' : ''}): ` +
            (r.detalhe ?? 'efeito especial'),
        );
        continue;
      }
      let valor = 0;
      let teto: number | undefined;
      let limiteFonte: number | undefined;
      try {
        const r = avaliarFormula(eff.formula || '0', variaveis, undefined, { item: itemBag });
        if (r.diagnosticos.length || !Number.isFinite(r.valor)) {
          useLogStore.getState().addLog('system', `⛔ ${fresco.nome}: fórmula do observador inválida.`);
          continue;
        }
        const limite = eff.counterCap ? avaliarFormula(eff.counterCap, variaveis, undefined, { item: itemBag }) : undefined;
        if (limite?.diagnosticos.length || (limite && !Number.isFinite(limite.valor))) continue;
        const limiteFonteAvaliado = eff.counterSourceLimit ? avaliarFormula(eff.counterSourceLimit, variaveis, undefined, { item: itemBag }) : undefined;
        if (limiteFonteAvaliado?.diagnosticos.length || (limiteFonteAvaliado && !Number.isFinite(limiteFonteAvaliado.valor))) continue;
        teto = limite?.valor;
        limiteFonte = limiteFonteAvaliado?.valor;
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
        attackerId: c.id,
        contador: { teto, porFonte: eff.counterPerSource, fonteId: c.id, limiteFonte, periodoFonte: eff.counterSourcePeriod },
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

  // Guarda cada mudança: duas travessias no mesmo tick não podem ser
  // perdidas por um debounce que só lê o último HP. Efeitos continuam fora
  // do set() original para evitar reentrada síncrona.
  const fila: { personagens: Character[]; apenasSnapshot: boolean; cadeia: ReturnType<typeof capturarCadeiaOmni> }[] = [];
  let pendente = false;
  useCharacterStore.subscribe((state) => {
    fila.push({ personagens: state.characters, apenasSnapshot: estadoRemotoEmAplicacao(), cadeia: capturarCadeiaOmni() });
    if (pendente) return;
    pendente = true;
    setTimeout(() => {
      pendente = false;
      const lote = fila.splice(0);
      for (const snapshot of lote) {
        try {
          const processar = () => {
            for (const c of snapshot.personagens) processarPersonagem(c, snapshot.apenasSnapshot);
          };
          if (snapshot.cadeia) executarNaCadeiaOmni(snapshot.cadeia, processar);
          else processar();
        } catch (err) { console.warn('[watcherEngine] erro no loop:', err); }
      }
    }, 0);
  });

  // Inicializa novos efeitos imediatamente ao equipar: o primeiro dano
  // pode ocorrer no mesmo tick. Não dispara efeitos durante configuração.
  const inicializarNovos = () => processarTodosPersonagens(true);
  useInventoryStore.subscribe(inicializarNovos);
  useOmniEntidadesStore.subscribe(inicializarNovos);
}
