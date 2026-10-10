import type { Character } from '@/types';
import type { CadeiaOmni } from '@/lib/omni/cadeiaEventos';
import type { GatilhoId } from '@/lib/omni/constantesDoSistema';
import { aceitaAlvoAtivo } from '@/lib/omni/alvosAtivos';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { podeUsarVersaoAprovada } from './aprovacao';
import { executarAtaqueAutonomoInvocacao } from './mapa';
import { resolverAcaoOmniInvocacao, type ResultadoResolucaoOmniInvocacao } from './omni';
import { avaliarCondicaoAutonomia, caminhoSeguro, validarCondicaoAutonomia, type CondicaoAutonomia } from './condicaoAutonomia';
import type { InstanciaInvocacao } from '@/lib/invocacoes/schema';
import type { InvocacaoControlador } from './tipos';
import type { EmitirOpts } from '@/lib/omni/eventBus';
import { limitarAcoesAutonomas, marcarRegraVisitada, MAX_ACOES_AUTONOMAS_POR_RODADA } from './guardiaAutonomia';

const filaPorInstancia = new Map<string, Promise<void>>();
const idsCadeia = new WeakMap<object, string>();
let sequenciaCadeia = 0;

type ContextoCondicao = {
  evento: {
    id: string;
    nome: GatilhoId;
    usuarioId?: string;
    alvoId?: string;
    cena: Record<string, number>;
    dano: Record<string, number>;
  };
  dono: Pick<Character, 'id' | 'name' | 'category' | 'hpCurrent' | 'hpMax' | 'peCurrent'>;
  alvo?: Pick<Character, 'id' | 'name' | 'category' | 'hpCurrent' | 'hpMax' | 'peCurrent'>;
  shikigami: {
    id: string;
    nome: string;
    estado: InstanciaInvocacao['estado'];
    hpAtual: number;
    hpMaximo: number;
  };
};

function registrar(mensagem: string): void {
  useLogStore.getState().addLog('system', mensagem);
}

function cadeiaId(cadeia: CadeiaOmni): string {
  const chave = cadeia.orcamento as object;
  const atual = idsCadeia.get(chave);
  if (atual) return atual;
  sequenciaCadeia += 1;
  const id = `auto-chain-${sequenciaCadeia}`;
  idsCadeia.set(chave, id);
  return id;
}

function enfileirar(instanciaId: string, tarefa: () => Promise<void>): Promise<void> {
  const anterior = filaPorInstancia.get(instanciaId) ?? Promise.resolve();
  const atual = anterior.catch(() => undefined).then(tarefa);
  filaPorInstancia.set(instanciaId, atual);
  const limpar = () => {
    if (filaPorInstancia.get(instanciaId) === atual) filaPorInstancia.delete(instanciaId);
  };
  void atual.then(limpar, limpar);
  return atual;
}

function medirDistanciaMetros(a: Entity, b: Entity): number {
  const grid = useMapStore.getState().gridConfig;
  if (!(grid.dpi > 0) || !(grid.metersPerCell > 0)) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) * grid.metersPerCell / grid.dpi;
}

