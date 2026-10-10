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
import { resolverAcaoOmniInvocacao } from '@/lib/controlador/omni';
import { podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';
import { categoriaEconomiaDaAcao, podeUsarAcaoDaInstancia } from '@/lib/controlador/economiaAcoes';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';

export interface EventoReacaoAtiva {
  gatilho: GatilhoReacaoAtiva;
  origemId: string;
  protegidoId?: string;
  /** Dano efetivo (gatilhos de dano). */
  dano?: number;
  movimento?: { de: { x: number; y: number }; para: { x: number; y: number }; /** Amostras intermediárias do trajeto, na ordem do movimento. */ trajetoria?: { x: number; y: number }[] };
}
export interface ResultadoJanelaAtiva { cancelado: boolean; defesaBonus: number; testeBonus: number }
export interface OfertaReacaoItem { fonte?: 'item'; id: string; usuarioId: string; nomeUsuario: string; instanceId: string; cfg: AcaoAtivaConfig; ent: EntidadeOmni; alvoId: string }
export interface OfertaReacaoInvocacao {
  fonte: 'invocacao';
  id: string;
  usuarioId: string;
  nomeUsuario: string;
  invocacaoId: string;
  instanciaId: string;
  tokenId: string;
  acaoId: string;
  acaoNome: string;
  acaoSnapshot: InvocacaoControlador['acoes'][number];
  modeloVersao?: number;
  config: AcaoAtivaConfig;
  alvoId: string;
  alvoNome: string;
}
export type OfertaReacaoAtiva = OfertaReacaoItem | OfertaReacaoInvocacao;
interface Janela { id: string; evento: EventoReacaoAtiva; ofertas: OfertaReacaoAtiva[]; destinatarios: string[]; pendentes: string[]; resultado: ResultadoJanelaAtiva; busy: boolean; expiresAt?: number; erro?: string }
export interface OfertaRemotaReacao {
  janelaId: string;
  clienteOrigem: string;
  perfilId: string;
  ofertas: OfertaReacaoAtiva[];
  evento: EventoReacaoAtiva;
  expiresAt?: number;
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
function scheduleRemoteExpiry(janelaId: string, expiresAt?: number) {
  clearTimeout(remoteExpirations.get(janelaId));
  remoteExpirations.delete(janelaId);
  if (expiresAt === undefined) return;
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
  window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'processando', janelaId, perfilId, clienteOrigem, ofertaId } }));
  try {
    if (oferta.fonte === 'invocacao') {
      const resultado = await executarOfertaReacao(oferta, remoto.evento, 'reacao-remota:' + janelaId + ':' + oferta.id);
      window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'resultado', janelaId, perfilId, clienteOrigem, ofertaId, resultado } }));
      useReacoesAtivasStore.getState().fecharOfertaRemota(janelaId);
      return;
    }
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
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'resultado', janelaId, perfilId, clienteOrigem, ofertaId, resultado } }));
    useReacoesAtivasStore.getState().fecharOfertaRemota(janelaId);
  } catch (e) {
    useReacoesAtivasStore.getState().marcarOfertaRemotaBusy(janelaId, false, e instanceof Error ? e.message : 'Falha ao resolver reação.');
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'indisponivel', janelaId, perfilId, clienteOrigem } }));
  }
}

