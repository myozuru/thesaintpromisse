import { useState } from 'react';
import type { Character } from '@/types';
import { CriadorShikigami } from './CriadorShikigami';
import { ControladorInvocacoesSection } from './ControladorInvocacoesSection';

export function ControladorShikigamisAba({character}:{character:Character}){
 const [aba,setAba]=useState<'criar'|'biblioteca'>('criar');
 return <div className="space-y-3">
   <div role="tablist" aria-label="Shikigamis do Controlador" className="flex flex-wrap gap-2 border-b border-border pb-2">
     <button type="button" role="tab" aria-selected={aba==='criar'} onClick={()=>setAba('criar')} className={`rounded px-3 py-2 text-sm ${aba==='criar'?'bg-primary text-primary-foreground':'border border-border'}`}>Criar Shikigami</button>
     <button type="button" role="tab" aria-selected={aba==='biblioteca'} onClick={()=>setAba('biblioteca')} className={`rounded px-3 py-2 text-sm ${aba==='biblioteca'?'bg-primary text-primary-foreground':'border border-border'}`}>Biblioteca e Invocações</button>
   </div>
   <div role="tabpanel">{aba==='criar'?<CriadorShikigami character={character}/>:<ControladorInvocacoesSection character={character}/>}</div>
 </div>;
}
