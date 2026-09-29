/**
 * Painel das habilidades base do Suporte.
 * Nv 1 · Suporte em Combate: Apoiar (Ação Bônus) + Cura de toque (Ação Bônus).
 */
import { shownPeMax, shownHpMax } from '@/lib/peDisplay';
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import { checkTouchTarget, charsDistanceMeters, fmtM, TOUCH_RANGE_M } from '@/lib/touchRange';
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
import { AmizadeSection, AnaliseSection } from './SuporteNivel2Sections';
import { ApoioAvancadoSection, OutraChanceSection } from './SuporteNivel6Sections';
import { ComandoSection, DesvendarSection, PreAnaliseSection } from './SuporteComandoTerrenoSections';
import { RepertorioSection, MobilidadeSection } from './SuporteRepertorioMobilidadeSections';
import { TransmitirSection } from './SuporteTransmitirSection';
import { NegacaoCriticaSection } from './SuporteNegacaoSections';
import { SintonizacaoVitalSection } from './SuporteSintonizacaoSections';
import { maybeOfferSintonizacao } from '@/lib/suporteSintonizacao';
import { GuardaSincronizadaSection, InspirarAliadosSection, IntervencaoSection } from './SuporteNivel4Sections';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import {
  hasApoioAccess,
  APOIOS_AVANCADOS,
  applyApoioAvancado,
  getApoiosEscolhidos,
  type ApoioAvancadoKey,
} from '@/lib/suporteNivel6';

