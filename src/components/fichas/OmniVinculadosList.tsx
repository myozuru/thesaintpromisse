/**
 * Lista todas as entidades Omni "vinculadas" à ficha (campo
 * `Character.omniAtivos`) agrupadas por categoria. Cada linha mostra:
 *  - Badge da categoria (Feitiço / Talento / Passiva / Aura / Condição)
 *  - Nome e descrição da entidade (resolvida do useOmniEntidadesStore)
 *  - Botão "Desvincular" — remove o vínculo, MAS mantém a instância no
 *    inventário (igual a desequipar um item).
 *
 * Mostra um aviso amigável se a entidade-fonte foi deletada do catálogo.
 */
import { useState } from 'react';
import { Sparkles, Star, Wand2, AlertTriangle, Link2Off, Skull, Sparkle, Sword, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useToast } from '@/hooks/use-toast';
import { normalizarCombatData } from '@/lib/omni/tipos';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import { OmniDetalhesDialog } from './OmniDetalhesDialog';

const CATEGORIA_META: Record<
  'feitico' | 'talento' | 'passiva' | 'aura' | 'condicao',
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  feitico:  { label: 'Feitiço',  icon: Wand2,    cls: 'text-violet-300 border-violet-500/40 bg-violet-500/10' },
  talento:  { label: 'Talento',  icon: Star,     cls: 'text-amber-300  border-amber-500/40  bg-amber-500/10' },
  passiva:  { label: 'Passiva',  icon: Sparkles, cls: 'text-sky-300    border-sky-500/40    bg-sky-500/10' },
  aura:     { label: 'Aura',     icon: Sparkle,  cls: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10' },
  condicao: { label: 'Condição', icon: Skull,    cls: 'text-rose-300   border-rose-500/40   bg-rose-500/10' },
};

interface Props {
  charId: string;
  charName: string;
  /**
   * Callback chamado quando o jogador clica em "⚔ Usar" em uma entidade
   * vinculada que possui Script Ativo (`effectsActive`). Recebe a entidade
   * resolvida do catálogo Omni — o pai (CharacterCard) decide como executar
   * (tipicamente reusa `executarAcaoItem`).
   */
  onUsar?: (entidade: EntidadeOmni) => void;
  /**
   * Se passado, filtra para mostrar apenas vínculos de uma categoria
   * (usado para embutir a lista dentro das Sections nativas: Passivas, Feitiços, etc.).
   */
  filtroCategoria?: 'feitico' | 'talento' | 'passiva' | 'aura' | 'condicao' | 'voto';
  /** Oculta o estado vazio quando embutido dentro de outra seção. */
  hideEmpty?: boolean;
}

export function OmniVinculadosList({ charId, charName, onUsar, filtroCategoria, hideEmpty }: Props) {
  const { toast } = useToast();
  const character = useCharacterStore((s) => s.characters.find((c) => c.id === charId));
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const desvincular = useCharacterStore((s) => s.desvincularOmniAtivo);
  const addLog = useLogStore((s) => s.addLog);
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const [detalhes, setDetalhes] = useState<EntidadeOmni | null>(null);

  const todos = character?.omniAtivos ?? [];
  const ativos = filtroCategoria ? todos.filter((a) => a.categoria === filtroCategoria) : todos;

  if (ativos.length === 0) {
    if (hideEmpty) return null;
    return (
      <p className="text-sm text-muted-foreground italic">
        Nenhuma entidade Omni vinculada. No inventário, clique em <strong className="text-emerald-300">🔗 Vincular</strong> em um feitiço, talento, passiva, aura ou condição para que ele apareça aqui.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        {ativos.map((vinc) => {
          const meta = CATEGORIA_META[vinc.categoria];
          const Icon = meta.icon;
          const ent = entidades[vinc.entidadeId];
          const orfa = !ent;
          const cd = ent ? normalizarCombatData(ent.combatData) : null;
          const podeUsar = !!ent && !!onUsar && (cd?.effectsActive?.length ?? 0) > 0;
          const podeAbrir = !!ent;

          return (
            <div
              key={vinc.id}
              role={podeAbrir ? 'button' : undefined}
              tabIndex={podeAbrir ? 0 : undefined}
              onClick={() => { if (ent) setDetalhes(ent); }}
              onKeyDown={(e) => {
                if (!ent) return;
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetalhes(ent); }
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${meta.cls} ${podeAbrir ? 'cursor-pointer hover:brightness-125' : ''}`}
              title={podeAbrir ? 'Clique para ver detalhes' : undefined}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider opacity-90">
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
                <span className="font-semibold text-foreground inline-flex items-center gap-1">
                  {ent?.nome ?? '(entidade não encontrada)'}
                  {podeAbrir && <Info className="h-3 w-3 opacity-50" />}
                </span>
                {orfa && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300"
                    title="A entidade foi removida do catálogo Omni. Você pode desvincular para limpar."
                  >
                    <AlertTriangle className="h-3 w-3" /> órfã
                  </span>
                )}
                {podeUsar && (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onUsar!(ent!); }}
                    className="ml-auto h-6 px-2 text-xs gap-1 bg-primary/80 hover:bg-primary text-primary-foreground"
                    title={`Executar Script Ativo de "${ent!.nome}"`}
                  >
                    <Sword className="h-3 w-3" /> Usar
                  </Button>
                )}
                {(() => {
                  const restrita = vinc.categoria === 'passiva' || vinc.categoria === 'feitico';
                  if (restrita && !isMaster) return null;
                  return (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        desvincular(charId, vinc.id);
                        addLog(
                          'system',
                          `🔗 "${ent?.nome ?? 'entidade'}" desvinculada da ficha de ${charName}.`,
                        );
                        toast({
                          title: `${ent?.nome ?? 'Entidade'} desvinculada`,
                          description: `Continua no inventário de ${charName}.`,
                        });
                      }}
                      className={`${podeUsar ? '' : 'ml-auto '}h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive`}
                      title="Remover vínculo (mantém a instância no inventário)"
                    >
                      <Link2Off className="h-3 w-3" /> Desvincular
                    </Button>
                  );
                })()}
              </div>
              {ent?.descricao && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{ent.descricao}</p>
              )}
            </div>
          );
        })}
      </div>
      <OmniDetalhesDialog open={!!detalhes} onOpenChange={(o) => !o && setDetalhes(null)} entidade={detalhes} />
    </>
  );
}
