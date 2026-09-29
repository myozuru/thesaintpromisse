/**
 * Painel das Artes do Combate (Especialista em Combate, nível 1+).
 * Mostra os Pontos de Preparo, o botão "Analisar o campo" (ação comum → +2)
 * e a lista das cinco artes com custo e descrição. As artes em si são
 * ativadas no Painel de Ataque (checkboxes antes de rolar).
 */
import { useMemo } from 'react';
import { Swords, Eye, BatteryCharging } from 'lucide-react';
import type { Character } from '@/types';
import {
  ARTES_COMBATE,
  analisarCampo,
  getPreparoAtual,
  getPreparoMax,
  hasArtesCombate,
  metadeSab,
  sabMod,
  execucaoSilenciosaDice,
  investidaMoveMeters,
} from '@/lib/artesCombate';
import { cn } from '@/lib/utils';

export function ArtesCombatePanel({ character: c }: { character: Character }) {
  const preparoMax = useMemo(() => getPreparoMax(c), [c]);
  const preparo = getPreparoAtual(c);
  const sab = sabMod(c);

  if (!hasArtesCombate(c)) return null;

  const detalhe = (id: string): string => {
    switch (id) {
      case 'distracao_letal':
        return `No acerto: Defesa do alvo −${metadeSab(c)} por 1 rodada.`;
      case 'execucao_silenciosa':
        return `Vs. Desprevenido: +${execucaoSilenciosaDice(c)}d6 de dano.`;
      case 'golpe_descendente':
        return `No acerto CaC: sua Defesa +${metadeSab(c)} até seu próximo turno.`;
      case 'investida_imediata':
        return `Aproxima ${investidaMoveMeters(c).toLocaleString('pt-BR')} m do alvo (sem AdO) e ataca.`;
      default:
        return '';
    }
  };

  return (
    <div className="px-4 pb-3">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <BatteryCharging className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Artes do Combate
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Preparo: <b className={cn('text-sm', preparo > 0 ? 'text-amber-300' : 'text-destructive')}>{preparo}</b>
            <span className="text-muted-foreground">/{preparoMax}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => analisarCampo(c.id)}
          disabled={(c.actionsCurrent ?? 0) <= 0 || preparo >= preparoMax}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
            (c.actionsCurrent ?? 0) > 0 && preparo < preparoMax
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
              : 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed',
          )}
          title="Gasta a Ação Comum para analisar o campo de batalha e recuperar 2 Pontos de Preparo"
        >
          <Eye className="h-3.5 w-3.5" />
          Analisar o campo de batalha (+2 Preparo · gasta Ação Comum)
        </button>

        <div className="space-y-1.5">
          {ARTES_COMBATE.map((arte) => (
            <div
              key={arte.id}
              className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-2"
            >
              <div className="flex items-center gap-2">
                <Swords className="h-3 w-3 text-amber-400/80 shrink-0" />
                <span className="text-xs font-semibold text-foreground">{arte.name}</span>
                <span className="ml-auto rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  {arte.cost} PP
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{arte.summary}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-amber-200/80">{detalhe(arte.id)}</p>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground leading-snug">
          Preparo máximo = nível + Mod. de Sabedoria ({sab >= 0 ? '+' : ''}{sab}). Recupera +1 ao
          eliminar um inimigo, metade no descanso curto e tudo no descanso longo. Ative as artes
          no Painel de Ataque antes de rolar.
        </p>
      </div>
    </div>
  );
}
