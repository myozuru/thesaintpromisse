/**
 * PORTAS DA MORTE (só fichas PLAYER) + Ferimentos Complexos + Suporte nv4 "No Último Segundo".
 * Regras puras no topo; integração com stores logo abaixo (imports dinâmicos evitam ciclos).
 */
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';

export const ULTIMO_SEGUNDO_ID = 'sup-no-ultimo-segundo';
export const ULTIMO_SEGUNDO_MOV_M = 4.5;
export const ULTIMO_SEGUNDO_DEF_AO = 5;

export interface PortasMorte { sucessos: number; falhas: number; ultimaRodada?: number }

// ───────────────────────── Regras puras ─────────────────────────
export function resultadoTesteMorte(d20: number): { sucessos: number; falhas: number } {
  if (d20 <= 1) return { sucessos: 0, falhas: 2 };
  if (d20 <= 9) return { sucessos: 0, falhas: 1 };
  if (d20 <= 19) return { sucessos: 1, falhas: 0 };
  return { sucessos: 2, falhas: 0 };
}
export const usaPortas = (c: Pick<Character, 'category'>) => c.category === 'PLAYER';
export const estaMorto = (c: Pick<Character, 'activeConditions'>) => (c.activeConditions ?? []).some((a) => a.conditionId === 'morto');
export const naPorta = (c: Pick<Character, 'category' | 'hpCurrent' | 'activeConditions'>) => usaPortas(c) && !estaMorto(c) && (c.hpCurrent ?? 1) <= 0;
/** CD de Medicina: 15 +1 a cada 5 PV negativos. */
export const cdEstabilizar = (hp: number) => 15 + Math.floor(Math.max(0, -hp) / 5);
/** Morte massiva: chegou a 0 e o negativo passou do PV máximo. */
export const morteMassiva = (hp: number, hpMax: number) => hp < 0 && -hp > hpMax;
/** Ferimento Complexo: dano num único ataque ≥ metade do PV máximo, mínimo 50. */
export const limiarFerimento = (hpMax: number) => Math.max(50, Math.ceil(hpMax / 2));

export const FERIMENTOS: Record<number, { nome: string; efeito: string }> = {
  1: { nome: 'Perde um olho', efeito: 'Desvantagem em Percepção e ataques à distância.' },
  2: { nome: 'Perde um olho', efeito: 'Desvantagem em Percepção e ataques à distância.' },
  3: { nome: 'Perde ambos os olhos', efeito: 'Cego permanentemente até regenerar os olhos.' },
  4: { nome: 'Perde uma perna', efeito: 'Metade do movimento total; desvantagem em Acrobacia.' },
  5: { nome: 'Perde uma perna', efeito: 'Metade do movimento total; desvantagem em Acrobacia.' },
  6: { nome: 'Perde ambas as pernas', efeito: 'Não se move normalmente; só rasteja.' },
  7: { nome: 'Ferida interna', efeito: 'Ao tentar agir em combate: TR Fortitude CD 20 + nível; falha perde a ação e reações até o próximo turno. Tratada (mestre em Medicina, ação comum) → CD 10.' },
  8: { nome: 'Perde um braço', efeito: 'Não segura com duas mãos; 1 objeto por vez; desvantagem em Atletismo.' },
  9: { nome: 'Perde um braço', efeito: 'Não segura com duas mãos; 1 objeto por vez; desvantagem em Atletismo.' },
  10: { nome: 'Perde ambos os braços', efeito: 'Incapaz de segurar objetos; Destreza −4.' },
};
/** Movimento depois dos ferimentos de perna (rastejar = metade). */
export function fatorMovimentoFerimentos(c: Pick<Character, 'ferimentosComplexos'>): number {
  const fs = (c.ferimentosComplexos ?? []).map((f) => f.resultado);
  if (fs.includes(6) || fs.includes(4) || fs.includes(5)) return 0.5;
  return 1;
}

// ───────────────────────── Integração ─────────────────────────
const log = (m: string) => { try { useLogStore.getState().addLog('combat', m); } catch { /* noop */ } };
const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id);
const upd = (id: string, p: Partial<Character>) => useCharacterStore.getState().updateCharacter(id, p);

