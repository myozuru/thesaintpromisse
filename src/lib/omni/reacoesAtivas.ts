import { create } from 'zustand';
import type { AcaoAtivaConfig, EntidadeOmni, GatilhoReacaoAtiva } from './tipos';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { findCharEntity, touchDistanceMeters } from '@/lib/touchRange';
import { aceitaAlvoAtivo } from './alvosAtivos';
import { useReactionStore } from '@/stores/useReactionStore';
import { planejarCustosAtivos, validarRecursosAtivos } from './custosAtivos';

export interface EventoReacaoAtiva {
  gatilho: GatilhoReacaoAtiva;
  origemId: string;
  protegidoId?: string;
  movimento?: { de: { x: number; y: number }; para: { x: number; y: number } };
}
export interface ResultadoJanelaAtiva { cancelado: boolean; defesaBonus: number }
export interface OfertaReacaoAtiva { id: string; usuarioId: string; nomeUsuario: string; instanceId: string; cfg: AcaoAtivaConfig; ent: EntidadeOmni; alvoId: string }
interface Janela { id: string; evento: EventoReacaoAtiva; ofertas: OfertaReacaoAtiva[]; resultado: ResultadoJanelaAtiva; busy: boolean; erro?: string }
interface Estado { janelas: Janela[] }
export const useReacoesAtivasStore = create<Estado>(() => ({ janelas: [] }));
const resolvers = new Map<string, (r: ResultadoJanelaAtiva) => void>();
const vazio = (): ResultadoJanelaAtiva => ({ cancelado: false, defesaBonus: 0 });

function elegivel(oferta: OfertaReacaoAtiva, evento: EventoReacaoAtiva): boolean {
  const chars = useCharacterStore.getState().characters;
  const u = chars.find(c => c.id === oferta.usuarioId), origem = chars.find(c => c.id === evento.origemId);
  const r = oferta.cfg.reacao;
  if (!u || !origem || !r || u.id === origem.id || (u.hpCurrent ?? 1) <= 0 || !aceitaAlvoAtivo(u, origem, { ...oferta.cfg, filtro_alvo: 'inimigos' })) return false;
  const protegido = chars.find(c => c.id === evento.protegidoId);
  if (evento.protegidoId) {
    if (!protegido || (r.protegido === 'usuario' && protegido.id !== u.id) || (r.protegido === 'aliados' && !aceitaAlvoAtivo(u, protegido, { ...oferta.cfg, filtro_alvo: 'aliados' }))) return false;
  }
  const ms = useMapStore.getState(), ut = findCharEntity(ms.entities, u.id), ot = findCharEntity(ms.entities, origem.id);
  if (!ut || !ot || !Number.isFinite(r.alcance_m) || r.alcance_m <= 0) return false;
  if (evento.movimento) {
    const antes = touchDistanceMeters(ut, { ...ot, ...evento.movimento.de }, ms.gridConfig);
    const depois = touchDistanceMeters(ut, { ...ot, ...evento.movimento.para }, ms.gridConfig);
    if (evento.gatilho === 'quando_inimigo_entrar_alcance' ? !(antes > r.alcance_m + 0.05 && depois <= r.alcance_m + 0.05) : !(antes <= r.alcance_m + 0.05 && depois > r.alcance_m + 0.05)) return false;
    if (evento.gatilho === 'quando_inimigo_sair_alcance' && (origem.desengajado || origem.desengajadoDe?.includes(u.id))) return false;
  } else {
    // Defesa/interceptação mede alcance até o protegido; demais gatilhos até a origem.
    const centro = evento.protegidoId ? findCharEntity(ms.entities, evento.protegidoId) : ot;
    if (!centro || touchDistanceMeters(ut, centro, ms.gridConfig) > r.alcance_m + 0.05) return false;
  }
  const custos = planejarCustosAtivos(oferta.cfg, u);
  return custos.ok && validarRecursosAtivos(u, custos.plano).ok && (custos.plano.acao !== 'reacao' || useReactionStore.getState().hasReactionAvailable(u.id));
}

