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

export const agoraMundo = () => toTimelineSeconds(useChronosStore.getState());

export function aceitarQuest(questId: string, charId: string) {
  const st = useQuestStore.getState(), q = st.quests[questId];
  if (!q || q.deletedAt) throw new Error('Quest não encontrada.');
  if (questExpirou(q.prazoFim, agoraMundo())) throw new Error('O prazo desta quest já acabou.');
  if (q.status !== 'disponivel' && q.status !== 'aceita') throw new Error('Esta quest não está mais disponível.');
  if (q.aceitaPor.includes(charId)) return;
  st.atualizarQuest(questId, { status: 'aceita', aceitaPor: [...q.aceitaPor, charId] });
  const nome = useCharacterStore.getState().characters.find((c) => c.id === charId)?.name ?? 'Alguém';
  useLogStore.getState().addLog('system', `📜 ${nome} aceitou a quest "${q.titulo}".`);
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
  const moeda = money.currencies.find((c) => c.id === q.recompensa.currencyId);
  useLogStore.getState().addLog('system', `🏆 Quest "${q.titulo}" concluída! ${q.recompensa.valor > 0 ? `${moeda?.symbol ?? ''}${q.recompensa.valor} divididos entre ${ids.length} jogador(es).` : ''}${q.recompensa.itens.length ? ` ${q.recompensa.itens.length} item(ns) caíram no chão${dono ? ` perto de ${dono.name}` : ''}.` : ''}`);
}

export function falharQuest(questId: string) {
  exigirMestre();
  const q = useQuestStore.getState().quests[questId];
  if (!q) return;
  useQuestStore.getState().atualizarQuest(questId, { status: 'falhou' });
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
      continue;
    }
    if (q.status === 'aceita' && !q.revelacaoAplicada && q.alvo.tipo === 'boss' && q.alvo.bossId) {
      const bs = useBossStore.getState(), boss = bs.bosses[q.alvo.bossId];
      if (boss) bs.update(boss.id, { revelado: { ...boss.revelado, ...Object.fromEntries(q.revelarBoss.map((f) => [f, true])) } });
      st.atualizarQuest(q.id, { revelacaoAplicada: true });
    }
  }
}
