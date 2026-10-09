import { fonteDoContador, notificarAtualizacaoContadores } from './atualizacaoContadores';
import { resolverTipoDano } from './contextoDano';
/**
 * Omni-Engine Runtime Executor (Fatia 3 — Pilar 1+2+4 ao vivo).
 *
 * Avalia BlocoLogico contra o personagem (parser + resolvedor) e aplica
 * AcaoLogica produzindo mutações reais no useCharacterStore + log.
 *
 * Sem side-effects fora de:
 *   - useCharacterStore.applyDamage (DANO) e updateCharacter (demais mutações)
 *   - useLogStore.addLog
 *   - useOmniRuntimeStore (para condições aplicadas como efeitos efêmeros)
 *
 * Proteção anti-loop em macros: profundidade ≤ 8.
 */
import type { Character } from '@/types';
import { resolverCondicaoOmni } from './condicaoDoSistema';
import type {
  AcaoLogica,
  BlocoLogico,
  CondicaoLogica,
  EntidadeOmni,
  GatilhoEntidade,
  Operando,
  ValorDinamico,
} from './tipos';
import {
  ACOES_EFEITO,
  type AlvoRefId,
  type GatilhoId,
  OPERADORES_LOGICOS,
} from './constantesDoSistema';
import { avaliarFormula } from './parser';
import { canonicalizarChave } from './keyAliases';
import { lerCaminhoOmni, montarVariaveisDoPersonagem } from './resolvedor';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { grantAdvantage, clearAllAdvantage, type AdvScope } from './rollAdvantage';
import { adicionarImunidade, removerImunidade, formatarImunidade } from './immunity';
import { calcularContador } from './contadores';
import { aplicarEfeitoNoPersonagem } from './aplicarEfeito';
import { avaliarComposicao } from './componentes/avaliar';
import { dadosCena } from './componentes/cena';
import { dadosEventoDano } from './componentes/eventos';
import { mesclarDados } from './componentes/legado';
import { anexarDadosCompostos, extrairDadosCompostos } from './componentes/contexto';

const PROFUNDIDADE_MAX = 8;

/**
 * Expande "tipo:a,b,c" em ["tipo:a","tipo:b","tipo:c"]. Mantém "todas" e
 * formas sem ":" intactas. Permite multi-seleção em CONCEDER_IMUNIDADE etc.
 */
function expandirEscopos(raw: string): string[] {
  const r = raw.trim();
  if (!r || !r.includes(':')) return [r];
  const [tipo, alvos] = r.split(':');
  if (!alvos) return [r];
  return alvos.split(',').map((s) => s.trim()).filter(Boolean).map((a) => `${tipo}:${a}`);
}

export interface ContextoRuntime {
  evento?: GatilhoId;
  usuario?: Character;
  alvo?: Character;
  cena?: Record<string, number>;
  /** Snapshot numérico do golpe; valores finais existem somente após resolução. */
  dano?: Readonly<Record<string, number>>;
  /** Para macros: profundidade atual de encadeamento. */
  profundidade?: number;
  /** Origem do disparo (para log). */
  origemNome?: string;
  /** Identidade persistente da entidade e da cópia que originaram a condição. */
  sourceEntityId?: string;
  sourceInstanceId?: string;
  /**
   * Scratchpad por bloco — id do último redutor de PE criado via REDUZIR_PE
   * dentro deste bloco, para que ESCOPO_* subsequentes anexem filtros a ele.
   */
  _ultimoRedutorPeId?: string;
}

// =============================================================================
// Resolução de operandos / valores
// =============================================================================

function personagemDoEscopo(ctx: ContextoRuntime, escopo: AlvoRefId): Character | undefined {
  if (escopo === 'USUARIO') return ctx.usuario;
  if (escopo === 'ALVO') return ctx.alvo ?? ctx.usuario;
  return undefined;
}

function variaveisCompletas(ctx: ContextoRuntime): Record<string, number> {
  const vars: Record<string, number> = {};
  if (ctx.usuario) Object.assign(vars, montarVariaveisDoPersonagem(ctx.usuario, 'USUARIO'));
  if (ctx.alvo) Object.assign(vars, montarVariaveisDoPersonagem(ctx.alvo, 'ALVO'));
  if (ctx.cena) for (const [k, v] of Object.entries(ctx.cena)) {
    vars[`CENA_${k}`] = v;
    vars[`CENA_${k.toUpperCase()}`] = v;
  }
  if (ctx.dano) for (const [k, v] of Object.entries(ctx.dano)) {
    vars[`DANO_${k.toUpperCase()}`] = v;
  }
  if (ctx.cena) anexarDadosCompostos(vars, 'CENA', mesclarDados(extrairDadosCompostos(vars).CENA ?? { selecoes: {} }, dadosCena(vars)));
  if (ctx.dano) anexarDadosCompostos(vars, 'DANO', dadosEventoDano(vars));
  return vars;
}

