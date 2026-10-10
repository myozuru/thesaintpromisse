import type { Character } from '@/types';
import type { InventoryItem } from '@/stores/useInventoryStore';
import type { InvocacaoControlador } from './tipos';

export type ResultadoValidacaoIntermediario =
  | { ok: true; via: 'item' | 'tecnica'; resumo: string }
  | { ok: false; motivo: string };

type ModeloIntermediario = Pick<InvocacaoControlador, 'id' | 'tipo' | 'intermediario'>;
type ReferenciaIntermediario = Pick<InvocacaoControlador, 'id' | 'intermediario'>;

/** Revalida a posse e o estado do vínculo no momento de materializar o token. */
export function validarIntermediarioInvocacao(
  modelo: ModeloIntermediario,
  dono: Pick<Character, 'id' | 'tecnicaAmaldicoada'>,
  items: Record<string, InventoryItem>,
  catalogo: readonly ReferenciaIntermediario[] = [],
): ResultadoValidacaoIntermediario {
  const intermediario = modelo.intermediario;
  if (!intermediario) {
    return { ok: false, motivo: 'A ficha não tem intermediário vinculado; a validação está pendente.' };
  }

  if (intermediario.tipo === 'tecnica') {
    if (modelo.tipo !== 'shikigami') {
      return { ok: false, motivo: 'A exceção por técnica só pode substituir o talismã de um Shikigami.' };
    }
    const tecnicaDoDono = dono.tecnicaAmaldicoada?.trim();
    if (!tecnicaDoDono) {
      return { ok: false, motivo: 'O personagem não tem técnica amaldiçoada cadastrada para dispensar o talismã.' };
    }
    if (intermediario.tecnicaId?.trim() !== tecnicaDoDono) {
      return { ok: false, motivo: 'A técnica vinculada não corresponde à técnica amaldiçoada do personagem.' };
    }
    return { ok: true, via: 'tecnica', resumo: 'técnica do personagem: ' + tecnicaDoDono };
  }

  const tipoEsperado = modelo.tipo === 'shikigami' ? 'talisma' : 'dispositivo';
  if (intermediario.tipo !== tipoEsperado) {
    return {
      ok: false,
      motivo: modelo.tipo === 'shikigami'
        ? 'Shikigami precisa de um talismã ou de uma exceção por técnica inata.'
        : 'Corpo amaldiçoado precisa estar ligado ao próprio dispositivo.',
    };
  }

  const instanceId = intermediario.itemInventarioId?.trim();
  if (!instanceId) return { ok: false, motivo: 'A ficha não aponta para uma instância de inventário.' };
  const item = items[instanceId];
  if (!item) return { ok: false, motivo: 'O intermediário foi removido do inventário; a ficha foi preservada.' };
  if (item.ownerId !== dono.id) return { ok: false, motivo: 'O intermediário não pertence mais ao dono desta invocação.' };
  if (item.entity?.categoria !== 'item' || (item.entity.slotType ?? 'nenhum') !== 'nenhum') {
    return { ok: false, motivo: 'A referência não é um item comum do inventário.' };
  }
  if (catalogo.some(outro => outro.id !== modelo.id && outro.intermediario?.itemInventarioId === instanceId)) {
    return { ok: false, motivo: 'Este item já está vinculado a outra invocação.' };
  }
  if (item.quebrado) return { ok: false, motivo: 'O intermediário está marcado como quebrado.' };
  if (!item.emMaos) return { ok: false, motivo: 'O intermediário está no inventário, mas não está em mãos.' };
  return { ok: true, via: 'item', resumo: item.entity.nome + ' em mãos' };
}
