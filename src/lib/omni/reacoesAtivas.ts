import { DESTINATARIO_MESTRE, destinatarioReacao, podeResponderReacao } from './destinatarioReacao';
import { resolverTokenDaFicha } from '@/lib/mapa/tokenDaFicha';
import { exemplarEstaEmpunhado } from './exemplarArma';
import { create } from 'zustand';
import type { AcaoAtivaConfig, EntidadeOmni, GatilhoReacaoAtiva } from './tipos';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { touchDistanceMeters } from '@/lib/touchRange';
import { aceitaAlvoAtivo } from './alvosAtivos';
import { useReactionStore } from '@/stores/useReactionStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { planejarCustosAtivos, validarRecursosAtivos } from './custosAtivos';
import { armaDoPersonagem, armaEstaEmpunhada } from './armaDoPersonagem';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { replicaWeaponName } from '@/lib/replicas';
import { segmentoCruzaAlcance } from './geometriaReacao';
import { comReacaoEmCurso, reacaoEmCurso } from './reacaoEmCurso';

export interface EventoReacaoAtiva {
  gatilho: GatilhoReacaoAtiva;
  origemId: string;
  protegidoId?: string;
  /** Dano efetivo (gatilhos de dano). */
  dano?: number;
  movimento?: { de: { x: number; y: number }; para: { x: number; y: number }; /** Amostras intermediárias do trajeto, na ordem do movimento. */ trajetoria?: { x: number; y: number }[] };
}
export interface ResultadoJanelaAtiva { cancelado: boolean; defesaBonus: number; testeBonus: number }
export interface OfertaReacaoAtiva { id: string; usuarioId: string; nomeUsuario: string; instanceId: string; cfg: AcaoAtivaConfig; ent: EntidadeOmni; alvoId: string }
interface Janela { id: string; evento: EventoReacaoAtiva; ofertas: OfertaReacaoAtiva[]; destinatarios: string[]; pendentes: string[]; resultado: ResultadoJanelaAtiva; busy: boolean; expiresAt: number; erro?: string }
export interface OfertaRemotaReacao {
  janelaId: string;
  clienteOrigem: string;
  perfilId: string;
  ofertas: OfertaReacaoAtiva[];
  evento: EventoReacaoAtiva;
  expiresAt: number;
  erro?: string;
  busy?: boolean;
}
interface Estado {
  janelas: Janela[];
  ofertasRemotas: OfertaRemotaReacao[];
  receberOfertaRemota: (oferta: OfertaRemotaReacao) => void;
  fecharOfertaRemota: (janelaId: string) => void;
  marcarOfertaRemotaBusy: (janelaId: string, busy: boolean, erro?: string) => void;
}
export const useReacoesAtivasStore = create<Estado>((set) => ({
  janelas: [], ofertasRemotas: [],
  receberOfertaRemota: (oferta) => {
    set(s => ({ ofertasRemotas: [...s.ofertasRemotas.filter(x => x.janelaId !== oferta.janelaId), { ...oferta, busy: false }] }));
    useCombatStore.getState().pauseTurnTimerForReaction(`omni-active-ui:${oferta.janelaId}`);
    scheduleRemoteExpiry(oferta.janelaId, oferta.expiresAt);
  },
  fecharOfertaRemota: (janelaId) => {
    clearTimeout(remoteExpirations.get(janelaId)); remoteExpirations.delete(janelaId);
    useCombatStore.getState().resumeTurnTimerForReaction(`omni-active-ui:${janelaId}`);
    set(s => ({ ofertasRemotas: s.ofertasRemotas.filter(x => x.janelaId !== janelaId) }));
  },
  marcarOfertaRemotaBusy: (janelaId, busy, erro) => set(s => ({ ofertasRemotas: s.ofertasRemotas.map(x => x.janelaId === janelaId ? { ...x, busy, erro } : x) })),
}));
const resolvers = new Map<string, (r: ResultadoJanelaAtiva) => void>();
const sondagens = new Map<string, ReturnType<typeof setTimeout>>();
const janelaExpirations = new Map<string, ReturnType<typeof setTimeout>>();
const remoteExpirations = new Map<string, ReturnType<typeof setTimeout>>();
export const PRAZO_SONDAGEM_REACAO_MS = 12000;
export const PRAZO_ESCOLHA_REACAO_MS = 12000;
const PRAZO_RESOLUCAO_REACAO_MANUAL_MS = PRAZO_ESCOLHA_REACAO_MS;
function scheduleRemoteExpiry(janelaId: string, expiresAt: number) {
  clearTimeout(remoteExpirations.get(janelaId));
  remoteExpirations.set(janelaId, setTimeout(() => {
    useReacoesAtivasStore.getState().fecharOfertaRemota(janelaId);
  }, Math.max(0, expiresAt - Date.now())));
}
function limparSondagem(janelaId: string, perfilId: string) {
  const key = `${janelaId}:${perfilId}`;
  clearTimeout(sondagens.get(key)); sondagens.delete(key);
}
const vazio = (): ResultadoJanelaAtiva => ({ cancelado: false, defesaBonus: 0, testeBonus: 0 });

