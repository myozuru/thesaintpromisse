import { alvosNoAlcance, clicarAlvoMapa, terminarAlvoMapa, tokenDaFicha, useAlvoMapaStore } from '@/stores/useAlvoMapaStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
export function AlvoMapaOverlay() {
  const { pending, selecionados, erro } = useAlvoMapaStore();
  useMapStore(s => s.entities); useCharacterStore(s => s.characters);
  if (!pending) return null;
  const validos = alvosNoAlcance(pending);
  return <div className="absolute bottom-8 left-1/2 z-50 w-80 -translate-x-1/2 rounded-lg border border-primary bg-card p-3 shadow-xl pointer-events-auto">
    <b>{pending.label}</b><p className="text-sm">Alcance: {pending.maxRangeMeters} m. Clique em um token destacado.</p>
    <div className="mt-2 flex flex-wrap gap-1">{validos.map(c => <button key={c.id} className={`rounded border px-2 py-1 text-sm ${selecionados.includes(c.id) ? 'bg-primary' : ''}`} onClick={() => clicarAlvoMapa(tokenDaFicha(c)!.id)}>{c.name}</button>)}</div>
    {!validos.length && <p className="text-sm text-muted-foreground">Nenhum alvo válido neste alcance.</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {(pending.maxAlvos ?? 1) > 1 && <button className="mt-2 rounded bg-primary px-2 py-1" disabled={!selecionados.length} onClick={() => {
      const ids = alvosNoAlcance(pending).map(c => c.id);
      if (selecionados.every(id => ids.includes(id))) terminarAlvoMapa(selecionados);
      else useAlvoMapaStore.setState({ erro: 'Um alvo saiu do alcance. Selecione novamente.', selecionados: [] });
    }}>Confirmar ({selecionados.length}/{pending.maxAlvos})</button>}
    <button className="ml-2 mt-2 rounded border px-2 py-1" onClick={() => terminarAlvoMapa(null)}>Cancelar</button>
  </div>;
}
