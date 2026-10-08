import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { limiteInvocacoesAtivas } from './tipos';

export type DirecaoInvocacao = 'norte' | 'sul' | 'leste' | 'oeste';
export type ResultadoInvocacao = { ok: true; tokenId: string } | { ok: false; motivo: string };

/** Mantém tokens distintos das fichas: servos não ganham iniciativa própria. */
export function tokensInvocados(donoCharacterId: string) {
  return Object.values(useMapStore.getState().entities).filter(e => e.ownerCharId === donoCharacterId && !!e.invocationId);
}

/** Coloca o servo na célula adjacente escolhida, respeitando alcance e ocupação. */
export function invocarControlador(donoId: string, invocacaoId: string, direcao: DirecaoInvocacao): ResultadoInvocacao {
  const cs = useCharacterStore.getState();
  const dono = cs.characters.find(c => c.id === donoId);
  if (!dono || dono.specialization !== 'Controlador') return { ok: false, motivo: 'Apenas um Controlador pode invocar.' };
  const modelo = dono.invocacoesConhecidas?.find(i => i.id === invocacaoId && i.donoCharacterId === donoId);
  if (!modelo) return { ok: false, motivo: 'Invocação não pertence ao catálogo.' };
  if (modelo.hpAtual <= 0) return { ok: false, motivo: 'A invocação precisa ter PV para ser materializada.' };

  const mapa = useMapStore.getState();
  const ativos = tokensInvocados(donoId);
  if (ativos.some(e => e.invocationId === invocacaoId)) return { ok: false, motivo: 'Essa invocação já está no mapa.' };
  if (ativos.length >= limiteInvocacoesAtivas(dono.treinoControle ?? 1)) return { ok: false, motivo: 'Limite de invocações ativas atingido.' };
  if (!Number.isFinite(modelo.custoInvocacaoPE) || modelo.custoInvocacaoPE < 0) return { ok: false, motivo: 'Custo de PE inválido.' };
  if ((dono.peCurrent ?? 0) < modelo.custoInvocacaoPE) return { ok: false, motivo: 'PE insuficiente.' };
  const origem = Object.values(mapa.entities).find(e => e.characterId === donoId && !e.invocationId);
  if (!origem) return { ok: false, motivo: 'Coloque o token do Controlador no mapa primeiro.' };
  const passo = mapa.gridConfig.dpi;
  if (!(passo > 0) || !(mapa.gridConfig.metersPerCell > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const direcoes: Record<DirecaoInvocacao, [number, number]> = {
    norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0],
  };
  const deslocamento = direcoes[direcao];
  if (!deslocamento) return { ok: false, motivo: 'Direção inválida.' };
  const x = origem.x + passo * deslocamento[0];
  const y = origem.y + passo * deslocamento[1];
  const ocupado = Object.values(mapa.entities).some(e => e.layer !== 'map' && !e.hidden &&
    Math.abs((e.x + e.w / 2) - (x + passo / 2)) < passo * .45 &&
    Math.abs((e.y + e.h / 2) - (y + passo / 2)) < passo * .45);
  if (ocupado) return { ok: false, motivo: 'A célula escolhida está ocupada.' };

  const tokenId = mapa.addEntity({
    shape: 'ELLIPSE', x, y, w: passo, h: passo, rotation: 0, color: '#8055bd',
    label: modelo.nome, locked: false, layer: 'tokens', nameplate: true,
    hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
    ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
    invocationDefense: modelo.defesa, invocationMovementM: modelo.deslocamentoM,
  });
  cs.updateCharacter(donoId, { peCurrent: (dono.peCurrent ?? 0) - modelo.custoInvocacaoPE });
  return { ok: true, tokenId };
}

/** Recolhe um servo real e libera o slot, sem reembolsar PE. */
export function recolherInvocacao(donoId: string, invocacaoId: string): boolean {
  const dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono || dono.specialization !== 'Controlador') return false;
  const mapa = useMapStore.getState();
  const tokens = Object.values(mapa.entities).filter(e => e.ownerCharId === donoId && e.invocationId === invocacaoId);
  if (!tokens.length) return false;
  const hpAtual = Math.max(0, tokens[0].hp ?? 0);
  const catalogo = (dono.invocacoesConhecidas ?? []).map(i => i.id === invocacaoId ? { ...i, hpAtual } : i);
  useCharacterStore.getState().updateCharacter(donoId, { invocacoesConhecidas: catalogo });
  mapa.removeEntities(tokens.map(t => t.id));
  return true;
}