function elegivel(oferta: OfertaReacaoItem, evento: EventoReacaoAtiva): boolean {
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

export function ofertasReacaoAtiva(evento: EventoReacaoAtiva): OfertaReacaoItem[] {
  const ofertas: OfertaReacaoItem[] = [];
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

function idOfertaInvocacao(janelaId: string | undefined, instanciaId: string, acaoId: string, alvoId: string): string {
  return janelaId
    ? `invocacao:${janelaId}:${encodeURIComponent(instanciaId)}:${encodeURIComponent(acaoId)}:${encodeURIComponent(alvoId)}`
    : crypto.randomUUID();
}

function reacoesInvocacaoElegiveis(evento: EventoReacaoAtiva, janelaId?: string): OfertaReacaoInvocacao[] {
  const personagens = useCharacterStore.getState().characters;
  const mapa = useMapStore.getState();
  const entidades = useOmniEntidadesStore.getState().entidades;
  const ofertas: OfertaReacaoInvocacao[] = [];
  for (const dono of personagens) {
    for (const token of Object.values(mapa.entities)) {
      if (token.ownerCharId !== dono.id || !token.invocationId || token.hidden ||
        mapa.layerVisible[token.layer ?? 'tokens'] === false || (token.hp ?? 0) <= 0) continue;
      const modelo = dono.invocacoesConhecidas?.find(item => item.id === token.invocationId);
      const instancia = dono.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId && item.modeloId === token.invocationId);
      if (!modelo || !instancia || instancia.estado !== 'ativa' ||
        !podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo ?? modelo.version, versaoAprovada: modelo.versaoAprovada })) continue;
      for (const reacao of modelo.reacoes ?? []) {
        if (!reacao.acaoId) continue;
        const acao = modelo.acoes.find(item => item.id === reacao.acaoId);
        if (!acao || acao.categoriaAcao !== 'reacao' || (acao.tipoExecucao !== 'omni' && acao.tipoExecucao !== 'referencia_omni')) continue;
        const resolvida = resolverAcaoOmniInvocacao(acao, entidades, { permitirReacao: true });
        if (!resolvida.ok || !resolvida.config.reacao || resolvida.config.reacao.gatilho !== evento.gatilho) continue;
        const alvoId = resolvida.config.reacao.alvo === 'usuario'
          ? dono.id
          : resolvida.config.reacao.alvo === 'protegido' ? evento.protegidoId : evento.origemId;
        const alvo = personagens.find(item => item.id === alvoId);
        if (!alvo) continue;
        const oferta: OfertaReacaoInvocacao = {
          fonte: 'invocacao',
          id: idOfertaInvocacao(janelaId, instancia.id, acao.id, alvo.id),
          usuarioId: dono.id,
          nomeUsuario: modelo.apelido?.trim() || modelo.nome,
          invocacaoId: modelo.id,
          instanciaId: instancia.id,
          tokenId: token.id,
          acaoId: acao.id,
          acaoNome: acao.nome,
          acaoSnapshot: acao,
          modeloVersao: modelo.versaoModelo ?? modelo.version,
          config: resolvida.config,
          alvoId: alvo.id,
          alvoNome: alvo.name,
        };
        if (elegivelInvocacao(oferta, evento)) ofertas.push(oferta);
      }
    }
  }
  return ofertas;
}

