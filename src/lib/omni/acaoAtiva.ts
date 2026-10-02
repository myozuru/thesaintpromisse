import { aceitaAlvoAtivo, selecionarAlvosAtivos, type SelecaoAtiva } from './alvosAtivos';
import { resolverTipoDano, type MetadadosAtaqueDano } from './contextoDano';
/**
 * Ações ativas genéricas do OMNI.
 *
 * Blocos reutilizáveis (nenhuma habilidade específica vive aqui):
 *  - alvos únicos, múltiplos, próprio e áreas com filtro;
 *  - custo em PE + tipo de ação + alcance em metros;
 *  - teste: TR do alvo contra CD (falha = dano cheio + efeitos; sucesso =
 *    metade ou nada, sem efeitos), ataque contra Defesa (acerto = efeitos)
 *    ou nenhum;
 *  - consumo de TODO um contador (com mínimo) + dados extras por carga;
 *  - margem de crítico reduzida por condição em fórmula;
 *  - efeitos secundários: puxar/empurrar (para ao lado do atacante) e condição.
 * Custos, ação e cargas são pagos ANTES da rolagem (gastos mesmo errando).
 */
import type { Character } from '@/types';
import type { AcaoAtivaConfig, EfeitoSecundarioAtivo, EntidadeOmni, TrNome } from './tipos';
import { avaliarFormula } from './parser';
import { lerCaminhoOmni, montarVariaveisDoPersonagem } from './resolvedor';
import { calcularContador } from './contadores';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { ALL_CONDITIONS, type ActiveCondition } from '@/types/conditions';
import { findCharEntity, touchDistanceMeters, type TouchGrid } from '@/lib/touchRange';
import { penalidadeTRFlanqueado } from '@/lib/flanqueadorSuperior';
import { imuneMovimentoForcado } from '@/lib/posturas';
import { specDCFor } from '@/lib/golpeEspecial';
import { rollD20Com, rollDiceGroups } from '@/lib/dice';
import { findWeaponByName } from '@/lib/weapons';
import { buildAttackContext, rollAttack } from '@/lib/combatEngine';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { replicaWeaponName } from '@/lib/replicas';

// ─── Regras puras ────────────────────────────────────────────────────

export interface DadosPlano { grupos: { count: number; sides: number }[]; fixo: number }

/** "2d8+3+1d6" → grupos de dados + parte fixa. */
export function parseDados(expr: string | undefined): DadosPlano {
  const out: DadosPlano = { grupos: [], fixo: 0 };
  if (!expr) return out;
  for (const raw of expr.replace(/\s+/g, '').split('+')) {
    if (!raw) continue;
    const m = raw.match(/^(\d*)d(\d+)$/i);
    if (m) out.grupos.push({ count: parseInt(m[1] || '1', 10), sides: parseInt(m[2], 10) });
    else if (/^-?\d+$/.test(raw)) out.fixo += parseInt(raw, 10);
  }
  return out;
}

/** Junta dano fixo + dados por carga; crítico dobra só os dados. */
export function planejarDano(dano: string | undefined, porCarga: string | undefined, cargas: number, critico: boolean): DadosPlano {
  const base = parseDados(dano);
  const pc = parseDados(porCarga);
  const grupos = [...base.grupos];
  for (const g of pc.grupos) grupos.push({ count: g.count * cargas, sides: g.sides });
  const mult = critico ? 2 : 1;
  return {
    grupos: grupos.filter((g) => g.count > 0).map((g) => ({ ...g, count: g.count * mult })),
    fixo: base.fixo + pc.fixo * cargas,
  };
}

/** Dano final após TR. */
export function danoAposTR(total: number, passou: boolean, metadeNoSucesso: boolean): number {
  if (!passou) return total;
  return metadeNoSucesso ? Math.floor(total / 2) : 0;
}

/**
 * Movimento forçado em casas (grade Chebyshev). Puxar para ao lado do
 * atacante (nunca passa dele); empurrar afasta. Retorna o novo centro.
 */
export function moverForcado(
  atk: { x: number; y: number },
  tgt: { x: number; y: number },
  metros: number,
  modo: 'puxar' | 'empurrar',
  grid: TouchGrid,
): { x: number; y: number; casas: number } {
  const dpi = grid.dpi || 70;
  const mpc = grid.metersPerCell || 1.5;
  const passos = Math.floor(metros / mpc + 1e-6);
  let cx = Math.round(tgt.x / dpi * 1000) / 1000, cy = Math.round(tgt.y / dpi * 1000) / 1000;
  const ax = atk.x / dpi, ay = atk.y / dpi;
  let casas = 0;
  for (let i = 0; i < passos; i++) {
    const dx = ax - cx, dy = ay - cy;
    if (modo === 'puxar' && Math.max(Math.abs(dx), Math.abs(dy)) <= 1.001) break;
    const sx = Math.sign(Math.round(dx * 1000)), sy = Math.sign(Math.round(dy * 1000));
    if (sx === 0 && sy === 0) break;
    const k = modo === 'puxar' ? 1 : -1;
    cx += sx * k; cy += sy * k; casas++;
  }
  return { x: cx * dpi, y: cy * dpi, casas };
}