function normalizar(texto: string): string {
  return texto.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function escolherAlvos(
  dono: Character,
  modelo: InvocacaoControlador,
  servo: Entity,
  resolvida: Extract<ResultadoResolucaoOmniInvocacao, { ok: true }>,
  policy: string | undefined,
): { ok: true; ids: string[] } | { ok: false; motivo: string } {
  if (policy !== 'prioridade' && policy !== 'ameaca_mais_proxima') {
    return { ok: false, motivo: 'A política de alvo exige escolha manual ou ainda não está definida.' };
  }
  if (resolvida.config.tipo_alvo === 'area') return { ok: false, motivo: 'Ações de área exigem posicionamento manual e não rodam em autonomia nesta etapa.' };
  if (resolvida.config.tipo_alvo === 'proprio') return { ok: false, motivo: 'Ações com alvo próprio ainda não estão disponíveis em autonomia.' };

  const state = useMapStore.getState();
  const personagens = useCharacterStore.getState().characters;
  const candidatos = new Map<string, { personagem: Character; token: Entity; distancia: number }>();
  for (const token of Object.values(state.entities)) {
    if (!token.characterId || token.characterId === dono.id || token.invocationId || token.hidden ||
      state.layerVisible[token.layer ?? 'tokens'] === false) continue;
    const alvo = personagens.find(item => item.id === token.characterId);
    if (!alvo || !aceitaAlvoAtivo(dono, alvo, resolvida.config)) continue;
    const distancia = medirDistanciaMetros(servo, token);
    if (distancia > resolvida.config.alcanceM + 1e-6) continue;
    const anterior = candidatos.get(alvo.id);
    if (!anterior || distancia < anterior.distancia) candidatos.set(alvo.id, { personagem: alvo, token, distancia });
  }
  const lista = [...candidatos.values()].sort((a, b) => a.distancia - b.distancia || a.personagem.id.localeCompare(b.personagem.id));
  if (!lista.length) return { ok: false, motivo: 'Nenhum alvo visível, válido e dentro do alcance.' };

  if (policy === 'prioridade') {
    const prioridades = (modelo.autonomia?.prioridadeAlvo ?? '').split(/[\n,;]+/).map(normalizar).filter(Boolean);
    if (!prioridades.length) return { ok: false, motivo: 'Defina ao menos um nome ou ID em Prioridade de alvo.' };
    const escolhidos: typeof lista = [];
    for (const prioridade of prioridades) {
      const matches = lista.filter(item => normalizar(item.personagem.id) === prioridade || normalizar(item.personagem.name) === prioridade);
      if (matches.length > 1) return { ok: false, motivo: `Prioridade ambígua para "${prioridade}"; use o ID do alvo.` };
      if (matches.length === 1) escolhidos.push(matches[0]);
    }
    if (!escolhidos.length) return { ok: false, motivo: 'Nenhum alvo disponível corresponde à prioridade configurada.' };
    const limit = resolvida.config.tipo_alvo === 'multiplo' ? Number(resolvida.config.max_alvos) : 1;
    return { ok: true, ids: [...new Set(escolhidos.map(item => item.personagem.id))].slice(0, limit) };
  }

  const limit = resolvida.config.tipo_alvo === 'multiplo' ? Number(resolvida.config.max_alvos) : 1;
  return { ok: true, ids: lista.slice(0, limit).map(item => item.personagem.id) };
}

function encontrarInstancia(dono: Character, token: Entity): InstanciaInvocacao | undefined {
  const id = token.invocationInstanceId;
  return id ? dono.instanciasInvocacao?.find(item => item.id === id && item.modeloId === token.invocationId) : undefined;
}

function contextoCondicao(
  evento: GatilhoId,
  eventoId: string,
  opts: EmitirOpts,
  dono: Character,
  alvo: Character | undefined,
  modelo: InvocacaoControlador,
  instancia: InstanciaInvocacao,
): ContextoCondicao {
  return {
    evento: { id: eventoId, nome: evento, usuarioId: opts.usuarioId, alvoId: opts.alvoId, cena: { ...opts.cena }, dano: { ...opts.dano } },
    dono: { id: dono.id, name: dono.name, category: dono.category, hpCurrent: dono.hpCurrent, hpMax: dono.hpMax, peCurrent: dono.peCurrent },
    ...(alvo ? { alvo: { id: alvo.id, name: alvo.name, category: alvo.category, hpCurrent: alvo.hpCurrent, hpMax: alvo.hpMax, peCurrent: alvo.peCurrent } } : {}),
    shikigami: { id: modelo.id, nome: modelo.apelido?.trim() || modelo.nome, estado: instancia.estado, hpAtual: instancia.hpAtual, hpMaximo: instancia.hpMaximoAtual },
  };
}

function politicaCusto(automacao: NonNullable<InvocacaoControlador['automacoesOmni']>[number], modelo: InvocacaoControlador): string | undefined {
  return automacao.politicaCusto ?? modelo.autonomia?.politicaCusto;
}

function custosDaAcao(modelo: InvocacaoControlador, acaoId: string, custoPE: number): number {
  const config = modelo.custosComandosConfigurados?.[acaoId];
  return Math.max(custoPE, (config?.debitos ?? []).reduce((total, debito) => total + (Number.isFinite(debito.quantidade) ? debito.quantidade : 0), 0));
}

function registrarUso(donoId: string, instanciaId: string, automacaoId: string, rodada: number): void {
  const dono = useCharacterStore.getState().characters.find(item => item.id === donoId);
  const instancia = dono?.instanciasInvocacao?.find(item => item.id === instanciaId);
  if (!dono || !instancia) return;
  const usos = instancia.usosAutomacaoRodada?.rodada === rodada
    ? instancia.usosAutomacaoRodada
    : { rodada, total: 0, porAutomacao: {} };
  useCharacterStore.getState().updateCharacter(donoId, {
    instanciasInvocacao: (dono.instanciasInvocacao ?? []).map(item => item.id === instanciaId
      ? { ...item, version: item.version + 1, usosAutomacaoRodada: {
          rodada,
          total: usos.total + 1,
          porAutomacao: { ...usos.porAutomacao, [automacaoId]: (usos.porAutomacao[automacaoId] ?? 0) + 1 },
        } }
      : item),
  });
}

export function definirAutomacaoInvocacao(tokenId: string, suspensa: boolean): { ok: true } | { ok: false; motivo: string } {
  const state = useMapStore.getState();
  const token = state.entities[tokenId];
  if (!token?.ownerCharId || !token.invocationId || !token.invocationInstanceId) return { ok: false, motivo: 'A instância não está mais no mapa.' };
  const dono = useCharacterStore.getState().characters.find(item => item.id === token.ownerCharId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === token.invocationId);
  const instancia = dono?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId);
  if (!dono || !modelo || !instancia) return { ok: false, motivo: 'Ficha, dono ou instância não encontrados.' };
  const mestre = useRoleStore.getState().role === 'MASTER';
  const perfilAtivo = useProfileStore.getState().activeProfileId;
  if (!mestre && (!perfilAtivo || perfilAtivo !== dono.profileId)) return { ok: false, motivo: 'Só o dono da ficha ou o Mestre pode alterar a automação.' };
  useCharacterStore.getState().updateCharacter(dono.id, {
    instanciasInvocacao: (dono.instanciasInvocacao ?? []).map(item => item.id === instancia.id
      ? { ...item, version: item.version + 1, automacaoSuspensa: suspensa }
      : item),
  });
  registrar(`${suspensa ? '⏸️ Automações suspensas' : '▶️ Automações retomadas'} para ${modelo.apelido?.trim() || modelo.nome} por ${mestre ? 'intervenção do Mestre' : 'decisão do dono'}.`);
  return { ok: true };
}

