/** Seleção espacial reutilizável; não contém regras de habilidades específicas. */
import type { Character } from '@/types';
import type { AcaoAtivaConfig } from './tipos';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { resolverTokenDaFicha } from '@/lib/mapa/tokenDaFicha';
import { distanciaBordaEntreFichas, distanciaCircularEntreFichas } from '@/lib/mapa/alcanceCircular';
import { findEntitiesInTemplate } from '@/lib/mapAoE';
import type { MapTemplate } from '@/components/mapa/TemplateEngine';

export type SelecaoAtiva = string | string[] | { ponto: { x: number; y: number }; rotacao?: number };
type SelecaoResultado = { ok: true; ids: string[]; selecaoValidada?: SelecaoAtiva } | { ok: false; reason: string };

/** Lados explícitos da iniciativa prevalecem; categoria é o fallback da mesa. */
function lado(c: Character): 'grupo' | 'inimigo' | 'neutro' {
  const ms = useMapStore.getState();
  const tokens = Object.values(ms.entities).filter(e => e.characterId === c.id);
  const side = ms.initiative.entries.find(e => tokens.some(t => t.id === e.entityId))?.side;
  if (side === 'neutral') return 'neutro';
  if (side === 'enemy') return 'inimigo';
  if (side === 'pc' || side === 'ally') return 'grupo';
  return c.category === 'INIMIGO' ? 'inimigo' : c.category === 'PLAYER' ? 'grupo' : 'neutro';
}

export function aceitaAlvoAtivo(u: Character, a: Character, cfg: AcaoAtivaConfig): boolean {
  const filtro = cfg.filtro_alvo ?? (cfg.tipo_alvo === 'proprio' ? 'todos' : 'todos_exceto_si');
  if (filtro === 'todos') return true;
  if (filtro === 'todos_exceto_si') return a.id !== u.id;
  if (a.id === u.id) return filtro === 'aliados';
  const lu = lado(u), la = lado(a);
  if (lu === 'neutro' || la === 'neutro') return false;
  return filtro === 'aliados' ? lu === la : lu !== la;
}

export function limiteAlvosAtivos(cfg: AcaoAtivaConfig, u: Character): number {
  const r = avaliarFormula(cfg.max_alvos || '1', montarVariaveisDoPersonagem(u, 'USUARIO'));
  return !r.diagnosticos.length && !r.rolagens.length && Number.isFinite(r.valor) ? Math.max(0, Math.floor(r.valor)) : 0;
}

