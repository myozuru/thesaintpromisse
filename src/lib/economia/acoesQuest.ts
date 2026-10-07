/** Ações com efeito na mesa: aceitar, concluir (pagamento + drop), falhar, expirar. */
import { useQuestStore, type Quest } from '@/stores/useQuestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useBossStore } from '@/stores/useBossStore';
import { tokenDaFicha } from '@/stores/useAlvoMapaStore';
import { useMapStore } from '@/stores/useMapStore';
import { invocarItemNoChao } from '@/lib/omni/itensNoChao';
import { toTimelineSeconds } from '@/lib/omni/tempo';
import { dividirRecompensa, questExpirou } from './quests';
import { registrarEvento } from './linhaTempo';

export const agoraMundo = () => toTimelineSeconds(useChronosStore.getState());

/** Aceita sozinho (um id) ou em grupo (vários ids escolhidos por quem aceita). */
export function aceitarQuest(questId: string, charIds: string | string[]) {
  const st = useQuestStore.getState(), q = st.quests[questId];
  if (!q || q.deletedAt) throw new Error('Quest não encontrada.');
  if (questExpirou(q.prazoFim, agoraMundo())) throw new Error('O prazo desta quest já acabou.');
  if (q.status !== 'disponivel' && q.status !== 'aceita') throw new Error('Esta quest não está mais disponível.');
  const novos = [...new Set(Array.isArray(charIds) ? charIds : [charIds])].filter((id) => !q.aceitaPor.includes(id));
  if (!novos.length) return;
  const primeira = q.aceitaPor.length === 0;
  st.atualizarQuest(questId, { status: 'aceita', aceitaPor: [...q.aceitaPor, ...novos] });
  const chars = useCharacterStore.getState().characters;
  const nomes = novos.map((id) => chars.find((c) => c.id === id)?.name ?? 'Alguém').join(', ');
  const grupo = novos.length > 1;
  useLogStore.getState().addLog('system', `📜 ${nomes} ${grupo ? 'aceitaram em grupo' : 'aceitou'} a quest "${q.titulo}".`);
  if (primeira) registrarEvento('quest', `Quest aceita: ${q.mascarada && !q.revelada ? 'Contrato misterioso' : q.titulo}`, `por ${nomes}`);
}

function exigirMestre() {
  if (useRoleStore.getState().role !== 'MASTER') throw new Error('Apenas o Mestre pode fazer isso.');
}

/** Paga em partes iguais e solta os itens no chão ao lado do primeiro participante com peça no mapa. */
export function concluirQuest(questId: string, participantes?: string[]) {
  exigirMestre();
  const st = useQuestStore.getState(), q = st.quests[questId];
  if (!q) throw new Error('Quest não encontrada.');
  if (q.status === 'concluida') throw new Error('Esta quest já foi concluída.');
  const chars = useCharacterStore.getState().characters;
  const ids = (participantes ?? q.aceitaPor).filter((id) => chars.some((c) => c.id === id));
  if (!ids.length) throw new Error('Nenhum jogador participante.');
  // Marca primeiro para impedir pagamento duplo em cliques repetidos.
  st.atualizarQuest(questId, { status: 'concluida' });
  const money = useMoneyStore.getState();
  const partes = dividirRecompensa(q.recompensa.valor, ids);
  for (const [cid, valor] of Object.entries(partes)) {
    const c = chars.find((x) => x.id === cid)!;
    if (valor > 0) money.masterGrant(money.ensurePersonalWallet(c.id, c.name), q.recompensa.currencyId, valor, `Recompensa de quest: ${q.titulo}`);
  }
  const dono = ids.map((id) => chars.find((c) => c.id === id)!).find((c) => tokenDaFicha(c));
  const token = dono ? tokenDaFicha(dono) : null;
  const dpi = useMapStore.getState().gridConfig.dpi || 70;
  q.recompensa.itens.forEach((eid, i) => {
    try { invocarItemNoChao(eid, token ? { x: token.x + dpi * (0.7 + i * 0.45), y: token.y + dpi * 0.7 } : undefined); } catch { /* item removido do catálogo */ }
  });
  const rep = q.repRecompensa ?? 0;
  if (q.faccaoId && rep) st.ajustarRep(q.faccaoId, rep, ids, true);
  registrarEvento('quest', `Quest concluída: ${q.titulo}`, ids.map((id) => chars.find((c) => c.id === id)!.name).join(', '));
  const moeda = money.currencies.find((c) => c.id === q.recompensa.currencyId);
  useLogStore.getState().addLog('system', `🏆 Quest "${q.titulo}" concluída! ${q.recompensa.valor > 0 ? `${moeda?.symbol ?? ''}${q.recompensa.valor} divididos entre ${ids.length} jogador(es).` : ''}${q.recompensa.itens.length ? ` ${q.recompensa.itens.length} item(ns) caíram no chão${dono ? ` perto de ${dono.name}` : ''}.` : ''}`);
}

export function falharQuest(questId: string) {
  exigirMestre();
  const q = useQuestStore.getState().quests[questId];
  if (!q) return;
  useQuestStore.getState().atualizarQuest(questId, { status: 'falhou' });
  const rep = q.repRecompensa ?? 0;
  if (q.faccaoId && rep > 0) useQuestStore.getState().ajustarRep(q.faccaoId, -Math.ceil(rep / 2), q.aceitaPor, true);
  registrarEvento('quest', `Quest falhou: ${q.titulo}`);
  useLogStore.getState().addLog('system', `✖ Quest "${q.titulo}" falhou.`);
}

/** Mestre: expira quests vencidas e aplica a revelação do chefe para quests aceitas. */
export function processarQuestsMestre(agora = agoraMundo()) {
  if (useRoleStore.getState().role !== 'MASTER') return;
  const st = useQuestStore.getState();
  for (const q of Object.values(st.quests) as Quest[]) {
    if (q.deletedAt) continue;
    if ((q.status === 'disponivel' || q.status === 'aceita') && questExpirou(q.prazoFim, agora)) {
      st.atualizarQuest(q.id, { status: 'expirada' });
      useLogStore.getState().addLog('system', `⌛ O prazo da quest "${q.titulo}" acabou.`);
      if (q.aceitaPor.length) registrarEvento('quest', `Prazo esgotado: ${q.titulo}`);
      continue;
    }
    if (q.status === 'aceita' && !q.revelacaoAplicada && q.alvo.tipo === 'boss' && q.alvo.bossId) {
      // Revela a ficha com os campos que o Mestre já deixou visíveis no próprio chefe.
      const bs = useBossStore.getState(), boss = bs.bosses[q.alvo.bossId];
      if (boss && !boss.visivel) bs.update(boss.id, { visivel: true });
      st.atualizarQuest(q.id, { revelacaoAplicada: true });
    }
  }
}
