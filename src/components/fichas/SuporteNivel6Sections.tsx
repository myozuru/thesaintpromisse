/**
 * SUPORTE — Seções de UI das habilidades de 6º nível.
 *  • ApoioAvancadoSection — escolha dos apoios conhecidos (1 no Nv 6, +1 no Nv 12).
 *  • OutraChanceSection — contador de usos de Conceder Outra Chance.
 *  • OutraChancePromptDialog — pergunta automática quando um aliado falha.
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playClickSound, playErrorSound } from '@/lib/sounds';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import {
  APOIO_AVANCADO_ID,
  APOIOS_AVANCADOS,
  OUTRA_CHANCE_ID,
  OUTRA_CHANCE_PE_COST,
  acceptOutraChance,
  canChooseApoio,
  chooseApoio,
  closeOutraChanceEverywhere,
  getApoiosEscolhidos,
  getApoiosMaxFor,
  hasApoioAccess,
  getOutraChanceMaxUses,
  getOutraChanceUsesLeft,
  useOutraChancePromptStore,
  type ApoioAvancadoKey,
} from '@/lib/suporteNivel6';
import { Handshake, RotateCcw } from 'lucide-react';

// ===================== Apoio Avançado =====================

export function ApoioAvancadoSection({ character: c }: { character: Character }) {
  const addLog = useLogStore((s) => s.addLog);
  const [pick, setPick] = useState<ApoioAvancadoKey | ''>('');
  if (!hasApoioAccess(c)) return null;

  const chosen = getApoiosEscolhidos(c);
  const max = getApoiosMaxFor(c);
  const available = (Object.keys(APOIOS_AVANCADOS) as ApoioAvancadoKey[]).filter((k) => !chosen.includes(k));

  const handleChoose = () => {
    if (!pick) return;
    const r = chooseApoio(c, pick);
    if (!r.ok) {
      playErrorSound();
      addLog('system', `❌ ${c.name}: ${r.reason}`);
      return;
    }
    playClickSound();
    addLog('system', `🤝 ${c.name} aprendeu ${APOIOS_AVANCADOS[pick].label} (Apoio Avançado).`);
    setPick('');
  };

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2.5 space-y-2">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-primary">
        <span className="flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5" /> Apoio Avançado
        </span>
        <span className="font-mono text-muted-foreground normal-case">
          {chosen.length}/{max} apoios
        </span>
      </div>
      {chosen.length > 0 && (
        <ul className="space-y-1">
          {chosen.map((k) => (
            <li key={k} className="text-xs">
              <span className="font-semibold text-foreground">{APOIOS_AVANCADOS[k].label}:</span>{' '}
              <span className="text-muted-foreground">{APOIOS_AVANCADOS[k].desc}</span>
            </li>
          ))}
        </ul>
      )}
      {canChooseApoio(c) && available.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value as ApoioAvancadoKey)}
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="">Aprender apoio…</option>
            {available.map((k) => (
              <option key={k} value={k}>
                {APOIOS_AVANCADOS[k].label}
              </option>
            ))}
          </select>
          <button
            onClick={handleChoose}
            disabled={!pick}
            className="rounded border border-border bg-secondary/40 px-2 py-1 text-xs hover:bg-secondary/70 disabled:opacity-40"
          >
            Aprender
          </button>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Ao usar Apoiar, escolha um dos efeitos conhecidos no seletor ao lado do botão.
      </p>
    </div>
  );
}

// ===================== Conceder Outra Chance =====================

export function OutraChanceSection({ character: c }: { character: Character }) {
  if (!hasSpecAbility(c, OUTRA_CHANCE_ID)) return null;
  const left = getOutraChanceUsesLeft(c);
  const max = getOutraChanceMaxUses(c);
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2.5 space-y-1">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-primary">
        <span className="flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Conceder Outra Chance
        </span>
        <span className="font-mono text-muted-foreground normal-case">
          {left}/{max} usos
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Quando um aliado a até 6 m falhar num teste com CD conhecida, você será perguntado. Custa {OUTRA_CHANCE_PE_COST} PE;
        usos voltam no descanso longo (metade no curto).
      </p>
    </div>
  );
}

// ===================== Pergunta automática =====================

export function OutraChancePromptDialog() {
  const offer = useOutraChancePromptStore((s) => s.offer);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  if (!offer) return null;
  const sup = characters.find((x) => x.id === offer.supporterId);
  const roller = characters.find((x) => x.id === offer.rollerId);
  if (!sup || !roller) return null;

  const confirm = () => {
    const r = acceptOutraChance(offer);
    if (!r.ok) {
      playErrorSound();
      addLog('combat', `❌ ${sup.name}: Conceder Outra Chance falhou — ${r.reason}`);
      closeOutraChanceEverywhere(offer.requestId);
      return;
    }
    playClickSound();
    addLog(
      'combat',
      `🔁 ${sup.name} concede Outra Chance a ${roller.name} (−${OUTRA_CHANCE_PE_COST} PE): ${offer.testName} será rolado novamente, ficando com o melhor resultado.`,
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <RotateCcw className="h-4 w-4 text-primary" /> Conceder Outra Chance
        </div>
        <p className="text-sm text-foreground">
          <b>{roller.name}</b> falhou em <b>{offer.testName}</b> ({offer.total} vs CD {offer.dc}). Gastar{' '}
          {OUTRA_CHANCE_PE_COST} PE para ele rolar de novo, ficando com o melhor resultado?
        </p>
        <p className="text-xs text-muted-foreground">
          Usos restantes: {getOutraChanceUsesLeft(sup)}/{getOutraChanceMaxUses(sup)} · PE: {sup.peCurrent}/{sup.peMax}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => closeOutraChanceEverywhere(offer.requestId)}
            className="flex-1 rounded-md border border-border py-2 text-sm text-foreground hover:bg-secondary/40"
          >
            Não
          </button>
          <button
            onClick={confirm}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Conceder (−{OUTRA_CHANCE_PE_COST} PE)
          </button>
        </div>
      </div>
    </div>
  );
}