function destinatariosReacoes(): string[] {
  // Sem canal multiplayer não há sessão remota capaz de confirmar a sondagem.
  if (typeof window === 'undefined' || !(window as unknown as { __worldBus?: { send?: unknown } }).__worldBus?.send) return [];
  return [...new Set(useCharacterStore.getState().characters.map(destinatarioReacao))]
    .filter(id => !podeResponderReacao(id));
}
function publicarParaPerfis(tipo: 'sondar' | 'fechar', janelaId: string, evento: EventoReacaoAtiva, destinatarios: string[], expiresAt?: number) {
  if (typeof window === 'undefined') return;
  for (const perfilId of destinatarios) {
    if (podeResponderReacao(perfilId)) continue;
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo, janelaId, evento, perfilId, expiresAt } }));
  }
}

export async function responderOfertaRemota(janelaId: string, ofertaId?: string, perfilId?: string, clienteOrigem?: string) {
  const remoto = useReacoesAtivasStore.getState().ofertasRemotas.find(x => x.janelaId === janelaId);
  if (!remoto || remoto.busy || !perfilId || !clienteOrigem || typeof window === 'undefined') return;
  if (!ofertaId) {
    const tipo = podeResponderReacao(perfilId) ? 'passar' : 'indisponivel';
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo, janelaId, perfilId, clienteOrigem } }));
    useReacoesAtivasStore.getState().fecharOfertaRemota(janelaId);
    return;
  }
  const oferta = remoto.ofertas.find(o => o.id === ofertaId);
  if (!oferta) return;
  if (!podeResponderReacao(perfilId)) {
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'indisponivel', janelaId, perfilId, clienteOrigem } }));
    useReacoesAtivasStore.getState().fecharOfertaRemota(janelaId);
    return;
  }
  useReacoesAtivasStore.getState().marcarOfertaRemotaBusy(janelaId, true);
  try {
    const item = useInventoryStore.getState().items[oferta.instanceId];
    const entAtual = item && (useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity);
    const atual = entAtual?.acoesAtivas?.find(a => a.id === oferta.cfg.id);
    if (!item || item.ownerId !== oferta.usuarioId || JSON.stringify(atual) !== JSON.stringify(oferta.cfg) || !elegivel(oferta, remoto.evento)) throw new Error('Reação indisponível: ficha, alcance, recursos ou configuração mudaram.');
    const { executarAcaoAtiva } = await import('./acaoAtiva');
    const cfg = { ...oferta.cfg, tipo_alvo: oferta.alvoId === oferta.usuarioId ? 'proprio' as const : 'unico' as const, ...(remoto.evento.movimento ? { alcanceM: 0 } : {}) };
    const r = await comReacaoEmCurso(() => executarAcaoAtiva(oferta.usuarioId, cfg, oferta.alvoId, oferta.ent, { ignorarReacoes: true, instanciaId: oferta.instanceId }));
    if (!r.ok) throw new Error(r.reason);
    // executarAcaoAtiva já debita a reação no mesmo patch dos outros custos.
    const resultado = { cancelado: !!r.efeitoAplicado && !!oferta.cfg.reacao?.cancelar_evento, defesaBonus: r.efeitoAplicado ? oferta.cfg.reacao?.defesa_bonus ?? 0 : 0, testeBonus: r.efeitoAplicado ? oferta.cfg.reacao?.bonus_teste ?? 0 : 0 };
    useLogStore.getState().addLog('combat', `↪ ${oferta.nomeUsuario} reagiu com ${oferta.cfg.nome}${resultado.cancelado ? ' e interrompeu o evento' : ''}.`);
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'resultado', janelaId, perfilId, clienteOrigem, resultado } }));
    useReacoesAtivasStore.getState().fecharOfertaRemota(janelaId);
  } catch (e) {
    useReacoesAtivasStore.getState().marcarOfertaRemotaBusy(janelaId, false, e instanceof Error ? e.message : 'Falha ao resolver reação.');
  }
}

