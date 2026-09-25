/**
 * SceneTabs — abas de cenas no topo do mapa.
 * Permite trocar, criar, renomear, duplicar e remover cenas.
 */
import { useEffect, useRef, useState } from 'react';
import { Plus, Copy, Trash2, Pencil, Check, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useMapStore } from '@/stores/useMapStore';
import { buildBundle, downloadBundle } from '../sceneIO';

export function SceneTabs() {
  const sceneOrder = useMapStore((s) => s.sceneOrder);
  const scenes = useMapStore((s) => s.scenes);
  const activeId = useMapStore((s) => s.activeSceneId);
  const switchScene = useMapStore((s) => s.switchScene);
  const createScene = useMapStore((s) => s.createScene);
  const renameScene = useMapStore((s) => s.renameScene);
  const duplicateScene = useMapStore((s) => s.duplicateScene);
  const removeScene = useMapStore((s) => s.removeScene);
  const getSceneSnapshot = useMapStore((s) => s.getSceneSnapshot);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menu]);

  const beginEdit = (id: string) => {
    setEditing(id);
    setDraft(scenes[id]?.name ?? '');
    setMenu(null);
  };
  const commit = () => {
    if (editing) renameScene(editing, draft.trim() || 'Sem nome');
    setEditing(null);
  };

  return (
    <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
      {sceneOrder.map((id) => {
        const sc = scenes[id];
        if (!sc) return null;
        const isActive = id === activeId;
        if (editing === id) {
          return (
            <div
              key={id}
              className="flex items-center gap-1 h-7 px-2 rounded-md text-xs"
              style={{ background: '#1f2024', border: '1px solid #3a3b40' }}
            >
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') setEditing(null);
                }}
                className="bg-transparent outline-none text-foreground w-28"
              />
              <button onClick={commit} className="text-emerald-400 hover:text-emerald-300"><Check className="h-3 w-3" /></button>
              <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-foreground/80"><X className="h-3 w-3" /></button>
            </div>
          );
        }
        return (
          <button
            key={id}
            type="button"
            onClick={() => switchScene(id)}
            onDoubleClick={() => beginEdit(id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ id, x: e.clientX, y: e.clientY });
            }}
            className="h-7 px-2.5 rounded-md text-xs whitespace-nowrap transition-colors"
            style={{
              background: isActive ? 'hsl(var(--border))' : 'transparent',
              border: '1px solid',
              borderColor: isActive ? '#3a3b40' : 'transparent',
              color: isActive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
            }}
            title={`${sc.name} (duplo-clique para renomear)`}
          >
            {sc.name}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => createScene()}
        title="Nova cena"
        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[#2a2b30]"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 rounded-md py-1 text-xs shadow-xl"
          style={{
            left: menu.x,
            top: menu.y,
            background: 'hsl(var(--card))',
            border: '1px solid #2a2b30',
            minWidth: 160,
            color: 'hsl(var(--foreground))',
          }}
        >
          <MenuItem icon={<Pencil className="h-3 w-3" />} onClick={() => beginEdit(menu.id)}>Renomear</MenuItem>
          <MenuItem
            icon={<Copy className="h-3 w-3" />}
            onClick={() => {
              const nid = duplicateScene(menu.id);
              setMenu(null);
              if (nid) switchScene(nid);
            }}
          >
            Duplicar
          </MenuItem>
          <MenuItem
            icon={<Download className="h-3 w-3" />}
            onClick={async () => {
              const id = menu.id;
              setMenu(null);
              const sc = getSceneSnapshot(id);
              if (!sc) return;
              try {
                const bundle = await buildBundle([sc]);
                const slug = (sc.name || 'cena')
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
                  .slice(0, 40) || 'cena';
                downloadBundle(bundle, `${slug}.scene.json`);
                toast.success(`Cena "${sc.name}" exportada.`);
              } catch (e) {
                console.error(e);
                toast.error('Falha ao exportar cena.');
              }
            }}
          >
            Exportar
          </MenuItem>
          <div className="my-1 border-t border-border" />
          <MenuItem
            icon={<Trash2 className="h-3 w-3 text-red-400" />}
            disabled={sceneOrder.length <= 1}
            onClick={() => {
              if (confirm(`Remover a cena "${scenes[menu.id]?.name}"?`)) {
                removeScene(menu.id);
              }
              setMenu(null);
            }}
            danger
          >
            Remover
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, children, onClick, disabled, danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color: danger ? '#fca5a5' : undefined }}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
