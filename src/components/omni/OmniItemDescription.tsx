/**
 * 🎴 Visão do Player — Descrição automática de um item Omni.
 *
 * Esconde o terminal e fórmulas técnicas. Mostra apenas frases humanas
 * geradas a partir do Plano de Execução (frasePlanoExecucao), removendo
 * símbolos como @, *, /.
 */
import type { CombatEffect } from '@/lib/omni/tipos';
import { frasePlanoExecucao, humanizarWatcher } from '@/lib/omni/omniScript';

interface Props {
  effects: CombatEffect[];
  /** Variante visual: chip compacto inline ou bloco completo. */
  variante?: 'inline' | 'bloco';
  className?: string;
}

export function OmniItemDescription({ effects, variante = 'inline', className = '' }: Props) {
  if (!effects || effects.length === 0) return null;

  const limparSimbolosTecnicos = (texto: string) => texto
    .replace(/@/g, '')
    .replace(/×/g, ' vezes ')
    .replace(/÷/g, ' dividido por ')
    .replace(/[*/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const gatilhoTexto = (e: CombatEffect): string | null => {
    if (e.watcher) return humanizarWatcher(e.watcher);
    if (e.trigger) {
      const t = e.trigger.replace(/_/g, ' ');
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    return null;
  };

  const frases = effects.map((e) => limparSimbolosTecnicos(frasePlanoExecucao(e)));

  if (variante === 'inline') {
    const resumo = frases.join(' · ');
    return (
      <div
        className={`text-[11px] text-muted-foreground italic mt-1 ${className}`}
        title={frases.join('\n')}
      >
        ✨ Efeito: {resumo}
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1 ${className}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">
        Efeito do Item
      </div>
      {effects.map((e, i) => {
        const gat = gatilhoTexto(e);
        const prev = i > 0 ? effects[i - 1] : undefined;
        const prevKey = prev ? JSON.stringify([prev.trigger ?? null, prev.watcher ?? null]) : '';
        const curKey = JSON.stringify([e.trigger ?? null, e.watcher ?? null]);
        const mostrarGat = !!gat && curKey !== prevKey;
        return (
          <div key={i}>
            {mostrarGat && (
              <div className="text-[11px] text-amber-300/90 mt-1">
                ⚡ Gatilho: <span className="text-amber-200">{gat}</span>
              </div>
            )}
            <div className="text-[12px] text-foreground/95">
              {effects.length > 1 && (
                <span className="text-emerald-400/70 font-mono mr-1">#{i + 1}</span>
              )}
              ✅ {frases[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}