export async function selecionarAlvosAtivos(usuarioId: string, cfg: AcaoAtivaConfig, selecao: SelecaoAtiva, alcanceArmaM?: number | null, medicao: 'circular' | 'borda' = 'circular'): Promise<SelecaoResultado> {
  let u = useCharacterStore.getState().characters.find(c => c.id === usuarioId);
  if (!u) return { ok: false, reason: 'Personagem não encontrado.' };
  if (!Number.isFinite(cfg.alcanceM) || cfg.alcanceM < 0) return { ok: false, reason: 'Configure um alcance válido em metros.' };
  const alcanceM = cfg.alcanceM > 0 ? cfg.alcanceM : alcanceArmaM ?? 0;
  const tipo = cfg.tipo_alvo ?? 'unico';
  let ids: string[];
  let selecaoValidada: SelecaoAtiva | undefined;
  if (tipo === 'proprio') ids = [u.id];
  else if (tipo !== 'area') {
    ids = [...new Set(typeof selecao === 'string' ? [selecao].filter(Boolean) : Array.isArray(selecao) ? selecao : [])];
    if (!ids.length) return { ok: false, reason: 'Escolha um alvo.' };
    const max = tipo === 'multiplo' ? limiteAlvosAtivos(cfg, u) : 1;
    if (ids.length > max) return { ok: false, reason: `Selecione no máximo ${max} alvo(s).` };
  } else {
    const area = cfg.area;
    if (!area || !Number.isFinite(area.tamanho_m) || area.tamanho_m <= 0 ||
      !['cone', 'linha', 'raio_em_si', 'raio_no_ponto'].includes(area.forma) ||
      (area.largura_m !== undefined && (!Number.isFinite(area.largura_m) || area.largura_m <= 0))) {
      return { ok: false, reason: 'Configure uma área com dimensões positivas.' };
    }
    let ms = useMapStore.getState();
    let origem = resolverTokenDaFicha(u, ms.entities, ms.layerVisible);
    if (!origem) return { ok: false, reason: 'O usuário precisa estar no mapa para usar uma área.' };
    const kind = area.forma === 'cone' ? 'cone_attached' : area.forma === 'linha' ? 'line' : 'circle';
    let ponto: { x: number; y: number }, rotacao = 0;
    if (area.forma === 'raio_em_si') ponto = origem;
    else if (typeof selecao === 'object' && !Array.isArray(selecao)) {
      ponto = selecao.ponto; rotacao = selecao.rotacao ?? 0;
    } else {
      const colocado = await ms.requestAoEPlacement({
        kind, sizeMeters: area.tamanho_m, widthMeters: area.largura_m ?? 1.5,
        sourceLabel: `${u.name} · ${cfg.nome}`, originWorld: origem,
        maxRangeMeters: area.forma === 'raio_no_ponto' && alcanceM > 0 ? alcanceM : undefined,
      });
      if (!colocado) return { ok: false, reason: 'Posicionamento da área cancelado.' };
      ponto = colocado; rotacao = colocado.rotation;
    }
    // A mesa pode ter mudado enquanto o jogador posicionava a área.
    ms = useMapStore.getState();
    u = useCharacterStore.getState().characters.find(c => c.id === usuarioId);
    origem = u && resolverTokenDaFicha(u, ms.entities, ms.layerVisible);
    if (!u || !origem) return { ok: false, reason: 'Usuário removido do mapa.' };
    if (![ponto.x, ponto.y, rotacao].every(Number.isFinite)) return { ok: false, reason: 'Ponto ou direção inválidos.' };
    const pxM = (ms.gridConfig.dpi || 70) / (ms.gridConfig.metersPerCell || 1.5);
    if (area.forma === 'raio_no_ponto' && alcanceM > 0 && Math.hypot(ponto.x - origem.x, ponto.y - origem.y) / pxM > alcanceM + 0.05) {
      return { ok: false, reason: 'Centro da área fora de alcance.' };
    }
    selecaoValidada = { ponto: { x: ponto.x, y: ponto.y }, rotacao };
    const ancorado = area.forma !== 'raio_no_ponto';
    const template: MapTemplate = {
      id: 'omni-selecao', kind, x: ancorado ? origem.x : ponto.x, y: ancorado ? origem.y : ponto.y,
      rotation: rotacao, length: area.tamanho_m * pxM, width: (area.largura_m ?? 1.5) * pxM,
      color: '#ff5577', opacity: 1,
    };
    ids = [...new Set(findEntitiesInTemplate(template, Object.fromEntries(Object.entries(ms.entities).filter(([, e]) => ms.layerVisible[e.layer ?? 'tokens'] !== false))).map(id => ms.entities[id].characterId).filter((id): id is string => !!id))];
    ids = ids.filter(id => {
      const a = useCharacterStore.getState().characters.find(c => c.id === id);
      return a && aceitaAlvoAtivo(u!, a, cfg);
    });
    if (!ids.length) return { ok: false, reason: 'Nenhum alvo válido dentro da área.' };
  }
  const chars = useCharacterStore.getState().characters;
  for (const id of ids) {
    const a = chars.find(c => c.id === id);
    if (!a) return { ok: false, reason: 'Alvo não encontrado.' };
    if (!aceitaAlvoAtivo(u, a, cfg)) return { ok: false, reason: `${a.name} não atende ao filtro de alvos.` };
    if (!cfg.tipo_alvo && a.id === u.id) return { ok: false, reason: 'O alvo deve ser outra criatura.' };
    if (tipo !== 'area' && tipo !== 'proprio' && alcanceM > 0) {
      const ms = useMapStore.getState();
      const distancia = medicao === 'borda'
        ? distanciaBordaEntreFichas(u, a, ms.entities, ms.layerVisible, ms.gridConfig)
        : distanciaCircularEntreFichas(u, a, ms.entities, ms.layerVisible, ms.gridConfig);
      if (distancia === null) return { ok: false, reason: 'Usuário e alvo precisam estar no mapa para medir o alcance.' };
      if (distancia > alcanceM + 0.05) return { ok: false, reason: `${a.name} está fora de alcance.` };
    }
  }
  return { ok: true, ids, ...(selecaoValidada ? { selecaoValidada } : {}) };
}