class FormulaRuntimeInvalida extends Error {}
function avaliarFormulaSegura(
  expressao: string,
  ctx: ContextoRuntime,
  valoresAdicionais?: Record<string, number>,
): number {
  const variaveis = variaveisCompletas(ctx);
  if (valoresAdicionais) Object.assign(variaveis, valoresAdicionais);
  const r = avaliarFormula(expressao, variaveis);
  if (r.diagnosticos.length || !Number.isFinite(r.valor)) throw new FormulaRuntimeInvalida(`Fórmula inválida: ${expressao}`);
  return r.valor;
}

function resolverValorDinamico(v: ValorDinamico | undefined, ctx: ContextoRuntime): number {
  if (!v) return 0;
  if (v.tipo === 'fixo') return v.valor;
  return avaliarFormulaSegura(v.expressao, ctx);
}

function resolverOperando(op: Operando, ctx: ContextoRuntime): number | string {
  if (op.tipo === 'fixo') return op.valor;
  if (op.tipo === 'condicao') return op.condicao;
  if (op.tipo === 'formula') return avaliarFormulaSegura(op.expressao, ctx);
  // ref
  if (op.ref.composicao) {
    // ALVO tem fallback para o próprio usuário no leitor legado; preserve o
    // mesmo contrato também para composições quando a ação não tem alvo.
    const contextoComAlvo = op.ref.composicao.contexto === 'ALVO' && !ctx.alvo && ctx.usuario
      ? { ...ctx, alvo: ctx.usuario }
      : ctx;
    const dados = extrairDadosCompostos(variaveisCompletas(contextoComAlvo))[op.ref.composicao.contexto];
    const r = dados ? avaliarComposicao(op.ref.composicao, dados) : undefined;
    if (!r?.ok) {
      const motivo = r?.mensagem ?? 'dados indisponíveis para este contexto';
      throw new FormulaRuntimeInvalida(`Referência composta inválida (${op.ref.caminho}): ${motivo}`);
    }
    return r.valor;
  }
  const caminho = op.ref.caminho.trim().replace(/^@?(usuario|alvo|cena)\./i, '');
  if (!caminho) throw new FormulaRuntimeInvalida('Referência vazia no bloco visual.');

  // O leitor legado retorna 0 para qualquer caminho desconhecido. As
  // referências do construtor passam pelo parser de fórmulas para distinguir
  // zero real de key ausente e também suportar escopos de CENA.
  const escopo = op.ref.alvo === 'ALVO' && !ctx.alvo ? 'USUARIO' : op.ref.alvo;
  const adicionais: Record<string, number> = {};
  if (escopo === 'USUARIO' || escopo === 'ALVO') {
    const alvo = escopo === 'USUARIO' ? ctx.usuario : ctx.alvo;
    const chave = canonicalizarChave(caminho);
    // Contadores e flags nomeados são namespaces dinâmicos: ainda não existir
    // na ficha significa saldo/estado zero, não uma referência desconhecida.
    if (alvo && (/^contador_[a-z0-9_]+$/.test(chave) || /^flag_[a-z0-9_]+$/.test(chave))) {
      const variavel = `${escopo}_${chave.toUpperCase()}`;
      if (variaveisCompletas(ctx)[variavel] === undefined) adicionais[variavel] = 0;
    }
  }
  return avaliarFormulaSegura(`@${escopo}.${caminho}`, ctx, adicionais);
}

// =============================================================================
// Avaliação de condições
// =============================================================================

function temCondicao(c: Character | undefined, cond: string): boolean {
  if (!c) return false;
  const lista = ((c as unknown as { activeConditions?: Array<{ id?: string; type?: string; conditionId?: string }> }).activeConditions) ?? [];
  return lista.some((x) => x.id === cond || x.type === cond || x.conditionId === cond);
}

function avaliarCondicao(cl: CondicaoLogica, ctx: ContextoRuntime): boolean {
  const op = OPERADORES_LOGICOS[cl.operador];
  const esq = resolverOperando(cl.esquerdo, ctx);
  const dir = resolverOperando(cl.direito, ctx);

  switch (op.math) {
    case '>': return Number(esq) > Number(dir);
    case '>=': return Number(esq) >= Number(dir);
    case '<': return Number(esq) < Number(dir);
    case '<=': return Number(esq) <= Number(dir);
    case '===': return esq === dir;
    case '!==': return esq !== dir;
    case '<%': {
      // esquerdo deve ser ref a vida; usa max do mesmo alvo
      if (cl.esquerdo.tipo !== 'ref') return false;
      const alvo = personagemDoEscopo(ctx, cl.esquerdo.ref.alvo);
      if (!alvo || !alvo.hpMax) return false;
      const pct = ((alvo.hpCurrent ?? 0) / alvo.hpMax) * 100;
      return pct < Number(dir);
    }
    case '>%': {
      if (cl.esquerdo.tipo !== 'ref') return false;
      const alvo = personagemDoEscopo(ctx, cl.esquerdo.ref.alvo);
      if (!alvo || !alvo.hpMax) return false;
      const pct = ((alvo.hpCurrent ?? 0) / alvo.hpMax) * 100;
      return pct > Number(dir);
    }
    case 'has': {
      if (cl.esquerdo.tipo !== 'ref') return false;
      return temCondicao(personagemDoEscopo(ctx, cl.esquerdo.ref.alvo), String(dir));
    }
    case '!has': {
      if (cl.esquerdo.tipo !== 'ref') return false;
      return !temCondicao(personagemDoEscopo(ctx, cl.esquerdo.ref.alvo), String(dir));
    }
    default: return false;
  }
}

