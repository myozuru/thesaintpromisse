import { fonteDoContador } from './atualizacaoContadores';
/**
 * 🎯 Disparador de gatilhos sobre efeitos de itens equipados.
 *
 * Os scripts avançados do Omni (com `trigger`/`condition` por efeito) vivem
 * em `entity.combatData.effectsActive` / `effectsPassive`. O `eventBus`
 * tradicional só varre `entidade.gatilhos[]` (estrutura de blocos lógicos),
 * então este módulo faz a ponte para o novo formato:
 *
 *  1. Varre o inventário do personagem.
 *  2. Para cada item equipado, lê os efeitos com `trigger` que casa com
 *     o evento atual (aceita aliases pt-BR como `ao_receber_dano`).
 *  3. Avalia `condition` via `avaliarFormula` (>, <=, ==, etc.).
 *  4. Calcula a fórmula e aplica via `aplicarEfeitoNoPersonagem`.
 *  5. Consome 1 uso da instância (se o item tem `usos`).
 *
 * Esta função é síncrona e segura para ser chamada *antes* da aplicação
 * de dano — assim flags como `bloqueio_total` chegam a tempo.
 *
 * 🔬 LOGGING TÉCNICO: o canal `console.group('[Trigger]')` registra cada
 * passo da varredura, ideal para o desenvolvedor copiar/colar do console
 * do navegador quando algo não dispara como esperado.
 */
import { coletarFontesGatilho, type FonteGatilho } from './fontesGatilho';
import type { CombatEffect, EntidadeOmni } from './tipos';
import { normalizarCombatData } from './tipos';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { aplicarEfeitoNoPersonagem } from './aplicarEfeito';
import { executarCombatEffect } from './executarSubEfeito';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';
import { toast } from 'sonner';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { gatilhoCasa } from './gatilhoAliases';
import type { GatilhoId } from './constantesDoSistema';

/**
 * Casamento de gatilhos delegado a `gatilhoAliases.ts` (fonte única).
 * Aceita aliases pt-BR (`fim_turno`, `@sofrer_dano`, …) e ids técnicos
 * (`noFimDoTurno`, `aoSofrerDano`, …) indistintamente.
 */
function triggerCasa(evento: string, triggerEfeito?: string): boolean {
  return gatilhoCasa(evento as GatilhoId, triggerEfeito);
}

export interface DispararOpts {
  /** Dispatch exclusivo para a aura/entidade que originou o evento. */
  entidade?: EntidadeOmni;
  instanciaId?: string;
  /** Personagem que é "USUARIO" no contexto (em geral, dono do item). */
  usuarioId: string;
  /** Personagem que é "ALVO" (ex.: o atacante, em ao_receber_dano). */
  alvoId?: string;
  /** Variáveis extras de cena (ex.: { dano: 12 }). */
  cena?: Record<string, number>;
  /** Snapshot numérico do golpe; valores finais existem somente após resolução. */
  dano?: Readonly<Record<string, number>>;
}

/**
 * Dispara todos os efeitos de itens equipados pelo `usuarioId` que tenham
 * `trigger` casando com `evento`. Retorna o número de efeitos aplicados.
 */
