/**
 * WallsSettings — painel contextual da ferramenta Walls.
 * Suporta variante horizontal (toolbar no topo da tela).
 */
import {
  Trash2, Minus, Square, Circle, Hexagon,
  DoorOpen, EyeOff, Leaf, KeyRound, Building2,
} from 'lucide-react';
import { useMapStore } from '@/stores/useMapStore';

type Shape = 'line' | 'rect' | 'ellipse' | 'polygon';
type Kind = 'wall' | 'door' | 'secret' | 'window' | 'terrain';

const KINDS: Array<{ id: Kind; label: string; Icon: React.ComponentType<{ className?: string }>; hint: string }> = [
  { id: 'wall',    label: 'Parede',  Icon: Building2, hint: 'Bloqueia visão e luz.' },
  { id: 'door',    label: 'Porta',   Icon: DoorOpen,  hint: 'Clique-direito sobre a porta para abrir/fechar.' },
  { id: 'secret',  label: 'Secreta', Icon: KeyRound,  hint: 'Porta secreta — só o mestre vê. Bloqueia até abrir.' },
  { id: 'window',  label: 'Janela',  Icon: EyeOff,    hint: 'Apenas visual — não bloqueia visão nem luz.' },
  { id: 'terrain', label: 'Terreno', Icon: Leaf,      hint: 'Bloqueia VISÃO mas deixa a LUZ passar (folhagem, neblina).' },
];

const SHAPES: Array<{ id: Shape; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'line',    label: 'Linha',     Icon: Minus },
  { id: 'rect',    label: 'Retângulo', Icon: Square },
  { id: 'ellipse', label: 'Elipse',    Icon: Circle },
  { id: 'polygon', label: 'Polígono',  Icon: Hexagon },
];

export function WallsSettings({ horizontal = false }: { horizontal?: boolean }) {
  const kind = (useMapStore((s) => s.toolSettings.walls?.kind) ?? 'wall') as Kind;
  const shape = (useMapStore((s) => s.toolSettings.walls?.shape) ?? 'line') as Shape;
  const setToolSettings = useMapStore((s) => s.setToolSettings);
  const clearWalls = useMapStore((s) => s.clearWalls);
  const count = useMapStore((s) => s.walls.length);
  const activeHint = KINDS.find((k) => k.id === kind)?.hint ?? '';

  if (horizontal) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 text-popover-foreground">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Paredes</span>
        {SHAPES.map(({ id, label, Icon }) => (
          <IconBtn
            key={id}
            active={shape === id}
            title={label}
            onClick={() => setToolSettings('walls', { shape: id })}
          >
            <Icon className="h-4 w-4" />
          </IconBtn>
        ))}
        <span className="h-5 w-px shrink-0 bg-border" />
        {KINDS.map(({ id, label, Icon }) => (
          <IconBtn
            key={id}
            active={kind === id}
            title={label}
            onClick={() => setToolSettings('walls', { kind: id })}
          >
            <Icon className="h-4 w-4" />
          </IconBtn>
        ))}
        <span className="h-5 w-px shrink-0 bg-border" />
        <IconBtn active={false} title="Limpar todas as paredes" onClick={() => clearWalls()}>
          <Trash2 className="h-4 w-4" />
        </IconBtn>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-64">
      <Header label="Paredes" />

      <div>
        <Label>Forma</Label>
        <div className="grid grid-cols-4 gap-1">
          {SHAPES.map(({ id, label, Icon }) => (
            <IconBtn
              key={id}
              active={shape === id}
              title={label}
              onClick={() => setToolSettings('walls', { shape: id })}
            >
              <Icon className="h-4 w-4" />
            </IconBtn>
          ))}
        </div>
      </div>

      <div>
        <Label>Tipo</Label>
        <div className="grid grid-cols-5 gap-1">
          {KINDS.map(({ id, label, Icon }) => (
            <IconBtn
              key={id}
              active={kind === id}
              title={label}
              onClick={() => setToolSettings('walls', { kind: id })}
            >
              <Icon className="h-4 w-4" />
            </IconBtn>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-1.5">
          <span className="text-foreground/80 font-medium">
            {KINDS.find((k) => k.id === kind)?.label}
          </span>
          {' — '}{activeHint}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-snug">
        Arraste para criar (linha/retângulo/elipse). Em <b>polígono</b>, clique em
        cada vértice e dê <b>duplo-clique</b> para fechar. <b>Shift+clique</b>{' '}
        remove um segmento.
      </p>

      <div className="text-xs text-muted-foreground">{count} segmento(s)</div>

      <button
        onClick={() => clearWalls()}
        className="w-full px-2 py-1.5 rounded border border-border hover:bg-secondary flex items-center justify-center gap-1.5 text-foreground/80 text-xs"
      >
        <Trash2 className="h-3 w-3" /> Limpar todas
      </button>
    </div>
  );
}

function Header({ label }: { label: string }) {
  return <div className="text-foreground/80 text-xs font-semibold uppercase tracking-wider">{label}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground text-xs mb-1">{children}</div>;
}
function IconBtn({
  active, onClick, children, title,
}: { active: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      {children}
    </button>
  );
}