function elegivelInvocacao(oferta: OfertaReacaoInvocacao, evento: EventoReacaoAtiva): boolean {
  const characters = useCharacterStore.getState().characters;
  const owner = characters.find(character => character.id === oferta.usuarioId);
  const model = owner?.invocacoesConhecidas?.find(item => item.id === oferta.invocacaoId);
  const mapState = useMapStore.getState();
  const token = mapState.entities[oferta.tokenId];
  const instance = owner?.instanciasInvocacao?.find(item => item.id === oferta.instanciaId && item.modeloId === oferta.invocacaoId);
  const action = model?.acoes.find(item => item.id === oferta.acaoId);
  const target = characters.find(character => character.id === oferta.alvoId);
  if (!owner || !model || !token || !instance || !action || !target ||
    token.ownerCharId !== owner.id || token.invocationId !== model.id ||
    token.invocationInstanceId !== instance.id || token.hidden ||
    mapState.layerVisible[token.layer ?? 'tokens'] === false || (token.hp ?? 0) <= 0 ||
    instance.estado !== 'ativa' || !model.reacoes?.some(reacao => reacao.acaoId === action.id) ||
    !podeUsarVersaoAprovada({ estado: model.aprovacaoMestre, versaoAtual: model.versaoModelo ?? model.version, versaoAprovada: model.versaoAprovada }) ||
    (oferta.modeloVersao !== undefined && oferta.modeloVersao !== (model.versaoModelo ?? model.version)) ||
    JSON.stringify(action) !== JSON.stringify(oferta.acaoSnapshot) ||
    action.categoriaAcao !== 'reacao' || (action.tipoExecucao !== 'omni' && action.tipoExecucao !== 'referencia_omni') ||
    !podeUsarAcaoDaInstancia(instance, action.id) ||
    categoriaEconomiaDaAcao(action, instance.economiaAcoes) !== 'reacao' ||
    !instance.economiaAcoes?.reacao || instance.economiaAcoes.reacao.atual < 1 ||
    target.id === owner.id) return false;

  const resolvida = resolverAcaoOmniInvocacao(action, useOmniEntidadesStore.getState().entidades, { permitirReacao: true });
  if (!resolvida.ok || !resolvida.config.reacao ||
    JSON.stringify(resolvida.config) !== JSON.stringify(oferta.config) ||
    resolvida.config.reacao.gatilho !== evento.gatilho) return false;
  if (evento.dano !== undefined && resolvida.config.reacao.dano_minimo && evento.dano < resolvida.config.reacao.dano_minimo) return false;
  if (evento.protegidoId) {
    const protegido = characters.find(character => character.id === evento.protegidoId);
    const filtro = resolvida.config.reacao.protegido;
    if (!protegido || (filtro === 'usuario' && protegido.id !== owner.id) ||
      (filtro === 'aliados' && !aceitaAlvoAtivo(owner, protegido, { ...resolvida.config, filtro_alvo: 'aliados' }))) return false;
  }
  if (!aceitaAlvoAtivo(owner, target, resolvida.config)) return false;
  const targetToken = resolverTokenDaFicha(target, mapState.entities, mapState.layerVisible);
  if (!targetToken) return false;
  const range = resolvida.config.reacao.alcance_m;
  const actionRange = resolvida.config.alcanceM;
  const distance = touchDistanceMeters(token, targetToken, mapState.gridConfig);
  if (!Number.isFinite(range) || range <= 0 || distance > range + 0.05 || distance > actionRange + 0.05) return false;
  if (evento.movimento) {
    const mover = characters.find(character => character.id === evento.origemId);
    const moverToken = mover && resolverTokenDaFicha(mover, mapState.entities, mapState.layerVisible);
    if (!moverToken) return false;
    const points = [evento.movimento.de, ...(evento.movimento.trajetoria ?? []), evento.movimento.para];
    const inicioDentro = touchDistanceMeters(token, { ...moverToken, ...points[0] }, mapState.gridConfig) <= range + 0.05;
    const pontosDentro = points.map(point => touchDistanceMeters(token, { ...moverToken, ...point }, mapState.gridConfig) <= range + 0.05);
    const cruzou = points.slice(0, -1).some((point, index) => segmentoCruzaAlcance(point, points[index + 1], token, moverToken, mapState.gridConfig, range));
    if (evento.gatilho === 'quando_inimigo_entrar_alcance' ? (inicioDentro || !cruzou) : (!inicioDentro || pontosDentro.every(Boolean))) return false;
    if (evento.gatilho === 'quando_inimigo_sair_alcance' && (mover.desengajado || mover.desengajadoDe?.includes(owner.id))) return false;
  }
  const custoPE = action.custoPE ?? 0;
  const custoConfigurado = model.custosComandosConfigurados?.[action.id];
  if (custoPE > 0 && !custoConfigurado) return false;
  if (custoConfigurado?.execucao === 'evento_automatico') return false;
  let peConfigurado = 0;
  for (const debito of custoConfigurado?.debitos ?? []) {
    if (!Number.isFinite(debito.quantidade) || debito.quantidade < 0) return false;
    if (debito.entidade === 'dono') {
      if (debito.recurso !== 'pe' || (owner.peCurrent ?? 0) < debito.quantidade) return false;
      peConfigurado += debito.quantidade;
    } else {
      if (!debito.recursoId || instance.recursosAtuais?.[debito.recursoId] === undefined ||
        instance.recursosAtuais[debito.recursoId] < debito.quantidade) return false;
      if (debito.recurso === 'pe') peConfigurado += debito.quantidade;
    }
  }
  if (Math.abs(peConfigurado - custoPE) > 1e-9) return false;
  return true;
}

