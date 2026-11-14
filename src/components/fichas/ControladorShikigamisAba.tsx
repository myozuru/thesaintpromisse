import "../invocacoes/invocations.css";
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import type { Character } from '@/types';
import { CriadorShikigami } from './CriadorShikigami';
import { ControladorInvocacoesSection } from './ControladorInvocacoesSection';

export function ControladorShikigamisAba({ character }: { character: Character }) {
  const [aba, setAba] = useState<'minhas' | 'catalogo' | 'criar'>('minhas');
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
  return <div onWheelCapture={event => { const target = event.target; if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) target.blur(); }} className="invocations-workspace inv-workspace-inner space-y-3">
    <div role="navigation" aria-label="Invocações do personagem" className="inv-topnav">
      <motion.button type="button" aria-pressed={aba === 'minhas'} onClick={() => setAba('minhas')} whileTap={reduceMotion ? undefined : { scale: 0.985 }} className={`rounded px-3 py-2 text-sm ${aba === 'minhas' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Minhas invocações</motion.button>
      <motion.button type="button" aria-pressed={aba === 'catalogo'} onClick={() => setAba('catalogo')} whileTap={reduceMotion ? undefined : { scale: 0.985 }} className={`rounded px-3 py-2 text-sm ${aba === 'catalogo' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Catálogo</motion.button>
      <motion.button type="button" aria-pressed={aba === 'criar'} onClick={() => { setCloseAfterTransition(false); setCreatorOpened(true); setAba('criar'); }} whileTap={reduceMotion ? undefined : { scale: 0.985 }} className={`rounded px-3 py-2 text-sm ${aba === 'criar' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Criar ou editar</motion.button>
    </div>
    <div className="inv-view-stack" data-active-view={aba}>
      <motion.div role="region" aria-label="Ficha de invocação" aria-hidden={aba !== 'criar'} inert={aba !== 'criar'} data-active={aba === 'criar'} className="inv-view-panel" initial={false}
        animate={{ height: aba === 'criar' && creatorOpened ? 'auto' : 0, opacity: aba === 'criar' && creatorOpened ? 1 : 0, y: reduceMotion || (aba === 'criar' && creatorOpened) ? 0 : -6 }}
        transition={viewTransition} onAnimationComplete={finalizarFechamento}>
        {creatorOpened && <CriadorShikigami key={draftKey} character={character} initial={fichaEdicao} onSaved={voltarBiblioteca} onCancel={voltarBiblioteca} />}
      </motion.div>
      <motion.div role="region" aria-label={aba === 'minhas' ? 'Minhas invocações' : 'Catálogo de invocações'} aria-hidden={aba === 'criar'} inert={aba === 'criar'} data-active={aba !== 'criar'} className="inv-view-panel" initial={false}
        animate={{ height: aba !== 'criar' ? 'auto' : 0, opacity: aba !== 'criar' ? 1 : 0, y: reduceMotion || aba !== 'criar' ? 0 : -6 }}
        transition={viewTransition}>
        <ControladorInvocacoesSection character={character} view={aba === 'minhas' ? 'owned' : 'catalog'} onBrowseCatalog={() => setAba('catalogo')} onEditFicha={editar} onCreateFicha={novaFicha} />
      </motion.div>
    </div>
  </div>;
}
