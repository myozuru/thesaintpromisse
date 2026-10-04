import { notificarEventoPersonagem } from './notificarEvento';
/** Reposicionamento genérico. Usa patches de mapa e não debita movimento comum. */
import type { Character } from '@/types';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useFogStore } from '@/stores/fogStore';
import { WallsEngine } from '@/components/mapa/WallsEngine';
import { buildSegments } from '@/lib/fog/visibility';
import { firstFootprintHit, placementBlocked, tokenFootprintSegments, type MapCollisionToken } from '@/lib/mapCollision';
import { findCharEntity, touchDistanceMeters } from '@/lib/touchRange';
import { imuneMovimentoForcado } from '@/lib/posturas';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import type { EfeitoSecundarioAtivo, TipoMovimentoAtivo } from './tipos';

type Ponto = { x: number; y: number };
export interface PlanoMovimentoAtivo { indice: number; tipo: TipoMovimentoAtivo; sujeito: 'usuario' | 'alvo'; metros: number; destino?: Ponto }
export interface OpcoesMovimentoAtivo { /** Chave `${alvoId}:${índice do efeito}`; coordenadas-mundo. */ destinosMovimento?: Record<string, Ponto> }
type Resultado = { ok: true; planos: Map<string, PlanoMovimentoAtivo[]> } | { ok: false; reason: string };
const ficha = (id: string) => useCharacterStore.getState().characters.find(c => c.id === id);
const token = (id: string) => findCharEntity(useMapStore.getState().entities, id);
const pxM = () => { const g = useMapStore.getState().gridConfig; return (g.dpi || 70) / (g.metersPerCell || 1.5); };
const distancia = (a: Ponto, b: Ponto) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / pxM();
const normalizar = (e: Entity): Entity => ({ ...e, rotation: e.rotation || 0, shape: e.shape || 'RECT' });
const paredeTokens = () => {
  const ms = useMapStore.getState(), fog = useFogStore.getState();
  return [...WallsEngine.blockingSegments(ms.walls, 'sight'), ...buildSegments(fog.walls, fog.doors).map(s => [s.a, s.b] as [Ponto, Ponto])];
};

function familia(e: Entity): Entity[] {
  // updateEntity/updateEntities transportam as peças carregadas junto ao portador.
  return [e, ...Object.values(useMapStore.getState().entities).filter(t => t.carriedBy === e.id)];
}
const geometria = (e: Entity): MapCollisionToken => ({ origin: { x: e.x, y: e.y }, entity: normalizar(e) });

/** SAT para footprints convexos; apenas contato de bordas é permitido. */
function sobrepoe(a: Entity, b: Entity): boolean {
  const pa = tokenFootprintSegments(geometria(a), 0, 0).map(s => s[0]);
  const pb = tokenFootprintSegments(geometria(b), 0, 0).map(s => s[0]);
  for (const poly of [pa, pb]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = -(q.y - p.y), ny = q.x - p.x;
    const len = Math.hypot(nx, ny);
    if (!len) continue;
    const proj = (ps: Ponto[]) => ps.map(v => (v.x * nx + v.y * ny) / len);
    const aa = proj(pa), bb = proj(pb);
    if (Math.max(...aa) <= Math.min(...bb) + 0.05 || Math.max(...bb) <= Math.min(...aa) + 0.05) return false;
  }
  return true;
}

function pontoValido(e: Entity, destino: Ponto, ignorados: Set<string> = new Set()): boolean {
  if (![destino.x, destino.y].every(Number.isFinite)) return false;
  const grupo = familia(e), ids = new Set([...ignorados, ...grupo.map(t => t.id)]);
  const dx = destino.x - e.x, dy = destino.y - e.y;
  if (placementBlocked(grupo.map(geometria), paredeTokens(), dx, dy)) return false;
  const outros = Object.values(useMapStore.getState().entities).filter(t => !ids.has(t.id) && (t.layer ?? 'tokens') === 'tokens');
  return !grupo.some(t => outros.some(o => sobrepoe({ ...t, x: t.x + dx, y: t.y + dy }, o)));
}

