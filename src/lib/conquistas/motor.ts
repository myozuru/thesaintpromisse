/** Motor de conquistas: desbloqueio, entrega automática de recompensas e gatilhos. */
import { useConquistaStore, listarConquistas, desbloqueioAtivo } from '@/stores/useConquistaStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useOmniCatalogStore } from '@/stores/useOmniCatalogStore';
import { useLogStore } from '@/stores/useLogStore';
import { RARIDADE_INFO, type GatilhoConquista, type RecompensaConquista } from './tipos';

export function entregarRecompensas(charId: string, recompensas: RecompensaConquista[], motivo: string): string[] {
  const char = useCharacterStore.getState().characters.find((c) => c.id === charId);
  if (!char) return [];
  const feitas: string[] = [];
  for (const r of recompensas) {
    if (r.tipo === 'dinheiro' && r.valor > 0) {
      const money = useMoneyStore.getState();
      const wallet = money.ensurePersonalWallet(char.id, char.name);
      const cur = money.currencies.find((c) => c.id === r.currencyId) ?? money.currencies[0];
      if (!cur) continue;
      money.masterGrant(wallet, cur.id, r.valor, motivo);
      feitas.push(`${cur.symbol} ${r.valor}`);
    } else if (r.tipo === 'item') {
      let ok = 0;
      for (let i = 0; i < Math.max(1, r.quantidade); i++) if (useOmniCatalogStore.getState().entregarParaJogador(r.entidadeId, charId)) ok++;
      const nome = useOmniCatalogStore.getState().obter(r.entidadeId)?.nome ?? 'item';
      if (ok) feitas.push(`${ok}× ${nome}`);
    } else if (r.tipo === 'titulo' && r.texto.trim()) {
      feitas.push(`Título "${r.texto}"`);
    } else if (r.tipo === 'texto' && r.texto.trim()) {
      feitas.push(r.texto);
    } else if (r.tipo === 'recuperar_pe' && r.valor > 0) {
      const cs = useCharacterStore.getState();
      const c = cs.characters.find((x) => x.id === charId);
      if (!c) continue;
      const novo = Math.min(c.peMax, (c.peCurrent ?? 0) + r.valor);
      cs.updateCharacter(charId, { peCurrent: novo });
      feitas.push(`⚡ +${novo - (c.peCurrent ?? 0)} PE`);
    } else if (r.tipo === 'recuperar_vida' && r.valor > 0) {
      useCharacterStore.getState().applyHealing(charId, r.valor, 'other');
      feitas.push(`💚 +${r.valor} vida`);
    } else if (r.tipo === 'pvt' && r.valor > 0) {
      useCharacterStore.getState().applyShield(charId, r.valor);
      feitas.push(`🛡️ +${r.valor} PVT`);
    } else if (r.tipo === 'reduzir_exaustao' && r.niveis > 0) {
      const antes = useCharacterStore.getState().characters.find((x) => x.id === charId)?.exhaustionLevel ?? 0;
      if (antes <= 0) continue;
      useCharacterStore.getState().bumpExhaustion(charId, -r.niveis);
      feitas.push(`✨ -${Math.min(antes, r.niveis)} Exaustão`);
    }
  }
  return feitas;
}

/** Desbloqueia (idempotente). Retorna true se foi um desbloqueio novo. */
export function desbloquearConquista(charId: string, conquistaId: string, opts: { relato?: string; por?: 'auto' | 'mestre' } = {}): boolean {
  const st = useConquistaStore.getState();
  if (desbloqueioAtivo(st, charId, conquistaId)) return false;
  const def = listarConquistas(st.defs).find((c) => c.id === conquistaId);
  const char = useCharacterStore.getState().characters.find((c) => c.id === charId);
  if (!def || !char) return false;
  const entregues = entregarRecompensas(charId, def.recompensas, `Conquista: ${def.titulo}`);
  st.registrar({ charId, conquistaId, em: Date.now(), relato: opts.relato, concedidaPor: opts.por ?? 'auto', recompensasEntregues: true, updatedAt: Date.now() });
  const extra = entregues.length ? ` Recompensas: ${entregues.join(', ')}.` : '';
  useLogStore.getState().addLog('system', `🏆 ${char.name} desbloqueou "${def.titulo}" (${RARIDADE_INFO[def.raridade].nome}).${extra}`);
  return true;
}

/** Dispara um gatilho automático para fichas de jogador. */
export function dispararGatilhoConquista(gatilho: GatilhoConquista, charIds: string[]) {
  if (gatilho === 'manual') return;
  const chars = useCharacterStore.getState().characters;
  const defs = listarConquistas(useConquistaStore.getState().defs).filter((c) => c.gatilho === gatilho);
  for (const id of charIds) {
    const c = chars.find((x) => x.id === id);
    if (!c || c.category !== 'PLAYER') continue;
    for (const def of defs) desbloquearConquista(id, def.id, { por: 'auto' });
  }
}
