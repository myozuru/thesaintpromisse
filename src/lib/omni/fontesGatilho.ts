import { entidadeDoExemplar, exemplarEstaEmpunhado } from './exemplarArma';
import type { Character } from '@/types';
import type { EntidadeOmni } from './tipos';
import { armaEstaEmpunhada } from './armaDoPersonagem';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';

export type FonteGatilho = { entity: EntidadeOmni; instanceId: string; usosRestantes?: number; usosTotais?: number };

/** Mesma regra de disponibilidade para eventos e observadores de estado. */
export function coletarFontesGatilho(usuario: Character) {
  const inv = useInventoryStore.getState();
  const equipados = inv.listByOwner(usuario.id).filter(inst => {
    const ent = entidadeDoExemplar(inst);
    return ent.categoria === 'arma' ? exemplarEstaEmpunhado(usuario, inst) : inst.isEquipped;
  });
  // Mapa de templates "frescos" no banco de entidades. Usado como fonte
  // da verdade quando o snapshot do inventário está desatualizado (ex.:
  // o item foi pego ANTES do gatilho ser adicionado pelo Mestre).
  const omniMap = useOmniEntidadesStore.getState().entidades;

  // 🆕 Inclui PASSIVAS / TALENTOS / AURAS vinculados à ficha
  // (`Character.omniAtivos`). Eles não vivem no inventário, mas seus
  // scripts (effectsActive/Passive com `trigger`) também devem disparar.
  // Adaptamos cada um ao formato de "instância equipada" para reusar o
  // loop principal sem duplicação.
  const CATEGORIAS_VINCULO_ATIVO = new Set(['passiva', 'talento', 'aura']);
  const vinculados: FonteGatilho[] = [];
  const vistos = new Set<string>();
  for (const vinc of usuario.omniAtivos ?? []) {
    const chave = `${vinc.entidadeId}:${vinc.instanceId}`;
    if (vistos.has(chave)) continue; vistos.add(chave);
    if (!CATEGORIAS_VINCULO_ATIVO.has(vinc.categoria)) continue;
    const ent = omniMap?.[vinc.entidadeId];
    if (!ent) continue;
    vinculados.push({ entity: ent, instanceId: vinc.instanceId });
  }
  return { equipados, vinculados };
}
