/**
 * Habilidades de Suporte do 2º nível no painel do Suporte:
 * Amizade Inquebrável e Análise Profunda.
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollD20Com } from '@/lib/dice';
import { consumeAdvantageFor, applyAdvantageToD20 } from '@/lib/omni/rollAdvantage';
import {
  AMIZADE_ID,
  ANALISE_ID,
  canAnalisar,
  canChooseAmigo,
  getAmigo,
  getAnaliseCD,
  getAnaliseTraits,
  getPercepcaoBonus,
  hasSpecAbility,
  liberarTrocaAmigo,
  performAnalise,
  setAmigo,
} from '@/lib/suporteNivel2';
import { Eye, Heart } from 'lucide-react';

export function AmizadeSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const role = useRoleStore((s) => s.role);
  const addLog = useLogStore((s) => s.addLog);
  const [pick, setPick] = useState('');
  if (!hasSpecAbility(c, AMIZADE_ID)) return null;
  const amigo = getAmigo(c, characters);
  const options = characters.filter((x) => x.category === 'PLAYER' && x.id !== c.id);
  const choosing = canChooseAmigo(c);

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Heart className="h-3.5 w-3.5 text-primary" /> Amizade Inquebrável
      </div>
      {amigo && (
        <div className="text-xs text-foreground">
          Amigo: <b>{amigo.name}</b>{(amigo.hpCurrent ?? 0) <= 0 ? ' (caído)' : ''}
          <div className="text-muted-foreground">Ao passar seu turno a até 1,5 m dele, você poderá Apoiar como ação livre.</div>
        </div>
      )}
      {choosing ? (
        <div className="flex gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground"
          >
            <option value="">Escolher Amigo…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button
            disabled={!pick}
            onClick={() => {
              const f = characters.find((x) => x.id === pick);
              if (!f) return;
              const r = setAmigo(c, f);
              if (r.ok) addLog('system', `💞 ${c.name} escolheu ${f.name} como Amigo (Amizade Inquebrável).`);
            }}
            className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      ) : role === 'MASTER' ? (
        <button
          onClick={() => {
            liberarTrocaAmigo(c);
            addLog('system', `🕊️ Mestre liberou ${c.name} para escolher um novo Amigo (interlúdio).`);
          }}
          className="w-full rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary/40"
        >
          Liberar troca de Amigo (interlúdio)
        </button>
      ) : (
        <div className="text-[11px] text-muted-foreground">O Amigo é permanente. Se ele morrer, o Mestre libera a troca no interlúdio.</div>
      )}
    </div>
  );
}

export function AnaliseSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const inCombat = useCombatStore((s) => !!s.inCombat);
  const addLog = useLogStore((s) => s.addLog);
  const [targetId, setTargetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ targetId: string; total: number; cd: number; discoveries: number } | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  if (!hasSpecAbility(c, ANALISE_ID)) return null;

  const target = characters.find((x) => x.id === targetId);
  const check = target ? canAnalisar(c, target, inCombat) : { ok: false, reason: 'Escolha uma criatura.' };
  const bonus = getPercepcaoBonus(c);

  const analisar = async () => {
    if (!target || !check.ok || busy) return;
    setBusy(true);
    try {
      const adv = consumeAdvantageFor(c.id, { kind: 'skill', name: 'Percepção' });
      const { d20, modeLabel } = await applyAdvantageToD20(adv.net, () => rollD20Com(c.id));
      const total = d20 + bonus;
      const r = performAnalise(c, target, total, inCombat);
      if (!r.ok) return;
      setChosen([]);
      setResult({ targetId: target.id, total, cd: r.cd, discoveries: r.discoveries });
      addLog(
        'combat',
        `🔍 ${c.name} usa Análise Profunda em ${target.name}: Percepção ${d20}${bonus >= 0 ? '+' : ''}${bonus} = ${total}${modeLabel} vs CD ${r.cd} → ${r.discoveries > 0 ? `${r.discoveries} característica(s)` : 'falhou'}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const resTarget = result ? characters.find((x) => x.id === result.targetId) : null;
  const traits = resTarget ? getAnaliseTraits(resTarget) : [];
  const revealed = result && chosen.length >= result.discoveries;

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Eye className="h-3.5 w-3.5 text-primary" /> Análise Profunda
        <span className="font-normal text-muted-foreground">1 PE · Ação Comum · Percepção {bonus >= 0 ? '+' : ''}{bonus}</span>
      </div>
      <div className="flex gap-2">
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground"
        >
          <option value="">Criatura…</option>
          {characters.filter((x) => x.id !== c.id).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} — CD {getAnaliseCD(o)}{(c.analiseProfundaAlvos ?? []).includes(o.id) ? ' · já analisada' : ''}
            </option>
          ))}
        </select>
        <button
          disabled={!check.ok || busy}
          onClick={analisar}
          className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Rolando…' : 'Analisar'}
        </button>
      </div>
      {target && !check.ok && <div className="text-[11px] text-destructive">{check.reason}</div>}

      {result && resTarget && (
        <div className="space-y-1 text-xs">
          <div className="text-foreground">
            {resTarget.name}: {result.total} vs CD {result.cd} —{' '}
            {result.discoveries > 0 ? <b>escolha {result.discoveries} característica(s)</b> : 'nada descoberto.'}
          </div>
          {result.discoveries > 0 && traits.map((t) => {
            const on = chosen.includes(t.key);
            const locked = !on && !!revealed;
            return (
              <label key={t.key} className={`flex items-start gap-2 ${locked ? 'opacity-40' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked || on}
                  onChange={() => {
                    setChosen((p) => [...p, t.key]);
                    addLog('combat', `🔍 ${c.name} descobriu em ${resTarget.name} — ${t.label}: ${t.value}`);
                  }}
                />
                <span className="text-foreground">{t.label}{on && <>: <b>{t.value}</b></>}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