const TR_ROTULO: Record<TrNome, string> = {
  astucia: 'Astúcia', fortitude: 'Fortitude', integridade: 'Integridade', reflexos: 'Reflexos', vontade: 'Vontade',
};

/** Modificador do TR (ficha + Flanqueador Superior). */
export function modTR(alvo: Character, tr: TrNome): number {
  const ms = useMapStore.getState();
  return lerCaminhoOmni(alvo, `tr.${tr}`) + penalidadeTRFlanqueado(
    alvo, useCharacterStore.getState().characters, ms.entities as never, ms.gridConfig as never,
  );
}

function vars(u: Character, a?: Character) {
  return { ...montarVariaveisDoPersonagem(u, 'USUARIO'), ...(a ? montarVariaveisDoPersonagem(a, 'ALVO') : {}) };
}

export function custoPEDe(cfg: AcaoAtivaConfig, u: Character): number {
  return Math.max(0, Math.round(avaliarFormula(cfg.custoPE || '0', vars(u)).valor));
}

// ─── Validação + execução ────────────────────────────────────────────

export type ResultadoAtiva = { ok: false; reason: string } | { ok: true; dano: number; detalhe: string };

export function podeUsarAtiva(u: Character, alvo: Character | undefined, cfg: AcaoAtivaConfig): { ok: true } | { ok: false; reason: string } {
  if (!alvo) return { ok: false, reason: 'Escolha um alvo.' };
  if (!cfg.tipo_alvo && alvo.id === u.id) return { ok: false, reason: 'O alvo deve ser outra criatura.' };
  if (!aceitaAlvoAtivo(u, alvo, cfg)) return { ok: false, reason: 'O alvo não atende ao filtro.' };
  if (cfg.acao === 'comum' && (u.actionsCurrent ?? 1) <= 0) return { ok: false, reason: 'Sem Ação Comum disponível.' };
  if (cfg.acao === 'bonus' && (u.bonusActionsCurrent ?? 1) <= 0) return { ok: false, reason: 'Sem Ação Bônus disponível.' };
  if (cfg.acao === 'reacao' && (u.reactionsCurrent ?? 1) <= 0) return { ok: false, reason: 'Sem Reação disponível.' };
  const custo = custoPEDe(cfg, u);
  if ((u.peCurrent ?? 0) + (u.tempPE ?? 0) < custo) return { ok: false, reason: `PE insuficiente (precisa de ${custo}).` };
  if (cfg.consumirContador) {
    const tem = u.omniCounters?.[cfg.consumirContador.nome.trim().toLowerCase()] ?? 0;
    if (tem < Math.max(1, cfg.consumirContador.minimo)) return { ok: false, reason: `Precisa de ao menos ${Math.max(1, cfg.consumirContador.minimo)} carga(s) de ${cfg.consumirContador.nome} (tem ${tem}).` };
  }
  if (cfg.alcanceM > 0 && cfg.tipo_alvo !== 'area' && cfg.tipo_alvo !== 'proprio') {
    const ms = useMapStore.getState();
    const a = findCharEntity(ms.entities as never, u.id), b = findCharEntity(ms.entities as never, alvo.id);
    if (a && b) {
      const d = touchDistanceMeters(a, b, ms.gridConfig as TouchGrid);
      if (d > cfg.alcanceM + 0.05) return { ok: false, reason: `Fora de alcance (${d.toFixed(1).replace('.', ',')} m de ${cfg.alcanceM.toString().replace('.', ',')} m).` };
    }
  }
  return { ok: true };
}