export function ofertasReacaoAtiva(evento: EventoReacaoAtiva): OfertaReacaoAtiva[] {
  const ofertas: OfertaReacaoAtiva[] = [];
  for (const item of Object.values(useInventoryStore.getState().items)) {
    for (const cfg of item.entity.acoesAtivas ?? []) {
      if (cfg.reacao?.gatilho !== evento.gatilho) continue;
      // Seleção determinística evita abrir um segundo seletor durante a interrupção.
      if (cfg.tipo_alvo === 'multiplo' || cfg.tipo_alvo === 'area') continue;
      const alvoId = cfg.reacao.alvo === 'usuario' ? item.ownerId : cfg.reacao.alvo === 'protegido' ? evento.protegidoId : evento.origemId;
      const u = useCharacterStore.getState().characters.find(c => c.id === item.ownerId);
      if (!u || !alvoId) continue;
      const oferta = { id: `${item.instanceId}:${cfg.id}`, usuarioId: u.id, nomeUsuario: u.name, instanceId: item.instanceId, cfg, ent: item.entity, alvoId };
      if (elegivel(oferta, evento)) ofertas.push(oferta);
    }
  }
  return ofertas;
}

export function abrirJanelaReacaoAtiva(evento: EventoReacaoAtiva): Promise<ResultadoJanelaAtiva> {
  const ofertas = ofertasReacaoAtiva(evento);
  if (!ofertas.length) return Promise.resolve(vazio());
  const id = crypto.randomUUID();
  return new Promise(resolve => {
    resolvers.set(id, resolve);
    useReacoesAtivasStore.setState(s => ({ janelas: [...s.janelas, { id, evento, ofertas, resultado: vazio(), busy: false }] }));
  });
}
function fechar(id: string, resultado: ResultadoJanelaAtiva) {
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.filter(j => j.id !== id) }));
  const resolve = resolvers.get(id); resolvers.delete(id); resolve?.(resultado);
}
export async function responderReacaoAtiva(id: string, ofertaId?: string): Promise<void> {
  const j = useReacoesAtivasStore.getState().janelas.find(x => x.id === id);
  if (!j || j.busy) return;
  if (!ofertaId) { fechar(id, j.resultado); return; }
  const oferta = j.ofertas.find(o => o.id === ofertaId);
  if (!oferta) return;
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === id ? { ...x, busy: true, erro: undefined } : x) }));
  let erro: string | undefined;
  const resultado = { ...j.resultado };
  try {
    const item = useInventoryStore.getState().items[oferta.instanceId];
    const atual = item?.entity.acoesAtivas?.find(a => a.id === oferta.cfg.id);
    if (!item || item.ownerId !== oferta.usuarioId || JSON.stringify(atual) !== JSON.stringify(oferta.cfg) || !elegivel(oferta, j.evento)) throw new Error('Reação indisponível: ficha, alcance, recursos ou configuração mudaram.');
    const { executarAcaoAtiva } = await import('./acaoAtiva');
    const cfg = { ...oferta.cfg, tipo_alvo: oferta.alvoId === oferta.usuarioId ? 'proprio' as const : 'unico' as const, ...(j.evento.movimento ? { alcanceM: 0 } : {}) };
    const r = await executarAcaoAtiva(oferta.usuarioId, cfg, oferta.alvoId, oferta.ent, { ignorarReacoes: true });
    if (!r.ok) throw new Error(r.reason);
    const tipoAcao = oferta.cfg.custo_recursos?.tipo_acao ?? oferta.cfg.acao;
    if (tipoAcao === 'reacao' || tipoAcao === 'sustentada' && oferta.cfg.acao === 'reacao') useReactionStore.getState().consumeReaction(oferta.usuarioId);
    if (r.efeitoAplicado) {
      resultado.defesaBonus += oferta.cfg.reacao?.defesa_bonus ?? 0;
      resultado.cancelado ||= !!oferta.cfg.reacao?.cancelar_evento;
    }
    useLogStore.getState().addLog('combat', `↪ ${oferta.nomeUsuario} reagiu com ${oferta.cfg.nome}${resultado.cancelado ? ' e interrompeu o evento' : ''}.`);
  } catch (e) { erro = e instanceof Error ? e.message : 'Falha ao resolver reação.'; }
  const restantes = j.ofertas.filter(o => o.id !== oferta.id && elegivel(o, j.evento));
  if (resultado.cancelado || (!restantes.length && !erro)) { fechar(id, resultado); return; }
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === id ? { ...x, ofertas: restantes, resultado, busy: false, erro } : x) }));
}

/** Encerramento de combate cancela as resoluções ainda aguardando escolha. */
export function cancelarJanelasReacoesAtivas(): void {
  for (const j of useReacoesAtivasStore.getState().janelas) fechar(j.id, { cancelado: true, defesaBonus: 0 });
}
