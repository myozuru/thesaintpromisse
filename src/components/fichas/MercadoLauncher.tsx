/**
 * Launcher de Mercado para o jogador: lista as lojas existentes e abre
 * o ShopModal escolhendo uma. Aparece na ficha do PLAYER.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Store } from 'lucide-react';
import { useShopStore } from '@/stores/useShopStore';
import { ShopModal } from '@/components/omni/ShopModal';

interface Props {
  characterId: string;
}

export function MercadoLauncher({ characterId }: Props) {
  const shopsMap = useShopStore((s) => s.shops);
  const shops = useMemo(
    () => Object.values(shopsMap).sort((a, b) => a.name.localeCompare(b.name)),
    [shopsMap],
  );
  const [openShopId, setOpenShopId] = useState<string | null>(null);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1">
            <Store className="h-4 w-4 text-primary" />
            Mercado
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="end">
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">
            Lojas disponíveis
          </div>
          {shops.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">
              Nenhuma loja foi aberta pelo Mestre.
            </p>
          ) : (
            <div className="space-y-1">
              {shops.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left rounded-md px-2 py-2 hover:bg-primary/10 text-sm"
                  onClick={() => setOpenShopId(s.id)}
                >
                  <div className="font-semibold text-foreground">{s.name}</div>
                  {s.description && (
                    <div className="text-[11px] text-muted-foreground line-clamp-1">
                      {s.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {openShopId && (
        <ShopModal
          aberto={!!openShopId}
          onClose={() => setOpenShopId(null)}
          shopId={openShopId}
          characterId={characterId}
        />
      )}
    </>
  );
}