async function executarOfertaReacao(oferta: OfertaReacaoAtiva, evento: EventoReacaoAtiva, requestId: string): Promise<ResultadoJanelaAtiva> {
  if (oferta.fonte === 'invocacao') {
    if (!elegivelInvocacao(oferta, evento)) throw new Error('Reação indisponível: ficha, aprovação, alcance, recursos ou configuração mudaram.');
    const { executarReacaoInvocacao } = await import('@/lib/controlador/mapa');
    const resultado = await comReacaoEmCurso(() => executarReacaoInvocacao(oferta.usuarioId, oferta.invocacaoId, oferta.acaoId, oferta.alvoId, {
      instanciaId: oferta.instanciaId,
      requestId,
      validarReacao: () => elegivelInvocacao(oferta, evento),
    }, evento.gatilho));
    if (!resultado.ok) throw new Error(resultado.motivo);
    const aplicou = resultado.acertou;
    const reacao = oferta.config.reacao!;
    const resultadoJanela = {
      cancelado: aplicou && !!reacao.cancelar_evento,
      defesaBonus: aplicou ? reacao.defesa_bonus ?? 0 : 0,
      testeBonus: aplicou ? reacao.bonus_teste ?? 0 : 0,
    };
    useLogStore.getState().addLog('combat', '↪ ' + oferta.nomeUsuario + ' reagiu com ' + oferta.acaoNome +
      (resultado.acertou ? ' e acertou ' + oferta.alvoNome : ' e errou contra ' + oferta.alvoNome) +
      (resultadoJanela.cancelado ? ', interrompendo o evento' : '') + '.');
    return resultadoJanela;
  }
  const item = useInventoryStore.getState().items[oferta.instanceId];
  const entAtual = item && (useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity);
  const atual = entAtual?.acoesAtivas?.find(a => a.id === oferta.cfg.id);
  if (!item || item.ownerId !== oferta.usuarioId || JSON.stringify(atual) !== JSON.stringify(oferta.cfg) || !elegivel(oferta, evento)) {
    throw new Error('Reação indisponível: ficha, alcance, recursos ou configuração mudaram.');
  }
  const { executarAcaoAtiva } = await import('./acaoAtiva');
  const cfg = { ...oferta.cfg, tipo_alvo: oferta.alvoId === oferta.usuarioId ? 'proprio' as const : 'unico' as const, ...(evento.movimento ? { alcanceM: 0 } : {}) };
  const r = await comReacaoEmCurso(() => executarAcaoAtiva(oferta.usuarioId, cfg, oferta.alvoId, oferta.ent, { ignorarReacoes: true, instanciaId: oferta.instanceId }));
  if (!r.ok) throw new Error(r.reason);
  const aplicado = { cancelado: !!r.efeitoAplicado && !!oferta.cfg.reacao?.cancelar_evento, defesaBonus: r.efeitoAplicado ? oferta.cfg.reacao?.defesa_bonus ?? 0 : 0, testeBonus: r.efeitoAplicado ? oferta.cfg.reacao?.bonus_teste ?? 0 : 0 };
  useLogStore.getState().addLog('combat', '↪ ' + oferta.nomeUsuario + ' reagiu com ' + oferta.cfg.nome + (aplicado.cancelado ? ' e interrompeu o evento' : '') + '.');
  return aplicado;
}

