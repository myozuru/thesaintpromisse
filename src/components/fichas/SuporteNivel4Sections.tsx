/**
 * Suporte Nv 4 — Guarda Sincronizada: seção no painel + watcher global que
 * remove membros que se afastam (> 7,5 m) ou ficam Cego/Surdo.
 */
import { useEffect, useState } from 'react';
import { useChronosStore } from '@/stores/useChronosStore';
import { toTimelineSeconds } from '@/lib/omni/tempo';
import { rollDice } from '@/lib/dice';
import { grantFlatBonus } from '@/lib/omni/rollAdvantage';
import { checkTouchTarget } from '@/lib/touchRange';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import {
  GUARDA_ID, activateGuarda, computeGuardaPatches, guardaBonus,
  INSPIRAR_ID, INTERVENCAO_ID, GRAU_CONDICAO, buildInspirar, canInspirar, checkIntervencao, findInspiracaoFor,
  getGrauMaximo, getInspirarMaxAliados, getInspirarUsos, getIntervencaoCusto, inspiracaoExpirada, type GrauRemovivel,
} from '@/lib/suporteNivel4';
import { HeartPulse, Shield, Sparkles } from 'lucide-react';

export function GuardaSincronizadaSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  if (!hasSpecAbility(c, GUARDA_ID)) return null;

  const members = c.guardaSincronizada?.members ?? [];
  const names = members.map((id) => characters.find((x) => x.id === id)?.name ?? '?');

  const ativar = () => {
    const { entities, gridConfig } = useMapStore.getState();
    const r = activateGuarda(c, characters, entities, gridConfig);
    if (!r.ok) { addLog('system', `❌ ${c.name}: ${r.reason}`); return; }
    const store = useCharacterStore.getState();
    store.updateCharacter(c.id, { guardaSincronizada: { members: r.members } });
    addLog('system', `🛡️ ${c.name} sintonizou a guarda (Ação Bônus): ${r.members.length} membros, +${guardaBonus(r.members)} de Defesa.`);
  };
  const encerrar = () => {
    useCharacterStore.getState().updateCharacter(c.id, { guardaSincronizada: undefined });
    addLog('system', `🛡️ ${c.name} encerrou a Guarda Sincronizada.`);
  };

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Shield className="h-3.5 w-3.5 text-primary" /> Guarda Sincronizada
      </div>
      {members.length > 0 ? (
        <>
          <p className="text-[11px] text-muted-foreground">
            Ativa: +{guardaBonus(members)} de Defesa para {names.join(', ')}.
          </p>
          <button type="button" onClick={encerrar} className="w-full rounded border border-border px-2 py-1 text-xs hover:bg-secondary/40">
            Encerrar guarda
          </button>
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Ação Bônus: aliados a até 7,5 m (sem Cego/Surdo) entram na guarda. Quem se afastar sai.
          </p>
          <button type="button" onClick={ativar} className="w-full rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90">
            Sintonizar guarda
          </button>
        </>
      )}
    </div>
  );
}

/** Recalcula as guardas quando fichas ou peças mudam. Idempotente. */
export function GuardaSincronizadaWatcher() {
  const characters = useCharacterStore((s) => s.characters);
  const entities = useMapStore((s) => s.entities);
  const gridConfig = useMapStore((s) => s.gridConfig);
  useEffect(() => {
    if (!characters.some((c) => c.guardaSincronizada || c.guardaSincronizadaBonus)) return;
    const patches = computeGuardaPatches(characters, entities, gridConfig);
    if (patches.length === 0) return;
    const store = useCharacterStore.getState();
    for (const p of patches) store.updateCharacter(p.id, p.patch);
  }, [characters, entities, gridConfig]);
  return null;
}

// ===================== Inspirar Aliados =====================

function nowTimeline(): number {
  return toTimelineSeconds(useChronosStore.getState());
}

