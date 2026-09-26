/** Suporte Nv 4 — Negação Crítica: contador no painel + aviso ao dono do Suporte. */
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playClickSound, playErrorSound } from '@/lib/sounds';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import {
  NEGACAO_ID, NEGACAO_PE, acceptNegacao, closeNegacaoEverywhere,
  getNegacaoMaxUses, getNegacaoUsesLeft, useNegacaoPromptStore,
} from '@/lib/suporteNegacao';
import { ShieldAlert } from 'lucide-react';

export function NegacaoCriticaSection({ c }: { c: Character }) {
  if (!hasSpecAbility(c, NEGACAO_ID)) return null;
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-1">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <ShieldAlert className="h-3.5 w-3.5 text-primary" /> Negação Crítica
      </div>
      <p className="text-[11px] text-muted-foreground">
        Usos nesta cena: {getNegacaoUsesLeft(c)}/{getNegacaoMaxUses(c)} · {NEGACAO_PE} PE. Quando um aliado a até 12 m tirar 1 natural, você recebe um aviso para negar.
      </p>
    </div>
  );
}

export function NegacaoPromptDialog() {
  const offer = useNegacaoPromptStore((s) => s.offer);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  if (!offer) return null;
  const sup = characters.find((x) => x.id === offer.supporterId);
  const roller = characters.find((x) => x.id === offer.rollerId);
  if (!sup || !roller) return null;

  const confirm = () => {
    const r = acceptNegacao(offer);
    if (!r.ok) {
      playErrorSound();
      addLog('combat', `❌ ${sup.name}: Negação Crítica falhou — ${r.reason}`);
      closeNegacaoEverywhere(offer.requestId);
      return;
    }
    playClickSound();
    addLog('combat', `🛡️ ${sup.name} negou a falha crítica de ${roller.name} (−${NEGACAO_PE} PE): conta como falha comum.`);
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ShieldAlert className="h-4 w-4 text-primary" /> Negação Crítica
        </div>
        <p className="text-sm text-foreground">
          <b>{roller.name}</b> tirou <b>1 natural</b>. Gastar {NEGACAO_PE} PE para transformar a falha crítica em falha comum?
        </p>
        <p className="text-xs text-muted-foreground">
          Usos na cena: {getNegacaoUsesLeft(sup)}/{getNegacaoMaxUses(sup)} · PE: {sup.peCurrent}/{sup.peMax}
        </p>
        <div className="flex gap-2">
          <button onClick={() => closeNegacaoEverywhere(offer.requestId)}
            className="flex-1 rounded-md border border-border py-2 text-sm text-foreground hover:bg-secondary/40">Não</button>
          <button onClick={confirm}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            Negar (−{NEGACAO_PE} PE)
          </button>
        </div>
      </div>
    </div>
  );
}
