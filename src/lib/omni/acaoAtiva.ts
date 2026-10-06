import { exemplarEstaEmpunhado } from './exemplarArma';
import { resolverCondicaoOmni } from './condicaoDoSistema';
import { notificarEventoPersonagem } from './notificarEvento';
import { planejarFormulaDano } from './planoDano';
import { notificarAtualizacaoContadores } from './atualizacaoContadores';
import { notificarResultadoAtaque } from './resultadoAtaque';
import { armaDoPersonagem, armaEstaEmpunhada } from './armaDoPersonagem';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { planejarCustosAtivos, validarRecursosAtivos, patchCustosAtivos, consumirUsosItemAtivo, consumirMunicaoAtiva, type ContextoCustosAtivos } from './custosAtivos';
import { prepararMovimentosAtivos, aplicarMovimentoAtivo, validarPlanoMovimento, type PlanoMovimentoAtivo, type OpcoesMovimentoAtivo } from './movimentosAtivos';
import { avaliarCondicionaisAtivos } from './condicionaisAtivos';
import { applyAdvantageToD20, consumeAdvantageFor, consumeFlatBonusFor } from './rollAdvantage';
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
 *  - custos flexíveis de PE/PV, intensificação e consumo parcial ou total de cargas;
 *  - margem de crítico reduzida por condição em fórmula;
 *  - efeitos secundários: puxar/empurrar (para ao lado do atacante) e condição.
 * Custos, ação e cargas são pagos ANTES da rolagem (gastos mesmo errando).
 */
