/**
 * Migração legado → Omni-Engine.
 *
 * Converte `Item` (useItemStore) e `Spell` (Character.spells) em `EntidadeOmni`.
 * Mapeamento "razoável" — não 100% fiel: o objetivo é dar um ponto de partida
 * editável no construtor visual em vez de exigir recadastro do zero.
 */
import type { Item, Spell } from '@/types';
import type {
  AcaoLogica,
  BlocoLogico,
  CustoEntidade,
  EntidadeOmni,
  GatilhoEntidade,
} from './tipos';
import type { GatilhoId } from './constantesDoSistema';

const novoId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));

function bloco(acoes: AcaoLogica[]): BlocoLogico {
  return { id: novoId(), condicoes: [], modo: 'todas', acoes };
}

function gatilho(evento: GatilhoId, acoes: AcaoLogica[]): GatilhoEntidade {
  return { id: novoId(), evento, blocos: acoes.length ? [bloco(acoes)] : [] };
}

// =============================================================================
// ITEM → ENTIDADE
// =============================================================================
export function itemParaEntidade(item: Item): EntidadeOmni {
  const now = Date.now();
  const acoesPassivas: AcaoLogica[] = [];

  if (item.bonusHP) {
    acoesPassivas.push({
      id: novoId(),
      acao: 'SOMAR',
      alvoAplicacao: 'USUARIO',
      caminhoAlvo: 'status.vida.atual',
      valor: { tipo: 'fixo', valor: item.bonusHP },
    });
  }
  if (item.bonusPE) {
    acoesPassivas.push({
      id: novoId(),
      acao: 'SOMAR',
      alvoAplicacao: 'USUARIO',
      caminhoAlvo: 'status.energiaAmaldicoada.atual',
      valor: { tipo: 'fixo', valor: item.bonusPE },
    });
  }
  if (item.bonusESC) {
    acoesPassivas.push({
      id: novoId(),
      acao: 'SOMAR',
      alvoAplicacao: 'USUARIO',
      caminhoAlvo: 'status.deslocamento',
      valor: { tipo: 'fixo', valor: item.bonusESC },
    });
  }
  if (item.bonusCA) {
    acoesPassivas.push({
      id: novoId(),
      acao: 'SOMAR',
      alvoAplicacao: 'USUARIO',
      caminhoAlvo: 'status.defesa',
      valor: { tipo: 'fixo', valor: item.bonusCA },
    });
  }

  // Consumível (comida/poção): efeito ao "ativar" (mapeado em aoEquipar).
  const acoesConsumo: AcaoLogica[] = [];
  if (item.hpRestore) {
    acoesConsumo.push({
      id: novoId(),
      acao: 'CURAR',
      alvoAplicacao: 'USUARIO',
      valor: { tipo: 'fixo', valor: item.hpRestore },
    });
  }
  if (item.peRestore) {
    acoesConsumo.push({
      id: novoId(),
      acao: 'SOMAR',
      alvoAplicacao: 'USUARIO',
      caminhoAlvo: 'status.energiaAmaldicoada.atual',
      valor: { tipo: 'fixo', valor: item.peRestore },
    });
  }

  const passivos = [...acoesPassivas, ...acoesConsumo];
  const gatilhos: GatilhoEntidade[] = [gatilho('aoEquipar', passivos)];

  return {
    id: novoId(),
    versao: 1,
    nome: item.name || 'Item sem nome',
    categoria: 'item',
    descricao: item.description ?? '',
    tags: ['migrado', item.category, item.slotType].filter(Boolean) as string[],
    duracao: item.isFood
      ? { tipo: 'instantaneo' }
      : { tipo: 'permanente' },
    custos: [],
    gatilhos,
    criadoEm: now,
    atualizadoEm: now,
  };
}

// =============================================================================
// SPELL → ENTIDADE
// =============================================================================
export function feiticoParaEntidade(spell: Spell): EntidadeOmni {
  const now = Date.now();
  const acoes: AcaoLogica[] = [];

  // Dano direto.
  if (spell.spellType === 'damage' && spell.damageDice) {
    const expr =
      spell.damageBonus && spell.damageBonus !== 0
        ? `${spell.damageDice} + ${spell.damageBonus}`
        : spell.damageDice;
    acoes.push({
      id: novoId(),
      acao: 'DANO',
      alvoAplicacao: 'ALVO',
      valor: { tipo: 'formula', expressao: expr },
    });
  }

  // Cura.
  if (spell.spellType === 'heal' && spell.damageDice) {
    const expr =
      spell.damageBonus && spell.damageBonus !== 0
        ? `${spell.damageDice} + ${spell.damageBonus}`
        : spell.damageDice;
    acoes.push({
      id: novoId(),
      acao: 'CURAR',
      alvoAplicacao: 'ALVO',
      valor: { tipo: 'formula', expressao: expr },
    });
  }

  // Buffs → SOMAR aproximado em caminhos do sistema.
  for (const b of spell.buffs ?? []) {
    const caminho = mapearBuffParaCaminho(b.type);
    if (!caminho) continue;
    acoes.push({
      id: novoId(),
      acao: 'SOMAR',
      alvoAplicacao: 'ALVO',
      caminhoAlvo: caminho,
      valor: { tipo: 'fixo', valor: b.value },
    });
  }

  // Condições aplicadas.
  for (const c of spell.conditions ?? []) {
    const condId = (c as unknown as { conditionId?: string; id?: string }).conditionId
      ?? (c as unknown as { conditionId?: string; id?: string }).id;
    if (!condId) continue;
    acoes.push({
      id: novoId(),
      acao: 'APLICAR_CONDICAO',
      alvoAplicacao: 'ALVO',
      condicao: condId as never,
      valor: { tipo: 'fixo', valor: spell.durationRounds || 1 },
    });
  }

  const custos: CustoEntidade[] = spell.costPE
    ? [{
        caminhoRecurso: 'status.energiaAmaldicoada.atual',
        valor: { tipo: 'fixo', valor: spell.costPE },
      }]
    : [];

  return {
    id: novoId(),
    versao: 1,
    nome: spell.name || 'Feitiço sem nome',
    categoria: 'feitico',
    descricao: spell.description ?? '',
    tags: ['migrado', spell.spellType, spell.actionType].filter(Boolean) as string[],
    duracao:
      spell.durationRounds > 0
        ? { tipo: 'rodadas', valor: { tipo: 'fixo', valor: spell.durationRounds } }
        : { tipo: 'instantaneo' },
    custos,
    alcance: { tipo: 'fixo', valor: parseAlcance(spell.range) },
    gatilhos: [gatilho('aoConjurarFeitico', acoes)],
    criadoEm: now,
    atualizadoEm: now,
  };
}

function mapearBuffParaCaminho(tipo: string): string | undefined {
  switch (tipo) {
    case 'ca': return 'status.defesa';
    case 'movement': return 'status.deslocamento';
    case 'rd': return 'status.defesa';
    // Buffs específicos de combate (hit/dc/extraDice/etc.) não têm caminho
    // direto no Omni — ficam fora da migração automática.
    default: return undefined;
  }
}

function parseAlcance(range: string): number {
  if (!range || /toque/i.test(range)) return 0;
  const m = range.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
