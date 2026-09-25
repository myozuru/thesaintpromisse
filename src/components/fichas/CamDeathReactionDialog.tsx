/**
 * ============================================================================
 *  CamDeathReactionDialog
 * ============================================================================
 *  Disparado quando o HP do núcleo ATIVO de um CAM cai a 0.
 *  Pergunta se o jogador quer usar a Reação para trocar de núcleo.
 *   • Confirmar  → consome 1 Reação e troca para o núcleo escolhido.
 *   • Recusar    → marca o núcleo ativo como damaged + entra em "Morrendo".
 * ============================================================================
 */
import { useMemo, useState } from 'react';
import type { Character, CoreId } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { Skull, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  character: Character;
  onClose: () => void;
}

export function CamDeathReactionDialog({ character: c, onClose }: Props) {
  const { switchCore, markActiveCoreFallen, updateCharacter } = useCharacterStore();
  const addLog = useLogStore(s => s.addLog);
  const [target, setTarget] = useState<CoreId | ''>('');

  const switchable = useMemo(
    () =>
      (c.cores ?? []).filter(
        co => !co.destroyed && !co.damaged && co.id !== c.activeCoreId,
      ),
    [c.cores, c.activeCoreId],
  );

  const handleAccept = () => {
    if (!target) return;
    if (c.reactionsCurrent <= 0) {
      addLog('system', `❌ ${c.name} sem Reação disponível.`);
      return;
    }
    const ok = switchCore(c.id, target as CoreId);
    if (!ok) {
      addLog('system', `❌ Reação falhou — núcleo indisponível.`);
      return;
    }
    updateCharacter(c.id, { reactionsCurrent: c.reactionsCurrent - 1 });
    addLog('combat', `⚡ ${c.name} usou Reação — trocou para ${target.toUpperCase()}.`);
    onClose();
  };

  const handleRefuse = () => {
    markActiveCoreFallen(c.id);
    addLog('combat', `💀 ${c.name} caiu Morrendo — núcleo ativo marcado [DANIFICADO].`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-hp/60 bg-card p-5 shadow-2xl space-y-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="rounded-full bg-hp/20 p-2">
            <Skull className="h-5 w-5 text-hp" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground">Núcleo Caindo</h2>
            <p className="text-xs text-muted-foreground">
              {c.name} — núcleo ativo chegou a 0 HP.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-foreground/90 leading-relaxed">
          Deseja usar sua <strong className="text-pe">Reação</strong> para trocar de
          núcleo e evitar o estado <strong className="text-hp">Morrendo</strong>?
        </p>

        {switchable.length === 0 ? (
          <div className="rounded-lg border border-hp/40 bg-hp/10 p-3 text-xs text-hp">
            Nenhum núcleo elegível para troca. Você cairá Morrendo.
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Trocar para
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {switchable.map(co => (
                <button
                  key={co.id}
                  onClick={() => setTarget(co.id)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-xs transition-all',
                    target === co.id
                      ? 'bg-accent/25 border-accent text-foreground'
                      : 'bg-secondary/30 border-border text-muted-foreground hover:border-accent/40',
                  )}
                >
                  <div className="font-bold">{co.name}</div>
                  <div className="text-[10px] mt-0.5">
                    {co.specialization} · HP {co.hpCurrent}/{co.hpMax} · PE{' '}
                    {co.peCurrent}/{co.peMax}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border">
          <button
            onClick={handleRefuse}
            className="flex-1 rounded-lg border border-hp/50 bg-hp/10 px-3 py-2 text-xs font-bold text-hp hover:bg-hp/20"
          >
            Recusar (Cair Morrendo)
          </button>
          <button
            onClick={handleAccept}
            disabled={!target || c.reactionsCurrent <= 0}
            className="flex-[2] rounded-lg bg-pe/30 border border-pe text-pe px-3 py-2 text-xs font-bold hover:bg-pe/50 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Usar Reação ({c.reactionsCurrent} disp.)
          </button>
        </div>
      </div>
    </div>
  );
}
