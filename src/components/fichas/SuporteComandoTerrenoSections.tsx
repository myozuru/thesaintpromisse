/**
 * Suporte Nv 2 (4º par): Comando Motivador, Desvendar Terreno e a janela do
 * Mestre para definir a CD do Desvendar.
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollD20Com } from '@/lib/dice';
import { consumeAdvantageFor, applyAdvantageToD20 } from '@/lib/omni/rollAdvantage';
import { getPercepcaoBonus, hasSpecAbility } from '@/lib/suporteNivel2';
import {
  COMANDO_ID, COMANDO_PE_COST, DESVENDAR_ID, cancelarDesvendar, canComandar, darComando,
  definirCDDesvendar, getComandoBonus, getDesvendarFase, pedirDesvendar, pendingDesvendar,
  resolverDesvendar,
} from '@/lib/suporteComandoTerreno';
import { Map as MapIcon, Megaphone, Eye } from 'lucide-react';
import {
  PRE_ANALISE_ATENCAO, PRE_ANALISE_ID, RECOMPENSA_ID, canEscolherAliadoPreAnalise, escolherAliadoPatch, getRecompensaBonus,
} from '@/lib/suportePreAnaliseRecompensa';

export function PreAnaliseSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const addLog = useLogStore((s) => s.addLog);
  const [targetId, setTargetId] = useState('');
  if (!hasSpecAbility(c, PRE_ANALISE_ID)) return null;
  const target = characters.find((x) => x.id === targetId);
  const ally = characters.find((x) => x.id === c.preAnaliseAllyId);
  const chk = canEscolherAliadoPreAnalise(c, target);
  const go = () => {
    if (!chk.ok || !target) return;
    updateCharacter(c.id, escolherAliadoPatch(target.id));
    addLog('combat', `👁 ${c.name} (Pré-Análise) protege ${target.name}: não pode ser surpreendido.`);
    setTargetId('');
  };
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Eye className="h-3.5 w-3.5 text-primary" /> Pré-Análise
        <span className="font-normal text-muted-foreground">Imune a Surpreso · Atenção +{PRE_ANALISE_ATENCAO}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Aliado protegido: <strong className="text-foreground">{ally ? ally.name : 'nenhum'}</strong>
        {c.preAnaliseEscolhaUsada && ' · escolha usada (volta no descanso curto)'}
      </div>
      <div className="flex gap-2">
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={!!c.preAnaliseEscolhaUsada}
          className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground">
          <option value="">Aliado…</option>
          {characters.filter((x) => x.id !== c.id && x.category === 'PLAYER').map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button disabled={!chk.ok} onClick={go}
          className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50">
          Proteger
        </button>
      </div>
      <div className="text-xs text-muted-foreground">O aliado perde a proteção quando fizer um descanso curto.</div>
    </div>
  );
}

export function ComandoSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const [targetId, setTargetId] = useState('');
  const [comando, setComando] = useState('');
  const [recompensa, setRecompensa] = useState(false);
  if (!hasSpecAbility(c, COMANDO_ID)) return null;
  const temRecompensa = hasSpecAbility(c, RECOMPENSA_ID);
  const target = characters.find((x) => x.id === targetId);
  const chk = canComandar(c, target);
  const bonus = temRecompensa && recompensa ? getRecompensaBonus(c) : getComandoBonus(c);

  const go = () => {
    const r = darComando(c, target, comando.trim(), temRecompensa && recompensa);
    if (!r.ok || !target) return;
    addLog('combat', `📣 ${c.name} comanda ${target.name}${comando.trim() ? `: "${comando.trim()}"` : ''} (−2 PE) — +${r.bonus} na próxima rolagem${temRecompensa && recompensa ? ' · 🏆 Recompensa: +2 PE se suceder' : ''}.`);
    setComando('');
  };

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Megaphone className="h-3.5 w-3.5 text-primary" /> Comando Motivador
        <span className="font-normal text-muted-foreground">{COMANDO_PE_COST} PE · Ação Livre · +{bonus}</span>
      </div>
      <div className="flex gap-2">
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
          className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground">
          <option value="">Aliado…</option>
          {characters.filter((x) => x.id !== c.id && x.category === 'PLAYER').map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button disabled={!chk.ok} onClick={go}
          className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50">
          Comandar
        </button>
      </div>
      <input value={comando} onChange={(e) => setComando(e.target.value)} placeholder="Comando (opcional), ex: Ataque o líder!"
        className="w-full rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground" />
      {temRecompensa && (
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={recompensa} onChange={(e) => setRecompensa(e.target.checked)} />
          🏆 Recompensa pelo Sucesso — bônus pela metade (+{getRecompensaBonus(c)}); se suceder, o aliado ganha 2 PE
        </label>
      )}
      {target && !chk.ok && <div className="text-xs text-destructive">{chk.reason}</div>}
      <div className="text-xs text-muted-foreground">Vale na próxima rolagem do aliado, até o início do seu próximo turno.</div>
    </div>
  );
}

export function DesvendarSection({ c }: { c: Character }) {
  const inCombat = useCombatStore((s) => !!s.inCombat);
  const addLog = useLogStore((s) => s.addLog);
  const [busy, setBusy] = useState(false);
  if (!hasSpecAbility(c, DESVENDAR_ID)) return null;
  const fase = getDesvendarFase(c);
  const perc = getPercepcaoBonus(c);

  const rollPerc = async () => {
    const adv = consumeAdvantageFor(c.id, { kind: 'skill', name: 'Percepção' });
    return applyAdvantageToD20(adv.net, () => rollD20Com(c.id));
  };

  const pedir = () => {
    const r = pedirDesvendar(c);
    if (r.ok) addLog('combat', `🗺️ ${c.name} tenta Desvendar Terreno${inCombat ? ' (Ação de Movimento)' : ''} — aguardando CD do Mestre.`);
  };
  const rolar = async () => {
    if (busy) return; setBusy(true);
    try {
      const { d20, modeLabel } = await rollPerc();
      const total = d20 + perc;
      const r = resolverDesvendar(c, total);
      if (!r.ok) return;
      addLog('combat', `🗺️ ${c.name} Desvendar Terreno: Percepção ${d20}${perc >= 0 ? '+' : ''}${perc} = ${total}${modeLabel} vs CD ${r.cd} → ${r.success ? `sucesso! +${r.bonus} para procurar no terreno até o fim da cena` : 'falhou'}.`);
    } finally { setBusy(false); }
  };
  const procurar = async () => {
    if (busy) return; setBusy(true);
    try {
      const b = c.desvendarBonus ?? 0;
      const { d20, modeLabel } = await rollPerc();
      addLog('combat', `🔎 ${c.name} procura no terreno: Percepção ${d20}${perc >= 0 ? '+' : ''}${perc} +${b} (Desvendar) = ${d20 + perc + b}${modeLabel}.`);
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <MapIcon className="h-3.5 w-3.5 text-primary" /> Desvendar Terreno
        <span className="font-normal text-muted-foreground">Ação de Movimento · Percepção {perc >= 0 ? '+' : ''}{perc}</span>
      </div>
      {fase === 'idle' && (
        <button onClick={pedir} className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">Desvendar</button>
      )}
      {fase === 'aguardando-cd' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Aguardando o Mestre definir a CD…
          <button onClick={() => cancelarDesvendar(c.id)} className="rounded border border-border px-1.5 text-xs text-foreground">Cancelar</button>
        </div>
      )}
      {fase === 'pronto-para-rolar' && (
        <button disabled={busy} onClick={rolar} className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50">
          Rolar Percepção (CD {c.desvendarCD})
        </button>
      )}
      {fase === 'ativo' && (
        <div className="space-y-1">
          <button disabled={busy} onClick={procurar} className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50">
            Procurar no terreno (+{c.desvendarBonus})
          </button>
          <div className="text-xs text-muted-foreground">Terreno desvendado — vale até o fim da cena.</div>
        </div>
      )}
    </div>
  );
}

/** Janela global do Mestre: define a CD dos pedidos de Desvendar Terreno. */
export function DesvendarCDDialog() {
  const role = useRoleStore((s) => s.role);
  const characters = useCharacterStore((s) => s.characters);
  const [cd, setCd] = useState('15');
  if (role !== 'MASTER') return null;
  const pend = pendingDesvendar(characters);
  if (pend.length === 0) return null;
  const c = pend[0];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="w-80 rounded-lg border border-border bg-card p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <MapIcon className="h-4 w-4 text-primary" /> Desvendar Terreno
        </div>
        <p className="text-xs text-muted-foreground">{c.name} quer analisar o terreno. Qual a CD do teste de Percepção?</p>
        <input type="number" min={1} value={cd} onChange={(e) => setCd(e.target.value)} aria-label="CD"
          className="w-full rounded-md border border-border bg-secondary/40 px-2 py-1 text-sm text-foreground" />
        <div className="flex justify-end gap-2">
          <button onClick={() => cancelarDesvendar(c.id)} className="rounded-md border border-border px-3 py-1 text-xs text-foreground">Recusar</button>
          <button onClick={() => definirCDDesvendar(c.id, Number(cd))} className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Definir CD</button>
        </div>
      </div>
    </div>
  );
}