export function validarPlanoMovimento(uId: string, aId: string, p: PlanoMovimentoAtivo): string | undefined {
  const u = token(uId), a = token(aId), movido = p.sujeito === 'usuario' ? u : a;
  if (!u || !a || !movido) return 'Usuário e alvo precisam estar no mapa.';
  if (movido.carriedBy || (p.tipo === 'trocar_posicao' && (u.carriedBy || a.carriedBy))) return 'Solte a peça carregada antes de reposicioná-la.';
  if (p.tipo === 'teleporte') {
    if (!p.destino || distancia(movido, p.destino) > p.metros + 0.05) return 'Destino do teleporte fora de alcance.';
    if (!pontoValido(movido, p.destino)) return 'Destino do teleporte ocupado ou bloqueado.';
  }
  if (p.tipo === 'trocar_posicao') {
    if (u.id === a.id) return 'Escolha outra criatura para trocar de posição.';
    if (distancia(u, a) > p.metros + 0.05) return 'Troca de posição fora de alcance.';
    const ignorados = new Set([...familia(u), ...familia(a)].map(t => t.id));
    if (!pontoValido(u, a, ignorados) || !pontoValido(a, u, ignorados)) return 'As peças não cabem nas posições da troca.';
    const du = { x: a.x - u.x, y: a.y - u.y }, da = { x: -du.x, y: -du.y };
    if (familia(u).some(t => familia(a).some(o => sobrepoe({ ...t, x: t.x + du.x, y: t.y + du.y }, { ...o, x: o.x + da.x, y: o.y + da.y })))) return 'As peças se sobrepõem após a troca.';
  }
}

export async function prepararMovimentosAtivos(uId: string, alvos: Character[], efeitos: EfeitoSecundarioAtivo[], op: OpcoesMovimentoAtivo = {}): Promise<Resultado> {
  const planos = new Map<string, PlanoMovimentoAtivo[]>();
  for (const a of alvos) {
    const lista: PlanoMovimentoAtivo[] = [];
    for (const [indice, ef] of efeitos.entries()) {
      if (ef.tipo !== 'movimento' && ef.tipo !== 'puxar' && ef.tipo !== 'empurrar') continue;
      const tipo = ef.tipo === 'movimento' ? ef.movimento_tipo : ef.tipo;
      if (!['puxar', 'empurrar', 'avancar_ate', 'teleporte', 'trocar_posicao'].includes(tipo)) return { ok: false, reason: 'Tipo de movimento inválido.' };
      const u = ficha(uId), alvo = ficha(a.id);
      if (!u || !alvo || !token(uId) || !token(a.id)) return { ok: false, reason: 'Usuário e alvo precisam estar no mapa.' };
      const r = avaliarFormula(ef.tipo === 'movimento' ? ef.movimento_distancia : String(ef.metros), { ...montarVariaveisDoPersonagem(u, 'USUARIO'), ...montarVariaveisDoPersonagem(alvo, 'ALVO') });
      if ((ef.tipo === 'movimento' && !ef.movimento_distancia.trim()) || r.diagnosticos.length || r.rolagens.length || !Number.isFinite(r.valor) || r.valor < 0) return { ok: false, reason: 'Distância deve ser uma fórmula válida, sem dados, em metros não negativos.' };
      const sujeito = tipo === 'puxar' || tipo === 'empurrar' ? 'alvo' : tipo === 'avancar_ate' || tipo === 'trocar_posicao' ? 'usuario' : ef.tipo === 'movimento' ? ef.movimento_alvo ?? 'usuario' : 'alvo';
      const p: PlanoMovimentoAtivo = { indice, tipo, sujeito, metros: r.valor };
      if (tipo === 'teleporte') {
        const movido = token(sujeito === 'usuario' ? uId : a.id)!;
        const pronto = op.destinosMovimento?.[`${a.id}:${indice}`];
        const selecionado = pronto ?? await useMapStore.getState().requestAoEPlacement({ kind: 'circle', sizeMeters: 0.15, sourceLabel: `Teleporte · ${sujeito === 'usuario' ? u.name : alvo.name} · até ${p.metros} m na grade`, originWorld: movido });
        if (!selecionado) return { ok: false, reason: 'Teleporte cancelado.' };
        p.destino = { x: selecionado.x, y: selecionado.y };
      }
      lista.push(p);
    }
    planos.set(a.id, lista);
  }
  // Validar novamente depois dos await: outra tela pode alterar a mesa.
  for (const [aId, lista] of planos) for (const p of lista) {
    const erro = validarPlanoMovimento(uId, aId, p);
    if (erro) return { ok: false, reason: erro };
  }
  return { ok: true, planos };
}

