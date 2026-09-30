/**
 * Pergunta do Preparo Imediato na rolagem de iniciativa: gastar Preparo para
 * já entrar no combate com uma ação preparada.
 */
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import {
  devePerguntarNaIniciativa, opcoesPreparo, prepararNaIniciativa, marcarOfertaRespondida,
  custoDe, rotuloDe,
} from '@/lib/preparoImediato';

export function PreparoImediatoPrompt() {
  const inCombat = useCombatStore((s) => s.inCombat);
  const combatId = useCombatStore((s) => s.combatId);
  const chars = useCharacterStore((s) => s.characters);
  if (!inCombat || !combatId) return null;
  const c = chars.find((x) => devePerguntarNaIniciativa(x, combatId));
  if (!c) return null;
  const opcoes = opcoesPreparo(c);
  return (
    <div
      className="fixed bottom-40 left-1/2 z-[70] w-[min(92vw,380px)] -translate-x-1/2 rounded-lg border-2 border-amber-500/60 bg-card p-3 shadow-lg space-y-2"
      role="dialog"
      aria-label="Preparo Imediato"
      data-testid="preparo-imediato-prompt"
    >
      <div className="text-xs text-foreground leading-snug">
        ⏱️ <b>{c.name}</b> pode usar <b>Preparo Imediato</b> na iniciativa e já começar o combate
        com uma ação preparada.
      </div>
      <div className="flex gap-1.5">
        {opcoes.map((t) => (
          <button
            key={t}
            data-testid={`preparo-imediato-${t}`}
            onClick={() => prepararNaIniciativa(c.id, t, combatId)}
            className="flex-1 text-[11px] px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold hover:bg-amber-500/30"
          >
            {rotuloDe(t)} ({custoDe(t)} Preparo)
          </button>
        ))}
        <button
          data-testid="preparo-imediato-nao"
          onClick={() => marcarOfertaRespondida(c.id, combatId)}
          className="flex-1 text-[11px] px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
        >
          Não
        </button>
      </div>
    </div>
  );
}
