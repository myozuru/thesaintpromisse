import { useEffect } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';
import { deslocamentoInvocacaoM, modoMovimentoNue } from '@/lib/controlador/dezSombrasMovimento';

export function ShikigamiTokenHud() {
  const selectedIds = useMapStore((state) => state.selectedIds);
  const entities = useMapStore((state) => state.entities);
  const camera = useMapStore((state) => state.camera);
  const characters = useCharacterStore((state) => state.characters);
  const selected = selectedIds.length === 1 ? entities[selectedIds[0]] : undefined;
  const token = selected?.invocationId ? selected : undefined;
  const setSourceTokenId = useShikigamiHudStore((state) => state.setSourceTokenId);

  useEffect(() => {
    setSourceTokenId(token?.id ?? null);
  }, [token?.id, setSourceTokenId]);

  if (!token) return null;
  const x = (token.x + camera.x) * camera.scale;
  const y = (token.y - token.h / 2 + camera.y) * camera.scale;
  const modelo = characters.find((character) => character.id === token.ownerCharId)
    ?.invocacoesConhecidas?.find((item) => item.id === token.invocationId);
  const isNue = modelo?.subcategoria === 'dez-sombras:nue';
  const movementM = token.invocationMovementM !== undefined
    ? deslocamentoInvocacaoM(token.id, isNue ? modoMovimentoNue(token) : undefined)
    : undefined;

  return (
    <div className="absolute pointer-events-none" style={{ left: x, top: y - 8, transform: 'translate(-50%, -100%)', zIndex: 36 }} data-testid="shikigami-token-hud">
      <div className="rounded-md border border-violet-400/40 bg-card/95 px-2 py-1 text-[10px] text-foreground shadow-lg backdrop-blur whitespace-nowrap">
        <strong>{token.label || 'Shikigami'}</strong>
        <span className="ml-2 text-muted-foreground">PV {token.hp ?? '—'}/{token.hpMax ?? '—'}</span>
        {token.invocationSubordinate?.kind === 'fuga-coelho' && <span className="ml-2 text-emerald-200">Coelho disperso</span>}
        {token.invocationSubordinate?.kind !== 'fuga-coelho' && modelo?.subcategoria === 'dez-sombras:fuga-do-coelho' && token.invocationEffectiveSize && <span className="ml-2 text-amber-200">Porte {token.invocationEffectiveSize}</span>}
        {token.invocationConditionIds?.includes('fragilizado') && <span className="ml-2 text-rose-200">Fragilizada</span>}
        {token.invocationConditionIds?.includes('caido') && <span className="ml-2 text-amber-200">Caído</span>}
        {(token.invocationTempHp ?? 0) > 0 && <span className="ml-2 text-sky-200">PVT {token.invocationTempHp}</span>}
        {token.invocationDefense !== undefined && <span className="ml-2 text-muted-foreground">Def. {token.invocationDefense}</span>}
        {movementM !== undefined && <span className="ml-2 text-violet-200">{isNue ? `${modoMovimentoNue(token) === 'voo' ? 'Voo' : 'Caminhada'} ` : 'Mov. '}{movementM} m</span>}
        {token.invocationState === 'caida' && <span className="ml-2 text-amber-300">Caído</span>}
      </div>
    </div>
  );
}