/** Despacha regras OMNI de Shikigamis em série e preserva o orçamento da cadeia. */
export async function despacharAutonomiasInvocacao(
  evento: GatilhoId,
  opts: EmitirOpts,
  cadeia: CadeiaOmni,
): Promise<void> {
  if (!opts.usuarioId && !opts.alvoId) return;
  const combate = useCombatStore.getState();
  const eventoId = cadeiaId(cadeia);
  const personagens = useCharacterStore.getState().characters;
  const personagensDonos = personagens.filter(personagem => personagem.id === opts.usuarioId || personagem.id === opts.alvoId);

  for (const donoSnapshot of personagensDonos) {
    if (!combate.inCombat || combate.initiativeOrder[combate.currentTurnIndex]?.charId !== donoSnapshot.id) continue;
    const dono = useCharacterStore.getState().characters.find(item => item.id === donoSnapshot.id);
    if (!dono) continue;
    const alvo = opts.alvoId ? useCharacterStore.getState().characters.find(item => item.id === opts.alvoId) : undefined;
    for (const token of Object.values(useMapStore.getState().entities).filter(item => item.ownerCharId === dono.id && !!item.invocationId)) {
      const modelo = dono.invocacoesConhecidas?.find(item => item.id === token.invocationId);
      const instancia = encontrarInstancia(dono, token);
      if (!modelo || !instancia || instancia.estado !== 'ativa' || token.hidden ||
        useMapStore.getState().layerVisible[token.layer ?? 'tokens'] === false || instancia.automacaoSuspensa ||
        !podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada })) continue;
      if (!modelo.autonomia || modelo.autonomia.modo === 'manual') continue;

      const automacoes = [...(modelo.automacoesOmni ?? [])]
        .filter(automacao => automacao.habilitada)
        .sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0) || a.id.localeCompare(b.id));
      for (const automacao of automacoes) {
        const entidadeId = automacao.entidadeOmniId?.trim();
        const entidade = entidadeId ? useOmniEntidadesStore.getState().entidades[entidadeId] : undefined;
        const gatilho = entidade?.gatilhos?.find(item => item.id === automacao.gatilhoId);
        if (!entidade || !gatilho || gatilho.evento !== evento) continue;
        const regraChave = `${instancia.id}:${automacao.id}`;
        if (!marcarRegraVisitada(cadeia, regraChave)) continue;

        await enfileirar(instancia.id, async () => {
          const donoAtual = useCharacterStore.getState().characters.find(item => item.id === dono.id);
          const modeloAtual = donoAtual?.invocacoesConhecidas?.find(item => item.id === modelo.id);
          const tokenAtual = useMapStore.getState().entities[token.id];
          const instanciaAtual = donoAtual && tokenAtual ? encontrarInstancia(donoAtual, tokenAtual) : undefined;
          if (!donoAtual || !modeloAtual || !tokenAtual || !instanciaAtual || instanciaAtual.estado !== 'ativa' ||
            instanciaAtual.automacaoSuspensa || !useCombatStore.getState().inCombat ||
            useCombatStore.getState().initiativeOrder[useCombatStore.getState().currentTurnIndex]?.charId !== donoAtual.id) return;
          const rodada = useCombatStore.getState().round ?? 1;
          const uso = instanciaAtual.usosAutomacaoRodada?.rodada === rodada
            ? instanciaAtual.usosAutomacaoRodada
            : { rodada, total: 0, porAutomacao: {} };
          const limiteGlobal = limitarAcoesAutonomas(modeloAtual.autonomia?.limitePorRodada, MAX_ACOES_AUTONOMAS_POR_RODADA);
          const limiteRegra = limitarAcoesAutonomas(automacao.limitePorRodada, modeloAtual.autonomia?.limitePorRodada ?? 1);
          if (limiteGlobal <= uso.total || limiteRegra <= (uso.porAutomacao[automacao.id] ?? 0)) {
            registrar(`⏸️ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: limite de automação atingido para esta rodada.`);
            return;
          }
          const AST = automacao.condicaoAST === undefined ? undefined : validarCondicaoAutonomia(automacao.condicaoAST);
          if (automacao.condicaoAST !== undefined && !AST) {
            registrar(`⛔ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: condição da automação ${automacao.id} inválida; nenhuma ação executada.`);
            return;
          }
          const alvoAtual = opts.alvoId
            ? useCharacterStore.getState().characters.find(item => item.id === opts.alvoId)
            : undefined;
          const contexto = contextoCondicao(evento, eventoId, opts, donoAtual, alvoAtual, modeloAtual, instanciaAtual);
          if (!avaliarCondicaoAutonomia(AST, contexto)) return;

          const acaoOmni = entidade.acoesAtivas?.find(item => item.id === automacao.acaoId);
          if (!acaoOmni) {
            registrar(`⛔ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: ação OMNI ${automacao.acaoId} não existe mais em ${entidade.nome}.`);
            return;
          }
          const acoesLocais = modeloAtual.acoes.filter(item => item.entidadeOmniId === entidade.id && item.acaoOmniId === acaoOmni.id);
          if (acoesLocais.length !== 1) {
            registrar(`⛔ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: a ação OMNI ${acaoOmni.nome} precisa corresponder a uma única ação aprovada da ficha.`);
            return;
          }
          const acaoLocal = acoesLocais[0];
          const resolvida = resolverAcaoOmniInvocacao(acaoLocal, useOmniEntidadesStore.getState().entidades);
          if (!resolvida.ok) {
            registrar(`⏸️ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: ${resolvida.motivo}`);
            return;
          }
          const custo = custosDaAcao(modeloAtual, acaoLocal.id, resolvida.acao.custoPE ?? 0);
          const politica = politicaCusto(automacao, modeloAtual);
          if (custo > 0 && politica !== 'permitir_pe' && politica !== 'preferir_sem_custo') {
            registrar(`⏸️ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: ${acaoLocal.nome} aguarda confirmação manual de custo.`);
            return;
          }
          if (custo > 0 && politica === 'preferir_sem_custo') {
            const existeAlternativaSemCusto = automacoes.some(outra => {
              const outraEntidade = outra.entidadeOmniId ? useOmniEntidadesStore.getState().entidades[outra.entidadeOmniId] : undefined;
              const outraAcao = outraEntidade?.acoesAtivas?.find(item => item.id === outra.acaoId);
              const outraLocal = modeloAtual.acoes.find(item => item.entidadeOmniId === outraEntidade?.id && item.acaoOmniId === outraAcao?.id);
              return outra.id !== automacao.id && outra.habilitada && outra.gatilhoId === automacao.gatilhoId &&
                outra.entidadeOmniId === automacao.entidadeOmniId && outraAcao && outraLocal &&
                custosDaAcao(modeloAtual, outraLocal.id, Number(outraAcao.custoPE) || 0) === 0;
            });
            if (existeAlternativaSemCusto) {
              registrar(`⏭️ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: ${acaoLocal.nome} foi adiada por preferir uma automação sem custo.`);
              return;
            }
          }
          if (modeloAtual.custosComandosConfigurados?.[acaoLocal.id]?.execucao !== 'evento_automatico') {
            registrar(`⏸️ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: ${acaoLocal.nome} não está configurada para execução automática.`);
            return;
          }

          const politicaAlvo = automacao.politicaAlvo ?? modeloAtual.autonomia?.politicaAlvo;
          const alvos = escolherAlvos(donoAtual, modeloAtual, tokenAtual, resolvida, politicaAlvo);
          if (!alvos.ok) {
            registrar(`⏸️ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: ${alvos.motivo}`);
            return;
          }
          const requestId = `auto:${eventoId}:${instanciaAtual.id}:${automacao.id}`;
          const resultado = await executarAtaqueAutonomoInvocacao(donoAtual.id, modeloAtual.id, acaoLocal.id, alvos.ids, {
            instanciaId: instanciaAtual.id,
            requestId,
            cadeia,
          });
          if (!resultado.ok) {
            registrar(`⏸️ ${modeloAtual.apelido?.trim() || modeloAtual.nome}: automação ${acaoLocal.nome} não executada — ${resultado.motivo}`);
            return;
          }
          registrarUso(donoAtual.id, instanciaAtual.id, automacao.id, rodada);
          registrar(`🤖 ${modeloAtual.apelido?.trim() || modeloAtual.nome}: ${acaoLocal.nome} executada pela automação ${automacao.id}.`);
        });
      }
    }
  }
}

export const autonomiaInvocacaoInternals = {
  validarCondicao: validarCondicaoAutonomia,
  avaliarCondicao: avaliarCondicaoAutonomia,
  caminhoSeguro,
  marcarRegraVisitada,
  limitarAcoesAutonomas,
  MAX_ACOES_AUTONOMAS_POR_RODADA,
};
