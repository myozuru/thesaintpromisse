import { alvosNoAlcance, terminarAlvoMapa, useAlvoMapaStore } from '@/stores/useAlvoMapaStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
export function AlvoMapaOverlay() {
  const { pending, selecionados, erro } = useAlvoMapaStore();
  useMapStore(s => s.entities); useCharacterStore(s => s.characters);
  if (!pending) return null;
  const validos = alvosNoAlcance(pending);
  return <div className="absolute top-3 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-md bg-background/85 px-3 py-2 text-sm pointer-events-none">
    <b>{pending.label}</b><p>Alcance: {pending.maxRangeMeters} m · Clique no alvo destacado · Esc cancela</p>

    {!validos.length && <p className="text-sm text-muted-foreground">Nenhum alvo válido neste alcance.</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {(pending.maxAlvos ?? 1) > 1 && <button className="pointer-events-auto mt-2 rounded bg-primary px-2 py-1" disabled={!selecionados.length} onClick={() => {
      const ids = alvosNoAlcance(pending).map(c => c.id);
      if (selecionados.every(id => ids.includes(id))) terminarAlvoMapa(selecionados);
      else useAlvoMapaStore.setState({ erro: 'Um alvo saiu do alcance. Selecione novamente.', selecionados: [] });
    }}>Confirmar ({selecionados.length}/{pending.maxAlvos})</button>}
    <button className="pointer-events-auto ml-2 mt-2 rounded border px-2 py-1" onClick={() => terminarAlvoMapa(null)}>Cancelar</button>
  </div>;
}