function aplicarEfeitos(u: Character, alvo: Character, efeitos: EfeitoSecundarioAtivo[], fonte: string): string[] {
  const notas: string[] = [];
  const store = useCharacterStore.getState();
  for (const ef of efeitos) {
    if (ef.tipo === 'condicao') {
      const def = ALL_CONDITIONS.find((c) => c.id === ef.condicao);
      if (!def) continue;
      const ac: ActiveCondition = {
        id: crypto.randomUUID(), conditionId: def.id, name: def.name, icon: def.icon,
        remainingTurns: -1, remainingRounds: ef.rodadas > 0 ? ef.rodadas : -1, sourceCharName: fonte,
      };
      store.addCondition(alvo.id, ac);
      notas.push(`${def.icon} ${def.name}${ef.rodadas > 0 ? ` (${ef.rodadas} rod.)` : ''}`);
    } else {
      const vivo = useCharacterStore.getState().characters.find((x) => x.id === alvo.id) ?? alvo;
      if (imuneMovimentoForcado(vivo)) { notas.push('imune a movimento forçado'); continue; }
      const ms = useMapStore.getState();
      const a = findCharEntity(ms.entities as never, u.id) as { x: number; y: number } | null;
      const b = findCharEntity(ms.entities as never, alvo.id) as { id: string; x: number; y: number } | null;
      if (!a || !b) continue;
      const r = moverForcado(a, b, ef.metros, ef.tipo, ms.gridConfig as TouchGrid);
      if (r.casas > 0) ms.updateEntity(b.id, { x: r.x, y: r.y });
      const m = (r.casas * ((ms.gridConfig as TouchGrid)?.metersPerCell || 1.5)).toFixed(1).replace('.', ',');
      notas.push(`${ef.tipo === 'puxar' ? 'puxado' : 'empurrado'} ${m} m`);
    }
  }
  return notas;
}

/** Arma usada pela ação: a própria entidade (se for arma do catálogo) ou a da mão principal. */
function armaDaAcao(u: Character, ent?: EntidadeOmni) {
  const nome = (ent && replicaWeaponName(ent)) || u.mainHandWeaponName || '';
  return nome ? findWeaponByName(nome) : undefined;
}