import type { Character, DamageType } from '@/types';
import { getLevelSkillBonus, getTrainingBonus } from '@/types';
import type { AcaoAtivaConfig, DesfechoTRAtivo, EfeitoSecundarioAtivo, EntidadeOmni, TrNome } from './tipos';
import { avaliarFormula } from './parser';
import { ajustarProtecoesOmni } from './protecoesAtivas';
import { lerCaminhoOmni, montarVariaveisDoPersonagem } from './resolvedor';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { selectOmniModifiers } from '@/lib/omni/omniBridge';
import { type ActiveCondition } from '@/types/conditions';
import type { TouchGrid } from '@/lib/touchRange';
import { distanciaBordaEntreFichas, distanciaCircularEntreFichas } from '@/lib/mapa/alcanceCircular';
import { penalidadeTRFlanqueado } from '@/lib/flanqueadorSuperior';
import { specDCFor } from '@/lib/golpeEspecial';
import { rollD20Com, rollDiceGroups } from '@/lib/dice';
import { findWeaponByName, resolveWeaponDamage, requiresTwoHands, type Weapon } from '@/lib/weapons';
import { buildAttackContext, rollAttack } from '@/lib/combatEngine';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { replicaWeaponName } from '@/lib/replicas';
import { getSkillModFromConditions } from '@/lib/conditionEffects';
import { weaponMaxRangeMeters } from '@/lib/weaponRange';

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
export function planejarDano(dano: string | undefined, porCarga: string | undefined, cargas: number, critico: boolean, multiplicador = 2): DadosPlano {
  const base = parseDados(dano);
  const pc = parseDados(porCarga);
  const grupos = [...base.grupos];
  for (const g of pc.grupos) grupos.push({ count: g.count * cargas, sides: g.sides });
  const mult = critico ? Math.max(1, Math.trunc(multiplicador)) : 1;
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

export type GrauSucessoTR = 'falha_critica' | 'falha' | 'sucesso';
export function classificarGrauTR(d20: number, total: number, cd: number): GrauSucessoTR {
  if (d20 === 1 || total <= cd - 5) return 'falha_critica';
  return total >= cd ? 'sucesso' : 'falha';
}

export function danoDoGrauTR(total: number, grau: GrauSucessoTR, desfecho: DesfechoTRAtivo | undefined, metadeLegada: boolean): number {
  const modo = desfecho?.dano ?? (grau === 'sucesso' ? metadeLegada ? 'metade' : 'nenhum' : 'total');
  if (modo === 'nenhum') return 0;
  return modo === 'metade' ? Math.floor(total / 2) : total;
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
  const equipados = useInventoryStore.getState().listEquipped(alvo.id)
    .filter((item) => item.entity.slotType && item.entity.slotType !== 'nenhum')
    .map((item) => ({ instanceId: item.instanceId, equippedSlot: item.equippedSlot, entity: item.entity }));
  const bonusEquipamento = selectOmniModifiers(alvo, equipados).trs[tr] ?? 0;
  return lerCaminhoOmni(alvo, `tr.${tr}`) + bonusEquipamento + penalidadeTRFlanqueado(
    alvo, useCharacterStore.getState().characters, ms.entities as never, ms.gridConfig as never,
  );
}

function normalizarPericia(nome: string) {
  return nome.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function obterPericia(char: Character, nome: string) {
  const key = normalizarPericia(nome);
  return (char.skills ?? []).find(skill => normalizarPericia(skill.name) === key);
}

/** Bônus base usado pela rolagem de perícia da ficha, sem os bônus contextuais exclusivos do painel. */
export function modificadorPericiaAtiva(char: Character, nome: string): number | undefined {
  const skill = obterPericia(char, nome);
  if (!skill) return undefined;
  const attr = skill.linkedAttribute ? (char.attributes ?? []).find(a => a.id === skill.linkedAttribute) : undefined;
  const modAtributo = attr ? Math.floor((attr.value - 10) / 2) : 0;
  const equipados = useInventoryStore.getState().listEquipped(char.id).filter(i => i.entity.slotType && i.entity.slotType !== 'nenhum');
  const equipamentos = selectOmniModifiers(char, equipados).pericias;
  const skillKey = skill.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
  return (skill.value || 0) + modAtributo + getTrainingBonus(char.level, skill.trained, skill.mastery)
    + getLevelSkillBonus(char.level) + (skill.externalBonus || 0) + getSkillModFromConditions(char, skill.name)
    + ((char.omniSkillBonuses ?? {})[skillKey] ?? 0) + (equipamentos[skillKey] ?? 0);
}

/** Empates ficam com quem defende a manobra. */
export function usuarioVenceDisputa(totalUsuario: number, totalAlvo: number): boolean {
  return totalUsuario > totalAlvo;
}

export function melhorPericiaDaDisputa(char: Character, opcoes: string[]): { nome: string; bonus: number } | undefined {
  return opcoes.map(nome => ({ nome, bonus: modificadorPericiaAtiva(char, nome) }))
    .filter((item): item is { nome: string; bonus: number } => item.bonus !== undefined)
    .sort((a, b) => b.bonus - a.bonus)[0];
}

function danoArmaBase(arma?: Weapon, u?: Character) {
  if (!arma) return undefined;
  const duasMaos = !!u && (u.mainHandWeaponInstanceId && u.offHandWeaponInstanceId
    ? u.mainHandWeaponInstanceId === u.offHandWeaponInstanceId
    : !!u.mainHandWeaponName && u.mainHandWeaponName === u.offHandWeaponName);
  const dano = arma.omniDamageFormula ?? resolveWeaponDamage(arma, requiresTwoHands(arma) || duasMaos) ?? undefined;
  const grupos = dano && u ? planejarFormulaDano(dano, expr => avaliarFormula(expr, montarVariaveisDoPersonagem(u, 'USUARIO'), () => 0.5)).grupos : [...(dano ?? '').matchAll(/(\d*)d(\d+)/gi)].map(m => ({ count: Number(m[1] || 1), sides: Number(m[2]) }));
  return {
    ...(dano ? { dano } : {}),
    dados: grupos.reduce((n, g) => n + g.count, 0),
    passo: grupos.reduce((n, g) => Math.max(n, g.sides), 0),
    critico_margem: arma.critRange ?? 0,
  };
}

function vars(u: Character, a?: Character, arma?: Weapon) {
  const contexto = danoArmaBase(arma, u);
  return {
    ...montarVariaveisDoPersonagem(u, 'USUARIO'),
    ...(a ? montarVariaveisDoPersonagem(a, 'ALVO') : {}),
    ...(contexto ? { ARMA_DADOS: contexto.dados, ARMA_PASSO: contexto.passo, ARMA_CRITICO_MARGEM: contexto.critico_margem } : {}),
  };
}

function avaliarFormulaAtiva(expressao: string, u: Character, alvo?: Character, arma?: Weapon, rng?: () => number) {
  return avaliarFormula(expressao, vars(u, alvo, arma), rng, { arma: danoArmaBase(arma, u) });
}

/** Substitui tokens de arma por notação/dados para compor os grupos críticos. */
function danoComContextoArma(expressao: string | undefined, arma?: Weapon, u?: Character): string | undefined {
  if (!expressao) return expressao;
  const contexto = danoArmaBase(arma, u);
  return expressao
    .replace(/\(?@ARMA\.DADOS\)?d@ARMA\.PASSO/gi, () => `${contexto?.dados ?? 0}d${contexto?.passo ?? 0}`)
    .replace(/@ARMA\.([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*)/gi, (_token, campo: string) => {
      const chave = campo.toLowerCase();
      if (chave === 'dano') return contexto?.dano ?? '0';
      const n = (contexto as Record<string, number | string> | undefined)?.[chave];
      if (typeof n === 'number' && Number.isFinite(n)) return String(n);
      throw new Error(`Campo de arma desconhecido: ${campo}`);
    });
}

function notacaoDanoAtivo(expressao: string | undefined, u: Character, alvo?: Character, arma?: Weapon): string {
  if (expressao && /@ARMA\./i.test(expressao) && !arma) throw new Error('Fórmula exige uma arma disponível.');
  const expr = danoComContextoArma(expressao, arma, u);
  const plano = planejarFormulaDano(expr, parcela => avaliarFormulaAtiva(parcela, u, alvo, arma));
  return [...plano.grupos.map(g => `${g.count}d${g.sides}`), ...(plano.fixo ? [String(Math.round(plano.fixo))] : [])].join('+') || '0';
}

export function custoPEDe(cfg: AcaoAtivaConfig, u: Character, intensificacoes = 0, arma?: Weapon): number {
  const r = planejarCustosAtivos(cfg, u, intensificacoes);
  return r.ok ? r.plano.pe : Infinity;
}

// ─── Validação + execução ────────────────────────────────────────────

export type ResultadoAtiva = { ok: false; reason: string } | { ok: true; dano: number; cura?: number; detalhe: string; efeitoAplicado?: boolean };

export function podeUsarAtiva(u: Character, alvo: Character | undefined, cfg: AcaoAtivaConfig, intensificacoes = 0, arma?: Weapon, contexto?: ContextoCustosAtivos, medicao: 'circular' | 'borda' = 'circular'): { ok: true } | { ok: false; reason: string } {
  if (!alvo) return { ok: false, reason: 'Escolha um alvo.' };
  if (!Number.isFinite(cfg.alcanceM) || cfg.alcanceM < 0) return { ok: false, reason: 'Alcance inválido.' };
  if (!['ataque', 'tr', 'disputa', 'nenhum'].includes(cfg.teste)) return { ok: false, reason: 'Teste inválido.' };
  if (cfg.tipo_efeito && !['dano', 'cura', 'buff'].includes(cfg.tipo_efeito)) return { ok: false, reason: 'Tipo de efeito inválido.' };
  if (cfg.teste === 'tr' && cfg.tr && !(cfg.tr in TR_ROTULO)) return { ok: false, reason: 'Resistência inválida.' };
  if (cfg.teste === 'tr' && cfg.cd?.trim()) {
    const r = avaliarFormulaAtiva(cfg.cd, u, alvo, arma, () => 0.5);
    if (r.diagnosticos.length || r.rolagens.length || !Number.isSafeInteger(Math.round(r.valor))) return { ok: false, reason: 'CD exige fórmula válida e sem dados.' };
  }
  if (cfg.margemCritico) {
    const r = avaliarFormulaAtiva(cfg.margemCritico.condicao, u, alvo, arma, () => 0.5);
    if (r.diagnosticos.length || r.rolagens.length || !Number.isFinite(r.valor) || !Number.isSafeInteger(cfg.margemCritico.reducao)) return { ok: false, reason: 'Condição de crítico inválida.' };
  }
  if (cfg.teste === 'disputa') {
    if (!cfg.pericia_usuario?.trim() || !cfg.pericias_alvo?.some(p => p.trim())) return { ok: false, reason: 'Configure a perícia do usuário e ao menos uma perícia possível do alvo.' };
    if (modificadorPericiaAtiva(u, cfg.pericia_usuario) === undefined) return { ok: false, reason: `A perícia "${cfg.pericia_usuario}" não existe na ficha do usuário.` };
    if (!melhorPericiaDaDisputa(alvo, cfg.pericias_alvo)) return { ok: false, reason: 'O alvo não possui nenhuma das perícias configuradas para a disputa.' };
  }
  if (cfg.tipo_efeito !== 'cura' && cfg.tipo_efeito !== 'buff') {
    try {
      notacaoDanoAtivo(cfg.dano, u, alvo, arma);
      notacaoDanoAtivo(cfg.dadosPorCarga, u, alvo, arma);
      notacaoDanoAtivo(cfg.custo_recursos?.dano_por_intensificacao, u, alvo, arma);
      for (const ramo of Object.values(cfg.desfechosTR ?? {})) notacaoDanoAtivo(ramo?.dano_extra, u, alvo, arma);
      if (cfg.teste === 'ataque' && arma?.omniDamageFormula) notacaoDanoAtivo(arma.omniDamageFormula, u, alvo, arma);
    }
    catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'Fórmula de dano inválida.' }; }
  }
  const efeitos = [...(cfg.efeitos ?? []), ...Object.values(cfg.desfechosTR ?? {}).flatMap(d => d?.efeitos ?? [])];
  for (const ramo of Object.values(cfg.desfechosTR ?? {})) {
    if (ramo?.dano && !['total','metade','nenhum'].includes(ramo.dano) || ramo?.multiplicador_duracao !== undefined && (!Number.isSafeInteger(ramo.multiplicador_duracao) || ramo.multiplicador_duracao < 1)) return { ok: false, reason: 'Desfecho de resistência inválido.' };
  }
  for (const ef of efeitos) {
    if (!['condicao','remover_condicao','pv_temporarios','escudo','puxar','empurrar','movimento'].includes(ef.tipo)) return { ok: false, reason: 'Efeito secundário inválido.' };
    if (ef.tipo === 'condicao' && (!resolverCondicaoOmni(ef.condicao) || !Number.isSafeInteger(ef.rodadas) || ef.rodadas < 0)) return { ok: false, reason: 'Condição ou duração inválida.' };
    if (ef.tipo === 'pv_temporarios' || ef.tipo === 'escudo') {
      const r = avaliarFormulaAtiva(ef.valor, u, alvo, arma, () => 0.5);
      if (!ef.valor.trim() || r.diagnosticos.length || !Number.isFinite(r.valor) || !Number.isInteger(ef.rodadas) || ef.rodadas < 0) return { ok: false, reason: 'Proteção exige fórmula válida e duração inteira não negativa.' };
    }
    if (ef.tipo === 'remover_condicao' && ef.condicao !== 'todas' && !resolverCondicaoOmni(ef.condicao)) return { ok: false, reason: 'Condição a remover não reconhecida.' };
  }
  const formulasArma = [cfg.dano, cfg.dadosPorCarga, ...(cfg.condicionais ?? []).map(b => b.dano_extra), ...Object.values(cfg.desfechosTR ?? {}).map(r => r?.dano_extra)]
    .filter((f): f is string => !!f && /@ARMA\./i.test(f));
  for (const expressao of formulasArma) {
    const r = avaliarFormulaAtiva(expressao, u, alvo, arma, () => 0.5);
    if (r.diagnosticos.length) return { ok: false, reason: 'Fórmula de dano ou contexto da arma inválido.' };
  }
  if (cfg.tipo_efeito === 'cura') {
    if (cfg.tipo_alvo !== 'proprio' && cfg.filtro_alvo !== 'aliados') return { ok: false, reason: 'Cura exige filtro de aliados ou alvo próprio.' };
    if (cfg.teste !== 'nenhum') return { ok: false, reason: 'Cura direta exige ação sem teste.' };
    const formula = avaliarFormulaAtiva(cfg.cura || '0', u, alvo, arma, () => 0.5);
    if (formula.diagnosticos.length || !Number.isFinite(formula.valor)) return { ok: false, reason: 'Fórmula de cura inválida.' };
  }
  if (!cfg.tipo_alvo && alvo.id === u.id) return { ok: false, reason: 'O alvo deve ser outra criatura.' };
  if (!aceitaAlvoAtivo(u, alvo, cfg)) return { ok: false, reason: 'O alvo não atende ao filtro.' };
  const custos = planejarCustosAtivos(cfg, u, intensificacoes, { armaNome: arma?.name, ...contexto });
  if (!custos.ok) return custos;
  const recursos = validarRecursosAtivos(u, custos.plano);
  if (!recursos.ok) return recursos;
  if (cfg.alcanceM > 0 && cfg.tipo_alvo !== 'area' && cfg.tipo_alvo !== 'proprio') {
    const ms = useMapStore.getState();
    const d = medicao === 'borda'
      ? distanciaBordaEntreFichas(u, alvo, ms.entities, ms.layerVisible, ms.gridConfig)
      : distanciaCircularEntreFichas(u, alvo, ms.entities, ms.layerVisible, ms.gridConfig);
    if (d === null) return { ok: false, reason: 'Usuário e alvo precisam estar no mapa para medir o alcance.' };
    if (d > cfg.alcanceM + 0.05) return { ok: false, reason: `Fora de alcance (${d.toFixed(1).replace('.', ',')} m de ${cfg.alcanceM.toString().replace('.', ',')} m).` };
  }
  return { ok: true };
}

function aplicarEfeitos(u: Character, alvo: Character, efeitos: EfeitoSecundarioAtivo[], fonte: string, planos: PlanoMovimentoAtivo[] = [], sustentadas?: { charId: string; id: string; sourceEntityId?: string; sourceInstanceId?: string }[], arma?: Weapon, sourceEntityId?: string, sourceInstanceId?: string): string[] {
  const notas: string[] = [];
  const store = useCharacterStore.getState();
  for (const [indice, ef] of efeitos.entries()) {
    if (ef.tipo === 'condicao') {
      const def = resolverCondicaoOmni(ef.condicao);
      if (!def) continue;
      const ac: ActiveCondition = {
        id: crypto.randomUUID(), conditionId: def.id, name: def.name, icon: def.icon,
        remainingTurns: -1, remainingRounds: sustentadas ? -1 : ef.rodadas > 0 ? ef.rodadas : -1, sourceCharName: fonte, sourceCharId: u.id,
        sourceEntityId, sourceInstanceId,
      };
      const canonicalId = store.addCondition(alvo.id, ac);
      const activeCondition = useCharacterStore.getState().characters.find(c => c.id === alvo.id)?.activeConditions.find(c => c.id === canonicalId);
      const aplicacaoAtiva = activeCondition?.sourceApplications?.some(source => source.applicationId === ac.id) ?? canonicalId === ac.id;
      if (sustentadas && canonicalId && aplicacaoAtiva) sustentadas.push({ charId: alvo.id, id: canonicalId, sourceEntityId, sourceInstanceId });
      if (!useCharacterStore.getState().characters.find(c => c.id === alvo.id)?.activeConditions.some(c => c.id === ac.id)) continue;
      notas.push(`${def.icon} ${def.name}${sustentadas ? ' (sustentada)' : ef.rodadas > 0 ? ` (${ef.rodadas} rod.)` : ''}`);
    } else if (ef.tipo === 'remover_condicao') {
      const def = resolverCondicaoOmni(ef.condicao);
      const atuais = useCharacterStore.getState().characters.find(c => c.id === alvo.id)?.activeConditions ?? [];
      const removidas = atuais.filter(c => ef.condicao === 'todas' || c.conditionId === def?.id);
      for (const c of removidas) store.removeCondition(alvo.id, c.id);
      notas.push(`remove ${removidas.length} condição(ões)${def ? ': ' + def.name : ''}`);
    } else if (ef.tipo === 'pv_temporarios' || ef.tipo === 'escudo') {
      const r = avaliarFormulaAtiva(ef.valor, u, useCharacterStore.getState().characters.find(c => c.id === alvo.id)!, arma);
      if (r.diagnosticos.length || !Number.isFinite(r.valor)) { notas.push('fórmula de proteção inválida'); continue; }
      const valor = Math.max(0, Math.floor(r.valor));
      const atual = useCharacterStore.getState().characters.find(c => c.id === alvo.id)!;
      if (valor > 0) store.updateCharacter(alvo.id, {
        escCurrent: (atual.escCurrent ?? 0) + valor,
        protecoesOmni: [...ajustarProtecoesOmni(atual), { id: crypto.randomUUID(), fonte, tipo: ef.tipo, restante: valor, rodadas: ef.rodadas }],
      });
      const dados = r.rolagens.map(d => `${d.notacao} [${d.rolls.join(', ')}] = ${d.total}`).join('; ');
      notas.push(`+${valor} ${ef.tipo === 'escudo' ? 'escudo' : 'PV temporários'}${ef.rodadas ? ` (${ef.rodadas} rod.)` : ' (até remover)'}${dados ? ' · ' + dados : ''}`);
    } else {
      const plano = planos.find(p => p.indice === indice);
      if (plano) notas.push(aplicarMovimentoAtivo(u.id, alvo.id, plano));
    }
  }
  return notas;
}

/** Arma usada pela ação: a própria entidade (se for arma do catálogo) ou a da mão principal. */
export function armaDaAcao(u: Character, ent?: EntidadeOmni, instanciaId?: string) {
  const nome = (ent?.categoria === 'arma' && !ent.replica ? ent.nome : ent && replicaWeaponName(ent)) || u.mainHandWeaponName || '';
  return nome ? armaDoPersonagem(u.id, nome,
    ent?.categoria === 'arma' ? instanciaId : u.mainHandWeaponInstanceId ?? undefined) : undefined;
}

const acoesEmCurso = new Set<string>();
export async function executarAcaoAtiva(
  usuarioId: string, cfg: AcaoAtivaConfig, selecao: SelecaoAtiva, ent?: EntidadeOmni,
  opcoes: OpcoesMovimentoAtivo & { intensificacoes?: number; ignorarReacoes?: boolean; instanciaId?: string } = {},
): Promise<ResultadoAtiva> {
  if (acoesEmCurso.has(usuarioId)) return { ok: false, reason: 'Este personagem já está executando uma ação.' };
  acoesEmCurso.add(usuarioId);
  try { return await executarAcaoAtivaInterna(usuarioId, structuredClone(cfg), selecao, ent, opcoes); }
  catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'Não foi possível concluir a ação.' }; }
  finally { acoesEmCurso.delete(usuarioId); }
}