export function abrirJanelaReacaoAtiva(
  evento: EventoReacaoAtiva,
  opcoes: { incluirItens?: boolean; incluirInvocacoes?: boolean } = {},
): Promise<ResultadoJanelaAtiva> {
  // Efeitos de uma reação (dano, TR...) não abrem novas reações.
  if (reacaoEmCurso()) return Promise.resolve(vazio());
  const id = crypto.randomUUID();
  const todasOfertas = [
    ...(opcoes.incluirItens === false ? [] : ofertasReacaoAtiva(evento)),
    ...(opcoes.incluirInvocacoes === false ? [] : reacoesInvocacaoElegiveis(evento, id)),
  ];
  const ofertas = todasOfertas.filter(o => podeVerOfertaReacao(o, useProfileStore.getState().activeProfileId));
  const destinatarios = destinatariosReacoes();
  if (!ofertas.length && !destinatarios.length) return Promise.resolve(vazio());
  const temOfertaInvocacao = todasOfertas.some(oferta => oferta.fonte === 'invocacao');
  const expiresAt = temOfertaInvocacao ? undefined : Date.now() + PRAZO_ESCOLHA_REACAO_MS;
  return new Promise(resolve => {
    resolvers.set(id, resolve);
    useCombatStore.getState().pauseTurnTimerForReaction(`omni-active:${id}`);
    if (expiresAt !== undefined) {
      janelaExpirations.set(id, setTimeout(() => {
        const atual = useReacoesAtivasStore.getState().janelas.find(x => x.id === id);
        if (atual) {
          useLogStore.getState().addLog('combat', 'Reação: prazo de 12 segundos expirou; continuando sem reação.');
          fechar(id, atual.resultado);
        }
      }, Math.max(0, expiresAt - Date.now())));
    }
    useReacoesAtivasStore.setState(s => ({ janelas: [...s.janelas, { id, evento, ofertas, destinatarios, pendentes: [...destinatarios], resultado: vazio(), busy: false, expiresAt }] }));
    if (expiresAt !== undefined) for (const perfilId of destinatarios) {
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
    if (!oferta || oferta.busy || (oferta.expiresAt !== undefined && Date.now() > oferta.expiresAt) || !podeResponderReacao(remoto.perfilId)) return false;
    clearTimeout(remoteExpirations.get(janelaId));
    remoteExpirations.delete(janelaId);
    const limiteOpcional = oferta.expiresAt === undefined ? undefined : limite;
    useReacoesAtivasStore.setState(s => ({ ofertasRemotas: s.ofertasRemotas.map(x => x.janelaId === janelaId ? { ...x, busy: true, expiresAt: limiteOpcional } : x) }));
    scheduleRemoteExpiry(janelaId, limiteOpcional);
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'processando', janelaId, perfilId: remoto.perfilId, clienteOrigem: remoto.clienteOrigem } }));
    return true;
  }
  const janela = useReacoesAtivasStore.getState().janelas.find(x => x.id === janelaId);
  if (!janela || janela.busy || (janela.expiresAt !== undefined && Date.now() > janela.expiresAt)) return false;
  clearTimeout(janelaExpirations.get(janelaId));
  const limiteOpcional = janela.expiresAt === undefined ? undefined : limite;
  if (limiteOpcional !== undefined) {
    janelaExpirations.set(janelaId, setTimeout(() => {
      const atual = useReacoesAtivasStore.getState().janelas.find(x => x.id === janelaId);
      if (atual) fechar(janelaId, atual.resultado);
    }, PRAZO_RESOLUCAO_REACAO_MANUAL_MS));
  }
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === janelaId ? { ...x, busy: true, expiresAt: limiteOpcional } : x) }));
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
  if (oferta.fonte === 'invocacao' && podeResponderReacao(DESTINATARIO_MESTRE)) {
    const destinatario = destinatarioDaOferta(oferta);
    if (destinatario && destinatario !== DESTINATARIO_MESTRE && j.pendentes.includes(destinatario)) {
      limparSondagem(id, destinatario);
      publicarParaPerfis('fechar', id, j.evento, [destinatario]);
      useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === id
        ? { ...x, pendentes: x.pendentes.filter(perfilId => perfilId !== destinatario) }
        : x) }));
    }
  }
  let erro: string | undefined;
  const resultado = { ...j.resultado };
  try {
    if (oferta.fonte === 'invocacao') {
      const aplicado = await executarOfertaReacao(oferta, j.evento, 'reacao-local:' + id + ':' + oferta.id);
      resultado.defesaBonus += aplicado.defesaBonus;
      resultado.testeBonus += aplicado.testeBonus;
      resultado.cancelado ||= aplicado.cancelado;
    } else {
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
    }
  } catch (e) { erro = e instanceof Error ? e.message : 'Falha ao resolver reação.'; }
  const atualJanela = useReacoesAtivasStore.getState().janelas.find(x => x.id === id);
  if (!atualJanela) return;
  resultado.defesaBonus += atualJanela.resultado.defesaBonus - j.resultado.defesaBonus;
  resultado.testeBonus += (atualJanela.resultado.testeBonus ?? 0) - (j.resultado.testeBonus ?? 0);
  resultado.cancelado ||= atualJanela.resultado.cancelado;
  const restantes = atualJanela.ofertas.filter(o => o.id !== oferta.id && (o.fonte === 'invocacao' ? elegivelInvocacao(o, j.evento) : elegivel(o, j.evento)));
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
export async function receberRespostaRemota(msg: { tipo: 'resultado' | 'passar' | 'indisponivel' | 'disponivel' | 'processando'; janelaId: string; perfilId: string; clienteOrigem: string; ofertaId?: string; resultado?: ResultadoJanelaAtiva }, clienteLocal: string) {
  if (msg.clienteOrigem !== clienteLocal || !msg.perfilId) return;
  const j = useReacoesAtivasStore.getState().janelas.find(x => x.id === msg.janelaId);
  if (!j || !j.pendentes.includes(msg.perfilId)) return;
  limparSondagem(msg.janelaId, msg.perfilId);
  if (msg.tipo === 'processando') {
    if (j.busy) return;
    const expiresAt = j.expiresAt === undefined ? undefined : Date.now() + PRAZO_RESOLUCAO_REACAO_MANUAL_MS;
    clearTimeout(janelaExpirations.get(j.id));
    if (expiresAt !== undefined) {
      janelaExpirations.set(j.id, setTimeout(() => {
        const atual = useReacoesAtivasStore.getState().janelas.find(x => x.id === j.id);
        if (atual) fechar(j.id, atual.resultado);
      }, PRAZO_RESOLUCAO_REACAO_MANUAL_MS));
    }
    useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === j.id ? { ...x, busy: true, expiresAt } : x) }));
    return;
  }
  if (msg.tipo === 'disponivel') return;
  const resultado = msg.tipo === 'resultado' ? { cancelado: j.resultado.cancelado || !!msg.resultado?.cancelado, defesaBonus: j.resultado.defesaBonus + (msg.resultado?.defesaBonus ?? 0), testeBonus: (j.resultado.testeBonus ?? 0) + (msg.resultado?.testeBonus ?? 0) } : j.resultado;
  if (resultado.cancelado) { fechar(j.id, resultado); return; }
  const pendentes = j.pendentes.filter(x => x !== msg.perfilId);
  // Quando o próprio perfil resolveu uma oferta em sua sessão, retire a cópia
  // espelhada que o Mestre também podia ver para não permitir uso duplicado.
  const ofertas = msg.tipo === 'resultado' && msg.ofertaId
    ? j.ofertas.filter(oferta => oferta.id !== msg.ofertaId)
    : j.ofertas;
  if (!pendentes.length && !ofertas.length) { fechar(j.id, resultado); return; }
  useReacoesAtivasStore.setState(s => ({ janelas: s.janelas.map(x => x.id === j.id ? { ...x, ofertas, pendentes, resultado, busy: false } : x) }));
}