export function InspirarAliadosSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const [sel, setSel] = useState<string[]>([]);
  if (!hasSpecAbility(c, INSPIRAR_ID)) return null;

  const max = getInspirarMaxAliados(c);
  const allies = characters.filter((x) => x.id !== c.id && !x.isGrimorioCreature && (x.category === 'PLAYER' || x.category === 'NPC'));
  const insp = c.inspiracao;
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < max ? [...s, id] : s));

  const inspirar = () => {
    const chk = canInspirar(c, sel);
    if (!chk.ok) { addLog('system', `❌ ${c.name}: ${chk.reason}`); return; }
    useCharacterStore.getState().updateCharacter(c.id, buildInspirar(c, sel, nowTimeline()));
    const names = sel.map((id) => characters.find((x) => x.id === id)?.name).join(', ');
    addLog('system', `✨ ${c.name} inspirou ${names} (Ação Bônus, 1 PE): ${getInspirarUsos(c)} uso(s) de +2d3 por 10 min.`);
    setSel([]);
  };

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Inspirar Aliados
      </div>
      {insp && insp.usesLeft > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Ativa: {insp.usesLeft} uso(s) restantes para {insp.allyIds.map((id) => characters.find((x) => x.id === id)?.name ?? '?').join(', ')}.
        </p>
      ) : null}
      {c.inspirarUsadoCena ? (
        <p className="text-[11px] text-muted-foreground">Já usada nesta cena.</p>
      ) : max <= 0 ? (
        <p className="text-[11px] text-muted-foreground">Seu bônus de treinamento ainda não permite inspirar aliados.</p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">Escolha até {max} aliado(s). Custa 1 PE e a Ação Bônus.</p>
          <div className="flex flex-wrap gap-1">
            {allies.map((a) => (
              <button key={a.id} type="button" onClick={() => toggle(a.id)}
                className={`rounded border px-2 py-0.5 text-[11px] ${sel.includes(a.id) ? 'border-primary bg-primary/20 text-foreground' : 'border-border text-muted-foreground hover:bg-secondary/40'}`}>
                {a.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={inspirar} disabled={sel.length === 0}
            className="w-full rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
            Inspirar ({sel.length}/{max})
          </button>
        </>
      )}
    </div>
  );
}

/** Botão na ficha do aliado inspirado: arma +2d3 na próxima rolagem de ataque, habilidade ou TR. */
export function InspiradoButton({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  useChronosStore((s) => s.seconds);
  const addLog = useLogStore((s) => s.addLog);
  const [busy, setBusy] = useState(false);
  const sup = findInspiracaoFor(c.id, characters, nowTimeline());
  if (!sup || !sup.inspiracao) return null;
  const mods = (c as unknown as { omniAdvMods?: Record<string, { source?: string; bonus?: number }> }).omniAdvMods ?? {};
  const armado = Object.values(mods).some((m) => m.bonus != null && m.source?.startsWith('Inspirar Aliados'));

  const usar = async () => {
    if (armado || busy) return;
    setBusy(true);
    try {
      const { total, rolls } = await rollDice('2d3', { label: `Inspiração de ${sup.name}` });
      const fresh = useCharacterStore.getState().characters.find((x) => x.id === sup.id);
      if (!fresh?.inspiracao || fresh.inspiracao.usesLeft <= 0) return;
      useCharacterStore.getState().updateCharacter(sup.id, { inspiracao: { ...fresh.inspiracao, usesLeft: fresh.inspiracao.usesLeft - 1 } });
      grantFlatBonus(c.id, 'next_any', total, { expires: 'use', source: `Inspirar Aliados (${sup.name})`, grantedBy: sup.id });
      addLog('system', `✨ ${c.name} usou a inspiração: +${total} (2d3: ${rolls.join(', ')}) na próxima rolagem.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); void usar(); }} disabled={armado || busy}
      className="w-full rounded border border-primary/50 bg-primary/10 px-2 py-1 text-xs font-semibold text-foreground hover:bg-primary/20 disabled:opacity-50">
      <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />
      {armado ? 'Inspiração pronta para a próxima rolagem' : `Usar inspiração (+2d3) · ${sup.inspiracao.usesLeft} restante(s)`}
    </button>
  );
}

/** Remove inspirações vencidas pelo relógio do jogo ou sem usos. */
export function InspiracaoWatcher() {
  const characters = useCharacterStore((s) => s.characters);
  const chronos = useChronosStore((s) => `${s.year}-${s.month}-${s.day}-${s.hours}-${s.minutes}-${s.seconds}`);
  useEffect(() => {
    const now = nowTimeline();
    for (const s of characters) {
      if (inspiracaoExpirada(s, now)) useCharacterStore.getState().updateCharacter(s.id, { inspiracao: undefined });
    }
  }, [characters, chronos]);
  return null;
}

// ===================== Intervenção =====================

export function IntervencaoSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const [targetId, setTargetId] = useState('');
  const [condId, setCondId] = useState('');
  const [grauVar, setGrauVar] = useState<GrauRemovivel>('fraca');
  if (!hasSpecAbility(c, INTERVENCAO_ID)) return null;

  const allies = characters.filter((x) => !x.isGrimorioCreature && (x.category === 'PLAYER' || x.category === 'NPC' || x.id === c.id));
  const target = characters.find((x) => x.id === targetId);
  const conds = target?.activeConditions ?? [];
  const cond = conds.find((x) => x.id === condId);
  const variavel = cond ? GRAU_CONDICAO[cond.conditionId] === 'variavel' : false;
  const maxGrau = getGrauMaximo(c.level ?? 1);

  const intervir = () => {
    if (!target || !cond) return;
    const { entities, gridConfig } = useMapStore.getState();
    const touch = checkTouchTarget(c.id, target.id, entities, gridConfig);
    if (touch) { addLog('system', `❌ ${c.name}: ${touch}`); return; }
    const r = checkIntervencao(c, cond.conditionId, variavel ? grauVar : undefined);
    if (!r.ok) { addLog('system', `❌ ${c.name}: ${r.reason}`); return; }
    const store = useCharacterStore.getState();
    store.updateCharacter(c.id, { peCurrent: (c.peCurrent ?? 0) - r.custo });
    store.removeCondition(target.id, cond.id);
    addLog('system', `🩹 ${c.name} usou Intervenção (Ação Comum, ${r.custo} PE) e encerrou ${cond.name} em ${target.name}.`);
    setCondId('');
  };

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <HeartPulse className="h-3.5 w-3.5 text-primary" /> Intervenção
      </div>
      <p className="text-[11px] text-muted-foreground">
        Ação Comum, alcance de toque. Encerra condições até <b>{GRAU_LABEL[maxGrau]}</b> (custo {getIntervencaoCusto(maxGrau)} PE nesse grau; fraca 3 PE).
      </p>
      <select value={targetId} onChange={(e) => { setTargetId(e.target.value); setCondId(''); }}
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs">
        <option value="">Escolha o aliado…</option>
        {allies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {target ? (
        conds.length === 0 ? <p className="text-[11px] text-muted-foreground">Sem condições ativas.</p> : (
          <select value={condId} onChange={(e) => setCondId(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs">
            <option value="">Escolha a condição…</option>
            {conds.map((cd) => {
              const g = GRAU_CONDICAO[cd.conditionId];
              return <option key={cd.id} value={cd.id}>{cd.icon} {cd.name} ({g ? GRAU_LABEL[g] : '?'})</option>;
            })}
          </select>
        )
      ) : null}
      {variavel ? (
        <select value={grauVar} onChange={(e) => setGrauVar(e.target.value as GrauRemovivel)}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs">
          {(['fraca', 'media', 'forte', 'extrema'] as GrauRemovivel[]).map((g) => <option key={g} value={g}>Grau: {GRAU_LABEL[g]}</option>)}
        </select>
      ) : null}
      <button type="button" onClick={intervir} disabled={!cond}
        className="w-full rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
        Encerrar condição
      </button>
    </div>
  );
}

const GRAU_LABEL: Record<string, string> = { fraca: 'Fraca', media: 'Média', forte: 'Forte', extrema: 'Extrema', variavel: 'Variável', especial: 'Especial' };
