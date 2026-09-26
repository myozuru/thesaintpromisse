import { useState } from 'react';
import { Shield } from 'lucide-react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollDiceCom } from '@/lib/dice';
import {
  applyProtetor, closeProtetorEverywhere, getProtetorDice, getProtetorMod,
  useProtetorPromptStore,
} from '@/lib/suporteProtetor';

/** Pergunta, quando um aliado adjacente sofre dano, se o Suporte quer usar Protetor. */
export function ProtetorPromptDialog() {
  const offer = useProtetorPromptStore((s) => s.offer);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const [busy, setBusy] = useState(false);
  if (!offer) return null;
  const sup = characters.find((x) => x.id === offer.supporterId);
  const target = characters.find((x) => x.id === offer.targetId);
  if (!sup || !target) return null;

  const dice = getProtetorDice(sup);
  const mod = getProtetorMod(sup);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { rolls } = await rollDiceCom(sup.id, `${dice.count}d${dice.sides}`, {
        bonus: mod,
        label: `Protetor — ${target.name}`,
      });
      const total = rolls.reduce((a, b) => a + b, 0) + mod;
      const res = applyProtetor(offer, total);
      if (!res.ok) {
        addLog('combat', `🛡️ ${sup.name} tentou Proteger ${target.name}, mas ${res.reason}`);
        closeProtetorEverywhere();
        return;
      }
      const parts = [
        res.hpBack > 0 ? `${res.hpBack} de PV` : '',
        res.escBack > 0 ? `${res.escBack} de Escudo` : '',
      ].filter(Boolean).join(' e ');
      addLog(
        'combat',
        `🛡️ ${sup.name} Protege ${target.name} (−1 PE): [${rolls.join(', ')}]${mod ? ` +${mod}` : ''} = ${total} de redução — ${parts || 'nenhum dano revertido'}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Shield className="h-4 w-4 text-primary" /> Protetor
        </div>
        <p className="text-sm text-foreground">
          <b>{target.name}</b>, ao seu lado, sofreu <b>{offer.damageDealt}</b> de dano. Gastar 1 PE para reduzir em{' '}
          <b>
            {dice.count}d{dice.sides}
            {mod ? ` +${mod}` : ''}
          </b>
          ?
        </p>
        <p className="text-xs text-muted-foreground">Ação Livre — requer escudo equipado. A redução devolve PV/Escudo perdidos, até o valor rolado.</p>
        <div className="flex gap-2">
          <button
            onClick={() => closeProtetorEverywhere()}
            className="flex-1 rounded-md border border-border py-2 text-sm text-foreground hover:bg-secondary/40"
          >
            Não
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? 'Rolando…' : 'Proteger'}
          </button>
        </div>
      </div>
    </div>
  );
}
