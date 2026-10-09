import { useCharacterStore } from '@/stores/useCharacterStore';
import { hasWorkspaceCloud, supabase } from '@/integrations/supabase/safeClient';
import type { Character } from '@/types';
import type { Json } from '@/integrations/supabase/types';
import { calcularContador, type OpcoesContador, type ResultadoContador } from './contadores';
import { registrarHistorico } from './componentes/eventos';
import { notificarAtualizacaoContadores } from './atualizacaoContadores';

export type MutacaoContadorOmni = {
  action: 'INCREMENTAR_CONTADOR' | 'CONSUMIR_CONTADOR' | 'DEFINIR_CONTADOR' | 'ZERAR_CONTADOR';
  name: string;
  amount: number;
  cap?: number;
  scope?: 'global' | 'porFonte';
  trackSource?: boolean;
  sourceLimit?: number;
  cycle?: string;
  sourceId?: string;
  exactSource?: boolean;
} | {
  action: 'DAMAGE_HISTORY' | 'HEALING_HISTORY';
  amount: number;
  round: number;
  temporary?: number;
};

export interface SnapshotContadoresOmni {
  character_id: string;
  counters: Record<string, number>;
  source_usage: Record<string, Record<string, { ciclo: string; usados: number }>>;
  revision: number;
}

type ResultadoRemoto = {
  characterId: string;
  counters?: Record<string, number>;
  sourceUsage?: Record<string, Record<string, { ciclo: string; usados: number }>>;
  revision: number;
  results?: Array<{ action: string; name?: string; consumed?: number; remaining?: number; amount?: number }>;
};

const filasEmAndamento = new Map<string, Promise<void>>();
const sequenciasLocais = new Map<string, number>();

function opcoesLocais(m: Extract<MutacaoContadorOmni, { name: string }>): OpcoesContador {
  return {
    valor: m.amount,
    teto: m.cap,
    escopoTeto: m.scope,
    rastrearFonte: m.trackSource,
    limiteFonte: m.sourceLimit,
    cicloFonte: m.cycle,
    fonteId: m.sourceId,
    fonteExata: m.exactSource,
  };
}

function aplicarLocalmente(
  personagem: Character,
  mutacoes: MutacaoContadorOmni[],
): { counters: Record<string, number>; usage: NonNullable<Character['omniCounterSourceUsage']>; results: ResultadoContador[] } {
  let counters = { ...(personagem.omniCounters ?? {}) };
  let usage = { ...(personagem.omniCounterSourceUsage ?? {}) };
  const results: ResultadoContador[] = [];
  for (const mutacao of mutacoes) {
    if (mutacao.action === 'DAMAGE_HISTORY' || mutacao.action === 'HEALING_HISTORY') {
      counters = registrarHistorico(
        counters,
        mutacao.action === 'DAMAGE_HISTORY' ? 'dano' : 'cura',
        mutacao.amount,
        mutacao.round,
        mutacao.action === 'DAMAGE_HISTORY' ? mutacao.temporary ?? 0 : 0,
      );
      continue;
    }
    if (!('name' in mutacao)) continue;
    const resultado = calcularContador(counters, mutacao.name, mutacao.action, {
      ...opcoesLocais(mutacao),
      usoPorFonte: usage,
    });
    counters = resultado.counters;
    usage = resultado.usoPorFonte;
    results.push(resultado);
  }
  return { counters, usage, results };
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
    const random = Math.floor(Math.random() * 16);
    return (token === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function atraso(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enviarOperacao(
  characterId: string,
  actorCharacterId: string,
  operationId: string,
  mutacoes: MutacaoContadorOmni[],
  sequencia: number,
): Promise<void> {
  if (!hasWorkspaceCloud) return;
  const serializadas = JSON.parse(JSON.stringify(mutacoes)) as Json;
  let resposta: ResultadoRemoto | null = null;
  let erroFinal: unknown;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      const { data, error } = await supabase.rpc('apply_omni_counter_operation', {
        p_operation_id: operationId,
        p_character_id: characterId,
        p_actor_character_id: actorCharacterId,
        p_mutations: serializadas,
      });
      if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
        resposta = data as unknown as ResultadoRemoto;
        break;
      }
      erroFinal = error ?? new Error('Resposta inválida ao sincronizar contador OMNI.');
    } catch (error) {
      erroFinal = error;
    }
    if (tentativa < 2) await atraso(250 * (tentativa + 1));
  }
  if (!resposta) {
    console.warn('[omni] falha ao sincronizar operação de contador; estado local permanece otimista:', erroFinal);
    return;
  }

  // Uma resposta atrasada não pode desfazer uma operação local mais nova. A
  // próxima resposta da fila inclui todas as anteriores por causa do lock SQL.
  if (sequenciasLocais.get(characterId) !== sequencia) return;
  const store = useCharacterStore.getState();
  const atual = store.characters.find(c => c.id === characterId);
  if (!atual || (atual._omniCounterRevision ?? 0) > resposta.revision) return;
  if (!resposta.counters || !resposta.sourceUsage) {
    // A RPC confirma a operação, mas não devolve o saldo de uma ficha
    // controlada por outra conta. O dono/Mestre recebe o valor via RLS/Realtime;
    // este cliente não carimba a cópia otimista como canônica.
    return;
  }
  notificarAtualizacaoContadores(characterId, atual.omniCounters, resposta.counters, true);
  store.updateCharacter(characterId, {
    omniCounters: resposta.counters,
    omniCounterSourceUsage: resposta.sourceUsage,
    _omniCounterRevision: resposta.revision,
  });
}