/** Desfaz tokens destruídos e registra a perda de PV no catálogo. */
export function limparInvocacoesDerrotadas(donoId: string): number {
  let removidos = 0;
  for (const token of tokensInvocados(donoId)) {
    if ((token.hp ?? 0) > 0) continue;
    if (recolherInvocacao(donoId, token.invocationId!)) removidos++;
  }
  return removidos;
}

/** Invocações não agem sozinhas; comandos no turno do dono serão implementados na Fase 4. */
export function podeComandarInvocacao(donoId: string): boolean {
  const combat = useCombatStore.getState();
  return combat.inCombat && combat.initiativeOrder[combat.currentTurnIndex]?.charId === donoId;
}


/** Dano direcionado a um token real de invocação; nunca altera PV da ficha do dono. */
export function causarDanoInvocacao(tokenId: string, dano: number): { ok: true; hpRestante: number; destruida: boolean } | { ok: false; motivo: string } {
  const mapa = useMapStore.getState();
  const token = mapa.entities[tokenId];
  if (!token?.ownerCharId || !token.invocationId) return { ok: false, motivo: 'Token não pertence a uma invocação.' };
  if (!Number.isFinite(dano) || dano < 0) return { ok: false, motivo: 'Dano inválido.' };
  const hpRestante = Math.max(0, (token.hp ?? 0) - Math.floor(dano));
  mapa.updateEntity(tokenId, { hp: hpRestante });
  const dono = useCharacterStore.getState().characters.find(c => c.id === token.ownerCharId);
  if (dono) {
    useCharacterStore.getState().updateCharacter(dono.id, {
      invocacoesConhecidas: (dono.invocacoesConhecidas ?? []).map(i => i.id === token.invocationId ? { ...i, hpAtual: hpRestante } : i),
    });
  }
  if (hpRestante === 0) mapa.removeEntities([tokenId]);
  return { ok: true, hpRestante, destruida: hpRestante === 0 };
}

/** Primeiro comando da Fase 4: uma ação bônus reposiciona um servo em
 * uma célula livre. Não cria novo turno na iniciativa nem movimento gratuito.
 */
export function comandarReposicionamento(donoId: string, invocacaoId: string, direcao: DirecaoInvocacao): { ok: true } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono || dono.specialization !== 'Controlador') return { ok: false, motivo: 'Controlador inválido.' };
  if (!podeComandarInvocacao(donoId)) return { ok: false, motivo: 'Só é possível comandar no turno do Controlador.' };
  const token = tokensInvocados(donoId).find(e => e.invocationId === invocacaoId);
  if (!token || (token.hp ?? 0) <= 0) return { ok: false, motivo: 'Invocação não está ativa.' };
  if ((dono.bonusActionsCurrent ?? 0) < 1) return { ok: false, motivo: 'Ação Bônus indisponível.' };
  const mapa = useMapStore.getState();
  const passo = mapa.gridConfig.dpi;
  if (!(passo > 0) || !(mapa.gridConfig.metersPerCell > 0)) return { ok: false, motivo: 'Grade inválida.' };
  const deltas: Record<DirecaoInvocacao, [number, number]> = {
    norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0],
  };
  if (!deltas[direcao]) return { ok: false, motivo: 'Direção inválida.' };
  const [dx, dy] = deltas[direcao];
  const x = token.x + dx * passo, y = token.y + dy * passo;
  const ocupado = Object.values(mapa.entities).some(e => e.id !== token.id && e.layer !== 'map' && !e.hidden &&
    Math.abs((e.x + e.w / 2) - (x + token.w / 2)) < passo * .45 &&
    Math.abs((e.y + e.h / 2) - (y + token.h / 2)) < passo * .45);
  if (ocupado) return { ok: false, motivo: 'Destino ocupado.' };
  mapa.updateEntity(token.id, { x, y });
  useCharacterStore.getState().updateCharacter(donoId, { bonusActionsCurrent: dono.bonusActionsCurrent - 1 });
  return { ok: true };
}
