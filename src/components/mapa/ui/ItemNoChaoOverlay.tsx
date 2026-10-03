import { useState } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { findMyCharacter } from '@/lib/myCharacter';
import { tokenDaFicha } from '@/stores/useAlvoMapaStore';
import { touchDistanceMeters } from '@/lib/touchRange';
import { recolherItemDoChao } from '@/lib/omni/itensNoChao';
export function ItemNoChaoOverlay() {
  const ms = useMapStore(), chars = useCharacterStore(s => s.characters);
  const profile = useProfileStore(s => s.activeProfileId), master = useRoleStore(s => s.role) === 'MASTER';
  const [erro, setErro] = useState<string | null>(null);
  const items = Object.values(ms.entities).filter(e => !!e.groundItem && !e.hidden);
  if (!items.length) return null;
  return <div className="absolute bottom-20 left-3 z-40 max-h-52 max-w-72 overflow-y-auto rounded-lg border border-border bg-card/95 p-2 pointer-events-auto">
    <b className="text-xs">Itens no chão</b>{items.map(e => {
      const char = findMyCharacter(chars, profile) ?? (master ? chars.find(c => c.id === e.groundItem!.droppedByCharId) : undefined);
      const token = char && tokenDaFicha(char), d = token ? touchDistanceMeters(token, e, ms.gridConfig) : null;
      return <div key={e.id} className="mt-1 flex items-center gap-2 text-sm"><span>{e.label}</span><button className="rounded border px-2 py-1 text-xs" disabled={!char || d === null || d > 1.55} title={d !== null ? `${d.toFixed(1)} m · recolher até 1,5 m` : 'Sua ficha precisa estar no mapa'} onClick={() => {
        try { recolherItemDoChao(char!.id, e.id); setErro(null); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível recolher.'); }
      }}>Recolher</button></div>;
    })}{erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
  </div>;
}
