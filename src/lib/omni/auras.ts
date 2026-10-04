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
 * essas auras vinculadas é mantido num cache em memória chaveado por
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

/** No mapa as coordenadas são pixels; o painel espacial usa metros. */
function posicaoDoPersonagem(id: string) {
  const ms = useMapStore.getState();
  const token = Object.values(ms.entities).find(e => e.characterId === id && !e.carriedBy && (e.layer ?? 'tokens') === 'tokens');
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

/** Cache de "quem estava dentro" para auras vinculadas (não persistido). */
const dentroDeVinculadas = new Map<string, Set<string>>();

/**
 * Recalcula auras. Pode ser chamado:
 *  - Após movimento (recalcula todos: a própria origem pode ter se movido).
 *  - No início de turno (sem charId → varre tudo).
 */
export function recalcularAuras(_charIdMovido?: string) {
  const rt = useOmniRuntimeStore.getState();
  const personagens = useCharacterStore.getState().characters;
  const entidadesStore = useOmniEntidadesStore.getState().entidades;

  // ===== 1) Auras via runtime (efeitos ativos com areaRaio) =====
  for (const ef of Object.values(rt.efeitos)) {
    const raio = raioDoEfeito(ef);
    if (!Number.isFinite(raio) || raio <= 0 || !ef.sourceCharId) continue;
    const posOrigem = posicaoDoPersonagem(ef.sourceCharId);
    if (!posOrigem) continue;

    const meta = (ef.meta ?? {}) as { dentroDe?: string[] };
    const antes = new Set(meta.dentroDe ?? []);
    const agora = new Set<string>();
    for (const c of personagens) {
      const p = posicaoDoPersonagem(c.id);
      if (!p) continue;
      const dx = p.x - posOrigem.x;
      const dy = p.y - posOrigem.y;
      if (Math.sqrt(dx * dx + dy * dy) <= raio) agora.add(c.id);
    }

    const escopoIds = new Set([...antes, ...agora]);

    const ent = entidadesStore[ef.entidadeId];
    if (!ent) continue;

    // Salva a transição antes dos efeitos: uma chamada aninhada não repete entrada.
    useOmniRuntimeStore.setState(s => ({ efeitos: s.efeitos[ef.id] ? { ...s.efeitos, [ef.id]: { ...s.efeitos[ef.id], meta: { ...s.efeitos[ef.id].meta, dentroDe: Array.from(agora) } } } : s.efeitos }));
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
    if (!posOrigem) continue;

    for (const vinc of dono.omniAtivos) {
      if (vinc.categoria !== 'aura') continue;
      const ent = entidadesStore[vinc.entidadeId];
      if (!ent) continue;
      const raio = raioDeEntidadeVinculada(ent, dono);
      if (!Number.isFinite(raio) || raio <= 0) continue;

      const cacheKey = `${useMapStore.getState().activeSceneId}:${dono.id}:${ent.id}`;
      chavesAtivas.add(cacheKey);
      const antes = dentroDeVinculadas.get(cacheKey) ?? new Set<string>();
      const agora = new Set<string>();
      for (const c of personagens) {
        const p = posicaoDoPersonagem(c.id);
        if (!p) continue;
        const dx = p.x - posOrigem.x;
        const dy = p.y - posOrigem.y;
        if (Math.sqrt(dx * dx + dy * dy) <= raio) agora.add(c.id);
      }

      dentroDeVinculadas.set(cacheKey, agora);
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
  for (const chave of dentroDeVinculadas.keys()) if (!chavesAtivas.has(chave)) dentroDeVinculadas.delete(chave);
}
