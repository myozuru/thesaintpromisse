/**
 * Fase 10 — Polimento: Tooltip / Popover de proveniência das Aptidões de Aura.
 *
 * Lê `aggregateAuraEffects(c).breakdown[]` e mostra cada bônus passivo agrupado
 * por aptidão. Reutiliza o agregador (não duplica regras). Aparece como um
 * pequeno chip "ⓘ Bônus" no header do painel de auras.
 */
import { Info, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { aggregateAuraEffects } from '@/lib/auraEffects';
import type { Character } from '@/types';

interface Props {
  character: Character;
}

export function AuraEffectsBreakdown({ character: c }: Props) {
  const eff = aggregateAuraEffects(c);
  const grouped = new Map<string, { name: string; rows: { field: string; value: string | number }[] }>();
  for (const b of eff.breakdown) {
    const g = grouped.get(b.aptitudeId) ?? { name: b.aptitudeName, rows: [] };
    g.rows.push({ field: b.field, value: b.value });
    grouped.set(b.aptitudeId, g);
  }
  const totalBonuses = eff.breakdown.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-xs px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
          title="Detalhamento de bônus passivos das auras"
        >
          <Info className="h-3 w-3" />
          {totalBonuses > 0 ? `${totalBonuses} bônus` : 'Sem bônus'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Proveniência de Aura</span>
          </div>

          {totalBonuses === 0 ? (
            <div className="text-xs text-muted-foreground italic py-2">
              Nenhuma aura passiva ativa contribuindo com bônus no momento.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {Array.from(grouped.entries()).map(([id, g]) => (
                <div key={id} className="rounded-md border border-border bg-card/40 p-2">
                  <div className="text-xs font-bold text-foreground mb-1">{g.name}</div>
                  <div className="space-y-0.5">
                    {g.rows.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-muted-foreground">{r.field}</span>
                        <span className="font-mono font-bold text-primary">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {eff.notes.length > 0 && (
            <div className="pt-1 border-t border-border space-y-0.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Notas</div>
              {eff.notes.map((n, i) => (
                <div key={i} className="text-xs text-foreground/80 italic leading-snug">
                  • {n}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
