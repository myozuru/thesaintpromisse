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
 * `${charId}:${entidadeId}`.
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
 *  - Após movimento (passa o charId que se moveu para reduzir escopo).
 *  - No início de turno (sem charId → varre tudo).
 */
export function recalcularAuras(charIdMovido?: string) {
  const rt = useOmniRuntimeStore.getState();
  const espacial = useOmniSpatialStore.getState();
  const personagens = useCharacterStore.getState().characters;
  const entidadesStore = useOmniEntidadesStore.getState().entidades;

  // ===== 1) Auras via runtime (efeitos ativos com areaRaio) =====
  for (const ef of Object.values(rt.efeitos)) {
    const raio = raioDoEfeito(ef);
    if (!Number.isFinite(raio) || raio <= 0 || !ef.sourceCharId) continue;
    const posOrigem = espacial.obter(ef.sourceCharId);
    if (!posOrigem) continue;

    const meta = (ef.meta ?? {}) as { dentroDe?: string[] };
    const antes = new Set(meta.dentroDe ?? []);
    const agora = new Set<string>();
    for (const c of personagens) {
      const p = espacial.obter(c.id);
      if (!p) continue;
      const dx = p.x - posOrigem.x;
      const dy = p.y - posOrigem.y;
      if (Math.sqrt(dx * dx + dy * dy) <= raio) agora.add(c.id);
    }

    const escopoIds = charIdMovido ? new Set([charIdMovido]) : new Set([...antes, ...agora]);

    const ent = entidadesStore[ef.entidadeId];
    if (!ent) continue;

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

    rt.efeitos[ef.id] = { ...ef, meta: { ...meta, dentroDe: Array.from(agora) } };
  }
  useOmniRuntimeStore.setState({ efeitos: { ...rt.efeitos } });

  // ===== 2) Auras VINCULADAS via Character.omniAtivos (categoria 'aura') =====
  for (const dono of personagens) {
    if (!dono.omniAtivos?.length) continue;
    const posOrigem = espacial.obter(dono.id);
    if (!posOrigem) continue;

    for (const vinc of dono.omniAtivos) {
      if (vinc.categoria !== 'aura') continue;
      const ent = entidadesStore[vinc.entidadeId];
      if (!ent) continue;
      const raio = raioDeEntidadeVinculada(ent, dono);
      if (!Number.isFinite(raio) || raio <= 0) continue;

      const cacheKey = `${dono.id}:${ent.id}`;
      const antes = dentroDeVinculadas.get(cacheKey) ?? new Set<string>();
      const agora = new Set<string>();
      for (const c of personagens) {
        const p = espacial.obter(c.id);
        if (!p) continue;
        const dx = p.x - posOrigem.x;
        const dy = p.y - posOrigem.y;
        if (Math.sqrt(dx * dx + dy * dy) <= raio) agora.add(c.id);
      }

      const escopoIds = charIdMovido ? new Set([charIdMovido]) : new Set([...antes, ...agora]);
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
      dentroDeVinculadas.set(cacheKey, agora);
    }
  }
}
