import { estadoRemotoEmAplicacao } from '@/lib/omni/estadoRemoto';
import { emPreviaMovimento, observarMovimentoConfirmado, type MovimentoConfirmadoMapa } from './movimentoConfirmado';
import { recalcularAuras } from '@/lib/omni/auras';
import { useMapStore, type Entity, type GatilhoZonaTerreno, type ZonaTerreno } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { executarCombatEffect } from '@/lib/omni/executarSubEfeito';
import { avancarDuracaoZona, pontoDentroDaZona, segmentoEntraNaZona, zonaEstaAtiva } from './zonaTerreno';

let iniciado = false;

function executarEfeitos(zona: Entity, personagemId: string, gatilho: GatilhoZonaTerreno) {
  const config = zona.terrainZone;
  if (!config || !zonaEstaAtiva(config) || !config.gatilhos.includes(gatilho) || config.efeitos.length === 0) return;
  const personagem = useCharacterStore.getState().characters.find((c) => c.id === personagemId);
  if (!personagem) return;
  for (const efeito of config.efeitos) {
    const origem = config.sourceCharId ? useCharacterStore.getState().characters.find(c => c.id === config.sourceCharId) : undefined;
    const alvoAtual = useCharacterStore.getState().characters.find(c => c.id === personagemId);
    if (!alvoAtual) break;
    const usuarioVars = montarVariaveisDoPersonagem(origem ?? alvoAtual, 'USUARIO');
    const alvoVars = montarVariaveisDoPersonagem(alvoAtual, 'ALVO');
    const vars = { ...usuarioVars, ...alvoVars };
    if (efeito.condition?.trim()) {
      try {
        const r = avaliarFormula(efeito.condition, vars);
        if (r.diagnosticos.length || !Number.isFinite(r.valor) || r.valor <= 0) continue;
      } catch {
        continue;
      }
    }
    executarCombatEffect(efeito, {
      usuarioId: origem?.id ?? personagemId,
      origemId: origem?.id ?? null,
      alvoId: personagemId,
      usuarioVars,
      alvoVars,
      sourceName: zona.label || 'Zona de terreno',
    });
  }
}

function processarMovimento(atual: ReturnType<typeof useMapStore.getState>, anterior: ReturnType<typeof useMapStore.getState>) {
  if (estadoRemotoEmAplicacao() || useRoleStore.getState().role === 'PLAYER' || emPreviaMovimento() || atual.activeSceneId !== anterior.activeSceneId || atual.pendingMove) return;
  const atingidos = new Set<string>();
  for (const entidade of Object.values(atual.entities)) {
    const antes = anterior.entities[entidade.id];
    if (!antes || !entidade.characterId || (antes.x === entidade.x && antes.y === entidade.y)) continue;
    for (const zona of Object.values(atual.entities)) {
      if (!zona.terrainZone || zona.id === entidade.id) continue;
      if (segmentoEntraNaZona(zona, { x: antes.x, y: antes.y }, { x: entidade.x, y: entidade.y })) {
        const key = `${zona.id}:${entidade.characterId}`;
        if (!atingidos.has(key)) { atingidos.add(key); executarEfeitos(zona, entidade.characterId, 'entrada'); }
      }
    }
  }
}

function processarConfirmacao(m: MovimentoConfirmadoMapa) {
  if (useRoleStore.getState().role === 'PLAYER') return;
  const entities = useMapStore.getState().entities;
  const caminho = [m.de, ...m.trajetoria, m.para];
  for (const zona of Object.values(entities)) {
    if (!zona.terrainZone) continue;
    const entrou = m.teleporte ? !pontoDentroDaZona(zona, m.de) && pontoDentroDaZona(zona, m.para)
      : caminho.slice(0, -1).some((p, i) => segmentoEntraNaZona(zona, p, caminho[i + 1]));
    if (entrou) executarEfeitos(zona, m.characterId, 'entrada');
  }
  recalcularAuras(m.characterId);
}

function personagensNaZona(entities: Record<string, Entity>, zona: Entity): string[] {
  const ids = new Set<string>();
  for (const entidade of Object.values(entities)) {
    const pending = useMapStore.getState().pendingMove;
    const ponto = pending?.entityId === entidade.id ? { x: pending.startX, y: pending.startY } : entidade;
    if (entidade.characterId && (entidade.layer ?? 'tokens') === 'tokens' && !entidade.carriedBy && pontoDentroDaZona(zona, ponto)) ids.add(entidade.characterId);
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

function mudaramTokensDeFicha(atual: ReturnType<typeof useMapStore.getState>, anterior: ReturnType<typeof useMapStore.getState>): boolean {
  const ids = new Set([...Object.keys(atual.entities), ...Object.keys(anterior.entities)]);
  for (const id of ids) {
    const depois = atual.entities[id];
    const antes = anterior.entities[id];
    if (!depois?.characterId && !antes?.characterId) continue;
    if (!depois || !antes || depois.characterId !== antes.characterId || depois.x !== antes.x || depois.y !== antes.y || depois.carriedBy !== antes.carriedBy) return true;
  }
  return false;
}

function idsAurasVinculadas(personagem: { omniAtivos?: Array<{ categoria?: string; entidadeId: string }> } | undefined): string[] {
  return (personagem?.omniAtivos ?? [])
    .filter((vinculo) => vinculo.categoria === 'aura')
    .map((vinculo) => vinculo.entidadeId)
    .sort();
}

function mudaramVinculosDeAura(atual: ReturnType<typeof useCharacterStore.getState>, anterior: ReturnType<typeof useCharacterStore.getState>): boolean {
  const atuais = new Map(atual.characters.map((personagem) => [personagem.id, idsAurasVinculadas(personagem)]));
  const anteriores = new Map(anterior.characters.map((personagem) => [personagem.id, idsAurasVinculadas(personagem)]));
  const ids = new Set([...atuais.keys(), ...anteriores.keys()]);
  for (const id of ids) {
    if (JSON.stringify(atuais.get(id) ?? []) !== JSON.stringify(anteriores.get(id) ?? [])) return true;
  }
  return false;
}

/** Inicializa listeners idempotentes no bootstrap do aplicativo. Efeitos ficam autoritativos no Mestre. */
export function iniciarEngineZonasTerreno() {
  if (iniciado) return;
  iniciado = true;
  observarMovimentoConfirmado(processarConfirmacao);
  useMapStore.subscribe((atual, anterior) => {
    processarMovimento(atual, anterior);
    const mudouEspaco = atual.activeSceneId !== anterior.activeSceneId || mudaramTokensDeFicha(atual, anterior);
    if (!estadoRemotoEmAplicacao() && !emPreviaMovimento() && !atual.pendingMove && useRoleStore.getState().role !== 'PLAYER' && mudouEspaco) recalcularAuras();
  });
  useCharacterStore.subscribe((atual, anterior) => {
    if (estadoRemotoEmAplicacao() || useRoleStore.getState().role === 'PLAYER' || !mudaramVinculosDeAura(atual, anterior)) return;
    recalcularAuras();
  });
  useCombatStore.subscribe((atual, anterior) => {
    if (estadoRemotoEmAplicacao() || useRoleStore.getState().role === 'PLAYER' || !atual.inCombat || !anterior.inCombat) return;
    const mudouTurno = atual.currentTurnIndex !== anterior.currentTurnIndex || atual.round !== anterior.round;
    if (!mudouTurno) return;
    recalcularAuras();
    const encerrando = anterior.initiativeOrder[anterior.currentTurnIndex];
    if (encerrando) processarFimTurno(encerrando.charId);
    if (atual.round > anterior.round) expirarZonas();
  });
}