function blocoVale(b: BlocoLogico, ctx: ContextoRuntime): boolean {
  if (b.condicoes.length === 0) return true;
  const resultados = b.condicoes.map((c) => avaliarCondicao(c, ctx));
  return b.modo === 'todas' ? resultados.every(Boolean) : resultados.some(Boolean);
}

// =============================================================================
// Execução de ações
// =============================================================================

function aplicarPatchNumerico(
  charId: string,
  caminhoRaw: string,
  delta: number,
  modo: 'somar' | 'definir' | 'multiplicar' | 'dividir',
  extras?: Parameters<typeof aplicarEfeitoNoPersonagem>[4],
) {
  if (modo === 'somar') {
    aplicarEfeitoNoPersonagem(charId, delta < 0 ? 'SUBTRAIR' : 'ADICIONAR', caminhoRaw, Math.abs(delta), extras);
    return;
  }
  if (modo === 'definir') {
    aplicarEfeitoNoPersonagem(charId, 'MODIFICADOR', caminhoRaw, delta, extras);
    return;
  }
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c) return;
  const atual = lerCaminhoOmni(c, caminhoRaw);
  const novo = modo === 'multiplicar' ? atual * delta : delta === 0 ? atual : atual / delta;
  aplicarEfeitoNoPersonagem(charId, 'MODIFICADOR', caminhoRaw, novo, extras);
}