async function executarAcaoAtivaInterna(
  usuarioId: string,
  cfg: AcaoAtivaConfig,
  selecao: SelecaoAtiva,
  ent?: EntidadeOmni,
  opcoes: OpcoesMovimentoAtivo & { intensificacoes?: number; ignorarReacoes?: boolean; instanciaId?: string } = {},
): Promise<ResultadoAtiva> {
  const inicio = useCharacterStore.getState().characters.find(c => c.id === usuarioId);
  const armaInicial = inicio ? armaDaAcao(inicio, ent, opcoes.instanciaId) : undefined;
  const alcanceArma = cfg.alcanceM === 0 && armaInicial && (ent?.categoria === 'arma' || cfg.teste === 'ataque')
    ? weaponMaxRangeMeters(armaInicial)
    : undefined;
  const medicaoAlcance = ent?.categoria === 'arma' || cfg.teste === 'ataque' ? 'borda' : 'circular';
  const escolhidos = await selecionarAlvosAtivos(usuarioId, cfg, selecao, alcanceArma, medicaoAlcance);
  if (!escolhidos.ok) return escolhidos;
  let store = useCharacterStore.getState();
  const log = (m: string) => useLogStore.getState().addLog('combat', m);
  let u = store.characters.find((x) => x.id === usuarioId);
  if (!u) return { ok: false, reason: 'Personagem não encontrado.' };
  let arma = armaDaAcao(u, ent, opcoes.instanciaId);
  const armaDeclarada = JSON.stringify(arma);
  const validarInstancia = () => {
    if (!opcoes.instanciaId) return true;
    const item = useInventoryStore.getState().items[opcoes.instanciaId];
    const usuario = useCharacterStore.getState().characters.find(c => c.id === usuarioId);
    return !!item && !!usuario && item.ownerId === usuarioId && (!ent || item.entity.id === ent.id) && (ent?.categoria !== 'arma' ||
      (usuario.mainHandWeaponInstanceId || usuario.offHandWeaponInstanceId
        ? usuario.mainHandWeaponInstanceId === item.instanceId || usuario.offHandWeaponInstanceId === item.instanceId
        : armaEstaEmpunhada(usuario, ent.replica ? item.replicaArma ?? '' : ent.nome)) && (!ent.replica || item.materializada));
  };
  if (!validarInstancia()) return { ok: false, reason: 'A instância desta ação não está disponível.' };
  if (ent?.categoria === 'arma' && (u.mainHandWeaponInstanceId || u.offHandWeaponInstanceId
    ? u.mainHandWeaponInstanceId !== opcoes.instanciaId && u.offHandWeaponInstanceId !== opcoes.instanciaId
    : !armaEstaEmpunhada(u, ent.replica ? replicaWeaponName(ent) ?? ent.nome : ent.nome))) return { ok: false, reason: 'Empunhe a arma antes de usar a ação.' };
  const armaInstanciaId = ent?.categoria === 'arma' ? opcoes.instanciaId : u.mainHandWeaponInstanceId ?? undefined;
  const contextoCustos: ContextoCustosAtivos = { armaNome: arma?.name, armaInstanciaId, instanciaId: opcoes.instanciaId, entidadeId: ent?.id };
  let alvos = escolhidos.ids.map(id => store.characters.find(c => c.id === id)!);
  for (const alvo of alvos) {
    const chk = podeUsarAtiva(u, alvo, cfg, opcoes.intensificacoes ?? 0, arma, contextoCustos, medicaoAlcance);
    if (!chk.ok) return chk;
  }
  if (cfg.teste === 'ataque' && !arma) return { ok: false, reason: 'Nenhuma arma empunhada para o ataque.' };

  const efeitosBase = cfg.efeitos ?? [];
  const indicesDesfecho: Partial<Record<GrauSucessoTR, number>> = {};
  const efeitosPossiveis = [...efeitosBase];
  for (const grau of ['falha_critica', 'falha', 'sucesso'] as const) {
    const efeitos = cfg.desfechosTR?.[grau]?.efeitos;
    if (efeitos) { indicesDesfecho[grau] = efeitosPossiveis.length; efeitosPossiveis.push(...efeitos); }
  }
  const movimentos = await prepararMovimentosAtivos(u.id, alvos, efeitosPossiveis, opcoes);
  if (!movimentos.ok) return movimentos;
  // Destino pode exigir interação: revalidar recursos e fichas após o await.
  store = useCharacterStore.getState();
  u = store.characters.find(c => c.id === usuarioId);
  if (!u) return { ok: false, reason: 'Personagem removido durante a seleção.' };
  alvos = escolhidos.ids.map(id => store.characters.find(c => c.id === id)!);
  for (const alvo of alvos) { const chk = podeUsarAtiva(u, alvo, cfg, opcoes.intensificacoes ?? 0, arma, contextoCustos, medicaoAlcance); if (!chk.ok) return chk; }

  if (!opcoes.ignorarReacoes && ent?.categoria === 'feitico') {
    const { abrirJanelaReacaoAtiva } = await import('./reacoesAtivas');
    const janela = await abrirJanelaReacaoAtiva({ gatilho: 'quando_inimigo_conjurar', origemId: usuarioId });
    if (janela.cancelado) return { ok: false, reason: 'Conjuração interrompida.' };
    store = useCharacterStore.getState();
    u = store.characters.find(c => c.id === usuarioId);
    if (!u || (u.hpCurrent ?? 1) <= 0) return { ok: false, reason: 'Conjurador indisponível.' };
    for (const alvo of alvos) { const chk = podeUsarAtiva(u, store.characters.find(c => c.id === alvo.id), cfg, opcoes.intensificacoes ?? 0, arma, contextoCustos, medicaoAlcance); if (!chk.ok) return chk; }
  }
  const personagemAntesDeRevalidar = useCharacterStore.getState().characters.find(c => c.id === usuarioId);
  const armaAntesDeRevalidar = personagemAntesDeRevalidar ? armaDaAcao(personagemAntesDeRevalidar, ent, opcoes.instanciaId) : undefined;
  const alcanceArmaAtual = cfg.alcanceM === 0 && armaAntesDeRevalidar && (ent?.categoria === 'arma' || cfg.teste === 'ataque')
    ? weaponMaxRangeMeters(armaAntesDeRevalidar)
    : undefined;
  const reescolhidos = await selecionarAlvosAtivos(usuarioId, cfg, escolhidos.selecaoValidada ?? escolhidos.ids, alcanceArmaAtual, medicaoAlcance);
  if (!reescolhidos.ok) return reescolhidos;
  if (reescolhidos.ids.length !== escolhidos.ids.length || reescolhidos.ids.some(id => !escolhidos.ids.includes(id))) return { ok: false, reason: 'Os alvos da área mudaram. Selecione novamente.' };
  store = useCharacterStore.getState();
  u = store.characters.find(c => c.id === usuarioId);
  if (!u) return { ok: false, reason: 'Usuário removido antes do pagamento.' };
  if (!validarInstancia()) return { ok: false, reason: 'A instância mudou durante a seleção.' };
  arma = armaDaAcao(u, ent, opcoes.instanciaId);
  if (JSON.stringify(arma) !== armaDeclarada || ent?.categoria === 'arma' && !armaEstaEmpunhada(u, ent.replica ? replicaWeaponName(ent) ?? ent.nome : ent.nome)) return { ok: false, reason: 'A arma mudou durante a seleção. Use a ação novamente.' };
  alvos = escolhidos.ids.map(id => store.characters.find(c => c.id === id)!);
  for (const alvo of alvos) {
    const chk = podeUsarAtiva(u, alvo, cfg, opcoes.intensificacoes ?? 0, arma, contextoCustos, medicaoAlcance); if (!chk.ok) return chk;
    for (const plano of movimentos.planos.get(alvo.id) ?? []) { const erro = validarPlanoMovimento(u.id, alvo.id, plano); if (erro) return { ok: false, reason: erro }; }
  }
  // Snapshot por alvo antes do consumo: cargas e PV são os da declaração.
  const condicionais = new Map(alvos.map(t => [t.id, {
    mods: avaliarCondicionaisAtivos(cfg.condicionais ?? [], u, t),
    critLegado: cfg.margemCritico?.condicao && avaliarFormulaAtiva(cfg.margemCritico.condicao, u, t, arma).valor ? cfg.margemCritico.reducao : 0,
  }]));

  if (cfg.tipo_efeito !== 'cura' && cfg.tipo_efeito !== 'buff') {
    for (const alvo of alvos) {
      try { for (const dano of condicionais.get(alvo.id)!.mods.danos) notacaoDanoAtivo(dano, u, alvo, arma); }
      catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'Dano condicional inválido.' }; }
    }
  }

  // ── Paga tudo antes de rolar ──
  const custos = planejarCustosAtivos(cfg, u, opcoes.intensificacoes ?? 0, contextoCustos);
  if (!custos.ok) return custos;
  const p = custos.plano;
  const cargas = p.cargas;
  const patchPago = patchCustosAtivos(u, p);
  if (p.acao === 'reacao') {
    delete patchPago.reactionsCurrent;
    const pagamento = useReactionStore.getState().runReaction(u.id, () => {
      if (!consumirUsosItemAtivo(p)) return { ok: false, reason: 'Os usos do item mudaram antes de a ação ser concluída.' };
      if (!consumirMunicaoAtiva(p)) return { ok: false, reason: 'A munição mudou antes de a ação ser concluída.' };
      useCharacterStore.getState().updateCharacter(u.id, patchPago);
      return { ok: true };
    });
    if (!pagamento.ok) return pagamento;
  } else {
    if (p.acao === 'movimento' && !useCombatStore.getState().spendMovementAction(u.id)) return { ok: false, reason: 'A Ação de Movimento deste turno já foi usada ou não está disponível.' };
    if (!consumirUsosItemAtivo(p)) {
      if (p.acao === 'movimento') useCombatStore.setState(s => {
        const movementActionUsedByChar = { ...(s.movementActionUsedByChar ?? {}) };
        delete movementActionUsedByChar[u.id];
        return { movementActionUsedByChar };
      });
      return { ok: false, reason: 'Os usos do item mudaram antes de a ação ser concluída.' };
    }
    if (!consumirMunicaoAtiva(p)) return { ok: false, reason: 'A munição mudou antes de a ação ser concluída.' };
    store.updateCharacter(u.id, patchPago);
  }
  if (patchPago.omniCounters) notificarAtualizacaoContadores(u.id, u.omniCounters, patchPago.omniCounters);
  const fonte = ent?.nome ?? cfg.nome;
  if (ent?.categoria === 'feitico') notificarEventoPersonagem('aoConjurarFeitico', u.id, fonte, { custoPE: p.pe });
  else if (ent?.categoria === 'talento') notificarEventoPersonagem('aoUsarTalento', u.id, fonte);
  const pago = `${p.pe} PE${p.pv ? ` + ${p.pv} PV` : ''}${cargas ? ` + ${cargas} carga(s) de ${p.contador}` : ''}${p.municao ? ` + ${p.municao} munição(ões)` : ''}${p.usosItem ? ` + ${p.usosItem} uso(s) do item` : ''}${p.intensificacoes ? ` · intensificação ${p.intensificacoes}` : ''}`;
  const sustentadas = p.pePorTurno > 0 ? [] as { charId: string; id: string; sourceEntityId?: string; sourceInstanceId?: string }[] : undefined;


  let danoTotal = 0;
  let curaTotal = 0;
  let efeitoAplicado = false;
  const detalhes: string[] = [];
  for (const selecionado of alvos) {
    const t = useCharacterStore.getState().characters.find(c => c.id === selecionado.id);
    if (!t) continue;
    const { mods, critLegado } = condicionais.get(t.id)!;
    const critExtra = critLegado - mods.margem;
    let metadadosAtaque: MetadadosAtaqueDano | undefined;
    let critico = false;
    let aplicaEfeitos = true;
    let passouTR = false;
    let grauTR: GrauSucessoTR | undefined;
    let desfechoTR: DesfechoTRAtivo | undefined;
    let efeitosTR: EfeitoSecundarioAtivo[] = cfg.efeitos ?? [];
    let armaDano = 0;
    let cabecalho = '';

    /** TR do alvo contra a CD; reutilizado como teste principal ou como TR após acerto. */
    const rolarTRAlvo = async () => {
      const tr = cfg.tr ?? 'fortitude';
      const cd = cfg.cd?.trim() ? Math.round(avaliarFormulaAtiva(cfg.cd, u, t, arma).valor) : specDCFor(u);
      const adv = consumeAdvantageFor(t.id, { kind: 'save', name: TR_ROTULO[tr] }, { disadvantage: mods.desvantagemTR });
      const flat = consumeFlatBonusFor(t.id, { kind: 'save', name: TR_ROTULO[tr] });
      const { abrirJanelaReacaoAtiva } = await import('./reacoesAtivas');
      const preTR = opcoes.ignorarReacoes ? { cancelado: false, testeBonus: 0 } : await abrirJanelaReacaoAtiva({ gatilho: 'quando_alvo_de_tr', origemId: u.id, protegidoId: t.id });
      if (preTR.cancelado) return { grau: 'sucesso' as GrauSucessoTR, texto: `TR ${TR_ROTULO[tr]} anulado por reação → SUCESSO` };
      const mod = modTR(t, tr) + mods.tr + flat.bonus + (preTR.testeBonus ?? 0);
      const rolled = await applyAdvantageToD20(adv.net, () => rollD20Com(t.id, undefined, { label: `TR ${TR_ROTULO[tr]}` }));
      const d20 = rolled.d20;
      const totalTR = d20 + mod;
      const grau = classificarGrauTR(d20, totalTR, cd);
      const grauLabel = grau === 'falha_critica' ? 'FALHA CRÍTICA' : grau.toUpperCase();
      if (!opcoes.ignorarReacoes) await abrirJanelaReacaoAtiva({ gatilho: grau === 'sucesso' ? 'quando_passar_tr' : 'quando_falhar_tr', origemId: u.id, protegidoId: t.id });
      return { grau, texto: `TR ${TR_ROTULO[tr]}${rolled.modeLabel} d20 ${d20}${mod >= 0 ? '+' : ''}${mod} = ${totalTR} vs CD ${cd} → ${grauLabel}${preTR.testeBonus ? ` (reação ${preTR.testeBonus > 0 ? '+' : ''}${preTR.testeBonus})` : ''}` };
    };

    if (cfg.teste === 'tr') {
      const resTR = await rolarTRAlvo();
      grauTR = resTR.grau;
      passouTR = grauTR === 'sucesso';
      const ramo = cfg.desfechosTR?.[grauTR];
      desfechoTR = ramo;
      efeitosTR = ramo?.efeitos ?? (grauTR === 'sucesso' ? [] : cfg.efeitos ?? []);
      if (grauTR === 'sucesso' && ramo?.dano === undefined && ramo?.dano_extra === undefined && !ramo?.dano_maximizado && !ramo?.efeitos?.length) efeitosTR = [];
      if (grauTR !== 'sucesso' && ramo?.efeitos === undefined && (cfg.efeitos?.length ?? 0) > 0) efeitosTR = cfg.efeitos!;
      aplicaEfeitos = grauTR !== 'sucesso' || efeitosTR.length > 0 || !!ramo?.dano_extra || !!ramo?.dano_maximizado || !!ramo?.dano && ramo.dano !== 'nenhum';
      cabecalho = resTR.texto;
    } else if (cfg.teste === 'ataque') {
      const def = computeTotalDefense(t, {}, arma!.range === 'melee' ? 'melee' : 'ranged');
      const ctx = buildAttackContext({
        attacker: u, weapon: arma!, targetDefense: def, targetId: t.id, alcanceM: cfg.alcanceM, ignorarReacoes: opcoes.ignorarReacoes,
        situation: { twoHanded: requiresTwoHands(arma!) || Boolean(u.mainHandWeaponInstanceId && u.offHandWeaponInstanceId ? u.mainHandWeaponInstanceId === u.offHandWeaponInstanceId : u.mainHandWeaponName && u.mainHandWeaponName === u.offHandWeaponName), rolarDano: cfg.tipo_efeito !== 'buff' && !!cfg.incluirArma && !/@ARMA\.DANO/i.test([cfg.dano, ...mods.danos].filter(Boolean).join('+')), hitBonusExtra: cfg.mod_acerto, critBonusExtra: critExtra || undefined, advantageExtra: mods.vantagemAcerto, critMultiplierExtra: mods.multiplicador },
        trainedRanges: [
          ...(u.meleeTrained ? (['melee'] as const) : []),
          ...(u.rangedTrained ? (['ranged', 'thrown'] as const) : []),
        ],
      });
      const r = await rollAttack(ctx);
      metadadosAtaque = { critical: r.critical, criticalFail: r.criticalFail, kind: arma!.range === 'melee' ? 'melee' : 'ranged' };
      critico = r.critical;
      aplicaEfeitos = r.hit;
      armaDano = cfg.incluirArma && !/@ARMA\.DANO/i.test(cfg.dano ?? '') ? r.damageTotal : 0;
      const podeVerDefesa = useRoleStore.getState().role !== 'PLAYER' || t.category === 'PLAYER';
      const defesaLabel = podeVerDefesa ? `Defesa ${def}` : 'Defesa do alvo';
      const bonusAcerto = r.attackTotal - r.natural;
      const dadoAcerto = r.attackRolls.length > 1
        ? `d20 [${r.attackRolls.join(', ')}] (usado ${r.natural})`
        : `d20 ${r.natural}`;
      const resultadoAcerto = r.hit ? (r.critical ? 'ACERTOU · CRÍTICO' : 'ACERTOU') : 'ERROU';
      cabecalho = `ataque ${dadoAcerto} ${bonusAcerto >= 0 ? '+' : '−'} ${Math.abs(bonusAcerto)} = ${r.attackTotal} vs ${defesaLabel} → ${resultadoAcerto}${critExtra ? ` (margem −${critExtra})` : ''}`;
      if (r.cancelled) { log(`⛔ ${cfg.nome}: ataque interrompido.`); continue; }
      const tipoDeclarado = resolverTipoDano(cfg.tipoDano) ?? (cfg.incluirArma || /@ARMA\./i.test([cfg.dano, ...mods.danos].join('+')) ? resolverTipoDano(arma!.omniDamageType ?? arma!.damageType ?? undefined) : undefined);
      if (r.hit) notificarResultadoAtaque(u.id, t.id, arma!, r, metadadosAtaque, 'omni', tipoDeclarado ?? null);
      if (!r.hit) {
        notificarResultadoAtaque(u.id, t.id, arma!, r, metadadosAtaque, 'omni', tipoDeclarado ?? null);
        const msg = `⚔️ ${u.name} usa ${cfg.nome} (${pago}) em ${t.name}: ${cabecalho}.`;
        log(msg);
        detalhes.push(msg);
        continue;
      }
      // TR após acerto: o dano do golpe entra sempre; condições/efeitos só se o alvo falhar.
      if (cfg.tr_apos_acerto) {
        const resTR = await rolarTRAlvo();
        grauTR = resTR.grau;
        const ramo = cfg.desfechosTR?.[grauTR];
        desfechoTR = ramo ? { ...ramo, dano: undefined } : undefined;
        efeitosTR = ramo?.efeitos ?? (grauTR === 'sucesso' ? [] : cfg.efeitos ?? []);
        cabecalho += ` · ${resTR.texto}`;
      }
    }

    if (cfg.tipo_efeito === 'cura') {
      const r = avaliarFormulaAtiva(cfg.cura || '0', u, t, arma);
      if (r.diagnosticos.length || !Number.isFinite(r.valor)) {
        const msg = `⛔ ${cfg.nome}: fórmula de recuperação inválida para ${t.name}.`;
        log(msg); detalhes.push(msg); continue;
      }
      const valor = Math.max(0, Math.floor(r.valor));
      const atual = useCharacterStore.getState().characters.find(c => c.id === t.id)!;
      const recurso = cfg.recurso_cura ?? 'pv';
      const antes = recurso === 'pv' ? atual.hpCurrent : atual.peCurrent;
      if (recurso === 'pv') useCharacterStore.getState().applyHealing(t.id, valor, 'other', u.id);
      else useCharacterStore.getState().updateCharacter(t.id, { peCurrent: Math.max(atual.peCurrent, Math.min(atual.peMax, atual.peCurrent + valor)) });
      const depois = useCharacterStore.getState().characters.find(c => c.id === t.id)!;
      const recuperado = Math.max(0, (recurso === 'pv' ? depois.hpCurrent : depois.peCurrent) - antes);
      curaTotal += recuperado;
      efeitoAplicado ||= recuperado > 0;
      const notas = aplicarEfeitos(u, depois, cfg.efeitos ?? [], fonte, movimentos.planos.get(t.id), sustentadas, arma, ent?.id, opcoes.instanciaId);
      efeitoAplicado ||= notas.length > 0;
      const dados = r.rolagens.map(d => `${d.notacao} [${d.rolls.join(', ')}] = ${d.total}`).join('; ');
      const msg = `✨ ${u.name} usa ${cfg.nome} (${pago}) em ${t.name}: recupera ${recuperado} ${recurso.toUpperCase()} (valor ${valor}${dados ? '; ' + dados : ''})${notas.length ? ' · ' + notas.join(' · ') : ''}.`;
      log(msg); detalhes.push(msg);
      continue;
    }

    if (cfg.teste === 'disputa') {
      const periciaUsuario = cfg.pericia_usuario!;
      const periciaAlvo = melhorPericiaDaDisputa(t, cfg.pericias_alvo!)!;
      const advU = consumeAdvantageFor(u.id, { kind: 'skill', name: periciaUsuario });
      const flatU = consumeFlatBonusFor(u.id, { kind: 'skill', name: periciaUsuario });
      const advT = consumeAdvantageFor(t.id, { kind: 'skill', name: periciaAlvo.nome });
      const flatT = consumeFlatBonusFor(t.id, { kind: 'skill', name: periciaAlvo.nome });
      const rollU = await applyAdvantageToD20(advU.net, () => rollD20Com(u.id, undefined, { label: `Disputa ${periciaUsuario}` }));
      const rollT = await applyAdvantageToD20(advT.net, () => rollD20Com(t.id, undefined, { label: `Disputa ${periciaAlvo.nome}` }));
      const totalU = rollU.d20 + modificadorPericiaAtiva(u, periciaUsuario)! + flatU.bonus;
      const totalT = rollT.d20 + periciaAlvo.bonus + flatT.bonus;
      const venceu = usuarioVenceDisputa(totalU, totalT);
      aplicaEfeitos = venceu;
      cabecalho = `disputa ${periciaUsuario} ${rollU.d20}+${totalU - rollU.d20}=${totalU} vs ${periciaAlvo.nome} ${rollT.d20}+${totalT - rollT.d20}=${totalT} → ${venceu ? 'VENCEU' : totalU === totalT ? 'EMPATE (alvo vence)' : 'PERDEU'}`;
      if (!venceu) {
        const msg = `⚔️ ${u.name} usa ${cfg.nome} (${pago}) em ${t.name}: ${cabecalho}.`;
        log(msg); detalhes.push(msg); continue;
      }
    }

    // ── Dano ──
    const extraIntensificacao = planejarDano(undefined, notacaoDanoAtivo(cfg.tipo_efeito === 'buff' ? undefined : cfg.custo_recursos?.dano_por_intensificacao, u, t, arma), p.intensificacoes, false);
    const danoConfigurado = (cfg.tipo_efeito === 'buff' ? [] : [cfg.dano, ...mods.danos, ...extraIntensificacao.grupos.map(g => `${g.count}d${g.sides}`), extraIntensificacao.fixo ? String(extraIntensificacao.fixo) : '', desfechoTR?.dano_extra])
      .filter(Boolean).map(d => danoComContextoArma(d, arma, u)).filter((d): d is string => !!d).join('+');
    const plano = planejarDano(notacaoDanoAtivo(danoConfigurado, u, t, arma), notacaoDanoAtivo(cfg.tipo_efeito === 'buff' ? undefined : cfg.dadosPorCarga, u, t, arma), cargas, critico, (arma?.critMultiplier ?? 2) + mods.multiplicador);
    const formulasComArma = [cfg.dano, ...mods.danos, desfechoTR?.dano_extra].filter(Boolean).join('+');
    const armaJaNaFormula = /@ARMA\.DANO/i.test(formulasComArma);
    const danoArmaAplicado = armaJaNaFormula ? 0 : armaDano;
    const tipoHerdado = danoArmaAplicado > 0 || /@ARMA\./i.test(formulasComArma);
    const modoDanoTR = desfechoTR?.dano ?? (passouTR ? cfg.metadeNoSucesso ? 'metade' : 'nenhum' : 'total');
    const danoSuprimido = cfg.tipo_efeito === 'buff' || cfg.teste === 'tr' && modoDanoTR === 'nenhum';
    let bruto = danoSuprimido ? 0 : danoArmaAplicado + plano.fixo;
    let dadosTxt = '';
    if (!danoSuprimido && plano.grupos.length) {
      if (desfechoTR?.dano_maximizado) {
        bruto += plano.grupos.reduce((soma, g) => soma + g.count * g.sides, 0);
        dadosTxt = plano.grupos.map(g => `${g.count}d${g.sides}[max]`).join('+');
      } else {
        const r = await rollDiceGroups(plano.grupos, { label: cfg.nome });
        bruto += r.total;
        dadosTxt = r.groups.map((g) => `${g.count}d${g.sides}[${g.rolls.join(',')}]`).join('+');
      }
    }
    const dano = cfg.tipo_efeito === 'buff' ? 0 : cfg.teste === 'tr' && grauTR ? danoDoGrauTR(bruto, grauTR, desfechoTR, !!cfg.metadeNoSucesso) : bruto;
    if (dano > 0) {
      const tipoArma: Partial<Record<NonNullable<Weapon['damageType']>, DamageType>> = { Ct: 'DCO', Pf: 'DP', Im: 'DI' };
      const tipoExtra = resolverTipoDano(cfg.tipoDano) ?? (tipoHerdado ? resolverTipoDano(arma?.omniDamageType) : undefined) ?? (tipoHerdado && arma?.damageType ? tipoArma[arma.damageType] : undefined);
      const tipoBaseArma = resolverTipoDano(arma?.omniDamageType) ?? (arma?.damageType ? tipoArma[arma.damageType] : undefined);
      const parcelas = [
        ...(danoArmaAplicado > 0 ? [{ valor: Math.min(dano, danoArmaAplicado), tipo: tipoBaseArma }] : []),
        ...(dano - Math.min(dano, danoArmaAplicado) > 0 ? [{ valor: dano - Math.min(dano, danoArmaAplicado), tipo: tipoExtra }] : []),
      ];
      const tiposParcela = new Set(parcelas.map((p) => p.tipo));
      const tipoOcorrencia = tiposParcela.size === 1 ? parcelas[0]?.tipo : undefined;
      useCharacterStore.getState().applyDamage(t.id, dano, tipoOcorrencia, {
        attackerId: u.id, source: 'omni', attack: metadadosAtaque,
        isMelee: metadadosAtaque ? metadadosAtaque.kind === 'melee' : undefined,
        parcelas,
      });
    }
    efeitoAplicado ||= aplicaEfeitos;
    const fatorRaw = desfechoTR?.multiplicador_duracao ?? 1;
    const fatorDuracao = Number.isFinite(fatorRaw) && fatorRaw > 0 ? fatorRaw : 1;
    const efeitosAplicados = efeitosTR.map(ef => 'rodadas' in ef && fatorDuracao > 1 && ef.rodadas > 0 ? { ...ef, rodadas: Math.ceil(ef.rodadas * fatorDuracao) } : ef);
    const inicioPlanos = grauTR && indicesDesfecho[grauTR] !== undefined ? indicesDesfecho[grauTR]! : 0;
    const todosPlanos = movimentos.planos.get(t.id) ?? [];
    const planosResultado = efeitosAplicados.map((_, i) => { const plano = todosPlanos.find(p => p.indice === inicioPlanos + i); return plano ? { ...plano, indice: i } : undefined; }).filter((p): p is PlanoMovimentoAtivo => !!p);
    const notas = aplicaEfeitos ? aplicarEfeitos(u, t, efeitosAplicados, fonte, planosResultado, sustentadas, arma, ent?.id, opcoes.instanciaId) : [];
    const partes = [
      cabecalho,
      mods.ativos.length ? `${mods.ativos.length} bloco(s) condicional(is) ativo(s)` : '',
      `dano ${dano}${danoArmaAplicado ? ` (arma ${danoArmaAplicado}` + (dadosTxt ? ` + ${dadosTxt}` : '') + ')' : dadosTxt ? ` (${dadosTxt})` : ''}${grauTR ? ` — ${grauTR}` : passouTR && cfg.metadeNoSucesso ? ' — metade' : ''}`,
      ...notas,
    ].filter(Boolean);
    const msg = `⚔️ ${u.name} usa ${cfg.nome} (${pago}) em ${t.name}: ${partes.join(' · ')}.`;
    log(msg);
    danoTotal += dano;
    detalhes.push(msg);
  }
  if (sustentadas?.length) {
    const atual = useCharacterStore.getState().characters.find(c => c.id === usuarioId);
    if (atual) useCharacterStore.getState().updateCharacter(usuarioId, { omniSustentacoes: [...(atual.omniSustentacoes ?? []), { id: crypto.randomUUID(), nome: cfg.nome, pePorTurno: p.pePorTurno, condicoes: sustentadas }] });
  }
  return { ok: true, dano: danoTotal, cura: curaTotal, efeitoAplicado, detalhe: detalhes.join("\n") };
}

/** Ações ativas disponíveis ao personagem (itens do inventário dele). */
export function acoesAtivasDe(charId: string): { instanceId: string; ent: EntidadeOmni; cfg: AcaoAtivaConfig }[] {
  const out: { instanceId: string; ent: EntidadeOmni; cfg: AcaoAtivaConfig }[] = [];
  const char = useCharacterStore.getState().characters.find(c => c.id === charId);
  for (const i of Object.values(useInventoryStore.getState().items)) {
    if (i.ownerId !== charId) continue;
    const ent = useOmniEntidadesStore.getState().entidades[i.entity.id] ?? i.entity;
    if (ent.categoria === 'arma' && (!char || !armaEstaEmpunhada(char, ent.replica ? i.replicaArma ?? '' : ent.nome) || ent.replica && !i.materializada)) continue;
    for (const cfg of ent.acoesAtivas ?? []) out.push({ instanceId: i.instanceId, ent, cfg });
  }
  return out;
}

export function novaAcaoAtiva(): AcaoAtivaConfig {
  return {
    id: crypto.randomUUID(), nome: 'Nova ação', acao: 'comum', custoPE: '0', alcanceM: 0,
    teste: 'nenhum', metadeNoSucesso: true, efeitos: [],
  };
}
