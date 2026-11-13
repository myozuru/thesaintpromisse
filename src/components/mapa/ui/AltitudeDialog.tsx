import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rollDiceCom } from '@/lib/dice';
import { baculoAetherisEquipped, baculoAetherisFallDice, fallDamageDice } from '@/lib/baculoAetheris';

const formatMeters = (meters: number) => Number.isInteger(meters) ? String(meters) : meters.toFixed(1).replace('.', ',');
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';

export function AltitudeDialog({ entityId, onClose }: { entityId: string | null; onClose: () => void }) {
  const entity = useMapStore((state) => entityId ? state.entities[entityId] : undefined);
  const updateEntity = useMapStore((state) => state.updateEntity);
  const pushHistory = useMapStore((state) => state.pushHistory);
  const characters = useCharacterStore((state) => state.characters);
  const [height, setHeight] = useState('0');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeight(String(entity?.altitudeM ?? 0));
    setError('');
  }, [entity?.id, entity?.altitudeM]);

  const confirm = async () => {
    if (!entity || busy) return;
    const nextHeight = Number(height.replace(',', '.'));
    if (!Number.isFinite(nextHeight) || nextHeight < 0) {
      setError('Informe uma altura igual ou maior que zero.');
      return;
    }
    setBusy(true);
    try {
      const previousHeight = Math.max(0, entity.altitudeM ?? 0);
      const dropMeters = Math.max(0, previousHeight - nextHeight);
      const character = characters.find((item) => item.id === entity.characterId);
      if (dropMeters > 0 && character) {
        const hasAetheris = baculoAetherisEquipped(character);
        const diceCount = hasAetheris ? baculoAetherisFallDice(dropMeters) : fallDamageDice(dropMeters);
        if (hasAetheris && dropMeters <= 18) {
          useLogStore.getState().addLog('combat', `Planar (Asas do Firmamento): dano de queda anulado (${formatMeters(dropMeters)} m).`);
        } else if (diceCount > 0) {
          const formula = `${diceCount}d6`;
          const rolled = await rollDiceCom(character.id, formula, { label: 'Dano de queda' });
          await useCharacterStore.getState().applyDamage(character.id, rolled.total, 'DI');
          const effectiveHeight = hasAetheris ? Math.max(0, dropMeters - 18) : dropMeters;
          useLogStore.getState().addLog('combat', `${character.name}: queda de ${formatMeters(dropMeters)} m; ${hasAetheris ? `${formatMeters(effectiveHeight)} m excedentes, ` : ''}${formula} de Impacto (${rolled.total}).`);
        } else {
          const effectiveHeight = hasAetheris ? Math.max(0, dropMeters - 18) : dropMeters;
          useLogStore.getState().addLog('combat', `${character.name}: queda de ${formatMeters(dropMeters)} m; sem trecho completo de dano${hasAetheris ? ` nos ${formatMeters(effectiveHeight)} m excedentes` : ''}.`);
        }
      }
      pushHistory();
      updateEntity(entity.id, { altitudeM: nextHeight, altitudeLabel: undefined });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível resolver a queda.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!entityId && !!entity} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Altitude e queda</DialogTitle>
          <DialogDescription>Informe a altura final do token. Reduzir a altitude resolve dano de queda automaticamente; o Báculo Aetheris anula os primeiros 18 m.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="map-entity-altitude">Altura acima do solo (m)</Label>
          <Input id="map-entity-altitude" type="number" min="0" step="0.5" value={height} onChange={(event) => { setHeight(event.target.value); setError(''); }} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? 'Resolvendo...' : 'Definir altitude'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
