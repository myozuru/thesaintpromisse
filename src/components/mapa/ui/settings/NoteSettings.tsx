/**
 * NoteSettings — cor padrão de novas notas + limpar tudo.
 */
import { useMapStore } from '@/stores/useMapStore';
import { Trash2 } from 'lucide-react';

export function NoteSettings() {
  const note = useMapStore((s) => s.toolSettings.note);
  const setToolSettings = useMapStore((s) => s.setToolSettings);
  const clearNotes = useMapStore((s) => s.clearNotes);
  const count = useMapStore((s) => s.notes.length);

  return (
    <div className="w-56 space-y-3 text-xs">
      <div className="text-sm font-medium">Anotações</div>
      <div className="text-muted-foreground leading-snug">
        Clique em um lugar vazio do mapa para criar um pino com texto. Clique em
        um pino existente para editar.
      </div>
      <div>
        <div className="text-muted-foreground mb-1">Cor padrão</div>
        <input
          type="color"
          value={note.color}
          onChange={(e) => setToolSettings('note', { color: e.target.value })}
          className="h-7 w-full bg-secondary border border-border rounded cursor-pointer"
        />
      </div>
      <button
        onClick={clearNotes}
        disabled={count === 0}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-border hover:bg-secondary text-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 className="h-3 w-3" /> Limpar tudo ({count})
      </button>
    </div>
  );
}
