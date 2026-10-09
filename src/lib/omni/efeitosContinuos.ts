/**
 * Efeitos contínuos OMNI presos a um alvo (ex.: Espírito de Fogo no ombro do aliado).
 *
 * - Cura contínua: rola os dados no início de cada turno do alvo.
 * - Assistência de dano: soma dados extras aos ataques compatíveis do alvo.
 *
 * Quando o efeito nasce de uma ação sustentada, ele só vale enquanto o
 * conjurador mantiver a sustentação (e o alvo continuar no alcance dela).
 */
import type { Character, DamageType, EfeitoContinuoOmni, EscopoAssistenciaDano } from '@/types';
import type { OpcoesDano } from './contextoDano';
import { resolverTipoDano } from './contextoDano';
import { planejarFormulaDano } from './planoDano';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { armaDoPersonagem } from './armaDoPersonagem';
import { estadoRemotoEmAplicacao } from './estadoRemoto';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollDiceGroups } from '@/lib/dice';
import type { Weapon } from '@/lib/weapons';

export const TAG_ASSISTENCIA = '__assistencia_dano';
const TAGS_SEM_ASSISTENCIA = new Set([TAG_ASSISTENCIA, '__persistent_area_tick', '__persistent_area_residual', '__sangue_toxico_return', '__dragao']);

/** Em efeitos de cura, atributos sem prefixo mod_ significam modificador d20. */
export function normalizarAtributosCura(expr: string): string {
  return expr.replace(/@(USUARIO|ALVO|ORIGEM)\.(for|des|con|int|sab|pre|car|forca|destreza|constituicao|inteligencia|sabedoria|presenca|carisma)\b/gi,
    (_todo, escopo: string, atributo: string) => {
      const chaves: Record<string, string> = {
        for: 'for', forca: 'for', des: 'des', destreza: 'des',
        con: 'con', constituicao: 'con', int: 'int', inteligencia: 'int',
        sab: 'sab', sabedoria: 'sab', pre: 'pre', presenca: 'pre',
        car: 'car', carisma: 'car',
      };
      const esc = escopo.toUpperCase() === 'ORIGEM' ? 'USUARIO' : escopo.toUpperCase();
      return `@${esc}.mod_${chaves[atributo.toLowerCase()]}`;
    });
}

const chars = () => useCharacterStore.getState().characters;

/** O efeito continua valendo? (sustentação viva e alvo ainda no alcance dela). */
export function efeitoContinuoValido(ef: EfeitoContinuoOmni, alvoId: string, lista: Character[] = chars()): boolean {
  if (!ef.sustentacaoId) return true;
  const origem = lista.find(c => c.id === ef.origemId);
  const s = origem?.omniSustentacoes?.find(x => x.id === ef.sustentacaoId);
  if (!s) return false;
  if (s.alcanceM && alvoId !== ef.origemId && !(s.alvos ?? []).includes(alvoId)) return false;
  return true;
}

/** Algum alvo ainda carrega um efeito ligado a esta sustentação? */
export function sustentacaoTemEfeitoContinuo(origemId: string, sustentacaoId: string, lista: Character[] = chars()): boolean {
  return lista.some(c => (c.omniEfeitosContinuos ?? []).some(e => e.origemId === origemId && e.sustentacaoId === sustentacaoId));
}

function salvar(charId: string, efeitos: EfeitoContinuoOmni[]) {
  useCharacterStore.getState().updateCharacter(charId, { omniEfeitosContinuos: efeitos });
}

/** Registra (ou soma espíritos a) um efeito contínuo no alvo. Mesma ação + mesma origem acumula. */
export function registrarEfeitoContinuo(alvoId: string, novo: Omit<EfeitoContinuoOmni, 'id'>): void {
  const alvo = chars().find(c => c.id === alvoId);
  if (!alvo) return;
  const atuais = (alvo.omniEfeitosContinuos ?? []).filter(e => efeitoContinuoValido(e, alvoId));
  const igual = atuais.find(e => e.origemId === novo.origemId && e.acaoId === novo.acaoId && e.sustentacaoId === novo.sustentacaoId);
  if (igual) {
    salvar(alvoId, atuais.map(e => e === igual ? {
      ...e, ...novo, id: e.id,
      multiplicador: e.multiplicador + novo.multiplicador,
      assistencia: novo.assistencia ? { ...novo.assistencia } : e.assistencia,
    } : e));
  } else {
    salvar(alvoId, [...atuais, { ...novo, id: crypto.randomUUID() }]);
  }
}