const cond = (id: string, conditionId: string, name: string, icon: string) =>
  useCharacterStore.getState().addCondition(id, { id: crypto.randomUUID(), conditionId, name, icon, remainingTurns: -1, remainingRounds: -1, sourceEntityId: 'portas-da-morte' } as never);
const tirarInconsciente = (c: Character): Partial<Character> => ({ activeConditions: (c.activeConditions ?? []).filter((a) => !(a.conditionId === 'inconsciente' && a.sourceEntityId === 'portas-da-morte')) });

function morrer(c: Character, motivo: string) {
  upd(c.id, { portasMorte: undefined, ...tirarInconsciente(c) });
  cond(c.id, 'morto', 'Morto', '☠');
  log(`💀 ${c.name} morreu (${motivo}).`);
}

/** Chamado depois de cada dano aplicado. */
export function aposDano(id: string, hpAntes: number, danoFinal: number) {
  const c = get(id);
  if (!c || !usaPortas(c) || estaMorto(c) || danoFinal <= 0) return;
  if (morteMassiva(c.hpCurrent ?? 0, c.hpMax ?? 0)) return morrer(c, 'dano massivo — sem Portas da Morte');
  if (danoFinal >= limiarFerimento(c.hpMax ?? 0)) {
    upd(c.id, { ferimentoPendente: danoFinal });
    log(`🦴 ${c.name} sofreu ${danoFinal} de dano de uma vez: Ferimento Complexo (o Mestre sorteia ou escolhe).`);
  }
  const hp = c.hpCurrent ?? 0;
  if (hp > 0) return;
  if (morteMassiva(hp, c.hpMax ?? 0)) return morrer(c, 'dano massivo — sem Portas da Morte');
  const pm = c.portasMorte ?? { sucessos: 0, falhas: c.falhasMorte ?? 0 };
  if (hpAntes > 0) {
    upd(c.id, { portasMorte: { sucessos: 0, falhas: pm.falhas } });
    cond(c.id, 'inconsciente', 'Inconsciente', '😵');
    log(`🚪 ${c.name} caiu nas Portas da Morte (${pm.falhas} falha(s) acumulada(s)).`);
    if (pm.falhas >= 3) morrer(c, '3 falhas');
    return;
  }
  const falhas = pm.falhas + 1;
  upd(c.id, { portasMorte: { ...pm, falhas }, falhasMorte: falhas });
  log(`🩸 ${c.name} sofreu dano nas Portas da Morte: +1 falha (${falhas}/3).`);
  if (falhas >= 3) morrer(c, '3 falhas');
}

export function estabilizar(id: string, como: string) {
  const c = get(id);
  if (!c || estaMorto(c) || !c.portasMorte) return;
  upd(id, { hpCurrent: Math.max(1, c.hpCurrent ?? 0), portasMorte: undefined, falhasMorte: c.portasMorte.falhas, ...tirarInconsciente(c) });
  log(`💚 ${c.name} foi estabilizado (${como}) e volta com ${Math.max(1, c.hpCurrent ?? 0)} PV.`);
}

/** Cura que leva a vida de volta a 0 ou mais estabiliza. */
export function aposCura(id: string) {
  const c = get(id);
  if (c?.portasMorte && (c.hpCurrent ?? 0) >= 0) estabilizar(id, 'cura');
}

/** Teste de morte (d20) no começo do turno. */
export function registrarTesteMorte(id: string, d20: number, rodada: number) {
  const c = get(id);
  if (!c || !c.portasMorte || estaMorto(c)) return;
  const r = resultadoTesteMorte(d20);
  const pm = { sucessos: c.portasMorte.sucessos + r.sucessos, falhas: c.portasMorte.falhas + r.falhas, ultimaRodada: rodada };
  upd(id, { portasMorte: pm, falhasMorte: pm.falhas });
  log(`🎲 ${c.name} — Teste de Morte: d20 ${d20} → ${r.sucessos ? `+${r.sucessos} sucesso(s)` : `+${r.falhas} falha(s)`} (✅ ${pm.sucessos}/3 · ❌ ${pm.falhas}/3).`);
  if (pm.falhas >= 3) return morrer(get(id)!, '3 falhas');
  if (pm.sucessos >= 3) estabilizar(id, '3 sucessos');
}

/** Descanso longo zera as falhas acumuladas. */
export const limparFalhasDescanso = (id: string) => upd(id, { falhasMorte: 0 });

