/** Aba Mapa: alterna entre a mesa de batalha e o Mapa do Mundo (com chefes). */
import { useState } from 'react';
import { Globe, Swords } from 'lucide-react';
import { MapaModule } from '@/components/mapa/MapaModule';
import { WorldMapView } from './WorldMapView';

export function MapaHub() {
  const [view, setView] = useState<'batalha' | 'mundo'>('batalha');
  const btn = (id: 'batalha' | 'mundo', label: string, Icon: typeof Globe) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
  return (
    <div className="space-y-2">
      <div className="inline-flex gap-1 rounded-lg border border-border bg-card/60 p-1">
        {btn('batalha', 'Mesa de batalha', Swords)}
        {btn('mundo', 'Mapa do Mundo', Globe)}
      </div>
      {/* A mesa fica montada para não perder estado ao alternar. */}
      <div className={view === 'batalha' ? '' : 'hidden'}>
        <MapaModule />
      </div>
      {view === 'mundo' && <WorldMapView />}
    </div>
  );
}