/** Executa a sondagem na sessão do perfil: o inventário pessoal não é replicado entre navegadores. */
export function receberSondagemRemota(msg: { janelaId: string; perfilId: string; clienteOrigem: string; evento: EventoReacaoAtiva; expiresAt?: number }) {
  if (!podeResponderReacao(msg.perfilId)) return;
  const ofertas = [
    ...ofertasReacaoAtiva(msg.evento),
    ...reacoesInvocacaoElegiveis(msg.evento, msg.janelaId),
  ].filter(o => destinatarioDaOferta(o) === msg.perfilId);
  const fichasMestre = useCharacterStore.getState().characters.filter(c => c.category !== 'PLAYER');
  const temReacaoManual = msg.perfilId === DESTINATARIO_MESTRE
    && fichasMestre.some(ficha => (ficha.spells ?? []).some(spell => spell.actionType === 'reaction'));
  if (!ofertas.length && !temReacaoManual) {
    window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'indisponivel', janelaId: msg.janelaId, perfilId: msg.perfilId, clienteOrigem: msg.clienteOrigem } }));
    return;
  }
  window.dispatchEvent(new CustomEvent('omni-reaction:send', { detail: { tipo: 'disponivel', janelaId: msg.janelaId, perfilId: msg.perfilId, clienteOrigem: msg.clienteOrigem } }));
  useReacoesAtivasStore.getState().receberOfertaRemota({ ...msg, ofertas, evento: msg.evento });
}

function destinatarioDaOferta(oferta: OfertaReacaoAtiva): string | undefined {
  const c = useCharacterStore.getState().characters.find(c => c.id === oferta.usuarioId);
  return c && destinatarioReacao(c);
}
export function podeVerOfertaReacao(oferta: OfertaReacaoAtiva, _perfilId: string | null): boolean {
  const d = destinatarioDaOferta(oferta);
  return !!d && (podeResponderReacao(d) || (oferta.fonte === 'invocacao' && podeResponderReacao(DESTINATARIO_MESTRE)));
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
