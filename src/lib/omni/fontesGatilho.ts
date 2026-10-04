import type { Character } from '@/types';
import type { EntidadeOmni } from './tipos';
import { armaEstaEmpunhada } from './armaDoPersonagem';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';

export type FonteGatilho = { entity: EntidadeOmni; instanceId: string; usosRestantes?: number; usosTotais?: number };

/** Mesma regra de disponibilidade para eventos e observadores de estado. */
export function coletarFontesGatilho(usuario: Character) {
  const inv = useInventoryStore.getState();
  // Empunhar é registrado na ficha; armas não usam necessariamente isEquipped.
  // Um exemplar por arma empunhada evita dobrar o gatilho com cópias iguais.
  const porArma = new Map<string, ReturnType<typeof inv.listByOwner>[number]>();
  const equipados = inv.listByOwner(usuario.id).filter(inst => {
    const ent = useOmniEntidadesStore.getState().entidades[inst.entity.id] ?? inst.entity;
    if (ent.categoria !== 'arma') return inst.isEquipped;
    const nome = ent.replica ? inst.replicaArma : ent.nome;
    if (!nome || !armaEstaEmpunhada(usuario, nome) || (ent.replica && !inst.materializada)) return false;
    const chave = nome.trim().toLowerCase();
    const anterior = porArma.get(chave);
    if (!anterior || (!anterior.isEquipped && inst.isEquipped)) porArma.set(chave, inst);
    return false;
  });
  equipados.push(...porArma.values());
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
  for (const vinc of usuario.omniAtivos ?? []) {
    if (!CATEGORIAS_VINCULO_ATIVO.has(vinc.categoria)) continue;
    const ent = omniMap?.[vinc.entidadeId];
    if (!ent) continue;
    vinculados.push({ entity: ent, instanceId: vinc.instanceId });
  }
  return { equipados, vinculados };
}