export function SuportePanel({ character: c }: { character: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const applyHealing = useCharacterStore((s) => s.applyHealing);
  const addLog = useLogStore((s) => s.addLog);
  const mapEntities = useMapStore((s) => s.entities);
  const gridConfig = useMapStore((s) => s.gridConfig);
  const [targetId, setTargetId] = useState<string>(c.id);
  const [apoiarTargetId, setApoiarTargetId] = useState<string>('');
  const [inspiracaoExtra, setInspiracaoExtra] = useState(0);
  const [trChoice, setTrChoice] = useState<SuporteBaseTR>('Astúcia');
  const [busy, setBusy] = useState(false);
  const [maximize, setMaximize] = useState(0);
  const [apoioKey, setApoioKey] = useState<ApoioAvancadoKey | ''>('');

  if (!isSuporte(c)) return null;

  const dice = getSuporteHealDice(c.level);
  const keyAttr = getSuporteKeyAttr(c);
  const keyMod = getSuporteKeyMod(c);
  const maxUses = getSuporteHealMaxUses(c);
  const left = getSuporteHealUsesLeft(c);
  const allies = characters.filter((x) => x.category === 'PLAYER' || x.category === 'NPC' || x.id === c.id);
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const apoiosConhecidos = hasApoioAccess(c) ? getApoiosEscolhidos(c) : [];
  /** Motivo de bloqueio por alcance de toque (null = pode tocar). */
  const touchBlock = (targetIdToCheck: string): string | null =>
    checkTouchTarget(c.id, targetIdToCheck, mapEntities, gridConfig);
  /** Rótulo curto no seletor: "· falta 1,5 m". */
  const rangeTag = (id: string): string => {
    const d = charsDistanceMeters(c.id, id, mapEntities, gridConfig);
    if (d === null) return ' · fora do mapa';
    return d > TOUCH_RANGE_M + 0.05 ? ` · falta ${fmtM(d - TOUCH_RANGE_M)} m` : ' · ao alcance';
  };
  /** Aliados dentro do raio da Presença Inspiradora (9 m, borda a borda). */
  const INSPIRACAO_RANGE_M = 9;
  const allyDistance = (ally: Character): number | null => {
    return charsDistanceMeters(c.id, ally.id, mapEntities, gridConfig);
  };

  /** Cura de toque do Suporte em Combate (também usada pelo Apoio Curativo). */
  const rollSuporteHeal = async (target: Character, origem: string): Promise<number> => {
    const notation = `${dice.count}d${dice.sides}`;
    const { rolls } = await rollDiceCom(c.id, notation, {
      bonus: keyMod,
      label: `Suporte em Combate — Cura (${origem})`,
    });
    const med = applyMedicinaInfalivel(c, rolls, dice.sides, 0);
    const amount = Math.max(0, med.rolls.reduce((a, b) => a + b, 0) + keyMod + med.flatBonus);
    const before = target.hpCurrent;
    applyHealing(target.id, amount, 'other');
    const after = useCharacterStore.getState().characters.find((x) => x.id === target.id)?.hpCurrent ?? before;
    updateCharacter(c.id, {
      suporteHealUsed: (c.suporteHealUsed ?? 0) + 1,
      ...(med.used > 0 ? { medicinaInfalivelUsed: (c.medicinaInfalivelUsed ?? 0) + med.used } : {}),
    });
    const medTxt = med.flatBonus ? ` +${med.flatBonus} Medicina Infalível` : '';
    addLog(
      'combat',
      `💚 ${c.name}: Suporte em Combate (${origem}, toque) cura ${target.name} — ${notation}[${med.rolls.join(', ')}] ${sign(keyMod)} ${keyAttr}${medTxt} = ${amount} (PV ${before} → ${after}). Usos: ${left - 1}/${maxUses}.`,
    );
    void maybeOfferSintonizacao(c.id, target.id, amount);
    return amount;
  };

  const handleApoiar = async () => {
    const target = characters.find((x) => x.id === apoiarTargetId);
    if (!target || target.id === c.id || busy) return;
    const blocked = touchBlock(target.id);
    if (blocked) {
      addLog('combat', `❌ ${c.name}: Apoiar falhou — ${blocked}`);
      return;
    }
    setBusy(true);
    try {
      // Apoio Avançado: valida o efeito ANTES de aplicar o Apoiar.
      let advNote = '';
      if (apoioKey) {
        const r = applyApoioAvancado(c, target, apoioKey);
        if (!r.ok) {
          addLog('combat', `❌ ${c.name}: ${APOIOS_AVANCADOS[apoioKey].label} falhou — ${r.reason}`);
          return;
        }
        advNote = ` + ${APOIOS_AVANCADOS[apoioKey].label}${r.note ? ` (${r.note})` : ''}`;
      }
      await applyApoiar(c, target);
      addLog(
        'combat',
        `🤝 ${c.name} usa Apoiar (Ação Bônus) em ${target.name} — vantagem no próximo teste de perícia da tarefa apoiada, até o início do próximo turno de ${c.name}.${advNote}`,
      );
      // Apoio Curativo: rola a cura como parte da mesma ação.
      if (apoioKey === 'curativo') await rollSuporteHeal(target, 'Apoio Curativo');
      setApoioKey('');
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
      // Só alcança aliados a até 9 m no mapa (quem não tem peça no mapa fica de fora).
      const inRange = allies.filter((a) => {
        if (a.id === c.id) return false;
        const d = allyDistance(a);
        return d !== null && d <= INSPIRACAO_RANGE_M + 0.05;
      });
      const outOfRange = allies.filter((a) => a.id !== c.id && !inRange.includes(a));
      if (inRange.length === 0) {
        addLog('combat', `❌ ${c.name}: Presença Inspiradora falhou — nenhum aliado a até ${INSPIRACAO_RANGE_M} m no mapa.`);
        return;
      }
      const r = applyPresencaInspiradora(c, inRange, extra);
      if (!r.ok) {
        addLog('combat', `✨ ${c.name}: Presença Inspiradora falhou — ${r.reason}`);
        return;
      }
      addLog(
        'combat',
        `✨ ${c.name} usa Presença Inspiradora (−${r.totalCost} PE): aliados em até 9 m recebem +${r.bonus} em TODAS as rolagens de perícia durante a cena.${outOfRange.length ? ` Fora de alcance: ${outOfRange.map((a) => a.name).join(', ')}.` : ''}`,
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
    const blocked = target.id === c.id ? null : touchBlock(target.id);
    if (blocked) {
      addLog('combat', `❌ ${c.name}: Cura de toque falhou — ${blocked}`);
      return;
    }
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
      void maybeOfferSintonizacao(c.id, target.id, amount);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-b from-primary/10 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 bg-primary/10 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Suporte</span>
          <span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs text-muted-foreground">Nv {c.level} · {keyAttr}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-mono">
          <span className="rounded border border-primary/30 bg-background/50 px-2 py-0.5">CURAS <strong className="text-foreground">{left}/{maxUses}</strong></span>
          <span className="rounded border border-primary/30 bg-background/50 px-2 py-0.5">PE <strong className="text-foreground">{c.peCurrent ?? 0}/{shownPeMax(c)}</strong></span>
        </div>
      </div>
      <div className="space-y-2 p-3">
      <div className="grid gap-2 min-[520px]:grid-cols-2">
      <div className="min-w-0 space-y-1.5 rounded-lg border border-border/60 bg-background/40 p-2">
        <div className="text-xs font-bold uppercase tracking-wider text-primary">Apoiar · Ação Bônus</div>
      <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          value={apoiarTargetId}
          onChange={(e) => setApoiarTargetId(e.target.value)}
          className="min-w-0 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          title="Criatura que você está ajudando (não pode ser você)"
        >
          <option value="">Apoiar quem?</option>
          {allies
            .filter((a) => a.id !== c.id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{rangeTag(a.id)}
              </option>
            ))}
        </select>
        <button
          onClick={handleApoiar}
          disabled={busy || !apoiarTargetId}
           className="inline-flex min-w-0 items-center justify-center gap-1 rounded border border-border bg-secondary/40 px-2 py-1.5 text-sm hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-40"
          title="Ação Bônus: o alvo ganha vantagem no próximo teste de perícia da tarefa apoiada, se rolar antes do início do seu próximo turno."
        >
          <HandHelping className="h-3.5 w-3.5" /> Apoiar (Ação Bônus)
        </button>
        {apoiarTargetId && touchBlock(apoiarTargetId) && (
          <p className="text-sm font-medium text-destructive sm:col-span-2">{touchBlock(apoiarTargetId)}</p>
        )}
        {apoiosConhecidos.length > 0 && (
          <select
            value={apoioKey}
            onChange={(e) => setApoioKey(e.target.value as ApoioAvancadoKey | '')}
            className="min-w-0 w-full rounded border border-border bg-background px-2 py-1.5 text-sm sm:col-span-2"
            title="Apoio Avançado: efeito extra aplicado junto do Apoiar"
          >
            <option value="">Apoio simples</option>
            {apoiosConhecidos.map((k) => (
              <option key={k} value={k}>
                {APOIOS_AVANCADOS[k].label}
              </option>
            ))}
          </select>
        )}
      </div>
      </div>
      <div className="min-w-0 space-y-1.5 rounded-lg border border-border/60 bg-background/40 p-2">
        <div className="text-xs font-bold uppercase tracking-wider text-primary">Cura de toque · Ação Bônus</div>
      <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="min-w-0 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          title="Alvo em alcance de toque"
        >
          {allies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.hpCurrent}/{shownHpMax(a)}){a.id !== c.id ? rangeTag(a.id) : ''}
            </option>
          ))}
        </select>
        <button
          onClick={handleHeal}
          disabled={left <= 0 || busy}
          className="inline-flex min-w-0 items-center justify-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-1 font-bold text-primary hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
          title="Ação Bônus · alcance de toque. Recupera usos em descanso curto ou longo."
        >
          <HeartHandshake className="h-3.5 w-3.5" /> Curar {dice.count}d{dice.sides} {sign(keyMod)}{hasMedicinaInfalivel(c) ? ` +${getTrainingBonusByLevel(c.level)}` : ''}
        </button>
        {targetId !== c.id && touchBlock(targetId) && (
          <p className="text-sm font-medium text-destructive sm:col-span-2">{touchBlock(targetId)}</p>
        )}
        <span className="text-muted-foreground sm:col-span-2">
          Usos: <strong className="text-foreground">{left}/{maxUses}</strong> · {keyAttr}
        </span>
      </div>
      </div>
      </div>
      <div className="grid gap-2 min-[520px]:grid-cols-2">
      {hasMedicinaInfalivel(c) && (
        <div className="flex flex-wrap items-center gap-2 text-xs rounded-lg border border-border/60 bg-background/40 p-2">
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
          <div className="flex flex-wrap items-center gap-2 text-xs rounded-lg border border-border/60 bg-background/40 p-2">
            <span className="font-bold uppercase tracking-wider text-primary">Testes de Resistência</span>
            {!baseTR ? (
              <>
                <select
                  value={trChoice}
                  onChange={(e) => setTrChoice(e.target.value as SuporteBaseTR)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
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
        <div className="flex flex-wrap items-center gap-2 text-xs rounded-lg border border-border/60 bg-background/40 p-2">
          <span className="font-bold uppercase tracking-wider text-primary">Presença Inspiradora</span>
          <select
            value={extra}
            onChange={(e) => setInspiracaoExtra(Number(e.target.value))}
            className="rounded border border-border bg-background px-2 py-1.5 text-sm"
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
          <span className="text-muted-foreground">PE: {c.peCurrent ?? 0}/{shownPeMax(c)}</span>
        </div>
      )}
      </div>
      <AmizadeSection c={c} />
      <AnaliseSection c={c} />
      <ApoioAvancadoSection character={c} />
      <OutraChanceSection character={c} />
      <ComandoSection c={c} />
      <DesvendarSection c={c} />
      <RepertorioSection c={c} />
      <MobilidadeSection c={c} />
      <TransmitirSection c={c} />
      <GuardaSincronizadaSection c={c} />
      <PreAnaliseSection c={c} />
      <InspirarAliadosSection c={c} />
      <IntervencaoSection c={c} />
      <NegacaoCriticaSection c={c} />
      <SintonizacaoVitalSection c={c} />
      </div>
    </div>
  );
}