function executarAcao(a: AcaoLogica, ctx: ContextoRuntime, log: (m: string) => void) {
  const valor = resolverValorDinamico(a.valor, ctx);
  const alvoChar = personagemDoEscopo(ctx, a.alvoAplicacao);
  const nomeAlvo = alvoChar?.name ?? '—';
  const nomeOrigem = ctx.origemNome ?? 'Omni';
  const extras = { attackerId: ctx.usuario?.id, damageType: a.tipoDano, sourceName: nomeOrigem };

  switch (a.acao) {
    case 'DANO': {
      if (alvoChar) {
        useCharacterStore.getState().applyDamage(alvoChar.id, Math.abs(valor), resolverTipoDano(a.tipoDano), { source: 'omni', attackerId: ctx.usuario?.id });
        log(`${nomeOrigem}: ${nomeAlvo} recebeu um golpe de ${Math.abs(valor)} de dano`);
      }
      break;
    }
    case 'CURAR': {
      if (alvoChar) {
        aplicarEfeitoNoPersonagem(alvoChar.id, 'ADICIONAR', 'status.vida.atual', Math.abs(valor), { attackerId: ctx.usuario?.id });
        log(`${nomeOrigem}: ${nomeAlvo} recuperou ${Math.abs(valor)} de vida`);
      }
      break;
    }
    case 'CONSUMIR_RECURSO': {
      if (alvoChar && a.caminhoAlvo) {
        // 🪬 Aplica redutor de custo Omni (com piso mínimo) por recurso.
        const key = canonicalizarChave(a.caminhoAlvo);
        const red = alvoChar.omniCostReduction?.[key];
        let custo = Math.abs(valor);
        if (red && red.reduce > 0) custo = Math.max(red.min ?? 1, custo - red.reduce);
        aplicarPatchNumerico(alvoChar.id, a.caminhoAlvo, Math.max(0, lerCaminhoOmni(alvoChar, a.caminhoAlvo) - custo), 'definir', extras);
        log(`${nomeOrigem}: ${nomeAlvo} gastou ${custo} em ${a.caminhoAlvo}${red ? ` (reduzido de ${Math.abs(valor)})` : ''}`);
      }
      break;
    }
    case 'SOMAR': {
      if (alvoChar && a.caminhoAlvo) {
        aplicarPatchNumerico(alvoChar.id, a.caminhoAlvo, valor, 'somar', extras);
        log(`${nomeOrigem}: ${nomeAlvo} ${valor >= 0 ? '+' : ''}${valor} em ${a.caminhoAlvo}`);
      }
      break;
    }
    case 'SUBTRAIR': {
      if (alvoChar && a.caminhoAlvo) {
        // 🛡️ Bloqueio Total absorve subtração em vida_atual.
        if (a.caminhoAlvo === 'status.vida.atual'
            && (alvoChar.omniFlags?.bloqueio_total ?? 0) >= 1
            && Math.abs(valor) > 0) {
          const flags = { ...(alvoChar.omniFlags ?? {}), bloqueio_total: 0 };
          useCharacterStore.getState().updateCharacter(alvoChar.id, { omniFlags: flags });
          log(`${nomeOrigem}: 🛡️ ${nomeAlvo} absorveu o dano com Bloqueio Total`);
          break;
        }
        aplicarPatchNumerico(alvoChar.id, a.caminhoAlvo, -Math.abs(valor), 'somar', extras);
        log(`${nomeOrigem}: ${nomeAlvo} -${Math.abs(valor)} em ${a.caminhoAlvo}`);
      }
      break;
    }
    case 'DEFINIR': {
      if (alvoChar && a.caminhoAlvo) {
        aplicarPatchNumerico(alvoChar.id, a.caminhoAlvo, valor, 'definir', extras);
        log(`${nomeOrigem}: ${nomeAlvo}.${a.caminhoAlvo} = ${valor}`);
      }
      break;
    }
    case 'APLICAR_CONDICAO': {
      if (alvoChar && a.condicao) {
        // Resolve a duração: prioriza a duração da AÇÃO; senão usa rodadas
        // calculadas a partir do `valor` (compat legado); senão 1 rodada.
        const duracaoEfetiva = a.duracao
          ?? { tipo: 'rodadas' as const, valor: { tipo: 'fixo' as const, valor: Math.max(1, valor || 1) } };
        const valorDuracao = duracaoEfetiva.valor ? resolverValorDinamico(duracaoEfetiva.valor, ctx) : Math.max(1, valor || 1);
        if (!Number.isFinite(valorDuracao) || valorDuracao < 0) throw new Error('Duração de condição inválida.');
        const def = resolverCondicaoOmni(a.condicao);
        const conditionId = def?.id ?? a.condicao;
        const instanceId = crypto.randomUUID();
        useCharacterStore.getState().addCondition(alvoChar.id, { id: instanceId, conditionId, name: def?.name ?? a.condicao, icon: def?.icon ?? '✨', remainingTurns: -1, remainingRounds: -1, sourceCharId: ctx.usuario?.id, sourceCharName: nomeOrigem, sourceEntityId: ctx.sourceEntityId, sourceInstanceId: ctx.sourceInstanceId });
        if (!useCharacterStore.getState().characters.find(c => c.id === alvoChar.id)?.activeConditions.some(c => c.id === instanceId)) break;
        // Registra como efeito ativo no runtime (visualização + expiração).
        const fakeEnt: EntidadeOmni = {
          id: `cond-${a.condicao}`,
          versao: 1,
          nome: `Condição: ${a.condicao}`,
          categoria: 'condicao',
          descricao: '',
          tags: ['condicao', a.condicao],
          duracao: duracaoEfetiva,
          custos: [],
          gatilhos: [],
          criadoEm: Date.now(),
          atualizadoEm: Date.now(),
        };
        useOmniRuntimeStore.getState().aplicarEfeito(fakeEnt, {
          targetCharId: alvoChar.id,
          sourceCharId: ctx.usuario?.id,
          duracaoValor: valorDuracao,
          duracaoOverride: duracaoEfetiva,
          meta: { condicao: conditionId, conditionInstanceId: instanceId },
        });
        log(`${nomeOrigem}: ${nomeAlvo} ganhou a condição "${a.condicao}"`);
      }
      break;
    }
    case 'REMOVER_CONDICAO': {
      if (alvoChar && a.condicao) {
        const def = resolverCondicaoOmni(a.condicao);
        const conditionId = def?.id ?? a.condicao;
        const rt = useOmniRuntimeStore.getState();
        for (const ef of Object.values(rt.efeitos)) {
          if (ef.targetCharId === alvoChar.id && (a.condicao === 'todas' && !!(ef.meta as { condicao?: string } | undefined)?.condicao || (ef.meta as { condicao?: string } | undefined)?.condicao === conditionId)) {
            rt.removerEfeito(ef.id);
          }
        }
        for (const ac of useCharacterStore.getState().characters.find(c => c.id === alvoChar.id)?.activeConditions ?? []) {
          if (a.condicao === 'todas' || ac.conditionId === conditionId || ac.name.toLocaleLowerCase() === a.condicao.toLocaleLowerCase()) useCharacterStore.getState().removeCondition(alvoChar.id, ac.id);
        }
        log(`${nomeOrigem}: removida a condição "${a.condicao}" de ${nomeAlvo}`);
      }
      break;
    }
    case 'REROLL': {
      // Marca pendência de reroll no efeito ativo do alvo (consumido por dice.ts).
      if (alvoChar) {
        const rt = useOmniRuntimeStore.getState();
        const duracaoEfetiva = a.duracao
          ?? { tipo: 'rodadas' as const, valor: { tipo: 'fixo' as const, valor: Math.max(1, valor || 1) } };
        const ent: EntidadeOmni = {
          id: 'reroll-marker',
          versao: 1,
          nome: `Reroll concedido (${ctx.origemNome ?? 'Omni'})`,
          categoria: 'passiva',
          descricao: '',
          tags: ['reroll'],
          duracao: duracaoEfetiva,
          custos: [],
          gatilhos: [],
          criadoEm: Date.now(),
          atualizadoEm: Date.now(),
        };
        rt.aplicarEfeito(ent, {
          targetCharId: alvoChar.id,
          sourceCharId: ctx.usuario?.id,
          duracaoValor: 1,
          duracaoOverride: duracaoEfetiva,
          meta: { rerollPendente: Math.max(1, valor || 1) },
        });
        log(`${nomeOrigem}: ${nomeAlvo} ganhou ${Math.max(1, valor || 1)} reroll(s) pendente(s)`);
      }
      break;
    }
    case 'MULTIPLICAR': {
      if (alvoChar && a.caminhoAlvo) {
        aplicarPatchNumerico(alvoChar.id, a.caminhoAlvo, valor, 'multiplicar', extras);
        log(`${nomeOrigem}: ${nomeAlvo}.${a.caminhoAlvo} ×${valor}`);
      }
      break;
    }
    case 'DIVIDIR': {
      if (alvoChar && a.caminhoAlvo) {
        aplicarPatchNumerico(alvoChar.id, a.caminhoAlvo, valor, 'dividir', extras);
        log(`${nomeOrigem}: ${nomeAlvo}.${a.caminhoAlvo} ÷${valor}`);
      }
      break;
    }
    case 'DISPARAR_GATILHO': {
      // Macro: dispara outro gatilho. `a.caminhoAlvo` = id da entidade alvo,
      // `a.condicao` = nome do evento (reaproveitando o campo).
      if (a.caminhoAlvo) {
        // Importa lazy para evitar ciclo.
        import('@/stores/useOmniEntidadesStore').then(({ useOmniEntidadesStore }) => {
          const ent = useOmniEntidadesStore.getState().entidades[a.caminhoAlvo!];
          if (!ent) {
            log(`${nomeOrigem}: macro alvo "${a.caminhoAlvo}" não encontrado`);
            return;
          }
          const evento = (a.condicao || 'aoEquipar') as GatilhoId;
          executarGatilho(ent, evento, ctx);
        });
      }
      break;
    }
    case 'CONCEDER_TALENTO': {
      if (alvoChar && a.condicao) {
        const store = useCharacterStore.getState();
        const atuais = alvoChar.chosenTalents ?? [];
        if (!atuais.some((t) => t.id === a.condicao)) {
          store.updateCharacter(alvoChar.id, {
            chosenTalents: [...atuais, { id: a.condicao, level: alvoChar.level ?? 1, source: 'origin' }],
          });
          log(`${nomeOrigem}: ${nomeAlvo} ganhou o talento "${a.condicao}"`);
        }
      }
      break;
    }
    case 'REMOVER_TALENTO': {
      if (alvoChar && a.condicao) {
        const store = useCharacterStore.getState();
        const restantes = (alvoChar.chosenTalents ?? []).filter((t) => t.id !== a.condicao);
        store.updateCharacter(alvoChar.id, { chosenTalents: restantes });
        log(`${nomeOrigem}: ${nomeAlvo} perdeu o talento "${a.condicao}"`);
      }
      break;
    }
    case 'RECARREGAR_HABILIDADE': {
      if (alvoChar && a.condicao) {
        const store = useCharacterStore.getState();
        const usage = { ...(alvoChar.specAbilityUsage ?? {}) };
        usage[a.condicao] = 0;
        store.updateCharacter(alvoChar.id, { specAbilityUsage: usage });
        log(`${nomeOrigem}: ${nomeAlvo} recarregou a habilidade "${a.condicao}"`);
      }
      break;
    }
    case 'MODIFICAR_USOS_APTIDAO': {
      if (alvoChar && a.condicao) {
        const store = useCharacterStore.getState();
        const usage = { ...(alvoChar.auraAptitudeUsage ?? {}) };
        usage[a.condicao] = Math.max(0, Math.round(valor));
        store.updateCharacter(alvoChar.id, { auraAptitudeUsage: usage });
        log(`${nomeOrigem}: ${nomeAlvo}.aptidao(${a.condicao}).usos = ${usage[a.condicao]}`);
      }
      break;
    }
    case 'CONCEDER_VANTAGEM':
    case 'CONCEDER_DESVANTAGEM': {
      if (!alvoChar) break;
      // caminhoAlvo = "scope" ou "scope:target1,target2,...". Multi-alvo
      // suportado por vírgula: "skill_specific:furtividade,acrobacia".
      const raw = (a.caminhoAlvo || 'next_any').trim();
      const [scopeStr, targetStr] = raw.split(':');
      const scope = scopeStr as AdvScope;
      const expiresOverride = (a.condicao as 'use' | 'turn' | 'persistent' | undefined);
      const kind = a.acao === 'CONCEDER_VANTAGEM' ? 'advantage' : 'disadvantage';
      const targets = targetStr
        ? targetStr.split(',').map((s) => s.trim()).filter(Boolean)
        : [undefined];
      for (const t of targets) {
        grantAdvantage(alvoChar.id, kind, scope, {
          target: t,
          expires: expiresOverride,
          source: nomeOrigem,
        });
        log(`${nomeOrigem}: ${nomeAlvo} ganhou ${kind === 'advantage' ? '🟢 Vantagem' : '🔴 Desvantagem'} (escopo: ${scope}${t ? `:${t}` : ''})`);
      }
      break;
    }
    case 'LIMPAR_VANT_DESV': {
      if (alvoChar) {
        clearAllAdvantage(alvoChar.id);
        log(`${nomeOrigem}: limpou modificadores de vantagem/desvantagem de ${nomeAlvo}`);
      }
      break;
    }
    case 'CONCEDER_IMUNIDADE': {
      if (!alvoChar) break;
      // caminhoAlvo aceita: "todas" | "categoria:MENTAL,FÍSICA" | "condicao:atordoado,cego".
      const escopoRaw = (a.caminhoAlvo && a.caminhoAlvo.trim())
        || (a.condicao ? `condicao:${a.condicao}` : 'todas');
      const escopos = expandirEscopos(escopoRaw);
      const store = useCharacterStore.getState();
      let lista = alvoChar.omniImmunities;
      for (const escopo of escopos) {
        lista = adicionarImunidade(lista, escopo);
        log(`${nomeOrigem}: ${nomeAlvo} agora é imune → ${formatarImunidade(escopo)}`);
      }
      store.updateCharacter(alvoChar.id, { omniImmunities: lista });
      break;
    }
    case 'REMOVER_IMUNIDADE': {
      if (!alvoChar) break;
      const escopoRaw = (a.caminhoAlvo && a.caminhoAlvo.trim())
        || (a.condicao ? `condicao:${a.condicao}` : 'todas');
      const escopos = expandirEscopos(escopoRaw);
      const store = useCharacterStore.getState();
      let lista = alvoChar.omniImmunities;
      for (const escopo of escopos) {
        lista = removerImunidade(lista, escopo);
        log(`${nomeOrigem}: ${nomeAlvo} perdeu a imunidade → ${formatarImunidade(escopo)}`);
      }
      store.updateCharacter(alvoChar.id, { omniImmunities: lista });
      break;
    }
    // ── Flags booleanas/numéricas ────────────────────────────────────────
    case 'ATIVAR_FLAG':
    case 'DESATIVAR_FLAG':
    case 'ALTERNAR_FLAG': {
      if (!alvoChar || !a.caminhoAlvo) break;
      const key = a.caminhoAlvo.trim().toLowerCase();
      const flags = { ...(alvoChar.omniFlags ?? {}) };
      const atual = flags[key] ?? 0;
      let prox: number;
      if (a.acao === 'ATIVAR_FLAG') prox = valor || 1;
      else if (a.acao === 'DESATIVAR_FLAG') prox = 0;
      else prox = atual > 0 ? 0 : (valor || 1);
      flags[key] = prox;
      useCharacterStore.getState().updateCharacter(alvoChar.id, { omniFlags: flags });
      log(`${nomeOrigem}: ${nomeAlvo}.flag.${key} = ${prox}`);
      break;
    }
    // ── Contadores nomeados ─────────────────────────────────────────────
    case 'INCREMENTAR_CONTADOR':
    case 'ZERAR_CONTADOR':
    case 'DEFINIR_CONTADOR':
    case 'CONSUMIR_CONTADOR': {
      if (!alvoChar || !a.caminhoAlvo) break;
      const fresh = useCharacterStore.getState().characters.find((x) => x.id === alvoChar.id) ?? alvoChar;
      const key = a.caminhoAlvo.trim().toLowerCase();
      const limiteFonte = a.limiteFonte ? resolverValorDinamico(a.limiteFonte, ctx) : undefined;
      if (limiteFonte !== undefined && (!Number.isFinite(limiteFonte) || limiteFonte < 0)) throw new Error('Limite por fonte inválido.');
      const combate = useCombatStore.getState();
      const cicloFonte = a.periodoFonte === 'rodada'
        ? `rodada:${combate.inCombat ? combate.combatId ?? 'combate' : 'fora'}:${combate.inCombat ? combate.round : 0}`
        : a.periodoFonte === 'descanso'
          ? `descanso:${fresh.omniCounterRestCycle ?? 0}`
          : undefined;
      const res = calcularContador(fresh.omniCounters ?? {}, key, a.acao, {
        valor: a.acao === 'INCREMENTAR_CONTADOR' && !a.valor ? 1 : valor,
        teto: a.teto ? resolverValorDinamico(a.teto, ctx) : undefined,
        escopoTeto: 'global',
        rastrearFonte: a.escopoTeto === 'porFonte' || limiteFonte !== undefined,
        limiteFonte,
        cicloFonte,
        usoPorFonte: fresh.omniCounterSourceUsage,
        fonteId: fonteDoContador(ctx.evento, ctx.usuario?.id, ctx.alvo?.id),
      });
      const counters = res.counters;
      useCharacterStore.getState().updateCharacter(alvoChar.id, { omniCounters: counters, omniCounterSourceUsage: res.usoPorFonte });
      if (a.acao === 'CONSUMIR_CONTADOR') {
        // Disponível para as próximas ações do mesmo bloco: @CENA.consumido
        ctx.cena = { ...(ctx.cena ?? {}), consumido: res.consumido };
        log(`${nomeOrigem}: ${nomeAlvo} consumiu ${res.consumido} de ${key} (restam ${counters[key] ?? 0})`);
      } else {
        log(`${nomeOrigem}: ${nomeAlvo}.contador.${key} = ${counters[key]}`);
      }
      notificarAtualizacaoContadores(alvoChar.id, fresh.omniCounters, counters, true);
      break;
    }
    // ── Redutor de custo de recurso ─────────────────────────────────────
    case 'REDUZIR_CUSTO': {
      if (!alvoChar || !a.caminhoAlvo) break;
      const key = canonicalizarChave(a.caminhoAlvo);
      const min = (a.condicao && /^\d+$/.test(a.condicao)) ? parseInt(a.condicao, 10) : 1;
      const red = { ...(alvoChar.omniCostReduction ?? {}) };
      red[key] = { reduce: Math.max(0, Math.round(valor)), min: Math.max(0, min) };
      useCharacterStore.getState().updateCharacter(alvoChar.id, { omniCostReduction: red });
      log(`${nomeOrigem}: ${nomeAlvo} ganhou redução de ${valor} em ${key} (mín. ${min})`);
      break;
    }
    case 'LIMPAR_REDUTOR_CUSTO': {
      if (!alvoChar || !a.caminhoAlvo) break;
      const key = canonicalizarChave(a.caminhoAlvo);
      const red = { ...(alvoChar.omniCostReduction ?? {}) };
      delete red[key];
      useCharacterStore.getState().updateCharacter(alvoChar.id, { omniCostReduction: red });
      log(`${nomeOrigem}: removida redução de custo em ${key}`);
      break;
    }
    // ── Redutor atômico de PE de feitiços ───────────────────────────────
    // REDUZIR_PE: cria um redutor "vazio" (filtro=todos) com:
    //   valor    = pontos a reduzir
    //   condicao = piso mínimo (default 1) — string numérica
    // ESCOPO_*: anexam um filtro atômico ao ÚLTIMO redutor criado neste
    // bloco pelo mesmo origem (combinação AND via `&`).
    case 'REDUZIR_PE': {
      if (!alvoChar) break;
      const min = (a.condicao && /^\d+$/.test(a.condicao)) ? parseInt(a.condicao, 10) : 1;
      const lista = [...(alvoChar.omniSpellCostReduction ?? [])];
      // Id determinístico por origem + nº de redutores já criados nesta exec.
      const idRed = `${nomeOrigem}__pe__${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      lista.push({
        id: idRed,
        filtro: 'todos',
        reduce: Math.max(0, Math.round(valor)),
        min: Math.max(0, min),
        origem: nomeOrigem,
      });
      useCharacterStore.getState().updateCharacter(alvoChar.id, { omniSpellCostReduction: lista });
      ctx._ultimoRedutorPeId = idRed;
      log(`${nomeOrigem}: ${nomeAlvo} ganhou redução de ${valor} PE em feitiços (mín. ${min})`);
      break;
    }
    case 'ESCOPO_FEITICO':
    case 'ESCOPO_NIVEL':
    case 'ESCOPO_TIPO':
    case 'ESCOPO_NOME': {
      if (!alvoChar || !ctx._ultimoRedutorPeId) {
        log(`${nomeOrigem}: ${a.acao} ignorado — nenhum REDUZIR_PE precedente neste bloco`);
        break;
      }
      // Mapeia a ação para o prefixo de filtro do spellCostReduction.
      const valorEscopo = (a.caminhoAlvo || a.condicao || '').trim();
      let atomico = '';
      if (a.acao === 'ESCOPO_FEITICO') atomico = 'todos';
      else if (a.acao === 'ESCOPO_NIVEL') atomico = valorEscopo ? `nivel:${valorEscopo}` : '';
      else if (a.acao === 'ESCOPO_TIPO') atomico = valorEscopo ? `tipo:${valorEscopo}` : '';
      else if (a.acao === 'ESCOPO_NOME') atomico = valorEscopo ? `nome:${valorEscopo}` : '';
      if (!atomico) break;
      const lista = [...(alvoChar.omniSpellCostReduction ?? [])];
      const idx = lista.findIndex((r) => r.id === ctx._ultimoRedutorPeId);
      if (idx < 0) break;
      const atual = lista[idx];
      const partes = atual.filtro.split('&').map((p) => p.trim()).filter((p) => p && p !== 'todos');
      // Evita duplicar o mesmo átomo.
      if (!partes.includes(atomico) && atomico !== 'todos') partes.push(atomico);
      const novoFiltro = partes.length ? partes.join('&') : 'todos';
      lista[idx] = { ...atual, filtro: novoFiltro };
      useCharacterStore.getState().updateCharacter(alvoChar.id, { omniSpellCostReduction: lista });
      log(`${nomeOrigem}: escopo "${atomico}" anexado ao redutor de PE`);
      break;
    }
    case 'LIMPAR_REDUTOR_PE': {
      if (!alvoChar) break;
      // caminhoAlvo opcional: filtro exato a remover. Sem filtro → limpa
      // todos os redutores de PE cuja origem é esta entidade.
      const filtroAlvo = (a.caminhoAlvo || '').trim();
      const lista = alvoChar.omniSpellCostReduction ?? [];
      const restantes = filtroAlvo
        ? lista.filter((r) => !(r.origem === nomeOrigem && r.filtro === filtroAlvo))
        : lista.filter((r) => r.origem !== nomeOrigem);
      useCharacterStore.getState().updateCharacter(alvoChar.id, { omniSpellCostReduction: restantes });
      log(`${nomeOrigem}: removida redução de PE${filtroAlvo ? ` (filtro: ${filtroAlvo})` : ''}`);
      break;
    }
    case 'MODIFICAR_CUSTO_ACAO': {
      if (!alvoChar || !a.caminhoAlvo || !a.condicao) break;
      // caminhoAlvo = id da habilidade (ex.: 'ler_tecnica')
      // condicao    = novo custo (ex.: 'action_bonus' | 'action_free')
      // valor       = perRound (0 = ilimitado)
      const key = a.caminhoAlvo.trim().toLowerCase();
      const map = { ...(alvoChar.omniActionCost ?? {}) };
      map[key] = { cost: a.condicao, perRound: valor > 0 ? Math.round(valor) : undefined, usedThisRound: 0 };
      useCharacterStore.getState().updateCharacter(alvoChar.id, { omniActionCost: map });
      log(`${nomeOrigem}: ${nomeAlvo}.acao.${key} → ${a.condicao}${valor > 0 ? ` (${valor}×/rodada)` : ''}`);
      break;
    }
    // ── Exaustão (escada genérica) ──────────────────────────────────────
    case 'ADICIONAR_EXAUSTAO': {
      if (!alvoChar) break;
      const cur = alvoChar.exhaustionLevel ?? 0;
      const next = Math.min(6, Math.max(0, cur + (valor || 1)));
      useCharacterStore.getState().updateCharacter(alvoChar.id, { exhaustionLevel: next });
      log(`${nomeOrigem}: ${nomeAlvo} ganhou ${valor || 1} nível(is) de exaustão (${cur} → ${next})`);
      break;
    }
  }
}

// =============================================================================
// Execução de gatilho de uma entidade
// =============================================================================

export function executarGatilho(
  entidade: EntidadeOmni,
  evento: GatilhoId,
  ctx: ContextoRuntime,
): number {
  const profundidade = ctx.profundidade ?? 0;
  if (profundidade > PROFUNDIDADE_MAX) return 0;

  const gatilhos = entidade.gatilhos.filter((g) => g.evento === evento);
  if (gatilhos.length === 0) return 0;

  const log = (m: string) => useLogStore.getState().addLog('system', m);
  const ctxComOrigem: ContextoRuntime = {
    ...ctx,
    evento,
    origemNome: ctx.origemNome ?? entidade.nome,
    sourceEntityId: entidade.id,
    profundidade: profundidade + 1,
  };

  let blocosDisparados = 0;
  for (const g of gatilhos) {
    for (const bloco of g.blocos) {
      try { if (!blocoVale(bloco, ctxComOrigem)) continue; }
      catch (err) { if (!(err instanceof FormulaRuntimeInvalida)) throw err; log(`⛔ ${ctxComOrigem.origemNome}: ${err.message}`); continue; }
      blocosDisparados++;
      // Scratchpad de redutor de PE é por-bloco — encadeamento ESCOPO_*
      // só vale entre ações do mesmo bloco.
      ctxComOrigem._ultimoRedutorPeId = undefined;
      for (const acao of bloco.acoes) {
        try { executarAcao(acao, ctxComOrigem, log); }
        catch (err) { if (!(err instanceof FormulaRuntimeInvalida)) throw err; log(`⛔ ${ctxComOrigem.origemNome}: ${err.message}`); }
      }
    }
  }
  return blocosDisparados;
}

// Re-export para conveniência.
export type { GatilhoEntidade };
