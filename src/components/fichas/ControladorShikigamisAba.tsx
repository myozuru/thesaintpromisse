import { useState } from 'react';
import type { Character } from '@/types';
import { CriadorShikigami } from './CriadorShikigami';
import { ControladorInvocacoesSection } from './ControladorInvocacoesSection';

export function ControladorShikigamisAba({ character }: { character: Character }) {
  const [aba, setAba] = useState<'criar' | 'biblioteca'>('criar');
  const [editingId, setEditingId] = useState<string | null>(null);
  const catalogo = character.invocacoesConhecidas ?? [];
  const fichaEdicao = editingId ? catalogo.find(inv => inv.id === editingId) : undefined;
  const editar = (id: string) => {
    setEditingId(id);
    setAba('criar');
  };
  const voltarBiblioteca = () => {
    setEditingId(null);
    setAba('biblioteca');
  };
  return <div className="space-y-3">
    <div role="tablist" aria-label="Shikigamis do Controlador" className="flex flex-wrap gap-2 border-b border-border pb-2">
      <button type="button" role="tab" aria-selected={aba === 'criar'} onClick={() => { setEditingId(null); setAba('criar'); }} className={`rounded px-3 py-2 text-sm ${aba === 'criar' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Criar ou editar ficha</button>
      <button type="button" role="tab" aria-selected={aba === 'biblioteca'} onClick={() => setAba('biblioteca')} className={`rounded px-3 py-2 text-sm ${aba === 'biblioteca' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>Biblioteca e Invocações</button>
    </div>
    <div role="tabpanel">
      {aba === 'criar'
        ? <CriadorShikigami character={character} initial={fichaEdicao} onSaved={voltarBiblioteca} onCancel={editingId ? voltarBiblioteca : undefined} />
        : <ControladorInvocacoesSection character={character} onEditFicha={editar} />}
    </div>
  </div>;
}
