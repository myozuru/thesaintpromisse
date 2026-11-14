import type { Character } from '@/types';
import type { Entity } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import type { InvocacaoControlador } from './tipos';
import { inerciaImparavelTouroAtiva } from './dezSombras';

export type ModoMovimentoNue = 'voo' | 'caminhada';

export interface EstadoCargaNue {
  ok: boolean;
  passageiros: number;
  unidades: number;
  penalidadeVooM: number;
  motivo?: string;
}

function isNue(modelo: InvocacaoControlador | undefined): boolean {
  return modelo?.subcategoria === 'dez-sombras:nue';
}

function modeloDaEntidade(entidade: Entity, personagens: Character[]): InvocacaoControlador | undefined {
  if (!entidade.ownerCharId || !entidade.invocationId) return undefined;
  return personagens.find(personagem => personagem.id === entidade.ownerCharId)
    ?.invocacoesConhecidas?.find(modelo => modelo.id === entidade.invocationId);
}

function categoriaDeCarga(entidade: Entity, personagens: Character[]): 'pequena' | 'media' | 'grande' {
  const modelo = modeloDaEntidade(entidade, personagens);
  const personagem = entidade.characterId
    ? personagens.find(item => item.id === entidade.characterId)
    : undefined;
  const nome = String(entidade.invocationEffectiveSize ?? modelo?.porte ?? personagem?.sizeCategory ?? 'Médio')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (nome.includes('minuscul') || nome.includes('minim') || nome.includes('pequen')) return 'pequena';
  if (nome.includes('medi')) return 'media';
  return 'grande';
}

function calcularCargaNue(
  carrierId: string,
  adicionarId?: string,
  entities = useMapStore.getState().entities,
  characters = useCharacterStore.getState().characters,
): EstadoCargaNue {
  const carrier = entities[carrierId];
  if (!carrier || !isNue(modeloDaEntidade(carrier, characters))) {
    return { ok: false, passageiros: 0, unidades: 0, penalidadeVooM: 0, motivo: 'A entidade carregadora não é o Nue.' };
  }
  if (carrier.carriedBy) {
    return { ok: false, passageiros: 0, unidades: 0, penalidadeVooM: 0, motivo: 'O Nue já está sendo carregado.' };
  }

  const idsCarga = new Set(Object.values(entities)
    .filter(entidade => entidade.carriedBy === carrierId)
    .map(entidade => entidade.id));
  if (adicionarId) {
    const alvo = entities[adicionarId];
    if (!alvo || alvo.id === carrierId) {
      return { ok: false, passageiros: idsCarga.size, unidades: 0, penalidadeVooM: 0, motivo: 'Escolha uma criatura válida para carregar.' };
    }
    if (alvo.carriedBy && alvo.carriedBy !== carrierId) {
      return { ok: false, passageiros: idsCarga.size, unidades: 0, penalidadeVooM: 0, motivo: 'A criatura já está sendo carregada por outra entidade.' };
    }
    if (Object.values(entities).some(entidade => entidade.carriedBy === alvo.id)) {
      return { ok: false, passageiros: idsCarga.size, unidades: 0, penalidadeVooM: 0, motivo: 'O Nue não pode carregar uma criatura que já esteja carregando outra.' };
    }
    idsCarga.add(adicionarId);
  }

  let unidades = 0;
  for (const id of idsCarga) {
    const entidade = entities[id];
    if (!entidade) continue;
    const categoria = categoriaDeCarga(entidade, characters);
    if (categoria === 'grande') {
      return { ok: false, passageiros: idsCarga.size, unidades, penalidadeVooM: 0, motivo: 'O Nue só pode carregar criaturas Pequenas, Mínimas ou Médias.' };
    }
    unidades += categoria === 'media' ? 2 : 1;
  }
  if (unidades > 4) {
    return { ok: false, passageiros: idsCarga.size, unidades, penalidadeVooM: 0, motivo: 'O limite de carga do Nue é quatro criaturas Pequenas/Mínimas ou duas Médias.' };
  }
  return { ok: true, passageiros: idsCarga.size, unidades, penalidadeVooM: unidades * 1.5 };
}

export function estadoCargaNue(carrierId: string): EstadoCargaNue {
  return calcularCargaNue(carrierId);
}

export function validarCargaNue(carrierId: string, targetId: string): EstadoCargaNue {
  return calcularCargaNue(carrierId, targetId);
}

export function modoMovimentoNue(token: Pick<Entity, 'invocationMovementMode'>): ModoMovimentoNue {
  return token.invocationMovementMode === 'caminhada' ? 'caminhada' : 'voo';
}

export function deslocamentoInvocacaoM(tokenId: string, modoOverride?: ModoMovimentoNue): number {
  const mapa = useMapStore.getState();
  const token = mapa.entities[tokenId];
  if (!token) return 0;
  const characters = useCharacterStore.getState().characters;
  const modelo = modeloDaEntidade(token, characters);
  let deslocamento: number;
  if (!modelo) {
    deslocamento = Math.max(0, token.invocationMovementM ?? 0);
  } else if (!isNue(modelo)) {
    deslocamento = Math.max(0, modelo.deslocamentoM);
  } else {
    const modo = modoOverride ?? modoMovimentoNue(token);
    const carga = estadoCargaNue(tokenId);
    if (!carga.ok) return 0;
    deslocamento = modo === 'caminhada' ? 4.5 : Math.max(0, 12 - carga.penalidadeVooM);
  }

  const instancia = token.invocationInstanceId
    ? characters.find(personagem => personagem.id === token.ownerCharId)
      ?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId)
    : undefined;
  const condicoes = (instancia?.condicoes ?? []).map(condicao => {
    const valor = typeof condicao === 'string'
      ? condicao
      : condicao && typeof condicao === 'object'
        ? String((condicao as { conditionId?: unknown }).conditionId ?? '')
        : '';
    return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  });
  if (modelo?.subcategoria === 'dez-sombras:touro-perfurante') {
    const combate = useCombatStore.getState();
    if (inerciaImparavelTouroAtiva(instancia?.inerciaImparavelTouro, combate)) return modelo.deslocamentoM * 2;
    if ((instancia?.agarradoPorInvocacao?.length ?? 0) > 0 ||
      condicoes.some(id => ['agarrado', 'imovel', 'paralisado', 'suspenso'].includes(id))) return 0;
    if (condicoes.includes('caido')) deslocamento = Math.min(deslocamento, 4.5);
    if (condicoes.includes('enredado') || condicoes.includes('lento')) deslocamento /= 2;
    if (condicoes.includes('sofrendo')) deslocamento = Math.max(0, deslocamento - 3);
    return deslocamento;
  }
  const caido = condicoes.includes('caido');
  return caido ? Math.min(deslocamento, 4.5) : deslocamento;
}
