/**
 * Painel das habilidades base do Suporte.
 * Nv 1 · Suporte em Combate: Apoiar (Ação Bônus) + Cura de toque (Ação Bônus).
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollDiceCom } from '@/lib/dice';
import {
  isSuporte,
  applyApoiar,
  applyMedicinaInfalivel,
  getMedicinaInfalivelMaxUses,
  getMedicinaInfalivelUsesLeft,
  hasMedicinaInfalivel,
  applyPresencaInspiradora,
  applySuporteBaseTR,
  applyTRMestre,
  getPresencaInspiradoraMaxExtra,
  getSuporteBaseTR,
  getSuporteHealDice,
  getSuporteHealMaxUses,
  getSuporteHealUsesLeft,
  getSuporteKeyAttr,
  getSuporteKeyMod,
  TR_MESTRE_LEVEL,
  type SuporteBaseTR,
} from '@/lib/suporteAbilities';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { HeartHandshake, HandHelping, ShieldCheck, Sparkles } from 'lucide-react';

export function SuportePanel({ character: c }: { character: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const applyHealing = useCharacterStore((s) => s.applyHealing);
  const addLog = useLogStore((s) => s.addLog);
  const [targetId, setTargetId] = useState<string>(c.id);
  const [apoiarTargetId, setApoiarTargetId] = useState<string>('');
  const [inspiracaoExtra, setInspiracaoExtra] = useState(0);
  const [trChoice, setTrChoice] = useState<SuporteBaseTR>('Astúcia');
  const [busy, setBusy] = useState(false);
  const [maximize, setMaximize] = useState(0);

  if (!isSuporte(c)) return null;

  const dice = getSuporteHealDice(c.level);
  const keyAttr = getSuporteKeyAttr(c);
  const keyMod = getSuporteKeyMod(c);
  const maxUses = getSuporteHealMaxUses(c);
  const left = getSuporteHealUsesLeft(c);
  const allies = characters.filter((x) => x.category === 'PLAYER' || x.category === 'NPC' || x.id === c.id);
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  const handleApoiar = async () => {
    const target = characters.find((x) => x.id === apoiarTargetId);
    if (!target || target.id === c.id || busy) return;
    setBusy(true);
    try {
      await applyApoiar(c, target);
      addLog(
        'combat',
        `🤝 ${c.name} usa Apoiar (Ação Bônus) em ${target.name} — vantagem no próximo teste de perícia da tarefa apoiada, até o início do próximo turno de ${c.name}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const maxExtra = getPresencaInspiradoraMaxExtra(c);
  const extra = Math.min(inspiracaoExtra, maxExtra);
  const inspiracaoCost = 2 + extra;
  const inspiracaoBonus = 1 + extra;
  const canInspirar = c.level >= 3 && (c.peCurrent ?? 0) >= inspiracaoCost;

  const handleInspirar = () => {
    if (!canInspirar || busy) return;
    setBusy(true);
    try {
      const r = applyPresencaInspiradora(c, allies, extra);
      if (!r.ok) {
        addLog('combat', `✨ ${c.name}: Presença Inspiradora falhou — ${r.reason}`);
        return;
      }
      addLog(
        'combat',
        `✨ ${c.name} usa Presença Inspiradora (−${r.totalCost} PE): aliados em até 9 m recebem +${r.bonus} em TODAS as rolagens de perícia durante a cena.`,
      );
      setInspiracaoExtra(0);
    } finally {
      setBusy(false);
    }
  };

  const handleHeal = async () => {
    if (left <= 0 || busy) return;
    const target = characters.find((x) => x.id === targetId);
    if (!target) return;
    setBusy(true);
    try {
      const notation = `${dice.count}d${dice.sides}`;
      const { rolls, total } = await rollDiceCom(c.id, notation, {
        bonus: keyMod,
        label: 'Suporte em Combate — Cura',
      });
      const med = applyMedicinaInfalivel(c, rolls, dice.sides, maximize);
      const healRolls = med.rolls;
      const amount = Math.max(0, healRolls.reduce((a, b) => a + b, 0) + keyMod + med.flatBonus);
      void total;
      const before = target.hpCurrent;
      applyHealing(target.id, amount, 'other');
      const after = useCharacterStore.getState().characters.find((x) => x.id === target.id)?.hpCurrent ?? before;
      updateCharacter(c.id, {
        suporteHealUsed: (c.suporteHealUsed ?? 0) + 1,
        ...(med.used > 0 ? { medicinaInfalivelUsed: (c.medicinaInfalivelUsed ?? 0) + med.used } : {}),
      });
      setMaximize(0);
      const medTxt = med.flatBonus
        ? ` +${med.flatBonus} Medicina Infalível${med.used ? ` (${med.used} dado(s) maximizado(s))` : ''}`
        : '';
      addLog(
        'combat',
        `💚 ${c.name}: Suporte em Combate (Ação Bônus, toque) cura ${target.name} — ${notation}[${healRolls.join(', ')}] ${sign(keyMod)} ${keyAttr}${medTxt} = ${amount} (PV ${before} → ${after}). Usos: ${left - 1}/${maxUses}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="text-xs font-bold uppercase tracking-wider text-primary">Suporte em Combate</div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={apoiarTargetId}
          onChange={(e) => setApoiarTargetId(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          title="Criatura que você está ajudando (não pode ser você)"
        >
          <option value="">Apoiar quem?</option>
          {allies
            .filter((a) => a.id !== c.id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
        <button
          onClick={handleApoiar}
          disabled={busy || !apoiarTargetId}
          className="inline-flex items-center gap-1 rounded border border-border bg-secondary/40 px-2 py-1 text-xs hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-40"
          title="Ação Bônus: o alvo ganha vantagem no próximo teste de perícia da tarefa apoiada, se rolar antes do início do seu próximo turno."
        >
          <HandHelping className="h-3.5 w-3.5" /> Apoiar (Ação Bônus)
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          title="Alvo em alcance de toque"
        >
          {allies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.hpCurrent}/{a.hpMax})
            </option>
          ))}
        </select>
        <button
          onClick={handleHeal}
          disabled={left <= 0 || busy}
          className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-1 font-bold text-primary hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
          title="Ação Bônus · alcance de toque. Recupera usos em descanso curto ou longo."
        >
          <HeartHandshake className="h-3.5 w-3.5" /> Curar {dice.count}d{dice.sides} {sign(keyMod)}{hasMedicinaInfalivel(c) ? ` +${getTrainingBonusByLevel(c.level)}` : ''}
        </button>
        <span className="text-muted-foreground">
          Usos: <strong className="text-foreground">{left}/{maxUses}</strong> · {keyAttr}
        </span>
      </div>
      {hasMedicinaInfalivel(c) && (
        <div className="flex flex-wrap items-center gap-2 text-xs border-t border-primary/20 pt-2">
          <span className="font-bold uppercase tracking-wider text-primary">Medicina Infalível</span>
          <label className="text-muted-foreground" title="Maximiza os menores dados da próxima cura (1 uso por dado). Vale para esta cura e para a Energia Reversa.">
            Maximizar{' '}
            <input
              type="number"
              min={0}
              max={getMedicinaInfalivelUsesLeft(c)}
              value={maximize}
              onChange={(e) => setMaximize(Math.max(0, Math.min(getMedicinaInfalivelUsesLeft(c), Math.floor(Number(e.target.value) || 0))))}
              className="w-12 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
            />{' '}
            dado(s)
          </label>
          <span className="text-muted-foreground">
            Usos: <strong className="text-foreground">{getMedicinaInfalivelUsesLeft(c)}/{getMedicinaInfalivelMaxUses(c)}</strong> · toda cura +{getTrainingBonusByLevel(c.level)}
          </span>
        </div>
      )}
      {(() => {
        const baseTR = getSuporteBaseTR(c);
        const baseST = (c.savingThrows ?? []).find((s) => s.name === baseTR);
        const hasMastery = !!baseST?.mastery;
        return (
          <div className="flex flex-wrap items-center gap-2 text-xs border-t border-primary/20 pt-2">
            <span className="font-bold uppercase tracking-wider text-primary">Testes de Resistência</span>
            {!baseTR ? (
              <>
                <select
                  value={trChoice}
                  onChange={(e) => setTrChoice(e.target.value as SuporteBaseTR)}
                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                  title="TR treinado da especialização (Nv 1): Astúcia ou Vontade"
                >
                  <option value="Astúcia">Astúcia</option>
                  <option value="Vontade">Vontade</option>
                </select>
                <button
                  onClick={() => {
                    applySuporteBaseTR(c, trChoice);
                    addLog('combat', `🛡️ ${c.name}: TR da especialização — ${trChoice} treinado.`);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-1 font-bold text-primary hover:bg-primary/25"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Treinar TR
                </button>
              </>
            ) : (
              <span className="text-muted-foreground">
                Treinado: <strong className="text-foreground">{baseTR}</strong>
                {hasMastery ? ' (Mestre)' : ''}
              </span>
            )}
            {baseTR && !hasMastery && (
              <button
                onClick={() => {
                  const r = applyTRMestre(c);
                  addLog(
                    'combat',
                    r.ok
                      ? `🛡️ ${c.name}: TR Mestre — maestria em ${baseTR} e treinado em ${baseTR === 'Astúcia' ? 'Vontade' : 'Astúcia'}.`
                      : `🛡️ ${c.name}: TR Mestre falhou — ${r.reason}`,
                  );
                }}
                disabled={c.level < TR_MESTRE_LEVEL}
                className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-1 font-bold text-primary hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                title={`Nv ${TR_MESTRE_LEVEL}: maestria no TR da especialização e treinado no outro (Astúcia/Vontade).`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> TR Mestre (Nv {TR_MESTRE_LEVEL})
              </button>
            )}
          </div>
        );
      })()}
      {c.level >= 3 && (
        <div className="flex flex-wrap items-center gap-2 text-xs border-t border-primary/20 pt-2">
          <span className="font-bold uppercase tracking-wider text-primary">Presença Inspiradora</span>
          <select
            value={extra}
            onChange={(e) => setInspiracaoExtra(Number(e.target.value))}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            title="PE adicional: +1 no bônus por PE (máx. = metade do mod de Presença)"
          >
            {Array.from({ length: maxExtra + 1 }, (_, i) => (
              <option key={i} value={i}>
                +{i} PE extra → bônus +{1 + i}
              </option>
            ))}
          </select>
          <button
            onClick={handleInspirar}
            disabled={!canInspirar || busy}
            className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-1 font-bold text-primary hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
            title="Custa 2 PE + PE extra. Aliados em até 9 m ganham o bônus em todas as perícias durante a cena."
          >
            <Sparkles className="h-3.5 w-3.5" /> Inspirar (−{inspiracaoCost} PE, +{inspiracaoBonus})
          </button>
          <span className="text-muted-foreground">PE: {c.peCurrent ?? 0}/{c.peMax ?? 0}</span>
        </div>
      )}
    </div>
  );
}
