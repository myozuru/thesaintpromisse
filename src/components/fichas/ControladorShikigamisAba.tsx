import "../invocacoes/invocations.css";
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import type { Character } from '@/types';
import { CriadorShikigami } from './CriadorShikigami';
import { ControladorInvocacoesSection } from './ControladorInvocacoesSection';
import { RituaisDezSombrasSection } from './RituaisDezSombrasSection';
import { cn } from '@/lib/utils';
import { Plus, BookOpen, ScrollText, Package } from 'lucide-react';

type AbaType = 'minhas' | 'catalogo' | 'rituais' | 'criar';

export function ControladorShikigamisAba({ character, canViewCatalog = true }: { character: Character; canViewCatalog?: boolean }) {
  const [aba, setAba] = useState<AbaType>('minhas');
  const [creatorOpened, setCreatorOpened] = useState(false);
  const [closeAfterTransition, setCloseAfterTransition] = useState(false);
  const [draftKey, setDraftKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion() === true;
  const viewTransition = {
    height: { duration: reduceMotion ? 0.22 : 0.34, ease: [0.22, 1, 0.36, 1] as const },
    opacity: { duration: reduceMotion ? 0.18 : 0.24, ease: 'easeOut' as const },
    y: { duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' as const },
  };
  const catalogo = character.invocacoesConhecidas ?? [];
  const fichaEdicao = editingId ? catalogo.find(inv => inv.id === editingId) : undefined;
  const editar = (id: string) => {
    setCloseAfterTransition(false);
    setCreatorOpened(true);
    setDraftKey(key => key + 1);
    setEditingId(id);
    setAba('criar');
  };
  const voltarMinhas = () => {
    setCloseAfterTransition(true);
    setAba('minhas');
  };
  const novaFicha = () => { setCloseAfterTransition(false); setEditingId(null); setDraftKey(key => key + 1); setCreatorOpened(true); setAba('criar'); };
  const finalizarFechamento = () => {
    if (!closeAfterTransition || aba === 'criar') return;
    setCreatorOpened(false);
    setCloseAfterTransition(false);
    setEditingId(null);
    setDraftKey(key => key + 1);
  };

  // Garante que a aba inicial seja válida quando canViewCatalog muda
  const abaVisivel = !canViewCatalog && aba === 'catalogo' ? 'minhas' : aba;

  return (
    <div
      onWheelCapture={event => {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) target.blur();
      }}
      className={cn("invocations-workspace inv-workspace-inner space-y-4 p-4")}
    >
      <div
        role="navigation"
        aria-label="Invocações do personagem"
        data-catalog-visible={canViewCatalog}
        className={cn("inv-topnav flex gap-2 mb-4")}
      >
        <motion.button
          type="button"
          aria-pressed={abaVisivel === 'minhas'}
          onClick={() => setAba('minhas')}
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          className={cn(
            "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            abaVisivel === 'minhas'
              ? "bg-primary text-primary-foreground glow-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
              : "bg-transparent text-foreground border border-border/50 hover:bg-accent/10 hover:border-primary/30"
          )}
        >
          <Package className="h-4 w-4" aria-hidden="true" />
          <span>Minhas invocações</span>
        </motion.button>
        {canViewCatalog && (
          <motion.button
            type="button"
            aria-pressed={abaVisivel === 'catalogo'}
            onClick={() => setAba('catalogo')}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              abaVisivel === 'catalogo'
                ? "bg-primary text-primary-foreground glow-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                : "bg-transparent text-foreground border border-border/50 hover:bg-accent/10 hover:border-primary/30"
            )}
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Catálogo</span>
          </motion.button>
        )}
        <motion.button
          type="button"
          aria-pressed={abaVisivel === 'rituais'}
          onClick={() => setAba('rituais')}
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          className={cn(
            "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            abaVisivel === 'rituais'
              ? "bg-primary text-primary-foreground glow-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
              : "bg-transparent text-foreground border border-border/50 hover:bg-accent/10 hover:border-primary/30"
          )}
        >
          <ScrollText className="h-4 w-4" aria-hidden="true" />
          <span>Rituais</span>
        </motion.button>
        <motion.button
          type="button"
          aria-pressed={abaVisivel === 'criar'}
          onClick={() => { setCloseAfterTransition(false); setCreatorOpened(true); setAba('criar'); }}
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          className={cn(
            "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            abaVisivel === 'criar'
              ? "bg-primary text-primary-foreground glow-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
              : "bg-transparent text-foreground border border-border/50 hover:bg-accent/10 hover:border-primary/30"
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Criar ou editar</span>
        </motion.button>
      </div>

      <div className="inv-view-stack" data-active-view={abaVisivel}>
        <motion.div
          role="region"
          aria-label="Ficha de invocação"
          aria-hidden={abaVisivel !== 'criar'}
          inert={abaVisivel !== 'criar'}
          data-active={abaVisivel === 'criar'}
          className="inv-view-panel"
          initial={false}
          animate={{
            height: abaVisivel === 'criar' && creatorOpened ? 'auto' : 0,
            opacity: abaVisivel === 'criar' && creatorOpened ? 1 : 0,
            y: reduceMotion || (abaVisivel === 'criar' && creatorOpened) ? 0 : -6,
          }}
          transition={viewTransition}
          onAnimationComplete={finalizarFechamento}
        >
          {creatorOpened && <CriadorShikigami key={draftKey} character={character} initial={fichaEdicao} onSaved={voltarMinhas} onCancel={voltarMinhas} />}
        </motion.div>
        <motion.div
          role="region"
          aria-label={abaVisivel === 'catalogo' ? 'Catálogo de invocações' : 'Minhas invocações'}
          aria-hidden={abaVisivel === 'criar' || abaVisivel === 'rituais'}
          inert={abaVisivel === 'criar' || abaVisivel === 'rituais'}
          data-active={abaVisivel === 'minhas' || abaVisivel === 'catalogo'}
          className="inv-view-panel"
          initial={false}
          animate={{
            height: abaVisivel === 'minhas' || abaVisivel === 'catalogo' ? 'auto' : 0,
            opacity: abaVisivel === 'minhas' || abaVisivel === 'catalogo' ? 1 : 0,
            y: reduceMotion || abaVisivel === 'minhas' || abaVisivel === 'catalogo' ? 0 : -6,
          }}
          transition={viewTransition}
        >
          <ControladorInvocacoesSection character={character} view={canViewCatalog && abaVisivel === 'catalogo' ? 'catalog' : 'owned'} canViewCatalog={canViewCatalog} onBrowseCatalog={canViewCatalog ? () => setAba('catalogo') : undefined} onEditFicha={editar} onCreateFicha={novaFicha} />
        </motion.div>
        <motion.div
          role="region"
          aria-label="Rituais das Dez Sombras"
          aria-hidden={abaVisivel !== 'rituais'}
          inert={abaVisivel !== 'rituais'}
          data-active={abaVisivel === 'rituais'}
          className="inv-view-panel"
          initial={false}
          animate={{
            height: abaVisivel === 'rituais' ? 'auto' : 0,
            opacity: abaVisivel === 'rituais' ? 1 : 0,
            y: reduceMotion || abaVisivel === 'rituais' ? 0 : -6,
          }}
          transition={viewTransition}
        >
          {abaVisivel === 'rituais' && <RituaisDezSombrasSection character={character} />}
        </motion.div>
      </div>
    </div>
  );
}
