/**
 * Painel "Efeitos Ativos" do Omni-Engine (Pilar 3 + Fatia 3).
 * Mostra em tempo real as instâncias de EfeitoAtivo com contagem regressiva,
 * e permite disparar manualmente o gatilho passivo de cada uma (teste).
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, X, Zap } from 'lucide-react';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { toTimelineSeconds } from '@/lib/omni/tempo';
import { executarGatilho } from '@/lib/omni/executor';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { toast } from 'sonner';

function formatRestante(seg: number): string {
  if (seg <= 0) return 'expirando...';
  if (seg < 60) return `${Math.ceil(seg)}s`;
  if (seg < 3600) return `${Math.floor(seg / 60)}m ${Math.ceil(seg % 60)}s`;
  if (seg < 86400) return `${Math.floor(seg / 3600)}h ${Math.floor((seg % 3600) / 60)}m`;
  return `${Math.floor(seg / 86400)}d`;
}

export function EfeitosAtivosPanel() {
  const efeitos = useOmniRuntimeStore((s) => s.efeitos);
  const removerEfeito = useOmniRuntimeStore((s) => s.removerEfeito);
  const chronos = useChronosStore();
  const [, force] = useState(0);

  useEffect(() => {
    const i = setInterval(() => force((v) => v + 1), 500);
    return () => clearInterval(i);
  }, []);

  const agora = toTimelineSeconds(chronos);
  const lista = Object.values(efeitos).sort((a, b) => {
    const ea = a.expiraEm ?? Infinity;
    const eb = b.expiraEm ?? Infinity;
    return ea - eb;
  });

  if (lista.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-center text-xs text-muted-foreground">
        <Clock className="h-5 w-5 mx-auto text-primary/40 mb-1" />
        Nenhum efeito ativo no momento.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Efeitos Ativos ({lista.length})</span>
      </div>
      <div className="space-y-1.5">
        {lista.map((ef) => {
          const restante = ef.expiraEm === null ? null : ef.expiraEm - agora;
          return (
            <div key={ef.id} className="flex items-center justify-between gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
              <div className="min-w-0">
                <div className="font-medium truncate">{ef.nomeSnapshot}</div>
                <div className="text-xs text-muted-foreground">
                  {restante === null ? '∞ permanente' : `⏱ ${formatRestante(restante)}`}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-primary"
                  title="Disparar gatilho passivo (teste)"
                  onClick={() => {
                    const ent = useOmniEntidadesStore.getState().entidades[ef.entidadeId];
                    if (!ent) {
                      toast.error('Entidade não encontrada');
                      return;
                    }
                    const usuario = useCharacterStore.getState().characters.find((c) => c.id === ef.sourceCharId);
                    const alvo = useCharacterStore.getState().characters.find((c) => c.id === ef.targetCharId);
                    const n = executarGatilho(ent, 'aoEquipar', { usuario, alvo, profundidade: 0 });
                    toast.success(`${ent.nome}: ${n} bloco(s) disparado(s)`);
                  }}
                >
                  <Zap className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removerEfeito(ef.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