export function dispararGatilhoEfeitosItens(
  evento: string,
  opts: DispararOpts,
): number {
  const charStore = useCharacterStore.getState();
  const usuario = charStore.characters.find((c) => c.id === opts.usuarioId);
  if (!usuario) {
    console.warn('[Trigger]', evento, '— usuário não encontrado:', opts.usuarioId);
    return 0;
  }
  const alvo = opts.alvoId
    ? charStore.characters.find((c) => c.id === opts.alvoId)
    : undefined;

  const inv = useInventoryStore.getState();
  const omniMap = useOmniEntidadesStore.getState().entidades;
  const { equipados, vinculados } = coletarFontesGatilho(usuario);
  const instancia = opts.instanciaId ? inv.items[opts.instanciaId] : undefined;
  if (opts.instanciaId && (!instancia || instancia.ownerId !== usuario.id)) return 0;
  const todos: FonteGatilho[] = opts.entidade ? [instancia ?? { entity: opts.entidade, instanceId: `evento:${opts.entidade.id}` }] : [...equipados, ...vinculados];

  console.group(`[Trigger] ${evento} → ${usuario.name}`);
  console.log('opts', opts);
  console.log(`equipados: ${equipados.length} • vinculados: ${vinculados.length}`);

  if (todos.length === 0) {
    console.log('⚠ nenhum item equipado nem passiva vinculada — abortando');
    console.groupEnd();
    return 0;
  }

  const log = (m: string) => useLogStore.getState().addLog('system', m);
  let aplicados = 0;

  for (const inst of todos) {
    // Resolve a versão "fresca" do template — corrige bug onde o snapshot
    // no inventário não tinha trigger/condition por ter sido adicionado
    // antes da edição do script no Construtor.
    const fresco: EntidadeOmni = opts.entidade ?? omniMap?.[inst.entity.id] ?? inst.entity;
    const cd = normalizarCombatData(fresco.combatData);
    if (!cd) {
      console.log(`  ✗ ${fresco.nome}: combatData vazio`);
      continue;
    }

    const ativos = cd.effectsActive ?? [];
    const passivos = cd.effectsPassive ?? [];
    console.log(`  • ${fresco.nome} [${inst.instanceId.slice(0, 8)}]`, {
      slotType: fresco.slotType,
      ativos: ativos.length,
      passivos: passivos.length,
      todosOsTriggers: [...ativos, ...passivos].map((e) => e.trigger ?? '(sem trigger)'),
      usos: `${inst.usosRestantes ?? '∞'}/${inst.usosTotais ?? '∞'}`,
    });

    // Considera tanto efeitos ativos quanto passivos com trigger.
    const candidatos: CombatEffect[] = [...ativos, ...passivos].filter((eff) =>
      triggerCasa(evento, eff.trigger),
    );

    if (candidatos.length === 0) {
      console.log(`    ↳ nenhum efeito casa com "${evento}"`);
      continue;
    }
    console.log(`    ↳ ${candidatos.length} candidato(s) casa(m)`, candidatos);

    // ─── 🔒 PRE-HOOK NATIVO: Validador de Usos ──────────────────────────
    // Se o item declara `usos.total` (Aba Custos), o motor cuida sozinho:
    // sem cargas restantes → aborta SILENCIOSAMENTE (não dispara, não loga
    // erro pro jogador). O Mestre não precisa escrever `se usos > 0` no
    // script — essa burocracia é responsabilidade do motor.
    const temUsos = typeof inst.usosRestantes === 'number' && typeof inst.usosTotais === 'number';
    if (temUsos && (inst.usosRestantes ?? 0) <= 0) {
      console.log(`    ↳ 🔒 [Pre-Hook] sem cargas (${inst.usosRestantes}/${inst.usosTotais}) — abortado silenciosamente`);
      continue;
    }

    // Bag de variáveis: USUARIO=portador, ALVO=atacante (se houver).
    // Recriada após cada efeito aplicado para que condições encadeadas
    // vejam o estado recém-atualizado (ex.: somar 1 em fadiga, depois
    // `se fadiga igual a 2` já enxerga a fadiga incrementada).
    const montarVariaveisAtuais = (): Record<string, number> => {
      const storeAtual = useCharacterStore.getState();
      const usuarioAtual = storeAtual.characters.find((c) => c.id === opts.usuarioId) ?? usuario;
      const alvoAtual = opts.alvoId
        ? storeAtual.characters.find((c) => c.id === opts.alvoId)
        : alvo;
      const vars: Record<string, number> = {
        ...montarVariaveisDoPersonagem(usuarioAtual, 'USUARIO'),
      };
      if (alvoAtual) Object.assign(vars, montarVariaveisDoPersonagem(alvoAtual, 'ALVO'));
      if (opts.cena) {
        for (const [k, v] of Object.entries(opts.cena)) {
          vars[`CENA_${k}`] = v;
          vars[`CENA_${k.toUpperCase()}`] = v;
        }
      }
      if (opts.dano) for (const [k, v] of Object.entries(opts.dano)) {
        vars[`DANO_${k.toUpperCase()}`] = v;
      }
      for (const [k, v] of Object.entries(cenaLocal)) {
        vars[`CENA_${k}`] = v;
        vars[`CENA_${k.toUpperCase()}`] = v;
      }
      return vars;
    };
    // ITEM.* (usos, etc.) — ainda exposto para retro-compatibilidade com
    // scripts legados que usem @ITEM.usos_restantes manualmente.
    const itemBag: Record<string, number> = {
      usos_restantes: inst.usosRestantes ?? 0,
      usos_totais: inst.usosTotais ?? 0,
    };

    let consumiuUso = false;
    const cenaLocal: Record<string, number> = {};
    for (const eff of candidatos) {
      const variaveis = montarVariaveisAtuais();
      // Avalia condição (se houver). String boolean → 1/0.
      if (eff.condition && eff.condition.trim()) {
        try {
          const r = avaliarFormula(eff.condition, variaveis, undefined, { item: itemBag });
          if (r.diagnosticos.length) {
            log(`⛔ ${fresco.nome} (${evento}): condição inválida — ${r.diagnosticos.map(d => d.mensagem).join('; ')}`);
            continue;
          }
          console.log(`    ↳ condição "${eff.condition}" → ${r.valor}`);
          if (r.valor <= 0) {
            console.log('      ✗ condição falsa — pulando efeito');
            continue;
          }
        } catch (err) {
          console.warn(`    ↳ erro avaliando condição "${eff.condition}":`, err);
          continue;
        }
      }
      // ─── 🎭 Keys especiais (diceSwitch / conditionApply / buttonOnly) ──
      if (eff.diceSwitch || eff.conditionApply || eff.buttonOnly) {
        const r = executarCombatEffect(eff, {
          usuarioId: usuario.id,
          alvoId: alvo?.id,
          usuarioVars: montarVariaveisAtuais(),
          alvoVars: montarVariaveisAtuais(),
          itemVars: itemBag,
          sourceName: fresco.nome,
          dano: opts.dano,
        });
        if (r.invalido) continue;
        console.log(`    ↳ ✓ key especial → ${r.detalhe ?? '(sem detalhe)'}`);
        aplicados++;
        consumiuUso = true;
        log(`⚡ ${fresco.nome} (${evento}): ${r.detalhe ?? 'efeito especial'}`);
        continue;
      }
      // Calcula fórmula e aplica.
      let valor = 0;
      try {
        const r = avaliarFormula(eff.formula || '0', variaveis, undefined, { item: itemBag });
        if (r.diagnosticos.length) {
          log(`⛔ ${fresco.nome} (${evento}): fórmula inválida — ${r.diagnosticos.map(d => d.mensagem).join('; ')}`);
          continue;
        }
        valor = r.valor;
      } catch (err) {
        console.warn(`    ↳ erro avaliando fórmula "${eff.formula}":`, err);
        continue;
      }
      const limite = eff.counterCap ? avaliarFormula(eff.counterCap, variaveis, undefined, { item: itemBag }) : undefined;
      const limiteFonte = eff.counterSourceLimit ? avaliarFormula(eff.counterSourceLimit, variaveis, undefined, { item: itemBag }) : undefined;
      const diagnosticosDosTetos = [...(limite?.diagnosticos ?? []), ...(limiteFonte?.diagnosticos ?? [])];
      if (diagnosticosDosTetos.length || (limite && !Number.isFinite(limite.valor)) || (limiteFonte && !Number.isFinite(limiteFonte.valor))) {
        log(`⛔ ${fresco.nome} (${evento}): teto inválido — ${diagnosticosDosTetos.map(d => d.mensagem).join('; ') || 'valor não finito'}`);
        continue;
      }
      const targetId = eff.target === 'ALVO' ? (alvo?.id ?? usuario.id) : usuario.id;
      const res = aplicarEfeitoNoPersonagem(targetId, eff.type, eff.resourcePath, valor, {
        peSpellReduction: eff.peSpellReduction,
        immunityGrant: eff.immunityGrant,
        sourceName: fresco.nome,
        damageType: eff.damageType,
        attackerId: usuario.id,
        contador: {
          teto: limite?.valor,
          porFonte: eff.counterPerSource,
          fonteId: fonteDoContador(evento, usuario.id, opts.alvoId),
          limiteFonte: limiteFonte?.valor,
          periodoFonte: eff.counterSourcePeriod,
        },
      });
      if (typeof res.consumido === 'number') cenaLocal.consumido = res.consumido;
      console.log(
        `    ↳ ✓ aplicado: ${eff.type} ${valor} em ${eff.resourcePath} (target=${eff.target} → ${targetId.slice(0, 8)})`,
        res,
      );
      aplicados++;
      consumiuUso = true;
      log(
        `⚡ ${fresco.nome} (${evento}): ${eff.type} ${valor} em ${eff.resourcePath ?? 'vida_atual'}` +
          (res.absorvidoPorBloqueio ? ' (absorvido)' : ''),
      );
    }

    // ─── 🔄 AUTO-CONSUMO + NOTIFICAÇÃO INTEGRADA ────────────────────────
    // Após qualquer execução bem-sucedida, o motor decrementa 1 carga
    // automaticamente e emite um toast unificado. O script do Mestre
    // permanece limpo (apenas a ação real, sem `subtrair 1 em usos`).
    if (consumiuUso && temUsos) {
      inv.consumirUso(inst.instanceId, 1);
      const restantes = (inst.usosRestantes ?? 1) - 1;
      console.log(`    ↳ 🔄 [Auto-Consumo] 1 carga consumida (resta ${restantes}/${inst.usosTotais})`);
      toast(`⚡ Gatilho Ativado: ${fresco.nome}`, {
        description: `1 uso consumido — restam ${restantes}/${inst.usosTotais}`,
      });
    } else if (consumiuUso) {
      toast(`⚡ Gatilho Ativado: ${fresco.nome}`, {
        description: 'Uso ilimitado',
      });
    }
  }

  console.log(`total aplicado: ${aplicados}`);
  console.groupEnd();
  return aplicados;
}

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__omniTrigger = { dispararGatilhoEfeitosItens, montarVariaveisDoPersonagem };
}
