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
  usuarioId?: string;
  alvoId?: string;
  cena?: Record<string, number>;
  /** Snapshot numérico do golpe; valores finais existem somente após resolução. */
  dano?: Readonly<Record<string, number>>;
  origemNome?: string;
  /** Se true, considera entidades passivas globais (aoEquipar) também. */
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
  return executarNaCadeiaOmni(cadeia, () => emitirEventoNaCadeia(evento, opts));
}

function emitirEventoNaCadeia(evento: GatilhoId, opts: EmitirOpts): number {
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
    if (
      (opts.usuarioId && (ef.sourceCharId === opts.usuarioId || ef.targetCharId === opts.usuarioId)) ||
      (opts.alvoId && (ef.sourceCharId === opts.alvoId || ef.targetCharId === opts.alvoId))
    ) {
      idsAtivos.add(ef.entidadeId);
    }
  }

  // 2) Pelas entidades VINCULADAS à ficha (`Character.omniAtivos`).
  //    Categorias 'sempre ativas' — passiva/talento/aura — disparam gatilhos
  //    de turno/eventos enquanto estiverem vinculadas, sem precisar do runtime.
  //    'condicao' continua via runtime (aplica e expira). 'feitico' só
  //    dispara via uso direto (botão Usar), não por gatilho automático.
  const CATEGORIAS_VINCULO_ATIVO = new Set(['passiva', 'talento', 'aura']);
  for (const charId of [opts.usuarioId, opts.alvoId]) {
    if (!charId) continue;
    const c = pegarChar(charId);
    if (!c?.omniAtivos) continue;
    for (const vinc of c.omniAtivos) {
      if (CATEGORIAS_VINCULO_ATIVO.has(vinc.categoria)) {
        idsAtivos.add(vinc.entidadeId);
      }
    }
  }

  let total = 0;
  for (const id of idsAtivos) {
    const ent = entidades[id];
    if (ent) total += executarGatilho(ent, evento, ctx);
  }

  if (opts.incluirPassivas) {
    for (const ent of Object.values(entidades) as EntidadeOmni[]) {
      if (idsAtivos.has(ent.id)) continue;
      if (ent.gatilhos.some((g) => g.evento === 'aoEquipar')) {
        total += executarGatilho(ent, evento, ctx);
      }
    }
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
