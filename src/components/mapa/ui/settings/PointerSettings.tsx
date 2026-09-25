/**
 * PointerSettings — só cor do ping.
 */
import { useMapStore } from '@/stores/useMapStore';

export function PointerSettings() {
  const pointer = useMapStore((s) => s.toolSettings.pointer);
  const setToolSettings = useMapStore((s) => s.setToolSettings);

  return (
    <div className="w-56 space-y-3 text-xs">
      <div className="text-sm font-medium">Ponteiro</div>
      <div className="text-muted-foreground leading-snug">
        Clique no mapa (ou dê 3 cliques rápidos com qualquer ferramenta) para piscar um aviso colorido por ~1,5 s. Não fica salvo.
      </div>
      <div>
        <div className="text-muted-foreground mb-1">Cor</div>
        <input
          type="color"
          value={pointer.color}
          onChange={(e) => setToolSettings('pointer', { color: e.target.value })}
          className="h-7 w-full bg-secondary border border-border rounded cursor-pointer"
        />
      </div>
    </div>
  );
}
