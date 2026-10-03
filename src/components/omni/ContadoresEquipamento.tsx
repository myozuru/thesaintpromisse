import { useMemo } from 'react';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import { contadoresDaEntidade } from '@/lib/omni/contadoresDaEntidade';
import { useCharacterStore } from '@/stores/useCharacterStore';

export function ContadoresEquipamento({ charId, entidade }: { charId: string; entidade: EntidadeOmni }) {
  const personagens = useCharacterStore(s => s.characters);
  const contadores = personagens.find(c => c.id === charId)?.omniCounters ?? {};
  const nomes = useMemo(() => contadoresDaEntidade(entidade), [entidade]);
  if (!nomes.length) return null;
  return <div role="group" aria-label={`Contadores de ${entidade.nome}`} className="mt-1 flex flex-wrap gap-1" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    {nomes.map(nome => {
      const prefixo = `${nome}__fonte__`;
      const fontes = Object.entries(contadores).filter(([k, v]) => k.startsWith(prefixo) && Number.isFinite(v) && v > 0);
      const titulo = nome.replace(/_/g, ' ').replace(/^\p{L}/u, l => l.toUpperCase());
      return <details key={nome} className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-xs">
        <summary className="cursor-pointer text-violet-300" title="Contador do portador; abra para ver as contribuições registradas">{titulo}: {contadores[nome] ?? 0}</summary>
        <div className="mt-1 space-y-1 text-foreground">
          {fontes.length ? fontes.map(([k, v]) => {
            const id = k.slice(prefixo.length), fonte = personagens.find(c => c.id === id);
            return <div key={k}>{fonte?.name ?? id}: {v}</div>;
          }) : <p className="text-muted-foreground">Sem contribuições por origem registradas.</p>}
        </div>
      </details>;
    })}
  </div>;
}
