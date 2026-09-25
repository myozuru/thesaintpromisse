/**
 * Resolvedor de Caminhos (ponte Omni ↔ sistema existente).
 *
 * Faz o mapeamento entre os caminhos abstratos do dicionário Omni
 * ("atributos.forca", "status.vida.atual") e a estrutura real do
 * `Character` do projeto atual (useCharacterStore). Assim, novas
 * entidades no-code podem ler/gravar no personagem existente sem
 * tocar no schema legado.
 */
import type { Character, Attribute } from '@/types';
import { getMasteryBonus } from '@/types';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { aggregateTalentBonuses } from '@/lib/talentEffects';
import { aggregateAuraEffects } from '@/lib/auraEffects';
import { useCombatStore } from '@/stores/useCombatStore';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { findWeaponByName } from '@/lib/weapons';
import { ALL_CONDITIONS } from '@/types/conditions';



// Leitura de caminho "dot.path" em um objeto qualquer.
function lerCaminho(obj: unknown, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/** Normaliza um nome/id de atributo para uma chave canônica pt-BR. */
function chaveAtr(s: string): string {
  const n = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (n.startsWith('for')) return 'forca';
  if (n.startsWith('des')) return 'destreza';
  if (n.startsWith('con')) return 'constituicao';
  if (n.startsWith('int')) return 'inteligencia';
  if (n.startsWith('sab')) return 'sabedoria';
  if (n.startsWith('pre')) return 'presenca';
  if (n.startsWith('car')) return 'presenca'; // alias D&D
  // Astúcia e Vontade NÃO são atributos — são Testes de Resistência.
  return n;
}

/** Normaliza o nome de uma perícia para a chave técnica canônica
 *  (sem acento, em minúsculas, com underscore). Ex: "Ofício 1" → "oficio1". */
function chavePericia(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

function somaAtr(a: Attribute, level: number): number {
  const base = a.value ?? 0;
  const ext = a.externalBonus ?? 0;
  const mastery = a.mastery ? getMasteryBonus(level) : 0;
  return base + ext + mastery;
}

/**
 * Normaliza um Character do sistema atual para o shape esperado pelos
 * caminhos Omni ("atributos.forca", "status.vida.atual", etc.).
 */
export function projetarPersonagemParaOmni(c: Character): Record<string, unknown> {
  const level = c.level ?? 1;
  const atributos: Record<string, number> = {
    forca: 0, destreza: 0, constituicao: 0,
    inteligencia: 0, sabedoria: 0, presenca: 0,
  };
  for (const a of c.attributes ?? []) {
    const key = chaveAtr(a.name || a.id || '');
    if (key in atributos) atributos[key] = somaAtr(a, level);
  }
  const status = {
    vida: { atual: c.hpCurrent ?? 0, max: c.hpMax ?? 0 },
    energiaAmaldicoada: { atual: c.peCurrent ?? 0, max: c.peMax ?? 0 },
    deslocamento: c.movement ?? 0,
    defesa: c.ca ?? 0,
    bonusTreinamento: c.trainingBonus ?? getTrainingBonusByLevel(level),
    nivelExaustao: 0,
    nivel: level,
  };
  const pericias: Record<string, number> = {};
  for (const s of c.skills ?? []) {
    const key = chavePericia(s.name || s.id || '');
    pericias[key] = somaAtr(s, level);
  }
  // Testes de Resistência (TR) — mesma normalização das perícias.
  const tr: Record<string, number> = {};
  for (const s of c.savingThrows ?? []) {
    const key = chavePericia(s.name || s.id || '');
    if (key) tr[key] = somaAtr(s, level);
  }
  return { atributos, status, pericias, tr };
}

/** Lê um caminho Omni diretamente do Character. */
export function lerCaminhoOmni(c: Character, caminho: string): number {
  const proj = projetarPersonagemParaOmni(c);
  const v = lerCaminho(proj, caminho);
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    const inner = (v as Record<string, unknown>).value;
    if (typeof inner === 'number') return inner;
  }
  return 0;
}

/**
 * Monta o bag `variaveis` usado pelo parser a partir de um Character.
 * Injeta aliases curtos (FOR, TREINO, NIVEL, VIDA, …) + alguns prefixados
 * por escopo (@USUARIO.*) para permitir fórmulas como "@USUARIO.FOR * 2".
 */
export function montarVariaveisDoPersonagem(
  c: Character,
  escopo: 'USUARIO' | 'ALVO' | 'CENA' = 'USUARIO'
): Record<string, number> {
  const proj = projetarPersonagemParaOmni(c);
  const atributos = proj.atributos as Record<string, number>;
  const status = proj.status as Record<string, unknown>;
  const vida = status.vida as { atual: number; max: number };
  const ea = status.energiaAmaldicoada as { atual: number; max: number };

  // ─── Bônus derivados de talentos/aptidões/auras (com fallback seguro) ─
  let talentos: ReturnType<typeof aggregateTalentBonuses> | null = null;
  try { talentos = aggregateTalentBonuses(c); } catch { talentos = null; }
  let auras: ReturnType<typeof aggregateAuraEffects> | null = null;
  try { auras = aggregateAuraEffects(c); } catch { auras = null; }

  const tempPE = c.tempPE ?? 0;
  const tempVida = (c as unknown as { tempHp?: number }).tempHp ?? 0;
  const sorteAtual = c.luckCurrent ?? 0;
  const sorteMax = c.luckMax ?? 0;
  const dadoVidaAtual = c.hitDiceCurrent ?? 0;
  const dadoVidaMax = c.hitDiceMax ?? 0;
  const reservaPE = c.economiaPEReserve ?? 0;
  const exaustao = c.exhaustionLevel ?? 0;
  const fome = c.hunger ?? 0;
  const morto = (vida.atual <= 0 && c.exhaustionLevel === 6) ? 1 : 0;
  const morrendo = c.dying ? 1 : 0;
  const inconsciente = c.unconsciousFromExhaustion ? 1 : 0;
  const tamanhoMap: Record<string, number> = { 'Pequeno': 1, 'Médio': 2, 'Grande': 3 };
  const tamanho = tamanhoMap[c.sizeCategory ?? 'Médio'] ?? 2;
  const empolgacao = c.empolgacaoLevel ?? 0;
  const categoriaMap: Record<string, number> = { 'PLAYER': 1, 'NPC': 2, 'INIMIGO': 3 };
  const categoria = categoriaMap[c.category as unknown as string] ?? 0;
  const round = (() => { try { return useCombatStore.getState().round ?? 0; } catch { return 0; } })();

  // Contadores por tipo (talentos/aptidões/habilidades)
  const qtdTalentosCombate = (c.chosenTalents ?? []).filter((t) => /combate|arma|ataque|defes/i.test(t.id)).length;
  const qtdAptidoesAura = (c.chosenAuraAptitudes ?? []).length;
  const qtdHabilidadesSpec = (c.chosenSpecAbilities ?? []).length;

  const base: Record<string, number> = {
    FOR: atributos.forca,
    DES: atributos.destreza,
    CON: atributos.constituicao,
    INT: atributos.inteligencia,
    SAB: atributos.sabedoria,
    SABEDORIA: atributos.sabedoria,
    // PRE / CAR → presenca (atributo real da ficha).
    PRE: atributos.presenca,
    CAR: atributos.presenca,
    PRESENCA: atributos.presenca,
    TREINO: (status.bonusTreinamento as number) ?? 0,
    BONUS_TREINAMENTO: (status.bonusTreinamento as number) ?? 0,
    BONUSDETREINAMENTO: (status.bonusTreinamento as number) ?? 0,
    TREINAMENTO: (status.bonusTreinamento as number) ?? 0,
    NIVEL: (status.nivel as number) ?? 1,
    VIDA: vida.atual,
    VIDA_ATUAL: vida.atual,
    VIDA_MAX: vida.max,
    PE: ea.atual,
    ENERGIA: ea.atual,
    ENERGIA_MAX: ea.max,
    PE_MAX: ea.max,
    DEFESA: (status.defesa as number) ?? 0,
    DESLOCAMENTO: (status.deslocamento as number) ?? 0,
    EXAUSTAO: exaustao,
    // Métricas de combate (resolvidas a 0 quando não calculadas no Character).
    ACERTO: ((status as Record<string, number>).modificadorAtaque) ?? 0,
    ESQUIVA: ((status as Record<string, number>).esquiva) ?? 0,
    RESISTENCIA: ((status as Record<string, number>).resistenciaAmaldicoada) ?? 0,
    // Flags Omni genéricas (omniFlags).
    BLOQUEIO_TOTAL: c.omniFlags?.bloqueio_total ?? 0,
    FADIGA: c.omniCounters?.fadiga ?? 0,

    // ─── 🩺 RECURSOS & POOLS ────────────────────────────────────────────
    VIDA_TEMP: tempVida,
    VIDA_TEMP_MAX: tempVida,
    VIDA_PCT: vida.max > 0 ? Math.round((vida.atual / vida.max) * 100) : 0,
    ENERGIA_PCT: ea.max > 0 ? Math.round((ea.atual / ea.max) * 100) : 0,
    PE_PCT: ea.max > 0 ? Math.round((ea.atual / ea.max) * 100) : 0,
    PE_TEMP: tempPE,
    SORTE: sorteAtual,
    SORTE_ATUAL: sorteAtual,
    SORTE_MAX: sorteMax,
    DADO_VIDA: dadoVidaAtual,
    DADO_VIDA_ATUAL: dadoVidaAtual,
    DADO_VIDA_MAX: dadoVidaMax,
    RESERVA_PE: reservaPE,
    RESERVA_PE_ATUAL: reservaPE,
    RESERVA_PE_MAX: reservaPE,

    // ─── 🍖 SOBREVIVÊNCIA ───────────────────────────────────────────────
    EXAUSTAO_NIVEL: exaustao,
    FOME: fome,
    FOME_NIVEL: fome,

    // ─── ⚔️ COMBATE AVANÇADO — Defesa & Iniciativa ──────────────────────
    DEFESA_CAC: ((status.defesa as number) ?? 0),
    DEFESA_DIST: ((status.defesa as number) ?? 0),
    INICIATIVA: c.initiativeBonus ?? 0,
    ATENCAO: c.attention ?? 0,

    // ─── 🎯 ECONOMIA DE AÇÕES ───────────────────────────────────────────
    ATAQUES_NO_TURNO: c.actionsMax ?? 1,
    ATAQUES_RESTANTES: c.actionsCurrent ?? 1,
    ACAO_RESTANTE: c.actionsCurrent ?? 1,
    ACOES_RESTANTES: c.actionsCurrent ?? 1,
    ACAO_BONUS: c.bonusActionsCurrent ?? 0,
    ADO_MAX: c.opportunityMax ?? 0,
    ADO_RESTANTES: c.opportunityCurrent ?? 0,
    REACAO_DISPONIVEL: (c.reactionsCurrent ?? 0) > 0 ? 1 : 0,
    MOVIMENTO_RESTANTE: c.movement ?? 0,

    // ─── ⚡ PR-1: AdO & Reações ─────────────────────────────────────────
    REACOES_MAX: c.reactionsMax ?? 1,
    REACOES_RESTANTES: c.reactionsCurrent ?? 0,
    REACAO_USADA_NESTA_RODADA: (c.reactionsCurrent ?? 0) < (c.reactionsMax ?? 1) ? 1 : 0,
    ...(() => {
      let grant: { mode?: string; consumed?: boolean; restrictToCharId?: string } | undefined;
      try { grant = useOpportunityStore.getState().grants[c.id]; } catch { grant = undefined; }
      const modoMap: Record<string, number> = { reaction: 1, action: 2, either: 3 };
      return {
        ADO_CONCEDIDA: grant ? 1 : 0,
        ADO_MODO: grant ? (modoMap[grant.mode ?? ''] ?? 0) : 0,
        ADO_CONSUMIDA: grant?.consumed ? 1 : 0,
        ADO_RESTRITA: grant?.restrictToCharId ? 1 : 0,
      };
    })(),

    // ─── 👁️ PR-1: Visão / Iluminação (defaults 0; mestre seta via flags) ─
    VISAO_NORMAL: c.omniFlags?.visao_normal ?? 0,
    VISAO_PENUMBRA: c.omniFlags?.visao_penumbra ?? 0,
    VISAO_ESCURIDAO: c.omniFlags?.visao_escuridao ?? 0,
    NA_ESCURIDAO: c.omniFlags?.na_escuridao ?? c.omniFlags?.visao_escuridao ?? 0,
    NA_PENUMBRA: c.omniFlags?.na_penumbra ?? c.omniFlags?.visao_penumbra ?? 0,
    ESTA_ILUMINADO: c.omniFlags?.esta_iluminado ?? 0,
    ESTA_OCULTO: c.omniFlags?.esta_oculto ?? 0,
    LINHA_DE_VISAO: c.omniFlags?.linha_de_visao ?? 0,
    ATRAS_DE_COBERTURA: c.omniFlags?.atras_de_cobertura ?? 0,
    FONTE_DE_LUZ_ATIVA: c.omniFlags?.fonte_de_luz_ativa ?? 0,

    // ─── 🗺️ PR-2: Mapa & Distância ─────────────────────────────────────
    EM_TERRENO_DIFICIL: c.omniFlags?.em_terreno_dificil ?? 0,
    VOANDO: c.omniFlags?.voando ?? 0,
    PRONO: c.omniFlags?.prono ?? 0,
    AGACHADO: c.omniFlags?.agachado ?? 0,
    VELOCIDADE_ATUAL: (() => {
      const base = c.movement ?? 0;
      const sobrecarga = (c.slotsCurrent ?? 0) > (c.slotsMax ?? 0);
      return sobrecarga ? base / 2 : base;
    })(),
    METROS_MOVIDOS_NESTE_TURNO: c.omniCounters?.metros_movidos ?? 0,
    USOU_CORRIDA: c.omniFlags?.usou_corrida ?? 0,
    SOBRECARREGADO: (c.slotsCurrent ?? 0) > (c.slotsMax ?? 0) ? 1 : 0,
    // Globais de cena (controláveis via omniFlags/omniCounters do Mestre).
    CENA_DISTANCIA_XY: c.omniCounters?.cena_distancia_xy ?? 0,
    CENA_DISTANCIA_MANHATTAN: c.omniCounters?.cena_distancia_manhattan ?? 0,
    CENA_ELEVACAO_DIFF: c.omniCounters?.cena_elevacao_diff ?? 0,
    CENA_TERRENO: c.omniFlags?.cena_terreno ?? 0,

    // ─── 🩹 PR-2: Recursos Detalhados (thresholds) ─────────────────────
    VIDA_PCT_ABAIXO_50: vida.max > 0 && (vida.atual / vida.max) <= 0.5 ? 1 : 0,
    VIDA_PCT_ABAIXO_25: vida.max > 0 && (vida.atual / vida.max) <= 0.25 ? 1 : 0,
    BLOODIED: vida.max > 0 && (vida.atual / vida.max) <= 0.5 ? 1 : 0,
    CRITICAMENTE_FERIDO: vida.max > 0 && (vida.atual / vida.max) <= 0.25 ? 1 : 0,
    PE_PCT_ABAIXO_50: ea.max > 0 && (ea.atual / ea.max) <= 0.5 ? 1 : 0,
    PE_PCT_ABAIXO_25: ea.max > 0 && (ea.atual / ea.max) <= 0.25 ? 1 : 0,

    // ─── 🗡️ PR-2: Empunhadura ──────────────────────────────────────────
    ...(() => {
      const main = c.mainHandWeaponName ?? null;
      const off = c.offHandWeaponName ?? null;
      const desarmado = !main && !off ? 1 : 0;
      const duasMaos = main && off && main === off ? 1 : 0;
      const dualWield = main && off && main !== off ? 1 : 0;
      const mainW = main ? findWeaponByName(main) : undefined;
      const offW = off && off !== main ? findWeaponByName(off) : undefined;

      const hasProp = (kind: string) => mainW?.properties?.some((p) => p.kind === kind) ? 1 : 0;
      return {
        DESARMADO: desarmado,
        DUAS_MAOS: duasMaos,
        DUAL_WIELD: dualWield,
        ARMA_PRINCIPAL_EH_CAC: mainW?.range === 'melee' ? 1 : 0,
        ARMA_PRINCIPAL_EH_DISTANCIA: mainW?.range === 'ranged' ? 1 : 0,
        ARMA_PRINCIPAL_LEVE: hasProp('leve'),
        ARMA_PRINCIPAL_VERSATIL: hasProp('versatil'),
        ARMA_PRINCIPAL_FINEZA: hasProp('fineza'),
        ARMA_PRINCIPAL_PESADA: hasProp('pesada'),
        ESCUDO_ID_EQUIPADO: c.equippedShieldId ? 1 : 0,
        SWAPS_ARMAS_NESTE_TURNO: c.weaponSwapsThisTurn ?? 0,
        ATAQUES_NESTE_TURNO: c.attacksThisTurn ?? 0,
        ULTIMO_ATAQUE_ACERTOU: c.lastAttackHit === true ? 1 : 0,
        ULTIMO_ATAQUE_ERROU: c.lastAttackHit === false ? 1 : 0,
      };
    })(),

    // ─── 🪪 PR-3: Identidade ───────────────────────────────────────────
    EH_PLAYER: c.category === 'PLAYER' ? 1 : 0,
    EH_NPC: c.category === 'NPC' ? 1 : 0,
    EH_INIMIGO: c.category === 'INIMIGO' ? 1 : 0,

    // ─── 🤕 PR-3: Condições Ativas ────────────────────────────────────
    ...(() => {
      const ativas = (c.activeConditions ?? []) as Array<{ conditionId?: string }>;
      // Inicializa todas as categorias com 0 para que as chaves declaradas no
      // dicionário sempre existam na bag (evita resolução silenciosa para 0
      // por "chave ausente" — agora é 0 explícito).
      const out: Record<string, number> = {
        QTD_CONDICOES: ativas.length,
        QTD_CONDICOES_FISICA: 0,
        QTD_CONDICOES_INCAPACITACAO: 0,
        QTD_CONDICOES_MENTAL: 0,
        QTD_CONDICOES_MOVIMENTO: 0,
        QTD_CONDICOES_SENSORIAL: 0,
        QTD_CONDICOES_VULNERABILIDADE: 0,
      };
      const byId = new Map(ALL_CONDITIONS.map((d) => [d.id, d]));
      for (const a of ativas) {
        if (!a.conditionId) continue;
        const def = byId.get(a.conditionId);
        if (def) {
          const catKey = def.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '_');
          const k = `QTD_CONDICOES_${catKey.toUpperCase()}`;
          out[k] = (out[k] ?? 0) + 1;
        }
      }
      return out;
    })(),

    // ─── 🌀 PR-3: Concentração & Sustentados ──────────────────────────
    ...(() => {
      const buffs = (c.activeBuffs ?? []) as Array<{ isSustained?: boolean; durationRounds?: number }>;
      const qtdSust = buffs.filter((b) => b.isSustained === true || b.durationRounds === -1).length;
      const qtdConc = c.lastSpellUsedId ? 1 : 0;
      const maxConc = c.maxConcentrationSlots ?? 1;
      const maxSust = c.maxSustainedSpells ?? 1;
      return {
        QTD_CONCENTRANDO: qtdConc,
        QTD_SUSTENTADOS: qtdSust,
        SLOTS_CONCENTRACAO_LIVRES: Math.max(0, maxConc - qtdConc),
        SLOTS_SUSTENTADO_LIVRES: Math.max(0, maxSust - qtdSust),
      };
    })(),

    // ─── 💰 PR-4: Economia (carteiras / moedas) ────────────────────────
    ...(() => {
      let wallets: Array<{ id: string; members: string[]; balances: Record<string, number>; isPersonal?: boolean }> = [];
      let defaultCurrencyId = 'yen';
      try {
        const ms = useMoneyStore.getState();
        wallets = ms.wallets as typeof wallets;
        defaultCurrencyId = (ms.currencies.find((c) => c.isDefault) ?? ms.currencies[0])?.id ?? 'yen';
      } catch { /* test sem store */ }
      const minhas = wallets.filter((w) => w.members?.includes(c.id));
      const totaisPorMoeda: Record<string, number> = {};
      for (const w of minhas) {
        for (const [cid, val] of Object.entries(w.balances ?? {})) {
          totaisPorMoeda[cid] = (totaisPorMoeda[cid] ?? 0) + (val ?? 0);
        }
      }
      const saldoTotal = Object.values(totaisPorMoeda).reduce((a, b) => a + b, 0);
      const saldoPadrao = totaisPorMoeda[defaultCurrencyId] ?? 0;
      const pessoal = minhas.find((w) => w.isPersonal);
      const saldoPessoal = pessoal ? (pessoal.balances?.[defaultCurrencyId] ?? 0) : 0;
      const out: Record<string, number> = {
        SALDO_TOTAL: saldoTotal,
        SALDO_PADRAO: saldoPadrao,
        SALDO_PESSOAL: saldoPessoal,
        CARTEIRAS_QTD: minhas.length,
        CARTEIRAS_COMPARTILHADAS: minhas.filter((w) => !w.isPersonal).length,
        TEM_CARTEIRA_PESSOAL: pessoal ? 1 : 0,
      };
      for (const [cid, val] of Object.entries(totaisPorMoeda)) {
        const norm = cid.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        out[`SALDO_${norm}`] = val;
        out[`TEM_MOEDA_${norm}`] = val > 0 ? 1 : 0;
      }
      return out;
    })(),

    // ─── 🕰️ PR-4: Tempo & Calendário (CENA) ───────────────────────────
    ...(() => {
      let ch: { hours: number; minutes: number; seconds: number; day: number; month: number; year: number; isRunning: boolean; multiplier: number } | null = null;
      try {
        const s = useChronosStore.getState();
        ch = { hours: s.hours, minutes: s.minutes, seconds: s.seconds, day: s.day, month: s.month, year: s.year, isRunning: s.isRunning, multiplier: s.multiplier };
      } catch { ch = null; }
      let eventosHoje = 0;
      try {
        const cs = useCalendarStore.getState();
        eventosHoje = (cs.events ?? []).filter((e: { day?: number; month?: number; year?: number }) =>
          ch && e.day === ch.day && e.month === ch.month && e.year === ch.year
        ).length;
      } catch { /* */ }
      if (!ch) {
        return {
          CENA_HORA: 0, CENA_MINUTO: 0, CENA_SEGUNDO: 0,
          CENA_DIA: 0, CENA_MES: 0, CENA_ANO: 0,
          CENA_EH_DIA: 0, CENA_EH_NOITE: 0, CENA_EH_AMANHECER: 0, CENA_EH_ANOITECER: 0,
          CENA_RELOGIO_ATIVO: 0, CENA_MULTIPLICADOR_TEMPO: 1,
          CENA_TIMESTAMP_SEGUNDOS: 0, CENA_EVENTOS_HOJE: 0,
        };
      }
      const h = ch.hours;
      const ehAmanhecer = h >= 5 && h < 7 ? 1 : 0;
      const ehDia = h >= 7 && h < 18 ? 1 : 0;
      const ehAnoitecer = h >= 18 && h < 20 ? 1 : 0;
      const ehNoite = (h >= 20 || h < 5) ? 1 : 0;
      const tsSeg = h * 3600 + ch.minutes * 60 + ch.seconds;
      return {
        CENA_HORA: h,
        CENA_MINUTO: ch.minutes,
        CENA_SEGUNDO: ch.seconds,
        CENA_DIA: ch.day,
        CENA_MES: ch.month,
        CENA_ANO: ch.year,
        CENA_EH_DIA: ehDia,
        CENA_EH_NOITE: ehNoite,
        CENA_EH_AMANHECER: ehAmanhecer,
        CENA_EH_ANOITECER: ehAnoitecer,
        CENA_RELOGIO_ATIVO: ch.isRunning ? 1 : 0,
        CENA_MULTIPLICADOR_TEMPO: ch.multiplier,
        CENA_TIMESTAMP_SEGUNDOS: tsSeg,
        CENA_EVENTOS_HOJE: eventosHoje,
      };
    })(),

    // ─── 🎒 PR-4: Inventário ──────────────────────────────────────────
    ...(() => {
      let total = 0, equip = 0;
      try {
        const inv = useInventoryStore.getState();
        const minhas = inv.listByOwner(c.id);
        total = minhas.length;
        equip = minhas.filter((i) => i.isEquipped).length;
      } catch { /* */ }
      return {
        QTD_ITENS_INVENTARIO: total,
        QTD_ITENS_EQUIPADOS: equip,
      };
    })(),

    // ─── 🎯 PR-5: Cena Tática (proximidade, aliados, inimigos) ───────
    ...(() => {
      const out: Record<string, number> = {
        ESTA_NO_MAPA: 0,
        CENA_TOKEN_X: 0,
        CENA_TOKEN_Y: 0,
        CENA_QTD_TOKENS: 0,
        CENA_QTD_ALIADOS: 0,
        CENA_QTD_INIMIGOS: 0,
        QTD_ALIADOS_ADJACENTES: 0,
        QTD_ALIADOS_PROXIMOS: 0,
        QTD_INIMIGOS_ADJACENTES: 0,
        QTD_INIMIGOS_PROXIMOS: 0,
        QTD_INIMIGOS_ENGAJADOS: 0,
        ALIADO_ADJACENTE: 0,
        INIMIGO_ADJACENTE: 0,
        FLANQUEADO: 0,
        SOZINHO: 1,
        NA_LINHA_DE_FRENTE: 0,
      };
      try {
        const map = useMapStore.getState();
        const grid = (map as unknown as { grid?: { metersPerCell?: number } }).grid;
        const mpc = grid?.metersPerCell ?? 1;
        const entitiesObj = (map as unknown as { entities?: Record<string, { id: string; x: number; y: number; w: number; h: number; characterId?: string; layer?: string; hidden?: boolean }> }).entities ?? {};
        const entities = Object.values(entitiesObj).filter((e) => !e.hidden && e.layer !== 'gm');
        const chars = useCharacterStore.getState().characters;
        const catById = new Map(chars.map((ch) => [ch.id, ch.category]));
        const meuToken = entities.find((e) => e.characterId === c.id);
        out.CENA_QTD_TOKENS = entities.length;
        out.CENA_QTD_ALIADOS = entities.filter((e) => e.characterId && catById.get(e.characterId) === 'PLAYER').length;
        out.CENA_QTD_INIMIGOS = entities.filter((e) => e.characterId && catById.get(e.characterId) === 'INIMIGO').length;
        if (!meuToken) return out;
        out.ESTA_NO_MAPA = 1;
        const mx = meuToken.x + meuToken.w / 2;
        const my = meuToken.y + meuToken.h / 2;
        out.CENA_TOKEN_X = Math.round(mx * mpc * 100) / 100;
        out.CENA_TOKEN_Y = Math.round(my * mpc * 100) / 100;
        const minhaCategoria = c.category;
        let alAdj = 0, alPx = 0, inAdj = 0, inPx = 0;
        for (const e of entities) {
          if (e.id === meuToken.id || !e.characterId || e.characterId === c.id) continue;
          const ex = e.x + e.w / 2;
          const ey = e.y + e.h / 2;
          // distância em metros entre centros, considerando "borda" das células.
          const distCells = Math.max(0, Math.hypot(ex - mx, ey - my) - (Math.max(meuToken.w, meuToken.h) + Math.max(e.w, e.h)) / 4);
          const distM = distCells * mpc;
          const cat = catById.get(e.characterId);
          // PLAYER & NPC = aliados de PLAYER; INIMIGO oposto. NPC neutro p/ INIMIGO.
          const ehAliado = minhaCategoria === 'INIMIGO'
            ? cat === 'INIMIGO'
            : (cat === 'PLAYER' || cat === 'NPC');
          const ehInimigo = minhaCategoria === 'INIMIGO'
            ? (cat === 'PLAYER' || cat === 'NPC')
            : cat === 'INIMIGO';
          if (distM <= 1.5) {
            if (ehAliado) alAdj++;
            if (ehInimigo) inAdj++;
          }
          if (distM <= 6) {
            if (ehAliado) alPx++;
            if (ehInimigo) inPx++;
          }
        }
        out.QTD_ALIADOS_ADJACENTES = alAdj;
        out.QTD_ALIADOS_PROXIMOS = alPx;
        out.QTD_INIMIGOS_ADJACENTES = inAdj;
        out.QTD_INIMIGOS_PROXIMOS = inPx;
        out.QTD_INIMIGOS_ENGAJADOS = inAdj;
        out.ALIADO_ADJACENTE = alAdj > 0 ? 1 : 0;
        out.INIMIGO_ADJACENTE = inAdj > 0 ? 1 : 0;
        out.FLANQUEADO = inAdj >= 2 ? 1 : 0;
        out.SOZINHO = alAdj === 0 && alPx === 0 ? 1 : 0;
        out.NA_LINHA_DE_FRENTE = inAdj > 0 ? 1 : 0;
      } catch { /* sem mapa/personagens — defaults */ }
      return out;
    })(),

    // ─── 🩹 PR-6: Cura / Recursos Avançados ────────────────────────────
    ...(() => {
      const faltante = Math.max(0, vida.max - vida.atual);
      const faltantePct = vida.max > 0 ? Math.round((faltante / vida.max) * 100) : 0;
      const podeSerCurado = (vida.atual < vida.max && !morto && !morrendo) ? 1 : 0;
      const curaReceb = c.omniCounters?.cura_recebida ?? 0;
      const curaRodada = c.omniCounters?.cura_recebida_nesta_rodada ?? 0;
      const ultimoDano = c.omniCounters?.ultimo_dano_recebido ?? 0;
      const danoRodada = c.omniCounters?.dano_recebido_nesta_rodada ?? 0;
      const vmUsos = c.vigorMalditoUses ?? 0;
      const vmMax = c.vigorMalditoMax ?? 0;
      const hdAtual = c.hitDiceCurrent ?? 0;
      const hdMax = c.hitDiceMax ?? 0;
      const hpSacr = c.hpSacrificedTotal ?? 0;
      return {
        PODE_SER_CURADO: podeSerCurado,
        VIDA_FALTANTE: faltante,
        VIDA_FALTANTE_PCT: faltantePct,
        CURA_RECEBIDA: curaReceb,
        CURA_RECEBIDA_NESTA_RODADA: curaRodada,
        ULTIMO_DANO_RECEBIDO: ultimoDano,
        DANO_RECEBIDO_NESTA_RODADA: danoRodada,
        VIDA_PERDIDA_NESTA_RODADA: danoRodada,
        ACAO_DISPONIVEL: (c.actionsCurrent ?? 0) > 0 ? 1 : 0,
        BONUS_ACAO_DISPONIVEL: (c.bonusActionsCurrent ?? 0) > 0 ? 1 : 0,
        MOVIMENTO_DISPONIVEL: (c.movement ?? 0) > 0 ? 1 : 0,
        SLOTS_DESCANSO_CURTO: hdAtual,
        SLOTS_DESCANSO_CURTO_MAX: hdMax,
        SLOTS_DESCANSO_CURTO_PCT: hdMax > 0 ? Math.round((hdAtual / hdMax) * 100) : 0,
        VIGOR_MALDITO_USOS: vmUsos,
        VIGOR_MALDITO_MAX: vmMax,
        VIGOR_MALDITO_DISPONIVEL: vmUsos > 0 ? 1 : 0,
        HP_SACRIFICADO: hpSacr,
        SACRIFICIO_PCT: vida.max > 0 ? Math.round((hpSacr / vida.max) * 100) : 0,
      };
    })(),

    // ─── ⚔️ PR-7: Combate Avançado (vantagem, cobertura, alcance, crítico) ─
    ...(() => {
      const mods = (c as unknown as { omniAdvMods?: Record<string, { kind: string; scope: string }> }).omniAdvMods ?? {};
      const arr = Object.values(mods);
      const qtdAdv = arr.filter((m) => m.kind === 'advantage').length;
      const qtdDis = arr.filter((m) => m.kind === 'disadvantage').length;
      const atkScopes = new Set(['next_attack','next_any','attack_melee','attack_ranged','attack_cursed','attack_all','attack_weapon_group','attack_weapon_name']);
      const trScopes  = new Set(['next_save','next_any','save_specific']);
      const skScopes  = new Set(['next_skill','next_any','skill_specific']);
      const has = (kind: string, set: Set<string>) => arr.some((m) => m.kind === kind && set.has(m.scope)) ? 1 : 0;

      const mainW = c.mainHandWeaponName ? findWeaponByName(c.mainHandWeaponName) : undefined;
      const critRange = mainW?.critRange ?? 20;
      const reach = mainW?.range === 'melee' ? 1.5 : 0;
      const rs = mainW?.rangeShort ?? 0;
      const rl = mainW?.rangeLong ?? 0;

      const meiaCob = c.omniFlags?.cobertura_meia ?? 0;
      const tresQuartos = c.omniFlags?.cobertura_tres_quartos ?? 0;
      const totalCob = c.omniFlags?.cobertura_total ?? 0;
      const bonusDef = totalCob ? 999 : (tresQuartos ? 5 : (meiaCob ? 2 : 0));

      const reacMax = c.reactionsMax ?? 1;
      const reacAtu = c.reactionsCurrent ?? 0;

      return {
        TEM_VANTAGEM: qtdAdv > 0 ? 1 : 0,
        TEM_DESVANTAGEM: qtdDis > 0 ? 1 : 0,
        QTD_VANTAGENS: qtdAdv,
        QTD_DESVANTAGENS: qtdDis,
        VANTAGEM_PROXIMO_ATAQUE: has('advantage', atkScopes),
        DESVANTAGEM_PROXIMO_ATAQUE: has('disadvantage', atkScopes),
        VANTAGEM_PROXIMO_TR: has('advantage', trScopes),
        DESVANTAGEM_PROXIMO_TR: has('disadvantage', trScopes),
        VANTAGEM_PROXIMA_PERICIA: has('advantage', skScopes),
        DESVANTAGEM_PROXIMA_PERICIA: has('disadvantage', skScopes),

        COBERTURA_MEIA: meiaCob,
        COBERTURA_TRES_QUARTOS: tresQuartos,
        COBERTURA_TOTAL: totalCob,
        BONUS_DEFESA_COBERTURA: bonusDef,
        IMUNE_POR_COBERTURA: totalCob ? 1 : 0,

        ARMA_PRINCIPAL_ALCANCE: reach,
        ARMA_PRINCIPAL_ALCANCE_CURTO: rs,
        ARMA_PRINCIPAL_ALCANCE_LONGO: rl,
        ARMA_PRINCIPAL_CRIT_RANGE: critRange,
        ARMA_PRINCIPAL_CRIT_AMPLIADO: critRange < 20 ? 1 : 0,

        REACOES_USADAS_NESTA_RODADA: Math.max(0, reacMax - reacAtu),
      };
    })(),

    // ─── 🔮 PR-8: Magia / Técnicas ─────────────────────────────────────
    ...(() => {
      const spells = ((c.spells ?? []) as unknown) as Array<{ id: string; name?: string; spellType?: string; costPE?: number; isPrepared?: boolean; damageType?: string }>;
      const buffs = (c.activeBuffs ?? []) as Array<{ spellName?: string; peCostPerRound?: number; isSustained?: boolean }>;
      const out: Record<string, number> = {
        QTD_FEITICOS: spells.length,
        QTD_FEITICOS_DANO: spells.filter((s) => s.spellType === 'damage').length,
        QTD_FEITICOS_CURA: spells.filter((s) => s.spellType === 'heal').length,
        QTD_FEITICOS_BUFF: spells.filter((s) => s.spellType === 'buff').length,
        QTD_FEITICOS_CONDICAO: spells.filter((s) => s.spellType === 'condition').length,
        QTD_FEITICOS_PRONTOS: spells.filter((s) => s.isPrepared).length,
        TEM_FEITICO_PRONTO: spells.some((s) => s.isPrepared) ? 1 : 0,
        PE_MINIMO_FEITICO: spells.length ? Math.min(...spells.map((s) => s.costPE ?? 0)) : 0,
        PE_MAXIMO_FEITICO: spells.length ? Math.max(...spells.map((s) => s.costPE ?? 0)) : 0,
        QTD_BUFFS_ATIVOS: buffs.length,
        QTD_BUFFS_SUSTENTADOS: buffs.filter((b) => b.isSustained).length,
        PE_POR_RODADA_SUSTENTADO: buffs.reduce((acc, b) => acc + (b.peCostPerRound ?? 0), 0),
        TEM_ULTIMO_FEITICO: c.lastSpellUsedId ? 1 : 0,
        SPELL_ATTACK_BONUS: c.spellAttackBonus ?? 0,
        TECNICA_AMALDICOADA_DEFINIDA: c.tecnicaAmaldicoada ? 1 : 0,
        QTD_FUNDAMENTOS_TECNICA: (c.tecnicaFundamentos ?? []).length,
        FOCO_DESTRUICAO: c.tecnicaFoco === 'Destruição' ? 1 : 0,
        FOCO_ECONOMIA: c.tecnicaFoco === 'Economia' ? 1 : 0,
        FOCO_REFINO: c.tecnicaFoco === 'Refino' ? 1 : 0,
        IMBUIR_ARMADO: c.imbuedSpell ? 1 : 0,
        ABSORCAO_ARMADA: (c as unknown as { pendingAbsorbedElement?: unknown }).pendingAbsorbedElement ? 1 : 0,
        AU_CONCENTRADA: (c as unknown as { concentratedAura?: { au?: number } }).concentratedAura?.au ?? 0,
      };
      // Predicates por id de feitiço e por elemento
      const elementos: Record<string, number> = {};
      for (const s of spells) {
        if (s.id) {
          const norm = String(s.id).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
          out[`TEM_FEITICO_${norm}`] = 1;
        }
        if (s.damageType) {
          const dn = String(s.damageType).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
          elementos[dn] = (elementos[dn] ?? 0) + 1;
        }
      }
      for (const [el, n] of Object.entries(elementos)) {
        out[`QTD_FEITICOS_ELEMENTO_${el}`] = n;
      }
      // Predicates por buff ativo (spellName)
      for (const b of buffs) {
        if (!b.spellName) continue;
        const norm = String(b.spellName).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
        out[`TEM_BUFF_${norm}`] = 1;
      }
      return out;
    })(),

    // ─── 🎬 PR-9: Meta / Narrativa (combate, iniciativa, cronômetro) ───
    ...(() => {
      const out: Record<string, number> = {
        EM_COMBATE: 0,
        TURNO_ATUAL_INDEX: 0,
        NUMERO_DA_RODADA: round,
        ORDEM_NA_INICIATIVA: 0,
        EH_MEU_TURNO: 0,
        INICIATIVA_TOTAL: 0,
        INICIATIVA_BONUS: 0,
        INICIATIVA_ROLAGEM: 0,
        QTD_PARTICIPANTES_COMBATE: 0,
        TURNOS_ATE_MEU: 0,
        PROXIMO_NO_TURNO: 0,
        ULTIMO_NO_TURNO: 0,
        METROS_MOVIDOS_COMBATE: 0,
        TURNO_CRONOMETRO_ATIVO: 0,
        TURNO_DURACAO_SEG: 0,
        TURNO_SEGUNDOS_RESTANTES: 0,
        TURNO_PAUSADO: 0,
        QTD_FLAGS_OMNI: Object.keys(c.omniFlags ?? {}).length,
        QTD_CONTADORES_OMNI: Object.keys(c.omniCounters ?? {}).length,
      };
      try {
        const cs = useCombatStore.getState();
        out.EM_COMBATE = cs.inCombat ? 1 : 0;
        out.TURNO_ATUAL_INDEX = cs.currentTurnIndex ?? 0;
        const ordem = cs.initiativeOrder ?? [];
        out.QTD_PARTICIPANTES_COMBATE = ordem.length;
        const idx = ordem.findIndex((e) => e.charId === c.id);
        if (idx >= 0) {
          out.ORDEM_NA_INICIATIVA = idx + 1;
          out.EH_MEU_TURNO = idx === cs.currentTurnIndex ? 1 : 0;
          const entry = ordem[idx];
          out.INICIATIVA_TOTAL = entry.total ?? 0;
          out.INICIATIVA_BONUS = entry.bonus ?? 0;
          out.INICIATIVA_ROLAGEM = entry.roll ?? 0;
          const cur = cs.currentTurnIndex ?? 0;
          out.TURNOS_ATE_MEU = ((idx - cur) + ordem.length) % ordem.length;
          out.PROXIMO_NO_TURNO = out.TURNOS_ATE_MEU === 1 ? 1 : 0;
          out.ULTIMO_NO_TURNO = idx === ordem.length - 1 ? 1 : 0;
        }
        out.METROS_MOVIDOS_COMBATE = cs.movementUsedByChar?.[c.id] ?? 0;
        out.TURNO_CRONOMETRO_ATIVO = cs.turnTimerEnabled ? 1 : 0;
        out.TURNO_DURACAO_SEG = cs.turnDurationSec ?? 0;
        out.TURNO_PAUSADO = cs.turnPaused ? 1 : 0;
        if (cs.turnTimerEnabled && !cs.turnPaused && cs.turnStartedAt > 0) {
          const elapsed = Math.floor((Date.now() - cs.turnStartedAt) / 1000);
          out.TURNO_SEGUNDOS_RESTANTES = Math.max(0, (cs.turnRemainingAtStart ?? 0) - elapsed);
        } else {
          out.TURNO_SEGUNDOS_RESTANTES = cs.turnRemainingAtStart ?? 0;
        }
      } catch { /* fora de store */ }
      return out;
    })(),



















    // ─── 🧍 ESTADO FÍSICO ───────────────────────────────────────────────
    TAMANHO: tamanho,
    MORRENDO: morrendo,
    ESTA_MORRENDO: morrendo,
    MORTO: morto,
    INCONSCIENTE: inconsciente,

    // ─── 🎒 EQUIPAMENTO & CATEGORIA ─────────────────────────────────────
    ESCUDO_EQUIPADO: talentos?.shieldProficient ? 1 : 0,
    CATEGORIA: categoria,

    // ─── 🔮 ESPECIALIZAÇÃO ──────────────────────────────────────────────
    CONCENTRANDO: c.lastSpellUsedId ? 1 : 0,
    EMPOLGACAO: empolgacao,
    EMPOLGACAO_NIVEL: empolgacao,

    // ─── 🌍 CENA TÁTICA ─────────────────────────────────────────────────
    RODADA: round,
    RODADAS_EM_COMBATE: round,

    // ─── 🌟 KEYS DERIVADAS DE TALENTOS ─────────────────────────────────
    ESCUDO_PROFICIENTE: talentos?.shieldProficient ? 1 : 0,
    DUAL_WIELD_DEF: talentos?.dualWieldDefenseBonus ?? 0,
    MOVIMENTO_BONUS_METROS: talentos?.movementMeters ?? 0,
    VIGOR_MALDITO_BONUS: talentos?.vigorMalditoHealBonus ?? 0,
    SUPORTE_LV2_UNLOCKED: talentos?.suporteLv2Unlocked ? 1 : 0,
    RD_ALMA: talentos?.soulRd ?? 0,
    ATENCAO_BONUS: talentos?.attention ?? 0,
    TR_VS_DEBUFF_DEFESA_BONUS: talentos?.saveBonusVsDefenseDebuff ?? 0,
    GRUPOS_CRITICO_ARMA: talentos?.weaponCriticalGroups?.length ?? 0,

    // ─── 🔮 SPECS DO FEITICEIRO ────────────────────────────────────────
    MAX_CONCENTRACAO: c.maxConcentrationSlots ?? 1,
    MAX_SUSTENTADOS: c.maxSustainedSpells ?? 1,
    SLOTS_LIBERACAO_BONUS: c.bonusReleaseSlots ?? 0,
    PE_TEMP_POR_RODADA: c.aptitudeOnlyTempPE ?? 0,

    // ─── ✨ AURA / APTIDÕES ────────────────────────────────────────────
    AURA_CA_BONUS: auras?.caBonus ?? 0,
    AURA_RD_FISICA: auras?.physicalRDBonus ?? 0,
    AURA_FURTIVIDADE_BONUS: auras?.furtividadeBonus ?? 0,
    AURA_AGARRAR_BONUS: auras?.grappleBonus ?? 0,
    AU: c.cursedAptitudes?.AU ?? 0,
    CL: c.cursedAptitudes?.CL ?? 0,
    BAR: c.cursedAptitudes?.BAR ?? 0,
    DOM: c.cursedAptitudes?.DOM ?? 0,
    ER: c.cursedAptitudes?.ER ?? 0,

    // ─── 🔢 CONTADORES POR TIPO ────────────────────────────────────────
    QTD_TALENTOS_COMBATE: qtdTalentosCombate,
    QTD_APTIDOES_AURA: qtdAptidoesAura,
    QTD_HABILIDADES_SPEC: qtdHabilidadesSpec,
    QTD_TALENTOS: (c.chosenTalents ?? []).length,
    QTD_APTIDOES: (c.chosenAuraAptitudes ?? []).length + (c.chosenClAptitudes ?? []).length,
    QTD_HABILIDADES: (c.chosenSpecAbilities ?? []).length,
  };

  // Demais flags dinâmicas (qualquer chave que o Mestre cunhou).
  for (const [k, v] of Object.entries(c.omniFlags ?? {})) {
    base[k.toUpperCase()] = v;
  }
  // Contadores nomeados — expostos como `CONTADOR_<NOME>` e também direto.
  // Sobrescreve FADIGA acima se o Mestre gravou outro valor no contador.
  for (const [k, v] of Object.entries(c.omniCounters ?? {})) {
    base[`CONTADOR_${k.toUpperCase()}`] = v;
    base[k.toUpperCase()] = v;
  }
  // Slot de venda — predicado VENDADO/DESCOBERTO (on=1 / off=0).
  // No terminal: `se DESCOBERTO igual a on` ≡ `se DESCOBERTO igual a 1`.
  base.VENDADO = c.blindfoldSlot ? 1 : 0;
  base.DESCOBERTO = c.blindfoldSlot ? 0 : 1;

  // Perícias — expostas como `PERICIA_<CHAVE>` (ex: PERICIA_FEITICARIA).
  // O parser já faz uppercase em chaves desconhecidas, então
  // `@USUARIO.pericia_feiticaria` resolve naturalmente.
  const pericias = (proj.pericias as Record<string, number>) ?? {};
  for (const [k, v] of Object.entries(pericias)) {
    base[`PERICIA_${k.toUpperCase()}`] = v;
  }

  // Testes de Resistência — expostos com nome direto (ex: FORTITUDE,
  // INTEGRIDADE). Parser resolve `@USUARIO.fortitude` via uppercase automático.
  const tr = (proj.tr as Record<string, number>) ?? {};
  for (const [k, v] of Object.entries(tr)) {
    base[k.toUpperCase()] = v;
  }

  // Predicates: tem_talento_<id>, tem_aptidao_<id>, tem_habilidade_<id>
  for (const t of c.chosenTalents ?? []) {
    base[`TEM_TALENTO_${t.id.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`] = 1;
  }
  for (const a of [...(c.chosenAuraAptitudes ?? []), ...(c.chosenClAptitudes ?? []), ...(c.chosenAptitudes ?? [])]) {
    base[`TEM_APTIDAO_${a.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`] = 1;
  }
  for (const h of c.chosenSpecAbilities ?? []) {
    base[`TEM_HABILIDADE_${h.abilityId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`] = 1;
  }

  // PR-2: Predicate arma_grupo_<grupo> — 1 se main ou off é desse grupo.
  const mhName = c.mainHandWeaponName ?? null;
  const ohName = c.offHandWeaponName ?? null;
  for (const name of [mhName, ohName]) {
    if (!name) continue;
    const w = findWeaponByName(name);
    if (w?.group) {
      const g = w.group.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
      base[`ARMA_GRUPO_${g}`] = 1;
    }
  }

  // PR-3: Predicate tem_condicao_<id> — 1 por condição ativa.
  for (const a of (c.activeConditions ?? []) as Array<{ conditionId?: string }>) {
    if (!a.conditionId) continue;
    const norm = a.conditionId.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
    base[`TEM_CONDICAO_${norm}`] = 1;
  }

  // PR-3: Predicates de identidade (origem / especialização).
  const originId = (c as unknown as { origin?: { id?: string } }).origin?.id;
  if (originId) {
    const norm = originId.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
    base[`ORIGEM_ID_${norm}`] = 1;
  }
  const specId = (c as unknown as { specialization?: { id?: string } }).specialization?.id;
  if (specId) {
    const norm = specId.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
    base[`ESPECIALIZACAO_ID_${norm}`] = 1;
  }
  // PR-4: Predicate tem_item_<entityId> — 1 por item no inventário.
  try {
    const inv = useInventoryStore.getState();
    for (const it of inv.listByOwner(c.id)) {
      const id = it.entity?.id;
      if (!id) continue;
      const norm = String(id).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
      base[`TEM_ITEM_${norm}`] = 1;
      if (it.isEquipped) base[`EQUIPADO_${norm}`] = 1;
    }
  } catch { /* */ }


  // Mesmo bag também disponível sob o prefixo de escopo (USUARIO_FOR, ALVO_VIDA, ...).
  const prefixado: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) {
    prefixado[`${escopo}_${k}`] = v;
  }
  return { ...base, ...prefixado };
}
