import "../invocacoes/invocations.css";
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import type { Character } from '@/types';
import { CriadorShikigami } from './CriadorShikigami';
import { ControladorInvocacoesSection } from './ControladorInvocacoesSection';
import { cn } from '@/lib/utils';
import { Plus, BookOpen } from 'lucide-react';

export function ControladorShikigamisAba({ character }: { character: Character }) {
  const [aba, setAba] = useState<'criar' | 'biblioteca'>('biblioteca');
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
  const voltarBiblioteca = () => {
    setCloseAfterTransition(true);
    setAba('biblioteca');
  };
  const novaFicha = () => { setCloseAfterTransition(false); setEditingId(null); setDraftKey(key => key + 1); setCreatorOpened(true); setAba('criar'); };
  const finalizarFechamento = () => {
    if (!closeAfterTransition || aba === 'criar') return;
    setCreatorOpened(false);
    setCloseAfterTransition(false);
    setEditingId(null);
    setDraftKey(key => key + 1);
  };

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
        aria-label="Shikigamis do Controlador"
        className={cn("inv-topnav flex gap-2 mb-4")}
      >
        <motion.button
          type="button"
          aria-pressed={aba === 'criar'}
          onClick={() => { setCloseAfterTransition(false); setCreatorOpened(true); setAba('criar'); }}
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          className={cn(
            "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            aba === 'criar'
              ? "bg-primary text-primary-foreground glow-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
              : "bg-transparent text-foreground border border-border/50 hover:bg-accent/10 hover:border-primary/30"
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Criar ou editar ficha</span>
        </motion.button>
        <motion.button
          type="button"
          aria-pressed={aba === 'biblioteca'}
          onClick={() => setAba('biblioteca')}
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          className={cn(
            "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            aba === 'biblioteca'
              ? "bg-primary text-primary-foreground glow-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
              : "bg-transparent text-foreground border border-border/50 hover:bg-accent/10 hover:border-primary/30"
          )}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span>Biblioteca e Invocações</span>
        </motion.button>
      </div>

      <div className="inv-view-stack" data-active-view={aba}>
        <motion.div
          role="region"
          aria-label="Ficha de invocação"
          aria-hidden={aba !== 'criar'}
          inert={aba !== 'criar'}
          data-active={aba === 'criar'}
          className="inv-view-panel"
          initial={false}
          animate={{
            height: aba === 'criar' && creatorOpened ? 'auto' : 0,
            opacity: aba === 'criar' && creatorOpened ? 1 : 0,
            y: reduceMotion || (aba === 'criar' && creatorOpened) ? 0 : -6,
          }}
          transition={viewTransition}
          onAnimationComplete={finalizarFechamento}
        >
          {creatorOpened && <CriadorShikigami key={draftKey} character={character} initial={fichaEdicao} onSaved={voltarBiblioteca} onCancel={voltarBiblioteca} />}
        </motion.div>
        <motion.div
          role="region"
          aria-label="Biblioteca de invocações"
          aria-hidden={aba !== 'biblioteca'}
          inert={aba !== 'biblioteca'}
          data-active={aba === 'biblioteca'}
          className="inv-view-panel"
          initial={false}
          animate={{
            height: aba === 'biblioteca' ? 'auto' : 0,
            opacity: aba === 'biblioteca' ? 1 : 0,
            y: reduceMotion || aba === 'biblioteca' ? 0 : -6,
          }}
          transition={viewTransition}
        >
          <ControladorInvocacoesSection character={character} onEditFicha={editar} onCreateFicha={novaFicha} />
        </motion.div>
      </div>
    </div>
  );
}
