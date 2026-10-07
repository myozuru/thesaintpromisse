import { useMapStore } from '@/stores/useMapStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { verificarDistanciaSustentacoes } from './custosAtivos';

let iniciado = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Mestre confere a distância das sustentações sempre que tokens se movem (agrupado em 250 ms). */
export function iniciarVigiaSustentacao(): void {
  if (iniciado) return;
  iniciado = true;
  useMapStore.subscribe((atual, anterior) => {
    if (atual.entities === anterior.entities || useRoleStore.getState().role === 'PLAYER') return;
    if (!useCharacterStore.getState().characters.some(c => c.omniSustentacoes?.some(s => s.alcanceM))) return;
    clearTimeout(timer);
    timer = setTimeout(() => verificarDistanciaSustentacoes(), 250);
  });
}