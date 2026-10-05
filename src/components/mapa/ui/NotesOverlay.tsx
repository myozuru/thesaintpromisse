/**
 * NotesOverlay — pinos HTML posicionados em coords de tela
 * (transformados de mundo→tela a cada frame da câmera).
 *
 * - Clique no pino abre editor inline (textarea).
 * - Drag move (em qualquer ferramenta exceto fog/measure/draw).
 * - Delete dentro do editor remove a nota.
 */
import { useEffect, useRef, useState } from 'react';
import { useMapStore, type MapNote } from '@/stores/useMapStore';
import { MapPin, X, Trash2 } from 'lucide-react';

interface Props {
  /** rect do container do canvas (em coords de tela do viewport). usado p/ posicionar */
  containerRef: React.RefObject<HTMLDivElement>;
}

export function NotesOverlay({ containerRef }: Props) {
  const notes = useMapStore((s) => s.notes);
  const camera = useMapStore((s) => s.camera);
  const updateNote = useMapStore((s) => s.updateNote);
  const removeNote = useMapStore((s) => s.removeNote);
  const pushHistory = useMapStore((s) => s.pushHistory);
  /** Marca se já foi feito snapshot para o drag/edit corrente. */
  const noteHistoryRef = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const draggingRef = useRef<{ id: string; startMouseX: number; startMouseY: number; startX: number; startY: number; moved: boolean } | null>(null);

  // Drag global
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = draggingRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startMouseX) / camera.scale;
      const dy = (e.clientY - d.startMouseY) / camera.scale;
      if (Math.hypot(e.clientX - d.startMouseX, e.clientY - d.startMouseY) > 3) {
        if (!d.moved) { pushHistory(); }
        d.moved = true;
      }
      updateNote(d.id, { x: d.startX + dx, y: d.startY + dy });
    };
    const onUp = (e: MouseEvent) => {
      const d = draggingRef.current;
      if (!d) return;
      draggingRef.current = null;
      // Se não houve drag real, considera clique → abrir editor
      if (!d.moved) {
        setEditingId(d.id);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [camera.scale, updateNote]);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 11 }}>
      {notes.map((n) => {
        const sx = (n.x + camera.x) * camera.scale;
        const sy = (n.y + camera.y) * camera.scale;
        return (
          <Pin
            key={n.id}
            note={n}
            x={sx}
            y={sy}
            isEditing={editingId === n.id}
            onStartDrag={(ev) => {
              draggingRef.current = {
                id: n.id,
                startMouseX: ev.clientX,
                startMouseY: ev.clientY,
                startX: n.x,
                startY: n.y,
                moved: false,
              };
            }}
            onChangeText={(t) => {
              if (!noteHistoryRef.current) { pushHistory(); noteHistoryRef.current = true; }
              updateNote(n.id, { text: t });
            }}
            onDelete={() => {
              pushHistory();
              setEditingId(null);
              removeNote(n.id);
            }}
            onClose={() => { setEditingId(null); noteHistoryRef.current = false; }}
          />
        );
      })}
    </div>
  );
}

function Pin({
  note,
  x,
  y,
  isEditing,
  onStartDrag,
  onChangeText,
  onDelete,
  onClose,
}: {
  note: MapNote;
  x: number;
  y: number;
  isEditing: boolean;
  onStartDrag: (ev: React.MouseEvent) => void;
  onChangeText: (t: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="flex flex-col items-center pointer-events-auto">
        <button
          type="button"
          onMouseDown={(ev) => {
            if (ev.button !== 0) return;
            ev.stopPropagation();
            ev.preventDefault();
            onStartDrag(ev);
          }}
          className="drop-shadow-lg cursor-grab active:cursor-grabbing"
          style={{ color: note.color }}
          title={note.text || 'Nota'}
        >
          <MapPin className="h-7 w-7" fill="currentColor" strokeWidth={1.5} stroke="#1a1a1a" />
        </button>
        {!isEditing && note.text && (
          <div
            className="mt-0.5 px-1.5 py-0.5 rounded text-xs max-w-[180px] truncate"
            style={{
              background: 'rgba(22,23,26,0.92)',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
            }}
          >
            {note.text}
          </div>
        )}
      </div>

      {isEditing && (
        <div
          className="absolute left-1/2 -translate-x-1/2 mt-1 w-56 rounded-lg p-2 shadow-2xl pointer-events-auto"
          style={{
            top: '4px',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Editar nota</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            autoFocus
            value={note.text}
            onChange={(e) => onChangeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            rows={3}
            placeholder="Texto da nota…"
            className="w-full text-xs bg-secondary border border-border rounded p-1.5 text-foreground resize-none focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={onDelete}
            className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded border border-border hover:bg-secondary text-foreground/80 text-xs"
          >
            <Trash2 className="h-3 w-3" /> Excluir nota
          </button>
        </div>
      )}
    </div>
  );
}