function elegivel(oferta: OfertaReacaoAtiva, evento: EventoReacaoAtiva): boolean {
  const chars = useCharacterStore.getState().characters;
  const u = chars.find(c => c.id === oferta.usuarioId), origem = chars.find(c => c.id === evento.origemId);
  const item = useInventoryStore.getState().items[oferta.instanceId];
  const ent = item && (useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity);
  if (!item || item.ownerId !== oferta.usuarioId || !ent || JSON.stringify(ent) !== JSON.stringify(oferta.ent)) return false;
  if (ent.categoria === 'arma') {
    const nome = ent.replica ? item.replicaArma : ent.nome;
    if (!u || !nome || !exemplarEstaEmpunhado(u, item) || (ent.replica && !item.materializada)) return false;
  }
  const r = oferta.cfg.reacao;
  if (!u || !origem || !r || u.id === origem.id || (u.hpCurrent ?? 1) <= 0 || !aceitaAlvoAtivo(u, origem, { ...oferta.cfg, filtro_alvo: 'inimigos' })) return false;
  if (r.dano_minimo && (evento.dano ?? 0) < r.dano_minimo) return false;
  const protegido = chars.find(c => c.id === evento.protegidoId);
  if (evento.protegidoId) {
    if (!protegido || (r.protegido === 'usuario' && protegido.id !== u.id) || (r.protegido === 'aliados' && !aceitaAlvoAtivo(u, protegido, { ...oferta.cfg, filtro_alvo: 'aliados' }))) return false;
  }
  const ms = useMapStore.getState(), ut = resolverTokenDaFicha(u, ms.entities, ms.layerVisible), ot = resolverTokenDaFicha(origem, ms.entities, ms.layerVisible);
  if (!ut || !ot || !Number.isFinite(r.alcance_m) || r.alcance_m <= 0) return false;
  if (evento.movimento) {
    const caminho = [evento.movimento.de, ...(evento.movimento.trajetoria ?? []), evento.movimento.para];
    const inicioDentro = touchDistanceMeters(ut, { ...ot, ...caminho[0] }, ms.gridConfig) <= r.alcance_m + 0.05;
    const pontosDentro = caminho.map(p => touchDistanceMeters(ut, { ...ot, ...p }, ms.gridConfig) <= r.alcance_m + 0.05);
    const cruzou = caminho.slice(0, -1).some((p, i) => segmentoCruzaAlcance(p, caminho[i + 1], ut, ot, ms.gridConfig, r.alcance_m));
    if (evento.gatilho === 'quando_inimigo_entrar_alcance' ? (inicioDentro || !cruzou) : (!inicioDentro || pontosDentro.every(Boolean))) return false;
    if (evento.gatilho === 'quando_inimigo_sair_alcance' && (origem.desengajado || origem.desengajadoDe?.includes(u.id))) return false;
  } else {
    // Defesa/interceptação mede alcance até o protegido; demais gatilhos até a origem.
    const centro = protegido ? resolverTokenDaFicha(protegido, ms.entities, ms.layerVisible) : ot;
    if (!centro || touchDistanceMeters(ut, centro, ms.gridConfig) > r.alcance_m + 0.05) return false;
  }
  const nomeArma = replicaWeaponName(oferta.ent) || (oferta.ent.categoria === 'arma' ? oferta.ent.nome : u.mainHandWeaponName) || undefined;
  const armaInstanciaId = oferta.ent.categoria === 'arma' ? oferta.instanceId : u.mainHandWeaponInstanceId ?? undefined;
  const arma = nomeArma ? armaDoPersonagem(u.id, nomeArma, armaInstanciaId) : undefined;
  const custos = planejarCustosAtivos(oferta.cfg, u, 0, { armaNome: arma?.name, armaInstanciaId, instanciaId: oferta.instanceId, entidadeId: oferta.ent.id });
  return custos.ok && validarRecursosAtivos(u, custos.plano).ok && (custos.plano.acao !== 'reacao' || useReactionStore.getState().hasReactionAvailable(u.id));
}