export async function executarAcaoAtiva(
  usuarioId: string,
  cfg: AcaoAtivaConfig,
  selecao: SelecaoAtiva,
  ent?: EntidadeOmni,
): Promise<ResultadoAtiva> {
  const escolhidos = await selecionarAlvosAtivos(usuarioId, cfg, selecao);
  if (!escolhidos.ok) return escolhidos;
  const store = useCharacterStore.getState();
  const log = (m: string) => useLogStore.getState().addLog('combat', m);
  const u = store.characters.find((x) => x.id === usuarioId);
  if (!u) return { ok: false, reason: 'Personagem não encontrado.' };
  const alvos = escolhidos.ids.map(id => store.characters.find(c => c.id === id)!);
  for (const alvo of alvos) {
    const chk = podeUsarAtiva(u, alvo, cfg);
    if (!chk.ok) return chk;
  }
  const arma = cfg.teste === 'ataque' ? armaDaAcao(u, ent) : undefined;
  if (cfg.teste === 'ataque' && !arma) return { ok: false, reason: 'Nenhuma arma empunhada para o ataque.' };

  // ── Paga tudo antes de rolar ──
  const custo = custoPEDe(cfg, u);
  const fromTemp = Math.min(u.tempPE ?? 0, custo);
  const patch: Partial<Character> = { tempPE: (u.tempPE ?? 0) - fromTemp, peCurrent: (u.peCurrent ?? 0) - (custo - fromTemp) };
  if (cfg.acao === 'comum') patch.actionsCurrent = Math.max(0, (u.actionsCurrent ?? 1) - 1);
  if (cfg.acao === 'bonus') patch.bonusActionsCurrent = Math.max(0, (u.bonusActionsCurrent ?? 1) - 1);
  if (cfg.acao === 'reacao') patch.reactionsCurrent = Math.max(0, (u.reactionsCurrent ?? 1) - 1);
  let cargas = 0;
  if (cfg.consumirContador) {
    const r = calcularContador(u.omniCounters ?? {}, cfg.consumirContador.nome, 'CONSUMIR_CONTADOR', { valor: 0 });
    cargas = r.consumido;
    patch.omniCounters = r.counters;
  }
  store.updateCharacter(u.id, patch);
  const fonte = ent?.nome ?? cfg.nome;
  const pago = `${custo} PE${cargas ? ` + ${cargas} carga(s) de ${cfg.consumirContador!.nome}` : ''}`;

  let danoTotal = 0;
  const detalhes: string[] = [];
  for (const selecionado of alvos) {
    const t = useCharacterStore.getState().characters.find(c => c.id === selecionado.id);
    if (!t) continue;
    let critExtra = 0;
    if (cfg.margemCritico?.condicao && avaliarFormula(cfg.margemCritico.condicao, vars(u, t)).valor) critExtra = cfg.margemCritico.reducao;
    let metadadosAtaque: MetadadosAtaqueDano | undefined;
    let critico = false;
    let aplicaEfeitos = true;
    let passouTR = false;
    let armaDano = 0;
    let cabecalho = '';

    if (cfg.teste === 'tr') {
      const tr = cfg.tr ?? 'fortitude';
      const cd = cfg.cd?.trim() ? Math.round(avaliarFormula(cfg.cd, vars(u, t)).valor) : specDCFor(u);
      const mod = modTR(t, tr);
      const d20 = await rollD20Com(t.id, undefined, { label: `TR ${TR_ROTULO[tr]}` });
      passouTR = d20 + mod >= cd;
      aplicaEfeitos = !passouTR;
      cabecalho = `TR ${TR_ROTULO[tr]} d20 ${d20}${mod >= 0 ? '+' : ''}${mod} = ${d20 + mod} vs CD ${cd} → ${passouTR ? 'SUCESSO' : 'FALHA'}`;
    } else if (cfg.teste === 'ataque') {
      const def = computeTotalDefense(t, {}, arma!.range === 'melee' ? 'melee' : 'ranged');
      const ctx = buildAttackContext({
        attacker: u, weapon: arma!, targetDefense: def,
        situation: { critBonusExtra: critExtra || undefined },
        trainedRanges: [
          ...(u.meleeTrained ? (['melee'] as const) : []),
          ...(u.rangedTrained ? (['ranged', 'thrown'] as const) : []),
        ],
      });
      const r = await rollAttack(ctx);
      metadadosAtaque = { critical: r.critical, criticalFail: r.criticalFail, kind: arma!.range === 'melee' ? 'melee' : 'ranged' };
      critico = r.critical;
      aplicaEfeitos = r.hit;
      armaDano = cfg.incluirArma ? r.damageTotal : 0;
      cabecalho = `ataque ${r.attackTotal} vs Defesa ${def} → ${r.critical ? 'CRÍTICO' : r.hit ? 'ACERTOU' : 'ERROU'}${critExtra ? ` (margem −${critExtra})` : ''}`;
      if (!r.hit) {
        const msg = `⚔️ ${u.name} usa ${cfg.nome} (${pago}) em ${t.name}: ${cabecalho}.`;
        log(msg);
        detalhes.push(msg);
        continue;
      }
    }

    // ── Dano ──
    const plano = planejarDano(cfg.dano, cfg.dadosPorCarga, cargas, critico);
    let bruto = armaDano + plano.fixo;
    let dadosTxt = '';
    if (plano.grupos.length) {
      const r = await rollDiceGroups(plano.grupos, { label: cfg.nome });
      bruto += r.total;
      dadosTxt = r.groups.map((g) => `${g.count}d${g.sides}[${g.rolls.join(',')}]`).join('+');
    }
    const dano = cfg.teste === 'tr' ? danoAposTR(bruto, passouTR, !!cfg.metadeNoSucesso) : bruto;
    if (dano > 0) {
      useCharacterStore.getState().applyDamage(t.id, dano, resolverTipoDano(cfg.tipoDano), {
        attackerId: u.id, source: 'omni', attack: metadadosAtaque,
        isMelee: metadadosAtaque ? metadadosAtaque.kind === 'melee' : undefined,
      });
    }
    const notas = aplicaEfeitos ? aplicarEfeitos(u, t, cfg.efeitos ?? [], fonte) : [];
    const partes = [
      cabecalho,
      `dano ${dano}${armaDano ? ` (arma ${armaDano}` + (dadosTxt ? ` + ${dadosTxt}` : '') + ')' : dadosTxt ? ` (${dadosTxt})` : ''}${passouTR && cfg.metadeNoSucesso ? ' — metade' : ''}`,
      ...notas,
    ].filter(Boolean);
    const msg = `⚔️ ${u.name} usa ${cfg.nome} (${pago}) em ${t.name}: ${partes.join(' · ')}.`;
    log(msg);
    danoTotal += dano;
    detalhes.push(msg);
  }
  return { ok: true, dano: danoTotal, detalhe: detalhes.join("\n") };
}

/** Ações ativas disponíveis ao personagem (itens do inventário dele). */
export function acoesAtivasDe(charId: string): { instanceId: string; ent: EntidadeOmni; cfg: AcaoAtivaConfig }[] {
  const out: { instanceId: string; ent: EntidadeOmni; cfg: AcaoAtivaConfig }[] = [];
  for (const i of Object.values(useInventoryStore.getState().items)) {
    if (i.ownerId !== charId) continue;
    for (const cfg of i.entity.acoesAtivas ?? []) out.push({ instanceId: i.instanceId, ent: i.entity, cfg });
  }
  return out;
}

export function novaAcaoAtiva(): AcaoAtivaConfig {
  return {
    id: crypto.randomUUID(), nome: 'Nova ação', acao: 'comum', custoPE: '0', alcanceM: 0,
    teste: 'nenhum', metadeNoSucesso: true, efeitos: [],
  };
}
