import { Swords, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GOLPE_PROPS, type GolpeSelecao, type GolpePropId } from '@/lib/golpeEspecial';

interface Props {
  sel: GolpeSelecao;
  onChange: (s: GolpeSelecao) => void;
  custo: number;
  peAtual: number;
  precisoUsado: number;
  amploTargetId: string;
  onAmploTarget: (id: string) => void;
  amploOptions: { id: string; name: string }[];
  longoM: number;
  penetranteRD: number;
}

/** Montagem do Golpe Especial (Especialista em Combate, nível 4+). */
export function GolpeEspecialSection({
  sel, onChange, custo, peAtual, precisoUsado, amploTargetId, onAmploTarget, amploOptions, longoM, penetranteRD,
}: Props) {
  const setN = (id: GolpePropId, n: number) => onChange({ ...sel, [id]: n });
  const semPE = custo > peAtual;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2" aria-label="Golpe Especial">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
        <Swords className="h-3.5 w-3.5" /> Golpe Especial
        <span className="ml-auto normal-case font-normal text-muted-foreground">
          PE: <b className={semPE ? 'text-destructive' : 'text-foreground'}>{peAtual}</b>
          {custo > 0 && <span className={semPE ? 'text-destructive' : 'text-primary'}> · custo {custo} PE</span>}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {GOLPE_PROPS.map((p) => {
          const n = sel[p.id] ?? 0;
          const unit = p.id === 'preciso' && precisoUsado > 0 ? 2 : p.cost;
          const detail = p.id === 'longo' ? `+${longoM.toLocaleString('pt-BR')} m`
            : p.id === 'penetrante' ? `ignora ${penetranteRD} RD` : null;
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-1 text-xs',
                n > 0 ? 'border-primary/60 bg-primary/15' : 'border-border bg-background',
              )}
              title={p.summary}
            >
              <button
                type="button"
                aria-label={`Golpe ${p.name}`}
                aria-pressed={n > 0}
                onClick={() => setN(p.id, n > 0 && p.max === 1 ? 0 : Math.min(p.max, n + 1) || 1)}
                className="flex-1 text-left"
              >
                <span className="font-bold">{p.name}</span>{' '}
                <span className={unit < 0 ? 'text-emerald-400' : 'text-primary'}>{unit > 0 ? `+${unit}` : unit} PE</span>
                <span className="block text-xs text-muted-foreground leading-tight">{detail ?? p.summary}</span>
              </button>
              {p.max > 1 && (
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={`Menos ${p.name}`} onClick={() => setN(p.id, Math.max(0, n - 1))} className="rounded border border-border p-0.5"><Minus className="h-3 w-3" /></button>
                  <span className="w-3 text-center font-mono">{n}</span>
                  <button type="button" aria-label={`Mais ${p.name}`} onClick={() => setN(p.id, Math.min(p.max, n + 1))} className="rounded border border-border p-0.5"><Plus className="h-3 w-3" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(sel.amplo ?? 0) > 0 && (
        <label className="flex items-center gap-2 text-xs">
          <span className="font-bold">Criatura extra:</span>
          <select
            aria-label="Alvo extra do Golpe Amplo"
            value={amploTargetId}
            onChange={(e) => onAmploTarget(e.target.value)}
            className="flex-1 rounded border border-border bg-background px-1 py-0.5"
          >
            <option value="">— escolha —</option>
            {amploOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      )}
      {custo > 0 && <p className="text-xs text-muted-foreground">Custo mínimo de 1 PE. Pago só quando o ataque é confirmado.</p>}
    </div>
  );
}
