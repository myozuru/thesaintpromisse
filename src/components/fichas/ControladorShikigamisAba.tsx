import "../invocacoes/invocations.css";
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import type { Character } from '@/types';
import { CriadorShikigami } from './CriadorShikigami';
import { ControladorInvocacoesSection } from './ControladorInvocacoesSection';
import { RituaisDezSombrasSection } from './RituaisDezSombrasSection';

export function ControladorShikigamisAba({ character, canViewCatalog = true }: { character: Character; canViewCatalog?: boolean }) {
  const [aba, setAba] = useState<'minhas' | 'catalogo' | 'rituais' | 'criar'>('minhas');
  const [creatorOpened, setCreatorOpened] = useState(false);
  const [closeAfterTransition, setCloseAfterTransition] = useState(false);
  const [draftKey, setDraftKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const abaVisivel = !canViewCatalog && aba === 'catalogo' ? 'minhas' : aba;
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
    if (!closeAfterTransition || abaVisivel === 'criar') return;
    setCreatorOpened(false);
    setCloseAfterTransition(false);
    setEditingId(null);
    setDraftKey(key => key + 1);
  };
  return <div onWheelCapture={event => { const target = event.target; if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) target.blur(); }} className="invocations-workspace inv-workspace-inner space-y-3">
    <div role="navigation" aria-label="Invocações do personagem" data-catalog-visible={canViewCatalog} className="inv-topnav">
      <motion.button type="button" aria-pressed={abaVisivel === 'minhas'} onClick={() => setAba('minhas')} whileTap={reduceMotion ? undefined : { scale: 0.985 }} className={`rounded px-3 py-2 text-sm ${abaVisivel === 'minhas' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Minhas invocações</motion.button>
      {canViewCatalog && <motion.button type="button" aria-pressed={abaVisivel === 'catalogo'} onClick={() => setAba('catalogo')} whileTap={reduceMotion ? undefined : { scale: 0.985 }} className={`rounded px-3 py-2 text-sm ${abaVisivel === 'catalogo' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Catálogo</motion.button>}
      <motion.button type="button" aria-pressed={abaVisivel === 'rituais'} onClick={() => setAba('rituais')} whileTap={reduceMotion ? undefined : { scale: 0.985 }} className={`rounded px-3 py-2 text-sm ${abaVisivel === 'rituais' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Rituais</motion.button>
      <motion.button type="button" aria-pressed={abaVisivel === 'criar'} onClick={() => { setCloseAfterTransition(false); setCreatorOpened(true); setAba('criar'); }} whileTap={reduceMotion ? undefined : { scale: 0.985 }} className={`rounded px-3 py-2 text-sm ${abaVisivel === 'criar' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Criar ou editar</motion.button>
    </div>
    <div className="inv-view-stack" data-active-view={abaVisivel}>
      <motion.div role="region" aria-label="Ficha de invocação" aria-hidden={abaVisivel !== 'criar'} inert={abaVisivel !== 'criar'} data-active={abaVisivel === 'criar'} className="inv-view-panel" initial={false}
        animate={{ height: abaVisivel === 'criar' && creatorOpened ? 'auto' : 0, opacity: abaVisivel === 'criar' && creatorOpened ? 1 : 0, y: reduceMotion || (abaVisivel === 'criar' && creatorOpened) ? 0 : -6 }}
        transition={viewTransition} onAnimationComplete={finalizarFechamento}>
        {creatorOpened && <CriadorShikigami key={draftKey} character={character} initial={fichaEdicao} onSaved={voltarBiblioteca} onCancel={voltarBiblioteca} />}
      </motion.div>
      <motion.div role="region" aria-label={abaVisivel === 'catalogo' ? 'Catálogo de invocações' : 'Minhas invocações'} aria-hidden={abaVisivel === 'criar' || abaVisivel === 'rituais'} inert={abaVisivel === 'criar' || abaVisivel === 'rituais'} data-active={abaVisivel === 'minhas' || abaVisivel === 'catalogo'} className="inv-view-panel" initial={false}
        animate={{ height: abaVisivel === 'minhas' || abaVisivel === 'catalogo' ? 'auto' : 0, opacity: abaVisivel === 'minhas' || abaVisivel === 'catalogo' ? 1 : 0, y: reduceMotion || abaVisivel === 'minhas' || abaVisivel === 'catalogo' ? 0 : -6 }}
        transition={viewTransition}>
        <ControladorInvocacoesSection character={character} view={canViewCatalog && abaVisivel === 'catalogo' ? 'catalog' : 'owned'} canViewCatalog={canViewCatalog} onBrowseCatalog={canViewCatalog ? () => setAba('catalogo') : undefined} onEditFicha={editar} onCreateFicha={novaFicha} />
      </motion.div>
      <motion.div role="region" aria-label="Rituais das Dez Sombras" aria-hidden={abaVisivel !== 'rituais'} inert={abaVisivel !== 'rituais'} data-active={abaVisivel === 'rituais'} className="inv-view-panel" initial={false}
        animate={{ height: abaVisivel === 'rituais' ? 'auto' : 0, opacity: abaVisivel === 'rituais' ? 1 : 0, y: reduceMotion || abaVisivel === 'rituais' ? 0 : -6 }}
        transition={viewTransition}>
        {abaVisivel === 'rituais' && <RituaisDezSombrasSection character={character} />}
      </motion.div>
    </div>
  </div>;
}
