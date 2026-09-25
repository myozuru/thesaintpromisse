/**
 * AssetTypeDialog — após carregar uma imagem, escolhe como inserir:
 * Mapa (fundo da cena), Personagem (token 1 célula) ou Objeto (altura padrão).
 */
import { Map as MapIcon, User, Package, X } from 'lucide-react';

export type AssetKind = 'map' | 'character' | 'object';

interface Props {
  name: string;
  previewUrl?: string;
  onChoose: (kind: AssetKind) => void;
  onCancel: () => void;
}

export function AssetTypeDialog({ name, previewUrl, onChoose, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg p-4 w-[420px] shadow-2xl"
        style={{ background: 'hsl(var(--card))', border: '1px solid #2a2b30', color: 'hsl(var(--foreground))' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-foreground text-sm font-semibold truncate pr-3">{name}</div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {previewUrl && (
          <div
            className="w-full h-32 mb-3 rounded border border-border bg-background flex items-center justify-center overflow-hidden"
          >
            <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        )}

        <div className="text-muted-foreground text-xs mb-3">Como deseja usar esta imagem?</div>

        <div className="grid grid-cols-3 gap-2">
          <Choice
            icon={<MapIcon className="h-5 w-5" />}
            label="Mapa"
            hint="Fundo da cena"
            onClick={() => onChoose('map')}
          />
          <Choice
            icon={<User className="h-5 w-5" />}
            label="Personagem"
            hint="Token 1 célula"
            onClick={() => onChoose('character')}
          />
          <Choice
            icon={<Package className="h-5 w-5" />}
            label="Objeto"
            hint="Altura padrão"
            onClick={() => onChoose('object')}
          />
        </div>
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
      className="flex flex-col items-center gap-1 p-3 rounded border border-border hover:bg-secondary hover:border-[#3a3b40] transition-colors"
    >
      <div className="text-foreground">{icon}</div>
      <div className="text-foreground text-xs font-medium">{label}</div>
      <div className="text-zinc-500 text-[10px]">{hint}</div>
    </button>
  );
}
