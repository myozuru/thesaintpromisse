import { findCharEntity } from '@/lib/touchRange';
import { useRoleStore } from '@/stores/useRoleStore';
import { estadoRemotoEmAplicacao } from './estadoRemoto';
import { useMapStore } from '@/stores/useMapStore';
/**
 * Motor de Auras do Omni-Engine (Pilar 5).
 *
 * Para cada efeito ativo cuja entidade tenha `areaRaio`, mantém o conjunto
 * de IDs de personagens "atualmente dentro" e dispara `aoEntrarEmAura` /
 * `aoSairDaAura` quando esse conjunto muda.
 *
 * Também varre auras VINCULADAS via `Character.omniAtivos` (categoria 'aura'),
 * tratando o personagem dono como fonte da aura. O estado "dentroDe" para
 * essas auras vinculadas é persistido localmente e chaveado por
 * `${sceneId}:${charId}:${entidadeId}`.
 */
import type { EfeitoAtivo } from '@/stores/useOmniRuntimeStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniSpatialStore } from '@/stores/useOmniSpatialStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { emitirEventoDaEntidade } from './eventBus';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import type { EntidadeOmni } from './tipos';
import type { Character } from '@/types';

let runtimeAuraRemovalListenerInstalled = false;

function instalarListenerRemocaoAuraRuntime() {
  if (runtimeAuraRemovalListenerInstalled) return;
  runtimeAuraRemovalListenerInstalled = true;
  useOmniRuntimeStore.subscribe((atual, anterior) => {
    if (useRoleStore.getState().role === 'PLAYER' || estadoRemotoEmAplicacao()) return;
    for (const [id, efeito] of Object.entries(anterior.efeitos)) {
      if (atual.efeitos[id]) continue;
      const ent = useOmniEntidadesStore.getState().entidades[efeito.entidadeId];
      const membros = (efeito.meta as { dentroDe?: unknown } | undefined)?.dentroDe;
      if (!ent || !efeito.sourceCharId || !Array.isArray(membros)) continue;
      for (const alvoId of membros) {
        if (typeof alvoId === 'string') {
          emitirEventoDaEntidade(ent, 'aoSairDaAura', { usuarioId: efeito.sourceCharId, alvoId });
        }
      }
    }
  });
}

/** No mapa as coordenadas são pixels; o painel espacial usa metros. */
function posicaoDoPersonagem(id: string) {
  const ms = useMapStore.getState();
  const token = findCharEntity(ms.entities, id);
  if (!token) return useOmniSpatialStore.getState().obter(id);
  const escala = (ms.gridConfig.metersPerCell || 1.5) / (ms.gridConfig.dpi || 70);
  const ponto = ms.pendingMove?.entityId === token.id ? { x: ms.pendingMove.startX, y: ms.pendingMove.startY } : token;
  return { x: ponto.x * escala, y: ponto.y * escala };
}

function raioDoEfeito(ef: EfeitoAtivo): number {
  const ent = useOmniEntidadesStore.getState().entidades[ef.entidadeId];
  if (!ent || !ent.areaRaio) return 0;
  if (ent.areaRaio.tipo === 'fixo') return ent.areaRaio.valor;
  const src = useCharacterStore.getState().characters.find((c) => c.id === ef.sourceCharId);
  const vars = src ? montarVariaveisDoPersonagem(src, 'USUARIO') : {};
  const r = avaliarFormula(ent.areaRaio.expressao, vars);
  return r.diagnosticos.length || !Number.isFinite(r.valor) ? 0 : r.valor;
}

function raioDeEntidadeVinculada(ent: EntidadeOmni, dono: Character): number {
  if (!ent.areaRaio) return 0;
  if (ent.areaRaio.tipo === 'fixo') return ent.areaRaio.valor;
  const vars = montarVariaveisDoPersonagem(dono, 'USUARIO');
  const r = avaliarFormula(ent.areaRaio.expressao, vars);
  return r.diagnosticos.length || !Number.isFinite(r.valor) ? 0 : r.valor;
}


/**
 * Recalcula auras. Pode ser chamado:
 *  - Após movimento (recalcula todos: a própria origem pode ter se movido).
 *  - No início de turno (sem charId → varre tudo).
 */