export function ofertasReacaoAtiva(evento: EventoReacaoAtiva): OfertaReacaoAtiva[] {
  const ofertas: OfertaReacaoAtiva[] = [];
  for (const item of Object.values(useInventoryStore.getState().items)) {
    const ent = useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity;
    for (const cfg of ent.acoesAtivas ?? []) {
      if (cfg.reacao?.gatilho !== evento.gatilho) continue;
      // Seleção determinística evita abrir um segundo seletor durante a interrupção.
      if (cfg.tipo_alvo === 'multiplo' || cfg.tipo_alvo === 'area') continue;
      const alvoId = cfg.reacao.alvo === 'usuario' ? item.ownerId : cfg.reacao.alvo === 'protegido' ? evento.protegidoId : evento.origemId;
      const u = useCharacterStore.getState().characters.find(c => c.id === item.ownerId);
      if (!u || !alvoId) continue;
      const oferta = { id: `${item.instanceId}:${cfg.id}`, usuarioId: u.id, nomeUsuario: u.name, instanceId: item.instanceId, cfg, ent, alvoId };
      if (elegivel(oferta, evento)) ofertas.push(oferta);
    }
  }
  return ofertas;
}

export function abrirJanelaReacaoAtiva(evento: EventoReacaoAtiva): Promise<ResultadoJanelaAtiva> {
  // Efeitos de uma reação (dano, TR...) não abrem novas reações.
  if (reacaoEmCurso()) return Promise.resolve(vazio());
  const ofertas = ofertasReacaoAtiva(evento).filter(o => podeVerOfertaReacao(o, useProfileStore.getState().activeProfileId));
  const destinatarios = destinatariosReacoes();
  if (!ofertas.length && !destinatarios.length) return Promise.resolve(vazio());
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + PRAZO_ESCOLHA_REACAO_MS;
  return new Promise(resolve => {
    resolvers.set(id, resolve);
    useCombatStore.getState().pauseTurnTimerForReaction(`omni-active:${id}`);
    janelaExpirations.set(id, setTimeout(() => {
      const atual = useReacoesAtivasStore.getState().janelas.find(x => x.id === id);
      if (atual) {
        useLogStore.getState().addLog('combat', 'Reação: prazo de 12 segundos expirou; continuando sem reação.');
        fechar(id, atual.resultado);
      }
    }, Math.max(0, expiresAt - Date.now())));
    useReacoesAtivasStore.setState(s => ({ janelas: [...s.janelas, { id, evento, ofertas, destinatarios, pendentes: [...destinatarios], resultado: vazio(), busy: false, expiresAt }] }));
    for (const perfilId of destinatarios) {
      const key = `${id}:${perfilId}`;
      sondagens.set(key, setTimeout(() => {
        sondagens.delete(key);
        useLogStore.getState().addLog('combat', 'Reação: prazo de 12 segundos expirou; continuando sem essa reação.');
        publicarParaPerfis('fechar', id, evento, [perfilId]);
        passarOfertaRemota(id, perfilId);
      }, PRAZO_SONDAGEM_REACAO_MS));
    }
    publicarParaPerfis('sondar', id, evento, destinatarios, expiresAt);
  });
}

