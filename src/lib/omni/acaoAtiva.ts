import { armaDoPersonagem, armaEstaEmpunhada } from './armaDoPersonagem';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { planejarCustosAtivos, validarRecursosAtivos, patchCustosAtivos, consumirUsosItemAtivo, type ContextoCustosAtivos } from './custosAtivos';
import { prepararMovimentosAtivos, aplicarMovimentoAtivo, type PlanoMovimentoAtivo, type OpcoesMovimentoAtivo } from './movimentosAtivos';
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
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { selectOmniModifiers } from '@/lib/omni/omniBridge';
import { ALL_CONDITIONS, type ActiveCondition } from '@/types/conditions';
import { findCharEntity, touchDistanceMeters, type TouchGrid } from '@/lib/touchRange';
import { penalidadeTRFlanqueado } from '@/lib/flanqueadorSuperior';
import { specDCFor } from '@/lib/golpeEspecial';
import { rollD20Com, rollDiceGroups } from '@/lib/dice';
import { findWeaponByName, resolveWeaponDamage, type Weapon } from '@/lib/weapons';
import { buildAttackContext, rollAttack } from '@/lib/combatEngine';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { replicaWeaponName } from '@/lib/replicas';
import { getSkillModFromConditions } from '@/lib/conditionEffects';

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
  const attr = skill.linkedAttribute ? char.attributes.find(a => a.id === skill.linkedAttribute) : undefined;
  const modAtributo = attr ? Math.floor((attr.value - 10) / 2) : 0;
  const skillKey = skill.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
  return (skill.value || 0) + modAtributo + getTrainingBonus(char.level, skill.trained, skill.mastery)
    + getLevelSkillBonus(char.level) + (skill.externalBonus || 0) + getSkillModFromConditions(char, skill.name)
    + ((char.omniSkillBonuses ?? {})[skillKey] ?? 0);
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

function danoArmaBase(arma?: Weapon) {
  if (!arma) return undefined;
  const dano = resolveWeaponDamage(arma) ?? undefined;
  const dados = [...(dano ?? '').matchAll(/(\d*)d(\d+)/gi)];
  return {
    ...(dano ? { dano } : {}),
    dados: dados.reduce((n, m) => n + Number(m[1] || 1), 0),
    passo: dados.reduce((n, m) => Math.max(n, Number(m[2])), 0),
    critico_margem: arma.critRange ?? 0,
  };
}

function vars(u: Character, a?: Character, arma?: Weapon) {
  const contexto = danoArmaBase(arma);
  return {
    ...montarVariaveisDoPersonagem(u, 'USUARIO'),
    ...(a ? montarVariaveisDoPersonagem(a, 'ALVO') : {}),
    ...(contexto ? { ARMA_DADOS: contexto.dados, ARMA_PASSO: contexto.passo, ARMA_CRITICO_MARGEM: contexto.critico_margem } : {}),
  };
}

function avaliarFormulaAtiva(expressao: string, u: Character, alvo?: Character, arma?: Weapon, rng?: () => number) {
  return avaliarFormula(expressao, vars(u, alvo, arma), rng, { arma: danoArmaBase(arma) });
}

