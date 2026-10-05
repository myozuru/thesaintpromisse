/**
 * Espírito de Luta (Especialista em Combate, 4º nível) — botão de Ação Livre.
 */
import { useState } from 'react';
import type { Character } from '@/types';
import {
  hasEspiritoLuta,
  espiritoLutaAtivo,
  espiritoLutaAtivar,
  espiritoLutaPodeUsar,
  ESPIRITO_LUTA_ATK,
  ESPIRITO_LUTA_PE,
} from '@/lib/espiritoLuta';

export function EspiritoLutaButton({ character: c }: { character: Character }) {
  const [msg, setMsg] = useState<string | null>(null);
  if (!hasEspiritoLuta(c)) return null;

  const chk = espiritoLutaPodeUsar(c);
  const ativo = espiritoLutaAtivo(c);

  return (
    <div className="space-y-1 rounded-md border border-orange-500/40 bg-orange-500/5 p-2" data-testid="espirito-luta-secao">
      <p className="text-xs font-bold text-orange-400">
        🔥 Espírito de Luta — ação livre · {ESPIRITO_LUTA_PE} PE · +{ESPIRITO_LUTA_ATK} em ataques até o fim da cena · +{Math.max(1, c.level ?? 1)} PV temporários
      </p>
      <button
        type="button"
        data-testid="espirito-luta-usar"
        disabled={!chk.ok}
        onClick={() => {
          const r = espiritoLutaAtivar(c.id);
          setMsg(r.ok
            ? `Ativado: +${r.bonus} em ataques e +${r.temp} PV temporários.`
            : r.reason);
        }}
        className="w-full rounded border border-orange-500 bg-orange-500/20 px-2 py-1 text-xs font-bold text-orange-300 hover:bg-orange-500/40 disabled:opacity-40"
      >
        {ativo ? 'Ativo nesta cena' : 'Espírito de Luta (Ação Livre)'}
      </button>
      {!chk.ok && chk.reason && !ativo && <p className="text-xs text-destructive">{chk.reason}</p>}
      {msg && <p className="text-xs text-muted-foreground" data-testid="espirito-luta-msg">{msg}</p>}
    </div>
  );
}
