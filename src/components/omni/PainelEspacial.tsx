/**
 * Painel Espacial mínimo (Pilar 5).
 * Permite ao Mestre setar (x,y) em metros para cada personagem.
 * Mover dispara recálculo de auras automaticamente.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniSpatialStore } from '@/stores/useOmniSpatialStore';
import { recalcularAuras } from '@/lib/omni/auras';
import { toast } from 'sonner';

export function PainelEspacial() {
  const personagens = useCharacterStore((s) => s.characters);
  const posicoes = useOmniSpatialStore((s) => s.posicoes);
  const mover = useOmniSpatialStore((s) => s.mover);
  const [draft, setDraft] = useState<Record<string, { x: string; y: string }>>({});

  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Posicionamento (m)</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-xs h-7"
          onClick={() => {
            recalcularAuras();
            toast.success('Auras recalculadas');
          }}
        >
          ↻ Auras
        </Button>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-auto">
        {personagens.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-2">
            Nenhum personagem carregado.
          </div>
        )}
        {personagens.map((c) => {
          const cur = posicoes[c.id];
          const d = draft[c.id] ?? { x: String(cur?.x ?? 0), y: String(cur?.y ?? 0) };
          return (
            <div key={c.id} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
              <span className="flex-1 truncate font-medium">{c.name}</span>
              <Input
                value={d.x}
                onChange={(e) => setDraft({ ...draft, [c.id]: { ...d, x: e.target.value } })}
                className="h-7 w-16 text-xs"
                placeholder="x"
              />
              <Input
                value={d.y}
                onChange={(e) => setDraft({ ...draft, [c.id]: { ...d, y: e.target.value } })}
                className="h-7 w-16 text-xs"
                placeholder="y"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2"
                onClick={() => {
                  const x = parseFloat(d.x) || 0;
                  const y = parseFloat(d.y) || 0;
                  mover(c.id, x, y);
                  toast.success(`${c.name} movido para (${x}, ${y})`);
                }}
              >
                Mover
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