/** Substitui tokens de arma por notação/dados para compor os grupos críticos. */
function danoComContextoArma(expressao: string | undefined, arma?: Weapon): string | undefined {
  if (!expressao) return expressao;
  const contexto = danoArmaBase(arma);
  return expressao
    .replace(/\(?@ARMA\.DADOS\)?d@ARMA\.PASSO/gi, () => `${contexto?.dados ?? 0}d${contexto?.passo ?? 0}`)
    .replace(/@ARMA\.([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*)/gi, (_token, campo: string) => {
      const chave = campo.toLowerCase();
      if (chave === 'dano') return contexto?.dano ?? '0';
      const n = (contexto as Record<string, number | string> | undefined)?.[chave];
      return typeof n === 'number' && Number.isFinite(n) ? String(n) : '0';
    });
}

export function custoPEDe(cfg: AcaoAtivaConfig, u: Character, intensificacoes = 0, arma?: Weapon): number {
  const r = planejarCustosAtivos(cfg, u, intensificacoes);
  return r.ok ? r.plano.pe : Math.max(0, Math.round(avaliarFormulaAtiva(cfg.custo_recursos?.pe_base ?? cfg.custoPE ?? '0', u, undefined, arma).valor));
}

// ─── Validação + execução ────────────────────────────────────────────

export type ResultadoAtiva = { ok: false; reason: string } | { ok: true; dano: number; cura?: number; detalhe: string; efeitoAplicado?: boolean };

export function podeUsarAtiva(u: Character, alvo: Character | undefined, cfg: AcaoAtivaConfig, intensificacoes = 0, arma?: Weapon, contexto?: ContextoCustosAtivos): { ok: true } | { ok: false; reason: string } {
  if (!alvo) return { ok: false, reason: 'Escolha um alvo.' };
  if (cfg.teste === 'disputa') {
    if (!cfg.pericia_usuario?.trim() || !cfg.pericias_alvo?.some(p => p.trim())) return { ok: false, reason: 'Configure a perícia do usuário e ao menos uma perícia possível do alvo.' };
    if (modificadorPericiaAtiva(u, cfg.pericia_usuario) === undefined) return { ok: false, reason: `A perícia "${cfg.pericia_usuario}" não existe na ficha do usuário.` };
    if (!melhorPericiaDaDisputa(alvo, cfg.pericias_alvo)) return { ok: false, reason: 'O alvo não possui nenhuma das perícias configuradas para a disputa.' };
  }
  const efeitos = [...(cfg.efeitos ?? []), ...Object.values(cfg.desfechosTR ?? {}).flatMap(d => d?.efeitos ?? [])];
  for (const ef of efeitos) {
    if (ef.tipo === 'pv_temporarios' || ef.tipo === 'escudo') {
      const r = avaliarFormulaAtiva(ef.valor, u, alvo, arma, () => 0.5);
      if (!ef.valor.trim() || r.diagnosticos.length || !Number.isFinite(r.valor) || !Number.isInteger(ef.rodadas) || ef.rodadas < 0) return { ok: false, reason: 'Proteção exige fórmula válida e duração inteira não negativa.' };
    }
    if (ef.tipo === 'remover_condicao' && ef.condicao !== 'todas' && !ALL_CONDITIONS.some(c => c.id === ef.condicao || c.name.toLocaleLowerCase() === ef.condicao.toLocaleLowerCase())) return { ok: false, reason: 'Condição a remover não reconhecida.' };
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
    const a = findCharEntity(ms.entities as never, u.id), b = findCharEntity(ms.entities as never, alvo.id);
    if (a && b) {
      const d = touchDistanceMeters(a, b, ms.gridConfig as TouchGrid);
      if (d > cfg.alcanceM + 0.05) return { ok: false, reason: `Fora de alcance (${d.toFixed(1).replace('.', ',')} m de ${cfg.alcanceM.toString().replace('.', ',')} m).` };
    }
  }
  return { ok: true };
}

function aplicarEfeitos(u: Character, alvo: Character, efeitos: EfeitoSecundarioAtivo[], fonte: string, planos: PlanoMovimentoAtivo[] = [], sustentadas?: { charId: string; id: string }[], arma?: Weapon): string[] {
  const notas: string[] = [];
  const store = useCharacterStore.getState();
  for (const [indice, ef] of efeitos.entries()) {
    if (ef.tipo === 'condicao') {
      const def = ALL_CONDITIONS.find((c) => c.id === ef.condicao);
      if (!def) continue;
      const ac: ActiveCondition = {
        id: crypto.randomUUID(), conditionId: def.id, name: def.name, icon: def.icon,
        remainingTurns: -1, remainingRounds: sustentadas ? -1 : ef.rodadas > 0 ? ef.rodadas : -1, sourceCharName: fonte,
      };
      store.addCondition(alvo.id, ac);
      if (sustentadas && useCharacterStore.getState().characters.find(c => c.id === alvo.id)?.activeConditions.some(c => c.id === ac.id)) sustentadas.push({ charId: alvo.id, id: ac.id });
      notas.push(`${def.icon} ${def.name}${sustentadas ? ' (sustentada)' : ef.rodadas > 0 ? ` (${ef.rodadas} rod.)` : ''}`);
    } else if (ef.tipo === 'remover_condicao') {
      const def = ALL_CONDITIONS.find(c => c.id === ef.condicao || c.name.toLocaleLowerCase() === ef.condicao.toLocaleLowerCase());
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
export function armaDaAcao(u: Character, ent?: EntidadeOmni) {
  const nome = (ent?.categoria === 'arma' && !ent.replica ? ent.nome : ent && replicaWeaponName(ent)) || u.mainHandWeaponName || '';
  return nome ? armaDoPersonagem(u.id, nome) : undefined;
}

export async function executarAcaoAtiva(
  usuarioId: string,
  cfg: AcaoAtivaConfig,
  selecao: SelecaoAtiva,
  ent?: EntidadeOmni,
  opcoes: OpcoesMovimentoAtivo & { intensificacoes?: number; ignorarReacoes?: boolean; instanciaId?: string } = {},
): Promise<ResultadoAtiva> {
  const escolhidos = await selecionarAlvosAtivos(usuarioId, cfg, selecao);
  if (!escolhidos.ok) return escolhidos;
  let store = useCharacterStore.getState();
  const log = (m: string) => useLogStore.getState().addLog('combat', m);
  let u = store.characters.find((x) => x.id === usuarioId);
  if (!u) return { ok: false, reason: 'Personagem não encontrado.' };
  const arma = armaDaAcao(u, ent);
  const contextoCustos: ContextoCustosAtivos = { armaNome: arma?.name, instanciaId: opcoes.instanciaId, entidadeId: ent?.id };
  let alvos = escolhidos.ids.map(id => store.characters.find(c => c.id === id)!);
  for (const alvo of alvos) {
    const chk = podeUsarAtiva(u, alvo, cfg, opcoes.intensificacoes ?? 0, arma, contextoCustos);
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
  for (const alvo of alvos) { const chk = podeUsarAtiva(u, alvo, cfg, opcoes.intensificacoes ?? 0, arma, contextoCustos); if (!chk.ok) return chk; }

  if (!opcoes.ignorarReacoes && ent?.categoria === 'feitico') {
    const { abrirJanelaReacaoAtiva } = await import('./reacoesAtivas');
    const janela = await abrirJanelaReacaoAtiva({ gatilho: 'quando_inimigo_conjurar', origemId: usuarioId });
    if (janela.cancelado) return { ok: false, reason: 'Conjuração interrompida.' };
    store = useCharacterStore.getState();
    u = store.characters.find(c => c.id === usuarioId);
    if (!u || (u.hpCurrent ?? 1) <= 0) return { ok: false, reason: 'Conjurador indisponível.' };
    for (const alvo of alvos) { const chk = podeUsarAtiva(u, store.characters.find(c => c.id === alvo.id), cfg, opcoes.intensificacoes ?? 0, arma, contextoCustos); if (!chk.ok) return chk; }
  }
  // Snapshot por alvo antes do consumo: cargas e PV são os da declaração.
  const condicionais = new Map(alvos.map(t => [t.id, {
    mods: avaliarCondicionaisAtivos(cfg.condicionais ?? [], u, t),
    critLegado: cfg.margemCritico?.condicao && avaliarFormulaAtiva(cfg.margemCritico.condicao, u, t, arma).valor ? cfg.margemCritico.reducao : 0,
  }]));

  // ── Paga tudo antes de rolar ──
  const custos = planejarCustosAtivos(cfg, u, opcoes.intensificacoes ?? 0, contextoCustos);
  if (!custos.ok) return custos;
  const p = custos.plano;
  if (!consumirUsosItemAtivo(p)) return { ok: false, reason: 'Os usos do item mudaram antes de a ação ser concluída.' };
  const cargas = p.cargas;
  store.updateCharacter(u.id, patchCustosAtivos(u, p));
  const fonte = ent?.nome ?? cfg.nome;
  const pago = `${p.pe} PE${p.pv ? ` + ${p.pv} PV` : ''}${cargas ? ` + ${cargas} carga(s) de ${p.contador}` : ''}${p.municao ? ` + ${p.municao} munição(ões)` : ''}${p.usosItem ? ` + ${p.usosItem} uso(s) do item` : ''}${p.intensificacoes ? ` · intensificação ${p.intensificacoes}` : ''}`;
  const sustentadas = p.pePorTurno > 0 ? [] as { charId: string; id: string }[] : undefined;
  const extraIntensificacao = planejarDano(undefined, cfg.custo_recursos?.dano_por_intensificacao, p.intensificacoes, false);

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

    if (cfg.teste === 'tr') {
      const tr = cfg.tr ?? 'fortitude';
      const cd = cfg.cd?.trim() ? Math.round(avaliarFormulaAtiva(cfg.cd, u, t, arma).valor) : specDCFor(u);
      const adv = consumeAdvantageFor(t.id, { kind: 'save', name: TR_ROTULO[tr] }, { disadvantage: mods.desvantagemTR });
      const flat = consumeFlatBonusFor(t.id, { kind: 'save', name: TR_ROTULO[tr] });
      const mod = modTR(t, tr) + mods.tr + flat.bonus;
      const rolled = await applyAdvantageToD20(adv.net, () => rollD20Com(t.id, undefined, { label: `TR ${TR_ROTULO[tr]}` }));
      const d20 = rolled.d20;
      const totalTR = d20 + mod;
      passouTR = totalTR >= cd;
      grauTR = classificarGrauTR(d20, totalTR, cd);
      const ramo = cfg.desfechosTR?.[grauTR];
      desfechoTR = ramo;
      efeitosTR = ramo?.efeitos ?? (grauTR === 'sucesso' ? [] : cfg.efeitos ?? []);
      if (grauTR === 'sucesso' && ramo?.dano === undefined && ramo?.dano_extra === undefined && !ramo?.dano_maximizado && !ramo?.efeitos?.length) efeitosTR = [];
      if (grauTR !== 'sucesso' && ramo?.efeitos === undefined && (cfg.efeitos?.length ?? 0) > 0) efeitosTR = cfg.efeitos!;
      aplicaEfeitos = grauTR !== 'sucesso' || efeitosTR.length > 0 || !!ramo?.dano_extra || !!ramo?.dano_maximizado || !!ramo?.dano && ramo.dano !== 'nenhum';
      const grauLabel = grauTR === 'falha_critica' ? 'FALHA CRÍTICA' : grauTR.toUpperCase();
      cabecalho = `TR ${TR_ROTULO[tr]}${rolled.modeLabel} d20 ${d20}${mod >= 0 ? '+' : ''}${mod} = ${totalTR} vs CD ${cd} → ${grauLabel}`;
    } else if (cfg.teste === 'ataque') {
      const def = computeTotalDefense(t, {}, arma!.range === 'melee' ? 'melee' : 'ranged');
      const ctx = buildAttackContext({
        attacker: u, weapon: arma!, targetDefense: def, targetId: t.id, alcanceM: cfg.alcanceM, ignorarReacoes: opcoes.ignorarReacoes,
        situation: { hitBonusExtra: cfg.mod_acerto, critBonusExtra: critExtra || undefined, advantageExtra: mods.vantagemAcerto, critMultiplierExtra: mods.multiplicador },
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
      cabecalho = `ataque ${r.attackTotal} vs Defesa ${def} → ${r.critical ? 'CRÍTICO' : r.hit ? 'ACERTOU' : 'ERROU'}${critExtra ? ` (margem −${critExtra})` : ''}`;
      if (r.cancelled) { log(`⛔ ${cfg.nome}: ataque interrompido.`); continue; }
      if (!r.hit) {
        const msg = `⚔️ ${u.name} usa ${cfg.nome} (${pago}) em ${t.name}: ${cabecalho}.`;
        log(msg);
        detalhes.push(msg);
        continue;
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
      if (recurso === 'pv') useCharacterStore.getState().applyHealing(t.id, valor, 'other');
      else useCharacterStore.getState().updateCharacter(t.id, { peCurrent: Math.max(atual.peCurrent, Math.min(atual.peMax, atual.peCurrent + valor)) });
      const depois = useCharacterStore.getState().characters.find(c => c.id === t.id)!;
      const recuperado = Math.max(0, (recurso === 'pv' ? depois.hpCurrent : depois.peCurrent) - antes);
      curaTotal += recuperado;
      efeitoAplicado ||= recuperado > 0;
      const notas = aplicarEfeitos(u, depois, cfg.efeitos ?? [], fonte, movimentos.planos.get(t.id), sustentadas, arma);
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
    const danoConfigurado = [cfg.dano, ...mods.danos, ...extraIntensificacao.grupos.map(g => `${g.count}d${g.sides}`), extraIntensificacao.fixo ? String(extraIntensificacao.fixo) : '', desfechoTR?.dano_extra]
      .filter(Boolean).map(d => danoComContextoArma(d, arma)).filter((d): d is string => !!d).join('+');
    const plano = planejarDano(danoConfigurado, danoComContextoArma(cfg.dadosPorCarga, arma), cargas, critico, 2 + mods.multiplicador);
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
      useCharacterStore.getState().applyDamage(t.id, dano, resolverTipoDano(cfg.tipoDano) ?? (tipoHerdado && arma?.damageType ? tipoArma[arma.damageType] : undefined), {
        attackerId: u.id, source: 'omni', attack: metadadosAtaque,
        isMelee: metadadosAtaque ? metadadosAtaque.kind === 'melee' : undefined,
      });
    }
    efeitoAplicado ||= aplicaEfeitos;
    const fatorRaw = desfechoTR?.multiplicador_duracao ?? 1;
    const fatorDuracao = Number.isFinite(fatorRaw) && fatorRaw > 0 ? fatorRaw : 1;
    const efeitosAplicados = efeitosTR.map(ef => 'rodadas' in ef && fatorDuracao > 1 && ef.rodadas > 0 ? { ...ef, rodadas: Math.ceil(ef.rodadas * fatorDuracao) } : ef);
    const inicioPlanos = grauTR && indicesDesfecho[grauTR] !== undefined ? indicesDesfecho[grauTR]! : 0;
    const todosPlanos = movimentos.planos.get(t.id) ?? [];
    const planosResultado = efeitosAplicados.map((_, i) => { const plano = todosPlanos.find(p => p.indice === inicioPlanos + i); return plano ? { ...plano, indice: i } : undefined; }).filter((p): p is PlanoMovimentoAtivo => !!p);
    const notas = aplicaEfeitos ? aplicarEfeitos(u, t, efeitosAplicados, fonte, planosResultado, sustentadas, arma) : [];
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
    if (ent.categoria === 'arma' && (!char || !armaEstaEmpunhada(char, ent.nome) || ent.replica && !i.materializada)) continue;
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