function enfileirar(charId: string, actorCharacterId: string, mutacoes: MutacaoContadorOmni[]): void {
  if (!hasWorkspaceCloud || mutacoes.length === 0) return;
  const sequencia = (sequenciasLocais.get(charId) ?? 0) + 1;
  sequenciasLocais.set(charId, sequencia);
  const operationId = uuid();
  const anterior = filasEmAndamento.get(charId) ?? Promise.resolve();
  const proxima = anterior
    .catch(() => undefined)
    .then(() => enviarOperacao(charId, actorCharacterId, operationId, mutacoes, sequencia))
    .catch(error => console.warn('[omni] erro inesperado na fila de contadores:', error));
  filasEmAndamento.set(charId, proxima);
  void proxima.finally(() => {
    if (filasEmAndamento.get(charId) === proxima) filasEmAndamento.delete(charId);
  });
}

/** Envia operações cujo saldo otimista já foi aplicado por outra mutação do store. */
export function sincronizarOperacoesContadorOmni(
  charId: string,
  mutacoes: MutacaoContadorOmni[],
  actorCharacterId = charId,
): void {
  enfileirar(charId, actorCharacterId, mutacoes);
}

/** Aplica a operação localmente e a envia para a transação idempotente do banco. */
export function aplicarOperacoesContadorOmni(
  charId: string,
  mutacoes: MutacaoContadorOmni[],
  actorCharacterId = charId,
): ResultadoContador[] {
  if (!mutacoes.length) return [];
  const atual = useCharacterStore.getState().characters.find(c => c.id === charId);
  if (!atual) return [];
  const resultado = aplicarLocalmente(atual, mutacoes);
  useCharacterStore.getState().updateCharacter(charId, {
    omniCounters: resultado.counters,
    omniCounterSourceUsage: resultado.usage,
  });
  enfileirar(charId, actorCharacterId, mutacoes);
  return resultado.results;
}

/** Persiste um histórico já aplicado no mesmo setState que atualizou PV/escudo. */
export function enfileirarHistoricoContadorOmni(
  charId: string,
  tipo: 'dano' | 'cura',
  amount: number,
  round: number,
  temporary = 0,
  actorCharacterId = charId,
): void {
  const mutacao: MutacaoContadorOmni = {
    action: tipo === 'dano' ? 'DAMAGE_HISTORY' : 'HEALING_HISTORY',
    amount: Math.max(0, Number.isFinite(amount) ? amount : 0),
    round: Math.max(0, Math.round(round)),
    ...(tipo === 'dano' ? { temporary: Math.max(0, temporary) } : {}),
  };
  enfileirar(charId, actorCharacterId, [mutacao]);
}

/** Reidrata/aplica o estado canônico recebido da tabela transacional. */
export function aplicarSnapshotContadoresOmni(rows: SnapshotContadoresOmni[] | null | undefined, notificar = false): void {
  if (!rows?.length) return;
  const porId = new Map(rows.map(row => [row.character_id, row]));
  useCharacterStore.setState(state => ({
    characters: state.characters.map(character => {
      const row = porId.get(character.id);
      if (!row || row.revision < (character._omniCounterRevision ?? 0)) return character;
      if (notificar) notificarAtualizacaoContadores(character.id, character.omniCounters, row.counters, true);
      return {
        ...character,
        omniCounters: row.counters,
        omniCounterSourceUsage: row.source_usage,
        _omniCounterRevision: row.revision,
      };
    }),
  }));
}

export function aplicarEventoContadorOmni(row: SnapshotContadoresOmni | null | undefined): void {
  if (!row) return;
  aplicarSnapshotContadoresOmni([row], true);
}