export function aplicarMovimentoAtivo(uId: string, aId: string, p: PlanoMovimentoAtivo): string {
  const erro = validarPlanoMovimento(uId, aId, p);
  if (erro) return erro;
  const ms = useMapStore.getState(), u = token(uId)!, a = token(aId)!;
  const movido = p.sujeito === 'usuario' ? u : a;
  // Avançar é voluntário; os demais deslocamentos do alvo são forçados.
  const forcado = p.tipo === 'puxar' || p.tipo === 'empurrar' || p.tipo === 'trocar_posicao' || (p.tipo === 'teleporte' && p.sujeito === 'alvo' && aId !== uId);
  if (forcado && ficha(aId) && imuneMovimentoForcado(ficha(aId)!)) return 'alvo imune a movimento forçado';
  if (p.tipo === 'teleporte') { ms.updateEntity(movido.id, p.destino!); if (movido.x !== p.destino!.x || movido.y !== p.destino!.y) notificarEventoPersonagem('aoMover', p.sujeito === 'usuario' ? uId : aId, 'Teleporte'); return 'teleportado sem AdO'; }
  if (p.tipo === 'trocar_posicao') {
    ms.updateEntities([{ id: u.id, patch: { x: a.x, y: a.y } }, { id: a.id, patch: { x: u.x, y: u.y } }]);
    if (u.x !== a.x || u.y !== a.y) {
      notificarEventoPersonagem('aoMover', uId, 'Troca de posição');
      if (aId !== uId) notificarEventoPersonagem('aoMover', aId, 'Troca de posição');
    }
    return 'posições trocadas sem AdO';
  }
  const emDirecao = p.tipo === 'avancar_ate' ? a : u;
  const dx = emDirecao.x - movido.x, dy = emDirecao.y - movido.y, norma = Math.max(Math.abs(dx), Math.abs(dy));
  if (!norma || !p.metros) return 'sem deslocamento';
  const mpc = ms.gridConfig.metersPerCell || 1.5;
  let travel = Math.floor(p.metros / mpc + 1e-6) * (ms.gridConfig.dpi || 70);
  const sentido = p.tipo === 'empurrar' ? -1 : 1;
  const ponto = (d: number) => ({ x: movido.x + dx / norma * d * sentido, y: movido.y + dy / norma * d * sentido });
  if (sentido === 1) {
    if (touchDistanceMeters(movido, emDirecao, ms.gridConfig) <= mpc + 0.05) return 'já adjacente';
    travel = Math.min(travel, norma);
    if (touchDistanceMeters({ ...movido, ...ponto(travel) }, emDirecao, ms.gridConfig) <= mpc) {
      let lo = 0, hi = travel;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (touchDistanceMeters({ ...movido, ...ponto(mid) }, emDirecao, ms.gridConfig) > mpc) lo = mid; else hi = mid; }
      travel = lo;
    }
  }
  const grupo = familia(movido), ids = new Set(grupo.map(t => t.id));
  const outros = Object.values(ms.entities).filter(t => !ids.has(t.id) && (t.layer ?? 'tokens') === 'tokens');
  const blockers = [...paredeTokens(), ...outros.flatMap(t => tokenFootprintSegments(geometria(t), 0, 0))];
  const destino = ponto(travel), vx = destino.x - movido.x, vy = destino.y - movido.y;
  const hit = firstFootprintHit(grupo.map(geometria), blockers, 0, 0, vx, vy);
  const contatoValido = hit && Math.abs(hit.t - 1) < 1e-7 && pontoValido(movido, destino);
  const t = hit && !contatoValido ? Math.max(0, hit.t - 0.0001) : 1;
  const final = { x: Math.round((movido.x + vx * t) * 1e9) / 1e9, y: Math.round((movido.y + vy * t) * 1e9) / 1e9 };
  if (!pontoValido(movido, final) || distancia(movido, final) < 1e-5) return 'movimento bloqueado';
  ms.updateEntity(movido.id, final);
  notificarEventoPersonagem('aoMover', p.sujeito === 'usuario' ? uId : aId, 'Movimento OMNI');
  return `${p.tipo === 'avancar_ate' ? 'avançou' : p.tipo === 'puxar' ? 'puxado' : 'empurrado'} ${distancia(movido, final).toFixed(2).replace('.', ',')} m${hit && !contatoValido ? ' (obstáculo)' : ''}`;
}
