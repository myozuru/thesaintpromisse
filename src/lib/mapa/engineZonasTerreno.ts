import { useMapStore, type Entity, type GatilhoZonaTerreno, type ZonaTerreno } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { executarCombatEffect } from '@/lib/omni/executarSubEfeito';
import { avancarDuracaoZona, pontoDentroDaZona, segmentoEntraNaZona } from './zonaTerreno';

let iniciado = false;

function executarEfeitos(zona: Entity, personagemId: string, gatilho: GatilhoZonaTerreno) {
  const config = zona.terrainZone;
  if (!config?.gatilhos.includes(gatilho) || config.efeitos.length === 0) return;
  const personagem = useCharacterStore.getState().characters.find((c) => c.id === personagemId);
  if (!personagem) return;
  for (const efeito of config.efeitos) {
    const usuarioVars = montarVariaveisDoPersonagem(personagem, 'USUARIO');
    const alvoVars = montarVariaveisDoPersonagem(personagem, 'ALVO');
    const vars = { ...usuarioVars, ...alvoVars };
    if (efeito.condition?.trim()) {
      try {
        if (avaliarFormula(efeito.condition, vars).valor <= 0) continue;
      } catch {
        continue;
      }
    }
    executarCombatEffect(efeito, {
      usuarioId: personagemId,
      alvoId: personagemId,
      usuarioVars,
      alvoVars,
      sourceName: zona.label || 'Zona de terreno',
    });
  }
}

function processarMovimento(atual: ReturnType<typeof useMapStore.getState>, anterior: ReturnType<typeof useMapStore.getState>) {
  if (useRoleStore.getState().role === 'PLAYER') return;
  for (const entidade of Object.values(atual.entities)) {
    const antes = anterior.entities[entidade.id];
    if (!antes || !entidade.characterId || (antes.x === entidade.x && antes.y === entidade.y)) continue;
    for (const zona of Object.values(atual.entities)) {
      if (!zona.terrainZone || zona.id === entidade.id) continue;
      if (segmentoEntraNaZona(zona, { x: antes.x, y: antes.y }, { x: entidade.x, y: entidade.y })) {
        executarEfeitos(zona, entidade.characterId, 'entrada');
      }
    }
  }
}

function personagensNaZona(entities: Record<string, Entity>, zona: Entity): string[] {
  const ids = new Set<string>();
  for (const entidade of Object.values(entities)) {
    if (entidade.characterId && pontoDentroDaZona(zona, { x: entidade.x, y: entidade.y })) ids.add(entidade.characterId);
  }
  return [...ids];
}

function processarFimTurno(personagemId: string) {
  const entities = useMapStore.getState().entities;
  for (const zona of Object.values(entities)) {
    if (!zona.terrainZone?.gatilhos.includes('fim_turno')) continue;
    if (personagensNaZona(entities, zona).includes(personagemId)) executarEfeitos(zona, personagemId, 'fim_turno');
  }
}

function expirarZonas() {
  const store = useMapStore.getState();
  for (const zona of Object.values(store.entities)) {
    if (!zona.terrainZone || zona.terrainZone.duracaoRodadas === null) continue;
    const proxima = avancarDuracaoZona(zona.terrainZone);
    if (!proxima) store.removeEntities([zona.id]);
    else store.updateEntity(zona.id, { terrainZone: proxima });
  }
}

/** Inicializa listeners idempotentes no bootstrap do aplicativo. Efeitos ficam autoritativos no Mestre. */
export function iniciarEngineZonasTerreno() {
  if (iniciado) return;
  iniciado = true;
  useMapStore.subscribe((atual, anterior) => processarMovimento(atual, anterior));
  useCombatStore.subscribe((atual, anterior) => {
    if (useRoleStore.getState().role === 'PLAYER' || !atual.inCombat || !anterior.inCombat) return;
    const mudouTurno = atual.currentTurnIndex !== anterior.currentTurnIndex || atual.round !== anterior.round;
    if (!mudouTurno) return;
    const encerrando = anterior.initiativeOrder[anterior.currentTurnIndex];
    if (encerrando) processarFimTurno(encerrando.charId);
    if (atual.round > anterior.round) expirarZonas();
  });
}
