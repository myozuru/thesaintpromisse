/** Suporte Nv 4 — Sintonização Vital: info no painel + aviso ao dono do Suporte. */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import { playClickSound, playErrorSound } from '@/lib/sounds';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import {
  SINTONIZACAO_ID, SINTONIZACAO_PE, SINTONIZACAO_RANGE_M,
  acceptSintonizacao, closeSintonizacaoEverywhere, listSintonizacaoTargets,
  sintonizacaoHealAmount, useSintonizacaoPromptStore,
} from '@/lib/suporteSintonizacao';
import { HeartPulse } from 'lucide-react';

export function SintonizacaoVitalSection({ c }: { c: Character }) {
  if (!hasSpecAbility(c, SINTONIZACAO_ID)) return null;
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-1">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <HeartPulse className="h-3.5 w-3.5 text-primary" /> Sintonização Vital
      </div>
      <p className="text-[11px] text-muted-foreground">
        Ao curar um aliado, você recebe um aviso: por {SINTONIZACAO_PE} PE, outra criatura a até {SINTONIZACAO_RANGE_M} m
        de você (incluindo você) recupera metade da cura original (arredondada para cima). Sem limite de usos.
      </p>
    </div>
  );
}

export function SintonizacaoPromptDialog() {
  const offer = useSintonizacaoPromptStore((s) => s.offer);
  const characters = useCharacterStore((s) => s.characters);
  const entities = useMapStore((s) => s.entities);
  const gridConfig = useMapStore((s) => s.gridConfig);
  const addLog = useLogStore((s) => s.addLog);
  const [targetId, setTargetId] = useState<string>('');
  if (!offer) return null;
  const sup = characters.find((x) => x.id === offer.supporterId);
  const healed = characters.find((x) => x.id === offer.healedId);
  if (!sup || !healed) return null;
  const amount = sintonizacaoHealAmount(offer.healAmount);
  const targets = listSintonizacaoTargets(sup.id, offer.healedId, characters, entities as never, gridConfig);

  const confirm = () => {
    const tgt = characters.find((x) => x.id === targetId);
    if (!tgt) {
      playErrorSound();
      return;
    }
    const r = acceptSintonizacao(offer, targetId);
    if (!r.ok) {
      playErrorSound();
      addLog('combat', `❌ ${sup.name}: Sintonização Vital falhou — ${r.reason}`);
      closeSintonizacaoEverywhere(offer.requestId);
      return;
    }
    playClickSound();
    addLog(
      'combat',
      `💞 ${sup.name}: Sintonização Vital (−${SINTONIZACAO_PE} PE) — ${tgt.name} recupera ${r.healed} PV (metade da cura de ${offer.healAmount} em ${healed.name}).`,
    );
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <HeartPulse className="h-4 w-4 text-primary" /> Sintonização Vital
        </div>
        <p className="text-sm text-foreground">
          Você curou <b>{healed.name}</b> em <b>{offer.healAmount} PV</b>. Gastar {SINTONIZACAO_PE} PE para curar outra
          criatura a até {SINTONIZACAO_RANGE_M} m em <b>{amount} PV</b>?
        </p>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Curar quem?</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id === sup.id ? `${t.name} (você)` : t.name} — PV {t.hpCurrent}/{t.hpMax}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">PE: {sup.peCurrent}/{sup.peMax}</p>
        <div className="flex gap-2">
          <button
            onClick={() => closeSintonizacaoEverywhere(offer.requestId)}
            className="flex-1 rounded-md border border-border py-2 text-sm text-foreground hover:bg-secondary/40"
          >
            Não
          </button>
          <button
            onClick={confirm}
            disabled={!targetId}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Curar (−{SINTONIZACAO_PE} PE)
          </button>
        </div>
      </div>
    </div>
  );
}