function variaveis(origem: Character | undefined, alvo: Character) {
  return {
    ...montarVariaveisDoPersonagem(origem ?? alvo, 'USUARIO'),
    ...montarVariaveisDoPersonagem(alvo, 'ALVO'),
  };
}

/** Rola uma fórmula (dados animados em 3D) N vezes somadas. */
async function rolarFormula(formula: string, vezes: number, origem: Character | undefined, alvo: Character, rotulo: string) {
  const vars = variaveis(origem, alvo);
  let plano: ReturnType<typeof planejarFormulaDano>;
  try {
    plano = planejarFormulaDano(normalizarAtributosCura(formula), parcela => avaliarFormula(parcela, vars));
  } catch {
    return null;
  }
  const n = Math.max(1, Math.floor(vezes));
  if (!Number.isFinite(plano.fixo) || plano.grupos.some(g => !Number.isSafeInteger(g.count) || g.count <= 0 || !Number.isSafeInteger(g.sides) || g.sides <= 0)) return null;
  const grupos = plano.grupos.map(g => ({ count: g.count * n, sides: g.sides }));
  const r = grupos.length ? await rollDiceGroups(grupos, { label: rotulo }) : null;
  const total = Math.max(0, Math.floor((r?.total ?? 0) + plano.fixo * n));
  const dados = r?.groups.map(g => `${g.count}d${g.sides} [${g.rolls.join(', ')}]`).join(' + ') ?? '';
  const fixo = plano.fixo * n;
  return { total, texto: [dados, fixo ? String(fixo) : ''].filter(Boolean).join(' + ') };
}

/** Início do turno do alvo: aplica curas contínuas e conta rodadas. */
export async function tickEfeitosContinuosInicioTurno(charId: string): Promise<number> {
  if (useRoleStore.getState().role === 'PLAYER' || estadoRemotoEmAplicacao()) return 0;
  const alvo = chars().find(c => c.id === charId);
  if (!alvo?.omniEfeitosContinuos?.length) return 0;
  const log = (m: string) => useLogStore.getState().addLog('combat', m);
  const validos = alvo.omniEfeitosContinuos.filter(e => efeitoContinuoValido(e, charId));
  for (const e of alvo.omniEfeitosContinuos) if (!validos.includes(e)) log(`💨 ${e.nome} se desfez em ${alvo.name}.`);
  let curados = 0;
  for (const e of validos) {
    if (!e.cura?.formula.trim()) continue;
    if ((alvo.hpCurrent ?? 1) <= 0 && e.cura.recurso !== 'pe') continue;
    const origem = chars().find(c => c.id === e.origemId);
    const atual = chars().find(c => c.id === charId)!;
    const r = await rolarFormula(e.cura.formula, e.multiplicador, origem, atual, `Cura contínua: ${e.nome}`);
    if (!r) { log(`⛔ ${e.nome}: fórmula de cura contínua inválida.`); continue; }
    const recurso = e.cura.recurso ?? 'pv';
    const antes = recurso === 'pv' ? atual.hpCurrent : atual.peCurrent;
    if (recurso === 'pv') useCharacterStore.getState().applyHealing(charId, r.total, 'other', e.origemId);
    else useCharacterStore.getState().updateCharacter(charId, { peCurrent: Math.max(atual.peCurrent, Math.min(atual.peMax, atual.peCurrent + r.total)) });
    const depois = chars().find(c => c.id === charId)!;
    const ganho = Math.max(0, (recurso === 'pv' ? depois.hpCurrent : depois.peCurrent) - antes);
    curados++;
    log(`✨ ${e.nome}${e.multiplicador > 1 ? ` ×${e.multiplicador}` : ''} cura ${alvo.name}: +${ganho} ${recurso.toUpperCase()} (${r.texto || r.total}).`);
  }
  // Duração por rodadas (0/ausente = enquanto durar a sustentação).
  const restantes = validos
    .map(e => e.rodadas && e.rodadas > 0 ? { ...e, rodadas: e.rodadas - 1 } : e)
    .filter(e => {
      if (e.rodadas === 0 && validos.find(v => v.id === e.id)?.rodadas) { log(`⏳ ${e.nome} terminou em ${alvo.name}.`); return false; }
      return true;
    });
  salvar(charId, restantes);
  return curados;
}

