import { useState } from 'react';
import { soltarItemNoChao } from '@/lib/omni/itensNoChao';
export function SoltarItemButton({ charId, itemId, legado = false }: { charId: string; itemId: string; legado?: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  return <span className="inline-flex flex-col"><button type="button" className="rounded border border-amber-500/50 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10" onClick={e => {
    e.stopPropagation(); try { soltarItemNoChao(charId, itemId, legado); setErro(null); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível soltar o item.'); }
  }}>Soltar no chão</button>{erro && <span role="alert" className="text-xs text-destructive">{erro}</span>}</span>;
}