/** Ao escolher um feitiço de reação, mantém a interrupção enquanto a ficha o resolve. */
export function declararReacaoManual(janelaId: string, remoto?: { perfilId: string; clienteOrigem: string }): boolean {
  const limite = Date.now() + PRAZO_RESOLUCAO_REACAO_MANUAL_MS;
  if (remoto) {
    const oferta = useReacoesAtivasStore.getState().ofertasRemotas.find(x => x.janelaId === janelaId);
    if (!oferta || oferta.busy || Date.now() > oferta.expiresAt || !podeResponderReacao(remoto.perfilId)) return false;
    clearTimeout(remoteExpirations.get(janelaId));
    remoteExpirations.delete(janelaId);
    useReacoesAtivasStore.setState(s => ({ ofertasRemotas: s.ofertasRemotas.map(x => x.janelaId === janelaId ? { ...x, busy: true, expiresAt: limite } : x) }));
    scheduleRemoteExpiry(janelaId, limite);
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'processando', janelaId, perfilId: remoto.perfilId, clienteOrigem: remoto.clienteOrigem } }));
    return true;
  }
  const janela = useReacoesAtivasStore.getState().janelas.find(x => x.id === janelaId);
  if (!janela || janela.busy || Date.now() > janela.expiresAt) return false;
  clearTimeout(janelaExpirations.get(janelaId));
  janelaExpirations.set(janelaId, setTimeout(() => {
    const atual = useReacoesAtivasStore.getState().janelas.find(x => x.id === janelaId);
    if (atual) fechar(janelaId, atual.resultado);
  }, PRAZO_RESOLUCAO_REACAO_MANUAL_MS));
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === janelaId ? { ...x, busy: true, expiresAt: limite } : x) }));
  return true;
}