export function recalcularAuras(_charIdMovido?: string) {
  if (useRoleStore.getState().role === 'PLAYER' || estadoRemotoEmAplicacao()) return;
  instalarListenerRemocaoAuraRuntime();
  const rt = useOmniRuntimeStore.getState();
  const personagens = useCharacterStore.getState().characters;
  const entidadesStore = useOmniEntidadesStore.getState().entidades;
  const sceneId = useMapStore.getState().activeSceneId;

  // ===== 1) Auras via runtime (efeitos ativos com areaRaio) =====
  const runtimeVistos = new Set<string>();
  for (const ef of Object.values(rt.efeitos).sort((a,b) => a.id.localeCompare(b.id))) {
    const identidade = `${ef.sourceCharId}:${ef.entidadeId}`;
    if (runtimeVistos.has(identidade)) continue; runtimeVistos.add(identidade);
    if (ef.sourceCharId && personagens.find(c => c.id === ef.sourceCharId)?.omniAtivos?.some(v => v.categoria === 'aura' && v.entidadeId === ef.entidadeId)) continue;
    if (!ef.sourceCharId) continue;
    const ent = entidadesStore[ef.entidadeId];
    if (!ent) continue;
    const meta = (ef.meta ?? {}) as { dentroDe?: string[]; cenaAura?: string };
    const membrosAnteriores = meta.dentroDe ?? [];
    if (meta.cenaAura && meta.cenaAura !== sceneId) {
      for (const id of membrosAnteriores) {
        emitirEventoDaEntidade(ent, 'aoSairDaAura', { usuarioId: ef.sourceCharId, alvoId: id });
      }
    }
    const antes = new Set(meta.cenaAura === sceneId ? membrosAnteriores : []);
    const raio = raioDoEfeito(ef);
    const posOrigem = posicaoDoPersonagem(ef.sourceCharId);
    const agora = new Set<string>();
    if (Number.isFinite(raio) && raio > 0 && posOrigem) {
      for (const c of personagens) {
        const p = posicaoDoPersonagem(c.id);
        if (!p) continue;
        const dx = p.x - posOrigem.x;
        const dy = p.y - posOrigem.y;
        if (Math.sqrt(dx * dx + dy * dy) <= raio) agora.add(c.id);
      }
    }

    const escopoIds = new Set([...antes, ...agora]);

    // Salva a transição antes dos efeitos: uma chamada aninhada não repete entrada.
    if (meta.cenaAura !== sceneId || antes.size !== agora.size || [...antes].some(id => !agora.has(id))) useOmniRuntimeStore.setState(s => ({ efeitos: s.efeitos[ef.id] ? { ...s.efeitos, [ef.id]: { ...s.efeitos[ef.id], meta: { ...s.efeitos[ef.id].meta, dentroDe: Array.from(agora), cenaAura: sceneId } } } : s.efeitos }));
    const usuario = personagens.find((c) => c.id === ef.sourceCharId);
    for (const id of escopoIds) {
      const alvo = personagens.find((c) => c.id === id);
      if (!alvo) continue;
      const estavaDentro = antes.has(id);
      const estaDentro = agora.has(id);
      if (!estavaDentro && estaDentro) {
        emitirEventoDaEntidade(ent, 'aoEntrarEmAura', { usuarioId: usuario?.id, alvoId: alvo.id });
      } else if (estavaDentro && !estaDentro) {
        emitirEventoDaEntidade(ent, 'aoSairDaAura', { usuarioId: usuario?.id, alvoId: alvo.id });
      }
    }

  }

  // ===== 2) Auras VINCULADAS via Character.omniAtivos (categoria 'aura') =====
  const chavesAtivas = new Set<string>();
  for (const dono of personagens) {
    if (!dono.omniAtivos?.length) continue;
    const posOrigem = posicaoDoPersonagem(dono.id);

    for (const vinc of dono.omniAtivos) {
      if (vinc.categoria !== 'aura') continue;
      const ent = entidadesStore[vinc.entidadeId];
      if (!ent) continue;
      const cacheKey = `${sceneId}:${dono.id}:${ent.id}`;
      chavesAtivas.add(cacheKey);
      const antes = new Set(useOmniSpatialStore.getState().aurasDentro[cacheKey] ?? []);
      const raio = raioDeEntidadeVinculada(ent, dono);
      const agora = new Set<string>();
      if (Number.isFinite(raio) && raio > 0 && posOrigem) {
        for (const c of personagens) {
          const p = posicaoDoPersonagem(c.id);
          if (!p) continue;
          const dx = p.x - posOrigem.x;
          const dy = p.y - posOrigem.y;
          if (Math.sqrt(dx * dx + dy * dy) <= raio) agora.add(c.id);
        }
      }

      const previous = useOmniSpatialStore.getState().aurasDentro[cacheKey] ?? [];
      if (previous.length !== agora.size || previous.some(id => !agora.has(id))) useOmniSpatialStore.setState(s => ({ aurasDentro: { ...s.aurasDentro, [cacheKey]: [...agora] } }));
      const escopoIds = new Set([...antes, ...agora]);
      for (const id of escopoIds) {
        const alvo = personagens.find((c) => c.id === id);
        if (!alvo) continue;
        const estavaDentro = antes.has(id);
        const estaDentro = agora.has(id);
        if (!estavaDentro && estaDentro) {
          emitirEventoDaEntidade(ent, 'aoEntrarEmAura', { usuarioId: dono.id, alvoId: alvo.id });
        } else if (estavaDentro && !estaDentro) {
          emitirEventoDaEntidade(ent, 'aoSairDaAura', { usuarioId: dono.id, alvoId: alvo.id });
        }
      }
    }
  }
  const persistidas = useOmniSpatialStore.getState().aurasDentro;
  const removidas = Object.entries(persistidas).filter(([k]) => !chavesAtivas.has(k));
  if (removidas.length > 0) {
    useOmniSpatialStore.setState({ aurasDentro: Object.fromEntries(Object.entries(persistidas).filter(([k]) => chavesAtivas.has(k))) });
    for (const [key, membros] of removidas) {
      const primeira = key.indexOf(':');
      const segunda = key.indexOf(':', primeira + 1);
      if (primeira < 0 || segunda < 0) continue;
      const donoId = key.slice(primeira + 1, segunda);
      const entidadeId = key.slice(segunda + 1);
      const ent = entidadesStore[entidadeId];
      if (!ent) continue;
      for (const alvoId of membros) {
        emitirEventoDaEntidade(ent, 'aoSairDaAura', { usuarioId: donoId, alvoId });
      }
    }
  }
}
