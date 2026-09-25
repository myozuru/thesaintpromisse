/**
 * OpportunityPromptOverlay — exibe o prompt de AdO pendente para o Mestre.
 *
 * Aparece quando algum movimento confirmado disparou candidatos. O Mestre
 * marca quem usou Reação / Ação Comum (consome o grant da rodada) ou descarta.
 * A rolagem do ataque/dano é feita normalmente na ficha — este overlay só
 * gerencia a *autorização*.
 */
import { Swords, X, Check } from 'lucide-react';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';

export function OpportunityPromptOverlay() {
  const pending = useOpportunityStore((s) => s.pending);
  const dismiss = useOpportunityStore((s) => s.dismissPending);
  const consume = useOpportunityStore((s) => s.consume);
  const isMaster = useRoleStore((s) => s.role) !== 'PLAYER';
  const addLog = useLogStore((s) => s.addLog);

  if (!pending) return null;
  // Jogadores também veem (informativo); só mestre clica.

  const resolve = (charId: string, charName: string, kind: 'reaction' | 'action') => {
    consume(charId, kind);
    addLog(
      'system',
      `Ataque de Oportunidade: ${charName} usou ${kind === 'reaction' ? 'reação' : 'ação comum'} contra ${pending.triggerCharName}.`,
    );
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[420px] max-w-[92vw]">
      <div className="rounded-lg border border-amber-500/60 bg-card/95 backdrop-blur shadow-2xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-200 text-[12px] font-semibold uppercase tracking-wider">
            <Swords className="h-4 w-4" />
            Ataque de Oportunidade
          </div>
          <button
            onClick={dismiss}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10 text-foreground/80"
            title="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-3 py-2 text-[12px] text-foreground">
          <span className="text-amber-200 font-semibold">{pending.triggerCharName}</span>{' '}
          saiu da adjacência. Provocou:
        </div>
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {pending.candidates.map((c) => (
            <div
              key={c.charId}
              className="flex items-center justify-between gap-2 rounded bg-secondary border border-border px-2 py-1.5"
            >
              <span className="text-[12px] text-foreground truncate">{c.charName}</span>
              {isMaster ? (
                <div className="flex gap-1">
                  {(c.mode === 'reaction' || c.mode === 'either') && (
                    <button
                      onClick={() => resolve(c.charId, c.charName, 'reaction')}
                      className="h-6 px-2 rounded text-[10px] bg-amber-500/25 hover:bg-amber-500/45 text-amber-100 border border-amber-500/50 flex items-center gap-1"
                      title="Marca a reação como usada (faça a rolagem na ficha)."
                    >
                      <Check className="h-3 w-3" /> Reação
                    </button>
                  )}
                  {(c.mode === 'action' || c.mode === 'either') && (
                    <button
                      onClick={() => resolve(c.charId, c.charName, 'action')}
                      className="h-6 px-2 rounded text-[10px] bg-sky-500/25 hover:bg-sky-500/45 text-sky-100 border border-sky-500/50 flex items-center gap-1"
                      title="Marca uso de 1 ação comum como AdO."
                    >
                      <Check className="h-3 w-3" /> Ação
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">aguardando mestre</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
