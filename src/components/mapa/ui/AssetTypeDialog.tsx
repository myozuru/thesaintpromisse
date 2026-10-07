/**
 * AssetTypeDialog — após carregar uma imagem, escolhe como inserir:
 * Mapa (fundo da cena), Personagem (token 1 célula), Objeto (altura padrão)
 * ou Baú (objeto vinculado a um baú do catálogo).
 */
import { useState } from 'react';
import { Map as MapIcon, User, Package, X, Archive } from 'lucide-react';
import { useChestStore } from '@/stores/useChestStore';
import { useRoleStore } from '@/stores/useRoleStore';

export type AssetKind = 'map' | 'character' | 'object' | 'chest';

interface Props {
  name: string;
  previewUrl?: string;
  onChoose: (kind: AssetKind, chestId?: string) => void;
  onCancel: () => void;
}

export function AssetTypeDialog({ name, previewUrl, onChoose, onCancel }: Props) {
  const [escolhendoBau, setEscolhendoBau] = useState(false);
  const chests = useChestStore(s => s.chests);
  const isMaster = useRoleStore(s => s.role) === 'MASTER';
  const lista = Object.values(chests).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg p-4 w-[460px] max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-foreground text-sm font-semibold truncate pr-3">{name}</div>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground" title="Cancelar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {previewUrl && (
          <div className="w-full h-32 mb-3 rounded border border-border bg-background flex items-center justify-center overflow-hidden">
            <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        )}

        {!escolhendoBau ? (<>
        <div className="text-muted-foreground text-xs mb-3">Como deseja usar esta imagem?</div>
          <div className={`grid gap-2 ${isMaster ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <Choice icon={<MapIcon className="h-5 w-5" />} label="Mapa" hint="Fundo da cena" onClick={() => onChoose('map')} />
            <Choice icon={<User className="h-5 w-5" />} label="Personagem" hint="Token 1 célula" onClick={() => onChoose('character')} />
            <Choice icon={<Package className="h-5 w-5" />} label="Objeto" hint="Altura padrão" onClick={() => onChoose('object')} />
            {isMaster && <Choice icon={<Archive className="h-5 w-5" />} label="Baú" hint="Do catálogo" onClick={() => setEscolhendoBau(true)} />}
          </div>
        </>) : (<>
          <div className="text-muted-foreground text-xs mb-2">Qual baú do catálogo esta imagem representa?</div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {lista.map(c => (
              <button key={c.id} type="button" onClick={() => onChoose('chest', c.id)}
                className="w-full text-left rounded border border-border px-3 py-2 text-sm hover:bg-secondary">
                🧰 {c.name} <span className="text-xs text-muted-foreground">· {c.entries.length} item(ns){c.locked ? ' · trancado' : ''}</span>
              </button>
            ))}
            {lista.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum baú no catálogo ainda.</p>}
          </div>
          <div className="mt-3 flex justify-between gap-2">
            <button type="button" className="rounded border px-3 py-1.5 text-xs" onClick={() => setEscolhendoBau(false)}>Voltar</button>
            <button type="button" className="rounded border border-primary/50 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
              onClick={() => onChoose('chest', useChestStore.getState().createChest(name.replace(/\.[a-z0-9]+$/i, '')).id)}>
              + Criar novo baú com esta imagem
            </button>
        </div>
        </>)}
      </div>
    </div>
  );
}

function Choice({
  icon, label, hint, onClick,
}: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-3 rounded border border-border hover:bg-secondary transition-colors"
    >
      <div className="text-foreground">{icon}</div>
      <div className="text-foreground text-xs font-medium">{label}</div>
      <div className="text-muted-foreground text-xs">{hint}</div>
    </button>
  );
}