/** Remove falhas por outra fonte (ex.: habilidades de Suporte). */
export function removerFalhas(id: string, qtd: number) {
  const c = get(id); if (!c) return;
  const f = Math.max(0, (c.portasMorte?.falhas ?? c.falhasMorte ?? 0) - qtd);
  upd(id, { falhasMorte: f, ...(c.portasMorte ? { portasMorte: { ...c.portasMorte, falhas: f } } : {}) });
}

// ── Ferimentos Complexos ──
export function aplicarFerimento(id: string, resultado: number) {
  const c = get(id); const f = FERIMENTOS[resultado]; if (!c || !f) return;
  const patch: Partial<Character> = {
    ferimentoPendente: undefined,
    ferimentosComplexos: [...(c.ferimentosComplexos ?? []), { id: crypto.randomUUID(), resultado, nome: f.nome, desde: Date.now() }],
  };
  if (resultado === 10) patch.attributes = c.attributes.map((a) => a.name === 'Destreza' ? { ...a, value: a.value - 4 } : a);
  upd(id, patch);
  if (resultado === 3) useCharacterStore.getState().addCondition(id, { id: crypto.randomUUID(), conditionId: 'cego', name: 'Cego', icon: '🙈', remainingTurns: -1, remainingRounds: -1, sourceEntityId: 'ferimento-complexo' } as never);
  log(`🦴 ${c.name} — Ferimento Complexo (${resultado}): ${f.nome}. ${f.efeito}`);
}
export function curarFerimento(id: string, ferimentoId: string) {
  const c = get(id); const f = c?.ferimentosComplexos?.find((x) => x.id === ferimentoId); if (!c || !f) return;
  const patch: Partial<Character> = { ferimentosComplexos: c.ferimentosComplexos!.filter((x) => x.id !== ferimentoId) };
  if (f.resultado === 10) patch.attributes = c.attributes.map((a) => a.name === 'Destreza' ? { ...a, value: a.value + 4 } : a);
  if (f.resultado === 3) patch.activeConditions = (c.activeConditions ?? []).filter((a) => !(a.conditionId === 'cego' && a.sourceEntityId === 'ferimento-complexo'));
  upd(id, patch);
  log(`✨ ${c.name}: ferimento curado (${f.nome}).`);
}

// ── No Último Segundo ──
export interface EntradaIni { charId: string; total: number }
/**
 * Início de rodada: quem tem a habilidade e algum aliado PLAYER com 2 falhas nas Portas ganha +5
 * na iniciativa atual. Se, por causa disso, passa a agir antes de um aliado nas Portas, recebe o
 * benefício da rodada. Retorna a nova ordem (estável) e quem recebeu o benefício.
 */
export function aplicarUltimoSegundo<T extends EntradaIni>(ordem: T[], chars: Character[]): { ordem: T[]; beneficiados: string[]; impulsionados: string[] } {
  const byId = new Map(chars.map((c) => [c.id, c]));
  const naPortaCom2 = (id: string) => { const c = byId.get(id); return !!c && naPorta(c) && (c.portasMorte?.falhas ?? 0) === 2; };
  const portadores = ordem.filter((e) => {
    const c = byId.get(e.charId);
    return !!c && !estaMorto(c) && (c.hpCurrent ?? 1) > 0 && (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === ULTIMO_SEGUNDO_ID)
      && ordem.some((o) => o.charId !== e.charId && naPortaCom2(o.charId));
  }).map((e) => e.charId);
  if (!portadores.length) return { ordem, beneficiados: [], impulsionados: [] };
  const antes = ordem.map((e) => e.charId);
  const nova = ordem.map((e, i) => ({ e: portadores.includes(e.charId) ? { ...e, total: e.total + 5 } : e, i }))
    .sort((a, b) => b.e.total - a.e.total || a.i - b.i).map((x) => x.e);
  const depois = nova.map((e) => e.charId);
  const morrendo = antes.filter((id) => { const c = byId.get(id); return !!c && naPorta(c); });
  const beneficiados = portadores.filter((p) => morrendo.some((m) => antes.indexOf(p) > antes.indexOf(m) && depois.indexOf(p) < depois.indexOf(m)));
  return { ordem: nova, beneficiados, impulsionados: portadores };
}
