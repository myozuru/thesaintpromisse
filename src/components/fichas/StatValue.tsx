/**
 * 🟣 StatValue — Renderização reativa de qualquer número de status da ficha.
 *
 * Comparando `valorBase` com `valorAtual`:
 *   • atual > base → texto violeta (#7C3AED)  [Buff]
 *   • atual < base → texto vermelho (#EF4444) [Debuff]
 *   • atual = base → cor neutra padrão
 *
 * Quando há diferença, encapsula o número num Tooltip com a quebra
 * matemática estruturada: Base + cada modificador (Origem).
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface StatModifierOrigin {
  /** Nome legível da origem (ex: "Amuleto do Treinamento"). */
  nome: string;
  /** Diferença numérica positiva (buff) ou negativa (debuff). */
  delta: number;
}

interface StatValueProps {
  valorBase: number;
  valorAtual: number;
  origens?: StatModifierOrigin[];
  /** Texto a renderizar — se omitido, usa o próprio `valorAtual`. */
  children?: React.ReactNode;
  className?: string;
  /** Sufixo opcional (ex: "/", " m"). Mantém a cor neutra. */
  suffix?: React.ReactNode;
}

export function StatValue({
  valorBase,
  valorAtual,
  origens = [],
  children,
  className,
  suffix,
}: StatValueProps) {
  const diff = valorAtual - valorBase;
  const isBuff = diff > 0;
  const isDebuff = diff < 0;
  const hasChange = diff !== 0;

  const colorClass = isBuff
    ? 'text-violet-400'
    : isDebuff
      ? 'text-red-400'
      : '';

  const display = children ?? valorAtual;

  const node = (
    <span
      className={cn(
        'inline-flex items-baseline gap-0.5 transition-colors',
        colorClass,
        hasChange && 'font-semibold cursor-help underline decoration-dotted decoration-current/40 underline-offset-2',
        className,
      )}
    >
      {display}
      {suffix}
    </span>
  );

  if (!hasChange) return node;

  // Filtra origens que efetivamente contribuíram com algum delta.
  const origensRelevantes = origens.filter((o) => o.delta !== 0);
  // Se não houver origens detalhadas, gera uma única linha "outras fontes".
  const linhasModificadores = origensRelevantes.length > 0
    ? origensRelevantes
    : [{ nome: 'Modificadores ativos', delta: diff }];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-1 text-xs">
          <div className="font-semibold text-foreground">
            Base: <span className="font-mono">{valorBase}</span>
          </div>
          {linhasModificadores.map((o, i) => {
            const sinal = o.delta > 0 ? '+' : '';
            const corDelta = o.delta > 0 ? 'text-violet-400' : 'text-red-400';
            return (
              <div key={i} className="text-muted-foreground">
                Modificador:{' '}
                <span className={cn('font-mono font-semibold', corDelta)}>
                  {sinal}{o.delta}
                </span>
                {' '}
                <span className="text-foreground/80">(Origem: {o.nome})</span>
              </div>
            );
          })}
          <div className="pt-1 border-t border-border/40 text-foreground">
            Total: <span className="font-mono font-bold">{valorAtual}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