/** Contexto do ataque que acabou de causar dano. */
export interface ContextoAtaqueAssistencia {
  isMelee?: boolean;
  source?: OpcoesDano['source'];
  kind?: string;
  arma?: Pick<Weapon, 'name' | 'group' | 'range'> | null;
}

/** Regra pura: este ataque recebe a assistência? */
export function assistenciaCombina(escopo: EscopoAssistenciaDano, filtroArma: string | undefined, ctx: ContextoAtaqueAssistencia): boolean {
  const corpo = ctx.isMelee === true || ctx.kind === 'melee';
  const feitico = ctx.source === 'feitico' || ctx.kind === 'cursed';
  const distancia = !feitico && !corpo && (ctx.isMelee === false || ctx.kind === 'ranged');
  switch (escopo) {
    case 'qualquer': return true;
    case 'corpo_a_corpo': return corpo;
    case 'distancia': return distancia;
    case 'feitico': return feitico;
    case 'arma': return !feitico && (ctx.source === 'arma' || !!ctx.arma);
    case 'arma_especifica': {
      if (feitico || !ctx.arma) return false;
      const termos = (filtroArma ?? '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (!termos.length) return true;
      const alvo = [ctx.arma.name, ctx.arma.group].filter(Boolean).map(s => String(s).toLowerCase());
      return termos.some(t => alvo.some(a => a === t || a.includes(t)));
    }
  }
  return false;
}

/** Chamado depois que um ataque causa dano: soma as assistências do atacante. */
export async function dispararAssistenciaDano(alvoId: string, opts: OpcoesDano | undefined): Promise<number> {
  const atacanteId = opts?.attackerId;
  if (!atacanteId || atacanteId === alvoId || opts?.tags?.some(t => TAGS_SEM_ASSISTENCIA.has(t))) return 0;
  const atacante = chars().find(c => c.id === atacanteId);
  const lista = (atacante?.omniEfeitosContinuos ?? []).filter(e => e.assistencia?.dano.trim() && efeitoContinuoValido(e, atacanteId));
  if (!atacante || !lista.length) return 0;
  const arma = atacante.mainHandWeaponName ? armaDoPersonagem(atacante.id, atacante.mainHandWeaponName, atacante.mainHandWeaponInstanceId ?? undefined) ?? null : null;
  const ctx: ContextoAtaqueAssistencia = { isMelee: opts?.isMelee, source: opts?.source, kind: opts?.attack?.kind, arma: opts?.source === 'feitico' ? null : arma };
  const alvo = chars().find(c => c.id === alvoId);
  if (!alvo) return 0;
  let total = 0;
  const consumidos = new Set<string>();
  for (const e of lista) {
    const a = e.assistencia!;
    if (!assistenciaCombina(a.escopo, a.filtroArma, ctx)) continue;
    const origem = chars().find(c => c.id === e.origemId);
    const r = await rolarFormula(a.dano, e.multiplicador, origem, atacante, `Assistência: ${e.nome}`);
    if (!r) {
      useLogStore.getState().addLog('combat', `⛔ ${e.nome}: fórmula de assistência inválida; nenhum dano adicional foi aplicado.`);
      continue;
    }
    if (r.total <= 0) continue;
    const tipo = resolverTipoDano(a.tipoDano) as DamageType | undefined;
    await useCharacterStore.getState().applyDamage(alvoId, r.total, tipo, { attackerId: atacanteId, source: 'omni', tags: [TAG_ASSISTENCIA] });
    useLogStore.getState().addLog('combat', `🔥 ${e.nome} soma +${r.total} de dano${a.tipoDano ? ` ${a.tipoDano}` : ''} ao golpe de ${atacante.name} em ${alvo.name} (${r.texto || r.total}).`);
    total += r.total;
    if (a.consumo === 'proximo_acerto') consumidos.add(e.id);
  }
  if (consumidos.size) {
    const atual = chars().find(c => c.id === atacanteId);
    if (atual) salvar(atacanteId, (atual.omniEfeitosContinuos ?? [])
      .map(e => consumidos.has(e.id) ? { ...e, assistencia: undefined } : e)
      .filter(e => e.cura?.formula.trim() || e.assistencia));
  }
  return total;
}
