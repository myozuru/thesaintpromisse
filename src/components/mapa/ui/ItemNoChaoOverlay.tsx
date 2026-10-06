import { useState } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { findMyCharacter } from '@/lib/myCharacter';
import { tokenDaFicha } from '@/stores/useAlvoMapaStore';
import { touchDistanceMeters } from '@/lib/touchRange';
import { recolherItemDoChao, invocarItemNoChao } from '@/lib/omni/itensNoChao';
import { screenToWorld } from '@/components/mapa/GridEngine';
import { OmniItemImagem } from '@/components/omni/OmniItemImagem';

export function ItemNoChaoOverlay() {
  const ms = useMapStore(), chars = useCharacterStore(s => s.characters);
  const profile = useProfileStore(s => s.activeProfileId), master = useRoleStore(s => s.role) === 'MASTER';
  const entidades = useOmniEntidadesStore(s => s.entidades);
  const [erro, setErro] = useState<string | null>(null);
  const [invocando, setInvocando] = useState(false);
  const [escolha, setEscolha] = useState('');
  const items = Object.values(ms.entities).filter(e => !!e.groundItem && !e.hidden);
  const catalogo = Object.values(entidades).filter(e => e.categoria === 'arma' || e.categoria === 'item').sort((a, b) => a.nome.localeCompare(b.nome));
  if (!items.length && !master) return null;
  const invocar = (alvo: HTMLElement) => {
    try {
      const cam = ms.camera;
      const area = (alvo.closest('[data-item-chao]')?.parentElement ?? document.body).getBoundingClientRect();
      const centro = screenToWorld(area.width / 2, area.height / 2, cam);
      invocarItemNoChao(escolha, centro); setErro(null); setInvocando(false); setEscolha('');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível invocar.'); }
  };
  return <div data-item-chao className="absolute bottom-20 left-3 z-40 max-h-72 max-w-80 overflow-y-auto rounded-lg border border-border bg-card/95 p-2 pointer-events-auto">
    <div className="flex items-center gap-2"><b className="text-xs">Itens no chão</b>
      {master && <button type="button" className="ml-auto rounded border border-primary/50 px-2 py-0.5 text-xs text-primary" onClick={() => setInvocando(v => !v)}>{invocando ? 'Fechar' : '+ Invocar item'}</button>}
    </div>
    {master && invocando && <div className="mt-2 flex items-center gap-1">
      <select aria-label="Item do catálogo" value={escolha} onChange={e => setEscolha(e.target.value)} className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-1 text-xs">
        <option value="">— escolha uma arma/item —</option>
        {catalogo.map(e => <option key={e.id} value={e.id}>{e.categoria === 'arma' ? '⚔️' : '📦'} {e.nome}</option>)}
      </select>
      <button type="button" disabled={!escolha} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={ev => invocar(ev.currentTarget)}>Colocar</button>
    </div>}
    {!items.length && <p className="mt-1 text-xs text-muted-foreground italic">Nada no chão.</p>}
    {items.map(e => {
      const char = findMyCharacter(chars, profile) ?? (master ? chars.find(c => c.id === e.groundItem!.droppedByCharId) : undefined);
      const token = char && tokenDaFicha(char), d = token ? touchDistanceMeters(token, e, ms.gridConfig) : null;
      const g = e.groundItem!;
      return <div key={e.id} className="mt-1 flex items-center gap-2 text-sm">
        {'item' in g && <OmniItemImagem entidade={g.item.entity} tamanho={24} />}
        <span className="min-w-0 flex-1 truncate">{e.label}</span>
        <button className="rounded border px-2 py-1 text-xs" disabled={!char || d === null || d > 1.55} title={d !== null ? `${d.toFixed(1)} m · recolher até 1,5 m` : 'Sua ficha precisa estar no mapa'} onClick={() => {
          try { recolherItemDoChao(char!.id, e.id); setErro(null); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível recolher.'); }
        }}>Recolher</button>
        {master && <button className="rounded border border-destructive/50 px-2 py-1 text-xs text-destructive" title="Remover do mapa" onClick={() => ms.removeEntities([e.id])}>✕</button>}
      </div>;
    })}{erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
  </div>;
}