export function concluirReacaoManual(janelaId: string, remoto?: { perfilId: string; clienteOrigem: string }): void {
  if (remoto) {
    const oferta = useReacoesAtivasStore.getState().ofertasRemotas.find(x => x.janelaId === janelaId);
    if (!oferta) return;
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'passar', janelaId, perfilId: remoto.perfilId, clienteOrigem: remoto.clienteOrigem } }));
    useReacoesAtivasStore.getState().fecharOfertaRemota(janelaId);
    return;
  }
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === janelaId ? { ...x, busy: false } : x) }));
  void responderReacaoAtiva(janelaId);
}
function fechar(id: string, resultado: ResultadoJanelaAtiva) {
  clearTimeout(janelaExpirations.get(id)); janelaExpirations.delete(id);
  useCombatStore.getState().resumeTurnTimerForReaction(`omni-active:${id}`);
  const j = useReacoesAtivasStore.getState().janelas.find(x => x.id === id);
  if (j) for (const perfilId of j.destinatarios) limparSondagem(id, perfilId);
  if (j) publicarParaPerfis('fechar', id, j.evento, j.destinatarios);
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.filter(j => j.id !== id) }));
  const resolve = resolvers.get(id); resolvers.delete(id); resolve?.(resultado);
}
export async function responderReacaoAtiva(id: string, ofertaId?: string): Promise<void> {
  const j = useReacoesAtivasStore.getState().janelas.find(x => x.id === id);
  if (!j || j.busy) return;
  if (!ofertaId) {
    if (!j.pendentes.length) { fechar(id, j.resultado); return; }
    useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === id ? { ...x, ofertas: [] } : x) }));
    return;
  }
  const oferta = j.ofertas.find(o => o.id === ofertaId);
  if (!oferta) return;
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === id ? { ...x, busy: true, erro: undefined } : x) }));
  let erro: string | undefined;
  const resultado = { ...j.resultado };
  try {
    const item = useInventoryStore.getState().items[oferta.instanceId];
    const entAtual = item && (useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity);
    const atual = entAtual?.acoesAtivas?.find(a => a.id === oferta.cfg.id);
    if (!item || item.ownerId !== oferta.usuarioId || JSON.stringify(atual) !== JSON.stringify(oferta.cfg) || !elegivel(oferta, j.evento)) throw new Error('Reação indisponível: ficha, alcance, recursos ou configuração mudaram.');
    const { executarAcaoAtiva } = await import('./acaoAtiva');
    const cfg = { ...oferta.cfg, tipo_alvo: oferta.alvoId === oferta.usuarioId ? 'proprio' as const : 'unico' as const, ...(j.evento.movimento ? { alcanceM: 0 } : {}) };
    const r = await comReacaoEmCurso(() => executarAcaoAtiva(oferta.usuarioId, cfg, oferta.alvoId, oferta.ent, { ignorarReacoes: true, instanciaId: oferta.instanceId }));
    if (!r.ok) throw new Error(r.reason);
    // executarAcaoAtiva já debita a reação no mesmo patch dos outros custos.
    if (r.efeitoAplicado) {
      resultado.defesaBonus += oferta.cfg.reacao?.defesa_bonus ?? 0;
      resultado.testeBonus += oferta.cfg.reacao?.bonus_teste ?? 0;
      resultado.cancelado ||= !!oferta.cfg.reacao?.cancelar_evento;
    }
    useLogStore.getState().addLog('combat', `↪ ${oferta.nomeUsuario} reagiu com ${oferta.cfg.nome}${resultado.cancelado ? ' e interrompeu o evento' : ''}.`);
  } catch (e) { erro = e instanceof Error ? e.message : 'Falha ao resolver reação.'; }
  const atualJanela = useReacoesAtivasStore.getState().janelas.find(x => x.id === id);
  if (!atualJanela) return;
  resultado.defesaBonus += atualJanela.resultado.defesaBonus - j.resultado.defesaBonus;
  resultado.testeBonus += (atualJanela.resultado.testeBonus ?? 0) - (j.resultado.testeBonus ?? 0);
  resultado.cancelado ||= atualJanela.resultado.cancelado;
  const restantes = atualJanela.ofertas.filter(o => o.id !== oferta.id && elegivel(o, j.evento));
  if (resultado.cancelado || (!restantes.length && !erro && !atualJanela.pendentes.length)) { fechar(id, resultado); return; }
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === id ? { ...x, ofertas: restantes, resultado, busy: false, erro } : x) }));
}

/** O jogador pode passar a própria oferta sem encerrar as reações dos demais. */
export function passarOfertaRemota(janelaId: string, perfilId: string) {
  const j = useReacoesAtivasStore.getState().janelas.find(x => x.id === janelaId);
  if (!j) return;
  limparSondagem(janelaId, perfilId);
  const pendentes = j.pendentes.filter(x => x !== perfilId);
  const ofertas = j.ofertas.filter(o => destinatarioDaOferta(o) !== perfilId);
  if (!ofertas.length && !pendentes.length) { fechar(janelaId, j.resultado); return; }
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === janelaId ? { ...x, ofertas, pendentes } : x) }));
}

