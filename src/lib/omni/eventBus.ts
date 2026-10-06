import { coletarFontesGatilho } from './fontesGatilho';
/**
 * Omni-Engine Event Bus (Fatia 3).
 *
 * Ponto único onde o jogo emite eventos. Para cada evento:
 *  1. Busca todas as entidades referenciadas por efeitos ativos do
 *     contexto (usuario/alvo) → executa seus gatilhos compatíveis.
 *  2. (Opcional) Busca entidades "passivas" globais marcadas com
 *     gatilho `aoEquipar` aplicadas como efeito permanente.
 *
 * Não há listeners externos: a varredura é determinística sobre os stores.
 */
import { reservarPassoOmni, executarNaCadeiaOmni, type CadeiaOmni } from './cadeiaEventos';
import type { GatilhoId } from './constantesDoSistema';
import type { EntidadeOmni } from './tipos';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { executarGatilho, type ContextoRuntime } from './executor';
import { dispararGatilhoEfeitosItens } from './triggerEfeitos';

export interface EmitirOpts {
  /** Contexto interno da cadeia que originou este evento. */
  cadeia?: CadeiaOmni;
  /** Instância de inventário em um dispatch exclusivo (ex.: equipar). */
  instanciaId?: string;
  usuarioId?: string;
  alvoId?: string;
  cena?: Record<string, number>;
  /** Snapshot numérico do golpe; valores finais existem somente após resolução. */
  dano?: Readonly<Record<string, number>>;
  origemNome?: string;
  /** Sem usuarioId, entrega o evento a cada ficha portadora de efeitos. */
  incluirPassivas?: boolean;
  /**
   * Se false, não varre `effectsActive/Passive` dos itens equipados
   * (evita disparo duplo quando o caller já chamou
   * `dispararGatilhoEfeitosItens` manualmente, ex.: pre-hook de dano).
   * Default: true.
   */
  incluirScriptsItens?: boolean;
}

function pegarChar(id?: string) {
  if (!id) return undefined;
  return useCharacterStore.getState().characters.find((c) => c.id === id);
}

export function emitirEvento(evento: GatilhoId, opts: EmitirOpts = {}): number {
  const cadeia = reservarPassoOmni(opts.cadeia);
  if (!cadeia) return 0;
  // O descanso já foi concluído quando o chamador emite este evento. O ciclo
  // fica na ficha para quotas de contador e independe do saldo consumível.
  if (evento === 'aoDescansar' && opts.usuarioId) {
    const ficha = pegarChar(opts.usuarioId);
    if (ficha) useCharacterStore.getState().updateCharacter(ficha.id, {
      omniCounterRestCycle: (ficha.omniCounterRestCycle ?? 0) + 1,
    });
  }
  return executarNaCadeiaOmni(cadeia, () => emitirEventoNaCadeia(evento, opts));
}

/** Evento de uma entidade específica: não dispara outras auras do portador. */
export function emitirEventoDaEntidade(ent: EntidadeOmni, evento: GatilhoId, opts: EmitirOpts): number {
  const cadeia = reservarPassoOmni(opts.cadeia);
  if (!cadeia) return 0;
  return executarNaCadeiaOmni(cadeia, () => {
    const ctx = { usuario: pegarChar(opts.usuarioId), alvo: pegarChar(opts.alvoId), cena: opts.cena, dano: opts.dano, origemNome: opts.origemNome, profundidade: 0 };
    return executarGatilho(ent, evento, ctx) + (opts.usuarioId ? dispararGatilhoEfeitosItens(evento, { usuarioId: opts.usuarioId, alvoId: opts.alvoId, cena: opts.cena, dano: opts.dano, entidade: ent, instanciaId: opts.instanciaId }) : 0);
  });
}

function emitirEventoNaCadeia(evento: GatilhoId, opts: EmitirOpts): number {
  // Eventos globais (relógio) são entregues a cada portador real. O catálogo
  // contém modelos, não instâncias de passivas de todos os personagens.
  if (!opts.usuarioId && opts.incluirPassivas) {
    return useCharacterStore.getState().characters.reduce((total, c) => total + emitirEvento(evento, { ...opts, usuarioId: c.id, incluirPassivas: false }), 0);
  }
  const usuario = pegarChar(opts.usuarioId);
  const alvo = pegarChar(opts.alvoId);
  const ctx: ContextoRuntime = {
    usuario,
    alvo,
    cena: opts.cena,
    dano: opts.dano,
    origemNome: opts.origemNome,
    profundidade: 0,
  };

  const entidades = useOmniEntidadesStore.getState().entidades;
  const efeitos = Object.values(useOmniRuntimeStore.getState().efeitos);

  // Quais entidades estão "ativas no contexto"?
  const idsAtivos = new Set<string>();

  // 1) Pelo runtime (efeitos persistentes — condições aplicadas, buffs, etc.)
  for (const ef of efeitos) {
    if (opts.usuarioId && (ef.targetCharId ?? ef.sourceCharId) === opts.usuarioId) {
      idsAtivos.add(ef.entidadeId);
    }
  }

  // 2) Fontes do portador: armas empunhadas, equipamentos e vínculos.
  // Scripts e blocos visuais precisam enxergar a mesma disponibilidade.
  const fontesDoDono = new Map<string, EntidadeOmni>();
  if (usuario) {
    const fontes = coletarFontesGatilho(usuario);
    for (const inst of [...fontes.equipados, ...fontes.vinculados]) {
      idsAtivos.add(inst.entity.id);
      fontesDoDono.set(inst.entity.id, entidades[inst.entity.id] ?? inst.entity);
    }
  }

  let total = 0;
  for (const id of idsAtivos) {
    const ent = fontesDoDono.get(id) ?? entidades[id];
    if (ent) total += executarGatilho(ent, evento, ctx);
  }

  // 3) Scripts do terminal Omni (effectsActive/effectsPassive em itens
  //    equipados). Suporta aliases pt-BR via `gatilhoAliases.ts` —
  //    qualquer evento canônico pode ser usado em `@<alias> -> …`.
  if (opts.usuarioId && opts.incluirScriptsItens !== false) {
    try {
      total += dispararGatilhoEfeitosItens(evento, {
        usuarioId: opts.usuarioId,
        alvoId: opts.alvoId,
        cena: opts.cena,
        dano: opts.dano,
      });
    } catch (err) {
      console.warn('[emitirEvento] erro disparando scripts de itens:', err);
    }
  }

  return total;
}
