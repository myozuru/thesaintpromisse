import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { validarIntermediarioInvocacao } from './intermediario';
import { useCombatStore } from '@/stores/useCombatStore';
import { limiteAtivasPersonagem, type InvocacaoControlador } from './tipos';
import { useLogStore } from '@/stores/useLogStore';
import { podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';
import { WallsEngine } from '@/components/mapa/WallsEngine';

export type DirecaoInvocacao = 'norte' | 'sul' | 'leste' | 'oeste';
export type ResultadoInvocacao = { ok: true; tokenId: string } | { ok: false; motivo: string };
export type PosicaoInvocacao = { invocacaoId: string; x: number; y: number };
export type ResultadoLoteInvocacoes = { ok: true; tokenIds: string[] } | { ok: false; motivo: string };

function novoIdInvocacao(prefixo: string): string {
  const valor = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefixo}-${valor}`;
}

/** Mantém tokens distintos das fichas: servos não ganham iniciativa própria. */
export function tokensInvocados(donoCharacterId: string) {
  return Object.values(useMapStore.getState().entities).filter(e => e.ownerCharId === donoCharacterId && !!e.invocationId);
}

/** API legada de posicionamento adjacente; a interface atual usa invocarControladores. */
export interface OpcoesInvocacaoControlador {
  motivoOverrideIntermediario?: string;
  /** Chave estável do pedido, reutilizada caso a mesma execução seja reenviada. */
  eventoId?: string;
}

export function invocarControlador(
  donoId: string,
  invocacaoId: string,
  direcao: DirecaoInvocacao,
  opcoes?: OpcoesInvocacaoControlador,
): ResultadoInvocacao {
  const cs = useCharacterStore.getState();
  const dono = cs.characters.find(c => c.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem não encontrado.' };
  if (opcoes?.eventoId !== undefined && !opcoes.eventoId.trim()) {
    return { ok: false, motivo: 'O ID do evento de invocação está vazio.' };
  }
  const eventoId = opcoes?.eventoId?.trim() || novoIdInvocacao('evento');
  const mapa = useMapStore.getState();
  const eventoExistente = Object.values(mapa.entities).find(e => e.invocationEventId === eventoId || e.invocationBatchId === eventoId);
  if (eventoExistente) {
    if (eventoExistente.invocationBatchId === eventoId) return { ok: false, motivo: 'Este ID de evento já pertence a um lote de invocações.' };
    if (eventoExistente.ownerCharId === donoId && eventoExistente.invocationId === invocacaoId) {
      return { ok: true, tokenId: eventoExistente.id };
    }
    return { ok: false, motivo: 'Este ID de evento já pertence a outra invocação.' };
  }
  const modelo = dono.invocacoesConhecidas?.find(i => i.id === invocacaoId && i.donoCharacterId === donoId);
  if (!modelo) return { ok: false, motivo: 'Invocação não pertence ao catálogo.' };
  if (!podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada })) return { ok: false, motivo: 'Esta versão da invocação ainda não foi aprovada pelo Mestre.' };
  const validacaoIntermediario = validarIntermediarioInvocacao(modelo, dono, useInventoryStore.getState().items, dono.invocacoesConhecidas ?? []);
  const motivoOverride = opcoes?.motivoOverrideIntermediario?.trim() ?? '';
  const overrideIntermediario = !validacaoIntermediario.ok && Boolean(motivoOverride);
  if (!validacaoIntermediario.ok && !motivoOverride) return { ok: false, motivo: validacaoIntermediario.motivo };
  if (overrideIntermediario && useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode ignorar a validação do intermediário.' };
  if (modelo.hpAtual <= 0) return { ok: false, motivo: 'A invocação precisa ter PV para ser materializada.' };

  const ativos = tokensInvocados(donoId);
  if (ativos.some(e => e.invocationId === invocacaoId)) return { ok: false, motivo: 'Essa invocação já está no mapa.' };
  if (ativos.length >= limiteAtivasPersonagem(dono.specialization, dono.treinoControle ?? 0)) return { ok: false, motivo: 'Limite de invocações ativas atingido.' };
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
  const alcance = modelo.alcanceInvocacaoM;
  if (!Number.isFinite(alcance) || (alcance ?? -1) < 0) return { ok: false, motivo: 'Defina o alcance de posicionamento na ficha antes de invocar.' };
  const distanciaM = Math.hypot(x - origem.x, y - origem.y) / passo * mapa.gridConfig.metersPerCell;
  if (distanciaM > alcance!) return { ok: false, motivo: 'A célula escolhida está fora do alcance de posicionamento.' };
  const ocupado = Object.values(mapa.entities).some(e => e.layer !== 'map' && !e.hidden &&
    Math.abs(e.x - x) < (e.w + passo) / 2 && Math.abs(e.y - y) < (e.h + passo) / 2);
  if (ocupado) return { ok: false, motivo: 'A célula escolhida está ocupada.' };
  const paredesAtivas = WallsEngine.blockingSegments(mapa.walls, 'sight');
  if (WallsEngine.minDistanceToSegments({ x, y }, paredesAtivas) < passo * Math.SQRT1_2) return { ok: false, motivo: 'A célula escolhida está bloqueada por uma parede ou obstáculo.' };

  const instanciaId = novoIdInvocacao('instancia');
  const tokenId = novoIdInvocacao('token');
  const peAntes = Number.isFinite(dono.peCurrent) ? dono.peCurrent : 0;
  try {
    mapa.addEntity({
      id: tokenId,
      shape: modelo.formaToken ?? 'ELLIPSE', x, y, w: passo, h: passo, rotation: 0,
      color: modelo.corIdentificacao ?? '#8055bd',
      label: modelo.apelido?.trim() || modelo.nome, locked: false, layer: 'tokens',
      nameplate: modelo.nomeplate ?? true,
      ...(modelo.imagemAssetId ? { assetId: modelo.imagemAssetId } : modelo.imagemFallbackAssetId ? { assetId: modelo.imagemFallbackAssetId } : {}),
      ...(modelo.imagemFallbackAssetId ? { invocationFallbackAssetId: modelo.imagemFallbackAssetId } : {}),
      ...(modelo.tokenCrop ? { tokenCrop: modelo.tokenCrop as import('@/stores/useMapStore').TokenCrop } : {}),
      hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
      ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
      invocationEventId: eventoId, invocationInstanceId: instanciaId,
      invocationDefense: modelo.defesa, invocationMovementM: modelo.deslocamentoM,
    });
    cs.updateCharacter(donoId, { peCurrent: peAntes - modelo.custoInvocacaoPE });
  } catch {
    try {
      if (useMapStore.getState().entities[tokenId]) useMapStore.getState().removeEntities([tokenId]);
    } catch { /* mantém a falha original; compensação best-effort */ }
    try {
      const donoAtual = useCharacterStore.getState().characters.find(c => c.id === donoId);
      if (donoAtual && donoAtual.peCurrent === peAntes - modelo.custoInvocacaoPE) {
        useCharacterStore.getState().updateCharacter(donoId, { peCurrent: peAntes });
      }
    } catch { /* mantém a falha original; compensação best-effort */ }
    return { ok: false, motivo: 'Não foi possível concluir a invocação; os efeitos locais foram desfeitos.' };
  }
  if (overrideIntermediario) {
    useLogStore.getState().addLog(
      'system',
      'Override do Mestre: ' + dono.name + ' invocou ' + modelo.nome + ' sem intermediário validado. Motivo: ' + motivoOverride,
      'O Mestre autorizou a invocação de ' + modelo.nome + ' com override do intermediário.',
    );
  }
  return { ok: true, tokenId };
}

/** Invocar é Ação Livre por enquanto; valida e materializa uma ou duas fichas em uma transação local idempotente. */
export function invocarControladores(
  donoId: string,
  posicoes: readonly PosicaoInvocacao[],
  opcoes?: { eventoId?: string; motivosOverrideIntermediario?: Record<string, string> },
): ResultadoLoteInvocacoes {
  if (posicoes.length < 1 || posicoes.length > 2) return { ok: false, motivo: 'Um uso permite posicionar uma ou duas invocações.' };
  const ids = posicoes.map(posicao => posicao.invocacaoId);
  if (new Set(ids).size !== ids.length) return { ok: false, motivo: 'Selecione invocações diferentes.' };
  const cs = useCharacterStore.getState();
  const dono = cs.characters.find(character => character.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem não encontrado.' };
  if (opcoes?.eventoId !== undefined && !opcoes.eventoId.trim()) return { ok: false, motivo: 'O ID do evento de invocação está vazio.' };
  const eventoId = opcoes?.eventoId?.trim() || novoIdInvocacao('evento');
  const mapa = useMapStore.getState();
  const associadasAoEvento = Object.values(mapa.entities).filter(entity =>
    entity.invocationBatchId === eventoId || entity.invocationEventId === eventoId,
  );
  if (associadasAoEvento.some(entity => entity.invocationBatchId === eventoId)) {
    const porInvocacao = new Map(associadasAoEvento.filter(entity => entity.invocationBatchId === eventoId).map(entity => [entity.invocationId, entity]));
    if (associadasAoEvento.some(entity => entity.invocationBatchId !== eventoId) ||
      posicoes.some(posicao => {
        const entity = porInvocacao.get(posicao.invocacaoId);
        return !entity || entity.ownerCharId !== donoId;
      }) || porInvocacao.size !== posicoes.length) {
      return { ok: false, motivo: 'Este ID de evento já pertence a outro lote de invocações.' };
    }
    return { ok: true, tokenIds: posicoes.map(posicao => porInvocacao.get(posicao.invocacaoId)!.id) };
  }
  if (associadasAoEvento.length) return { ok: false, motivo: 'Este ID de evento já pertence a outra invocação.' };

  const modelos = ids.map(id => dono.invocacoesConhecidas?.find(modelo => modelo.id === id && modelo.donoCharacterId === donoId));
  if (modelos.some(modelo => !modelo)) return { ok: false, motivo: 'Uma das invocações não pertence ao catálogo.' };
  const modelosValidos = modelos as InvocacaoControlador[];
  const validacoesOverride: Array<{ modelo: InvocacaoControlador; motivo: string; override: boolean }> = [];
  for (const modelo of modelosValidos) {
    if (!podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada })) {
      return { ok: false, motivo: 'A invocação ' + modelo.nome + ' ainda não foi aprovada pelo Mestre.' };
    }
    const validacao = validarIntermediarioInvocacao(modelo, dono, useInventoryStore.getState().items, dono.invocacoesConhecidas ?? []);
    const motivo = opcoes?.motivosOverrideIntermediario?.[modelo.id]?.trim() ?? '';
    const override = !validacao.ok && Boolean(motivo);
    if (!validacao.ok && !motivo) return { ok: false, motivo: validacao.motivo };
    if (override && useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode ignorar a validação do intermediário.' };
    if (modelo.hpAtual <= 0) return { ok: false, motivo: 'A invocação ' + modelo.nome + ' precisa ter PV para ser materializada.' };
    const alcance = modelo.alcanceInvocacaoM;
    if (!Number.isFinite(alcance) || (alcance ?? -1) < 0) return { ok: false, motivo: 'Defina o alcance de posicionamento na ficha ' + modelo.nome + ' antes de invocar.' };
    if (!Number.isFinite(modelo.custoInvocacaoPE) || modelo.custoInvocacaoPE < 0) return { ok: false, motivo: 'Custo de PE inválido para ' + modelo.nome + '.' };
    validacoesOverride.push({ modelo, motivo, override });
  }

  const ativos = tokensInvocados(donoId).filter(token => (token.hp ?? 0) > 0);
  if (ids.some(id => ativos.some(token => token.invocationId === id))) return { ok: false, motivo: 'Uma das invocações selecionadas já está no mapa.' };
  const limite = limiteAtivasPersonagem(dono.specialization, dono.treinoControle ?? 0);
  if (ativos.length + posicoes.length > limite) return { ok: false, motivo: 'O lote ultrapassa o limite de invocações ativas.' };
  const peAntes = Number.isFinite(dono.peCurrent) ? dono.peCurrent : 0;
  const custoTotal = modelosValidos.reduce((total, modelo) => total + modelo.custoInvocacaoPE, 0);
  if (peAntes < custoTotal) return { ok: false, motivo: 'PE insuficiente para o lote selecionado.' };

  const origem = Object.values(mapa.entities).find(entity => entity.characterId === donoId && !entity.invocationId);
  if (!origem) return { ok: false, motivo: 'Coloque o token do Controlador no mapa primeiro.' };
  const passo = mapa.gridConfig.dpi;
  const metrosPorCelula = mapa.gridConfig.metersPerCell;
  if (!(passo > 0) || !(metrosPorCelula > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const paredesAtivas = WallsEngine.blockingSegments(mapa.walls, 'sight');
  const alvos: Array<{ modelo: InvocacaoControlador; x: number; y: number }> = [];
  for (const posicao of posicoes) {
    const modelo = modelosValidos.find(item => item.id === posicao.invocacaoId)!;
    if (!Number.isFinite(posicao.x) || !Number.isFinite(posicao.y) ||
      Math.abs(posicao.x / passo - Math.round(posicao.x / passo)) > 1e-6 ||
      Math.abs(posicao.y / passo - Math.round(posicao.y / passo)) > 1e-6) {
      return { ok: false, motivo: 'Escolha uma célula válida da grade para ' + modelo.nome + '.' };
    }
    const distanciaM = Math.hypot(posicao.x - origem.x, posicao.y - origem.y) / passo * metrosPorCelula;
    if (distanciaM > modelo.alcanceInvocacaoM!) return { ok: false, motivo: 'A posição de ' + modelo.nome + ' está fora do alcance definido na ficha.' };
    const ocupado = Object.values(mapa.entities).some(entity => entity.layer !== 'map' && !entity.hidden &&
      Math.abs(entity.x - posicao.x) < (entity.w + passo) / 2 && Math.abs(entity.y - posicao.y) < (entity.h + passo) / 2);
    if (ocupado) return { ok: false, motivo: 'A célula escolhida para ' + modelo.nome + ' está ocupada.' };
    if (alvos.some(alvo => Math.abs(alvo.x - posicao.x) < passo * 0.45 && Math.abs(alvo.y - posicao.y) < passo * 0.45)) {
      return { ok: false, motivo: 'As invocações precisam ocupar células diferentes.' };
    }
    if (WallsEngine.minDistanceToSegments({ x: posicao.x, y: posicao.y }, paredesAtivas) < passo * Math.SQRT1_2) {
      return { ok: false, motivo: 'A célula escolhida para ' + modelo.nome + ' está bloqueada por uma parede ou obstáculo.' };
    }
    alvos.push({ modelo, x: posicao.x, y: posicao.y });
  }

  const criados: string[] = [];
  try {
    for (const { modelo, x, y } of alvos) {
      const tokenId = novoIdInvocacao('token');
      const instanciaId = novoIdInvocacao('instancia');
      criados.push(tokenId);
      mapa.addEntity({
        id: tokenId,
        shape: modelo.formaToken ?? 'ELLIPSE', x, y, w: passo, h: passo, rotation: 0,
        color: modelo.corIdentificacao ?? '#8055bd',
        label: modelo.apelido?.trim() || modelo.nome, locked: false, layer: 'tokens',
        nameplate: modelo.nomeplate ?? true,
        ...(modelo.imagemAssetId ? { assetId: modelo.imagemAssetId } : modelo.imagemFallbackAssetId ? { assetId: modelo.imagemFallbackAssetId } : {}),
        ...(modelo.imagemFallbackAssetId ? { invocationFallbackAssetId: modelo.imagemFallbackAssetId } : {}),
        ...(modelo.tokenCrop ? { tokenCrop: modelo.tokenCrop as import('@/stores/useMapStore').TokenCrop } : {}),
        hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
        ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
        invocationEventId: eventoId + ':' + modelo.id, invocationBatchId: eventoId, invocationInstanceId: instanciaId,
        invocationDefense: modelo.defesa, invocationMovementM: modelo.deslocamentoM,
      });
    }
    cs.updateCharacter(donoId, { peCurrent: peAntes - custoTotal });
  } catch {
    try { if (criados.length) useMapStore.getState().removeEntities(criados); } catch { /* rollback local best-effort */ }
    try {
      const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
      if (donoAtual && donoAtual.peCurrent === peAntes - custoTotal) useCharacterStore.getState().updateCharacter(donoId, { peCurrent: peAntes });
    } catch { /* rollback local best-effort */ }
    return { ok: false, motivo: 'Não foi possível concluir o lote; os efeitos locais foram desfeitos.' };
  }

  for (const { modelo, motivo, override } of validacoesOverride) {
    if (!override) continue;
    useLogStore.getState().addLog(
      'system',
      'Override do Mestre: ' + dono.name + ' invocou ' + modelo.nome + ' sem intermediário validado. Motivo: ' + motivo,
      'O Mestre autorizou a invocação de ' + modelo.nome + ' com override do intermediário.',
    );
  }
  return { ok: true, tokenIds: criados };
}

/** Recolhe um servo real e libera o slot, sem reembolsar PE. */

export function recolherInvocacao(donoId: string, invocacaoId: string): boolean {
  const dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono) return false;
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
  if (!dono) return { ok: false, motivo: 'Personagem inválido.' };
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


/** Quantidade de comandos complexos obtida por Ação Comum, com progressão modular. */
export function comandosPorAcao(nivel: number): number {
  return nivel >= 18 ? 4 : nivel >= 12 ? 3 : nivel >= 6 ? 2 : 1;
}

const ataquesPendentes = new Set<string>();

/** Ataque de servo comandado no turno do Controlador. O alvo utiliza uma ficha
 * real, portanto o dano percorre applyDamage (reações, RD e demais regras).
 */
export async function comandarAtaque(donoId: string, invocacaoId: string, acaoId: string, alvoId: string):
  Promise<{ ok: true; acertou: boolean; totalAtaque: number; dano: number } | { ok: false; motivo: string }> {
  const chave = donoId + ':' + invocacaoId;
  if (ataquesPendentes.has(chave)) return { ok: false, motivo: 'Comando anterior ainda em andamento.' };
  const dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem inválido.' };
  if (!podeComandarInvocacao(donoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const rodada = useCombatStore.getState().round;
  const pendente = dono.comandosControle?.rodada === rodada ? dono.comandosControle.restantes : 0;
  if (pendente <= 0 && (dono.actionsCurrent ?? 0) < 1) return { ok: false, motivo: 'Ação Comum indisponível.' };
  const inv = dono.invocacoesConhecidas?.find(i => i.id === invocacaoId && i.donoCharacterId === donoId);
  const acao = inv?.acoes.find(a => a.id === acaoId && a.tipo === 'ataque');
  if (!acao || !acao.dano) return { ok: false, motivo: 'Ataque não configurado para esta invocação.' };
  const mapa = useMapStore.getState();
  const servo = tokensInvocados(donoId).find(e => e.invocationId === invocacaoId && (e.hp ?? 0) > 0);
  const alvo = useCharacterStore.getState().characters.find(c => c.id === alvoId);
  const tokenAlvo = Object.values(mapa.entities).find(e => e.characterId === alvoId && !e.invocationId);
  if (!servo || !alvo || !tokenAlvo || alvoId === donoId) return { ok: false, motivo: 'Servo ou alvo ausente do mapa.' };
  const escala = mapa.gridConfig.metersPerCell / mapa.gridConfig.dpi;
  if (!(escala > 0)) return { ok: false, motivo: 'Grade inválida.' };
  const distancia = Math.hypot((servo.x + servo.w / 2) - (tokenAlvo.x + tokenAlvo.w / 2),
    (servo.y + servo.h / 2) - (tokenAlvo.y + tokenAlvo.h / 2)) * escala;
  if (distancia > (acao.alcanceM ?? 1.5) + 1e-6) return { ok: false, motivo: 'Alvo fora do alcance.' };
  const notacao = acao.dano.replace(/\s+/g, '');
  if (!/^\d+d(?:4|6|8|10|12|20)(?:\+\d+)?$/i.test(notacao)) return { ok: false, motivo: 'Dano inválido; configure NdN ou NdN+N.' };
  if (!Number.isFinite(acao.bonusAtaque ?? 0)) return { ok: false, motivo: 'Bônus de ataque inválido.' };
  const [dados, bonusStr] = notacao.split('+');
  const quantidade = parseInt(dados.split('d')[0], 10);
  if (quantidade < 1 || quantidade > 40) return { ok: false, motivo: 'Quantidade de dados inválida.' };
  ataquesPendentes.add(chave);
  // Cada Ação Comum abre um grupo de ordens. Os créditos remanescentes
  // não gastam outra ação, e não atravessam a rodada.
  const abrirGrupo = pendente <= 0;
  useCharacterStore.getState().updateCharacter(donoId, {
    actionsCurrent: dono.actionsCurrent - (abrirGrupo ? 1 : 0),
    comandosControle: { rodada, restantes: abrirGrupo ? comandosPorAcao(dono.level) - 1 : pendente - 1 },
  });
  try {
    const { rollD20Com, rollDiceCom } = await import('@/lib/dice');
    const natural = await rollD20Com(donoId, 0, { label: 'Ataque de ' + inv!.nome + ': ' + acao.nome });
    const totalAtaque = natural + (acao.bonusAtaque ?? 0);
    const acertou = natural === 20 || (natural !== 1 && totalAtaque >= (alvo.ca ?? 10));
    if (!acertou) {
      useLogStore.getState().addLog('combat', `🎯 ${inv!.nome} — ${acao.nome} contra ${alvo.name}: ${totalAtaque} (erro).`);
      return { ok: true, acertou: false, totalAtaque, dano: 0 };
    }
    const rolagem = await rollDiceCom(donoId, dados, { label: 'Dano de ' + inv!.nome });
    const dano = rolagem.total + Number(bonusStr ?? 0);
    await useCharacterStore.getState().applyDamage(alvoId, dano, acao.tipoDano ?? 'DCO', { attackerId: donoId });
    useLogStore.getState().addLog('combat', `🎯 ${inv!.nome} — ${acao.nome} contra ${alvo.name}: acerto ${totalAtaque}, dano rolado ${dano} (${acao.tipoDano ?? 'DCO'}).`);
    return { ok: true, acertou: true, totalAtaque, dano };
  } catch {
    // A execução pode ter chegado ao dano antes da falha. Não duplicar ação nem dano.
    return { ok: false, motivo: 'Falha ao resolver ataque; confira o log de combate.' };
  } finally {
    ataquesPendentes.delete(chave);
  }
}