/** Respostas remotas só são aceitas para perfil e cliente de origem correspondentes. */
export async function receberRespostaRemota(msg: { tipo: 'resultado' | 'passar' | 'indisponivel' | 'disponivel' | 'processando'; janelaId: string; perfilId: string; clienteOrigem: string; resultado?: ResultadoJanelaAtiva }, clienteLocal: string) {
  if (msg.clienteOrigem !== clienteLocal || !msg.perfilId) return;
  const j = useReacoesAtivasStore.getState().janelas.find(x => x.id === msg.janelaId);
  if (!j || !j.pendentes.includes(msg.perfilId)) return;
  limparSondagem(msg.janelaId, msg.perfilId);
  if (msg.tipo === 'processando') {
    if (j.busy) return;
    const expiresAt = Date.now() + PRAZO_RESOLUCAO_REACAO_MANUAL_MS;
    clearTimeout(janelaExpirations.get(j.id));
    janelaExpirations.set(j.id, setTimeout(() => {
      const atual = useReacoesAtivasStore.getState().janelas.find(x => x.id === j.id);
      if (atual) fechar(j.id, atual.resultado);
    }, PRAZO_RESOLUCAO_REACAO_MANUAL_MS));
    useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === j.id ? { ...x, busy: true, expiresAt } : x) }));
    return;
  }
  if (msg.tipo === 'disponivel') return;
  const resultado = msg.tipo === 'resultado' ? { cancelado: j.resultado.cancelado || !!msg.resultado?.cancelado, defesaBonus: j.resultado.defesaBonus + (msg.resultado?.defesaBonus ?? 0), testeBonus: (j.resultado.testeBonus ?? 0) + (msg.resultado?.testeBonus ?? 0) } : j.resultado;
  if (resultado.cancelado) { fechar(j.id, resultado); return; }
  const pendentes = j.pendentes.filter(x => x !== msg.perfilId);
  if (!pendentes.length && !j.ofertas.length) { fechar(j.id, resultado); return; }
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === j.id ? { ...x, pendentes, resultado, busy: false } : x) }));
}

/** Executa a sondagem na sessão do perfil: o inventário pessoal não é replicado entre navegadores. */
export function receberSondagemRemota(msg: { janelaId: string; perfilId: string; clienteOrigem: string; evento: EventoReacaoAtiva; expiresAt?: number }) {
  if (!podeResponderReacao(msg.perfilId)) return;
  const ofertas = ofertasReacaoAtiva(msg.evento).filter(o => destinatarioDaOferta(o) === msg.perfilId);
  const fichasMestre = useCharacterStore.getState().characters.filter(c => c.category !== 'PLAYER');
  const temReacaoManual = msg.perfilId === DESTINATARIO_MESTRE
    && fichasMestre.some(ficha => (ficha.spells ?? []).some(spell => spell.actionType === 'reaction'));
  if (!ofertas.length && !temReacaoManual) {
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'indisponivel', janelaId: msg.janelaId, perfilId: msg.perfilId, clienteOrigem: msg.clienteOrigem } }));
    return;
  }
  window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'disponivel', janelaId: msg.janelaId, perfilId: msg.perfilId, clienteOrigem: msg.clienteOrigem } }));
  useReacoesAtivasStore.getState().receberOfertaRemota({ ...msg, expiresAt: msg.expiresAt ?? Date.now() + PRAZO_ESCOLHA_REACAO_MS, ofertas, evento: msg.evento });
}

function destinatarioDaOferta(oferta: OfertaReacaoAtiva): string | undefined {
  const c = useCharacterStore.getState().characters.find(c => c.id === oferta.usuarioId);
  return c && destinatarioReacao(c);
}
export function podeVerOfertaReacao(oferta: OfertaReacaoAtiva, _perfilId: string | null): boolean {
  const d = destinatarioDaOferta(oferta);
  return !!d && podeResponderReacao(d);
}
/** Escape explícito para quem iniciou a ação quando uma sessão remota não responde. */
export function continuarSemReacoesPendentes(id: string): void {
  const j = useReacoesAtivasStore.getState().janelas.find(x => x.id === id);
  if (j && !j.busy) fechar(id, j.resultado);
}

/** Encerramento de combate cancela as resoluções ainda aguardando escolha. */
export function cancelarJanelasReacoesAtivas(): void {
  for (const j of useReacoesAtivasStore.getState().janelas) fechar(j.id, { cancelado: true, defesaBonus: 0 , testeBonus: 0 });
}
