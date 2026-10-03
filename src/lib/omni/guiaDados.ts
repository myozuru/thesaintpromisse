import {
  ACOES_EFEITO,
  DICIONARIO_CHAVES_OMNI,
  GATILHOS_EVENTOS,
  ROTULOS_GATILHOS,
  type ChaveOmniOpcao,
} from './constantesDoSistema';
import { ALIASES_POR_EVENTO } from './gatilhoAliases';
import { LEGACY_TO_CANONICAL } from './keyAliases';

export type CategoriaGuiaId = 'recursos' | 'combate' | 'pericias' | 'magia';
export type EscopoGuia = 'USUARIO' | 'ALVO' | 'NENHUM';

export interface ChaveGuia {
  id: string;
  label: string;
  descricao: string;
  aliases: string[];
  escopos: EscopoGuia[];
  grupos: string[];
  categoria: CategoriaGuiaId;
}

const ALIASES_EXPLICITOS: Record<string, string[]> = {
  for: ['forca'],
  des: ['destreza'],
  con: ['constituicao'],
  int: ['inteligencia'],
  sab: ['sabedoria'],
  pre: ['presenca', 'car', 'carisma'],
  vida: ['vida_atual', 'hp', 'pv'],
  vida_max: ['hp_max', 'pv_max'],
  pe: ['energia', 'energia_atual', 'pe_atual'],
  pe_max: ['energia_max'],
  pe_pct: ['energia_pct'],
  sorte: ['sorte_atual'],
  dado_vida: ['dado_vida_atual'],
  reserva_pe: ['reserva_pe_atual'],
  vida_pct_abaixo_50: ['bloodied'],
  vida_pct_abaixo_25: ['criticamente_ferido'],
  treino: ['treinamento', 'bonus_treinamento', 'bonusdetreinamento'],
  exaustao: ['exaustao_nivel', 'nivel_exaustao'],
  fome: ['fome_nivel'],
  ataques_restantes: ['acao_restante', 'acoes_restantes'],
  desloc: ['deslocamento'],
  morrendo: ['esta_morrendo'],
  empolgacao: ['empolgacao_nivel'],
  rodada: ['rodadas_em_combate'],
  'CENA.turno_indice': ['CENA.turno_de'],
  visao_escuridao: ['na_escuridao'],
  visao_penumbra: ['na_penumbra'],
  qtd_inimigos_adjacentes: ['qtd_inimigos_engajados'],
  dano_recebido_nesta_rodada: ['vida_perdida_nesta_rodada'],
  cobertura_total: ['imune_por_cobertura'],
  'DANO.tem_atacante': ['DANO.id_origem'],
  'DANO.tem_alvo': ['DANO.id_alvo'],
  condicao_rodadas_desde: ['condicao_idade_rodadas'],
  condicao_tem_idade: ['condicao_idade_conhecida'],
  condicao_rodadas_restantes: ['condicao_rodadas'],
  origem: ['origem_id'],
  especializacao: ['especializacao_id'],
  tem_buff: ['tem_buff'],
  duas_armas: ['dual_wield'],
  defesa_duas_armas: ['dual_wield_def'],
  bonus_movimento: ['movimento_bonus_metros'],
  bonus_tr_defesa_reduzida: ['tr_vs_debuff_defesa_bonus'],
  reducao_dano_alma: ['rd_alma'],
  concentracao_maxima: ['max_concentracao'],
  sustentados_maximos: ['max_sustentados'],
  bonus_slots_liberacao: ['slots_liberacao_bonus'],
  aura_bonus_defesa: ['aura_ca_bonus'],
  aura_reducao_dano_fisico: ['aura_rd_fisica'],
  aura_bonus_furtividade: ['aura_furtividade_bonus'],
  aura_bonus_agarrar: ['aura_agarrar_bonus'],
  arma_principal_corpo_a_corpo: ['arma_principal_eh_cac'],
  arma_principal_a_distancia: ['arma_principal_eh_distancia'],
  arma_margem_critico: ['arma_principal_crit_range'],
  qtd_feiticos_tipo: ['qtd_feiticos_elemento'],
  bonus_ataque_magia: ['spell_attack_bonus'],
  tem_tecnica: ['tecnica_amaldicoada_definida'],
  qtd_fundamentos: ['qtd_fundamentos_tecnica'],
  qtd_habilidades_especializacao: ['qtd_habilidades_spec'],
  pe_sustentacao_por_rodada: ['pe_por_rodada_sustentado'],
  indice_turno_atual: ['turno_atual_index'],
  turnos_ate_meu_turno: ['turnos_ate_meu'],
  sou_proximo_no_turno: ['proximo_no_turno'],
  sou_ultimo_no_turno: ['ultimo_no_turno'],
  duracao_turno_segundos: ['turno_duracao_seg'],
  segundos_restantes_turno: ['turno_segundos_restantes'],
  qtd_flags: ['qtd_flags_omni'],
  qtd_contadores: ['qtd_contadores_omni'],
  reacao_usada: ['reacao_usada_nesta_rodada'],
  reacoes_usadas: ['reacoes_usadas_nesta_rodada'],
  metros_movidos: ['metros_movidos_neste_turno'],
};

const ALIAS_PARA_CANONICA = new Map<string, string>();
for (const [canonica, aliases] of Object.entries(ALIASES_EXPLICITOS)) {
  ALIAS_PARA_CANONICA.set(canonica.toLowerCase(), canonica);
  for (const alias of aliases) ALIAS_PARA_CANONICA.set(alias.toLowerCase(), canonica);
}
for (const [alias, canonica] of Object.entries(LEGACY_TO_CANONICAL)) {
  if (!ALIAS_PARA_CANONICA.has(alias.toLowerCase())) {
    ALIAS_PARA_CANONICA.set(alias.toLowerCase(), canonica);
  }
}

function canonizarId(id: string): string {
  const semArroba = id.replace(/^@/, '');
  const exact = ALIAS_PARA_CANONICA.get(semArroba.toLowerCase());
  if (exact) return exact;
  const short = semArroba.replace(/^(USUARIO|ALVO)\./i, '');
  const direct = ALIAS_PARA_CANONICA.get(short.toLowerCase());
  if (direct) return direct;
  const dynamic: Array<[RegExp, string]> = [
    [/^condicao_idade_rodadas_(.+)$/i, 'condicao_rodadas_desde_$1'],
    [/^condicao_idade_conhecida_(.+)$/i, 'condicao_tem_idade_$1'],
    [/^condicao_rodadas_(.+)$/i, 'condicao_rodadas_restantes_$1'],
    [/^origem_id_(.+)$/i, 'origem_$1'],
    [/^especializacao_id_(.+)$/i, 'especializacao_$1'],
    [/^qtd_feiticos_elemento_(.+)$/i, 'qtd_feiticos_tipo_$1'],
  ];
  for (const [pattern, replacement] of dynamic) {
    if (pattern.test(short)) return short.replace(pattern, replacement);
  }
  return short;
}

function categoriaDoGrupo(grupo: string): CategoriaGuiaId {
  if (/per[ií]cias|resist[eê]ncia/i.test(grupo)) return 'pericias';
  if (/magia|t[eé]cnicas|aura|concentra[cç][aã]o|sustentados|contador|meta|narrativa|flags/i.test(grupo)) return 'magia';
  if (/atributos|recursos|pools|sobreviv[eê]ncia|progress[aã]o|cura|economia|invent[aá]rio/i.test(grupo)) return 'recursos';
  return 'combate';
}

const catalogo = DICIONARIO_CHAVES_OMNI.flatMap((categoria) =>
  categoria.itens.map((item) => ({ categoria, item })),
);

function criarChavesGuia(): ChaveGuia[] {
  const cards = new Map<string, ChaveGuia>();
  for (const { categoria: grupo, item } of catalogo) {
    const id = canonizarId(item.id);
    const atual = cards.get(id);
    const escopos = grupo.escopos.filter((s) => s !== 'NENHUM') as Exclude<EscopoGuia, 'NENHUM'>[];
    if (atual) {
      atual.grupos = [...new Set([...atual.grupos, grupo.grupo])];
      atual.escopos = [...new Set([...atual.escopos, ...escopos])];
      if (item.id !== id && !atual.aliases.includes(item.id)) atual.aliases.push(item.id);
      continue;
    }
    cards.set(id, {
      id,
      label: id === item.id ? item.label : item.label || id,
      descricao: item.hint ?? item.label,
      aliases: item.id === id ? [] : [item.id],
      escopos: escopos.length ? [...new Set(escopos)] : ['NENHUM'],
      grupos: [grupo.grupo],
      categoria: categoriaDoGrupo(grupo.grupo),
    });
  }

  for (const [id, aliases] of Object.entries(ALIASES_EXPLICITOS)) {
    const card = cards.get(id);
    if (!card) continue;
    for (const alias of aliases) if (!card.aliases.includes(alias)) card.aliases.push(alias);
  }
  for (const [alias, id] of Object.entries(LEGACY_TO_CANONICAL)) {
    const card = cards.get(id);
    if (!card || alias.includes('.')) continue;
    if (alias !== id && !card.aliases.includes(alias)) card.aliases.push(alias);
  }
  const aliasesDeTemplate: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^condicao_rodadas_desde_(.+)$/i, (m) => 'condicao_idade_rodadas_' + m[1]],
    [/^condicao_tem_idade_(.+)$/i, (m) => 'condicao_idade_conhecida_' + m[1]],
    [/^condicao_rodadas_restantes_(.+)$/i, (m) => 'condicao_rodadas_' + m[1]],
    [/^origem_(.+)$/i, (m) => 'origem_id_' + m[1]],
    [/^especializacao_(.+)$/i, (m) => 'especializacao_id_' + m[1]],
    [/^qtd_feiticos_tipo_(.+)$/i, (m) => 'qtd_feiticos_elemento_' + m[1]],
  ];
  for (const card of cards.values()) {
    for (const [pattern, format] of aliasesDeTemplate) {
      const match = card.id.match(pattern);
      if (match) {
        const alias = format(match);
        if (!card.aliases.includes(alias)) card.aliases.push(alias);
      }
    }
  }

  return [...cards.values()].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.id.localeCompare(b.id));
}

export const CHAVES_GUIA_OMNI = criarChavesGuia();
export const GATILHOS_GUIA_OMNI = Object.values(GATILHOS_EVENTOS).map((id) => ({
  id,
  rotulo: ROTULOS_GATILHOS[id],
  aliases: ALIASES_POR_EVENTO[id],
  exemplo: `@${ALIASES_POR_EVENTO[id][0]} -> `,
}));
export const ACOES_GUIA_OMNI = Object.entries(ACOES_EFEITO).map(([id, acao]) => ({
  id,
  label: acao.ui,
  comando: acao.math,
}));

export function escoposDaChaveGuia(chave: ChaveGuia): EscopoGuia[] {
  return chave.escopos.includes('NENHUM') ? ['NENHUM'] : chave.escopos;
}

export function referenciaDaChaveGuia(chave: ChaveGuia, escopo: EscopoGuia): string {
  return escopo === 'NENHUM' ? `@${chave.id}` : `@${escopo}.${chave.id}`;
}

export function referenciaDoAliasGuia(chave: ChaveGuia, alias: string, escopo: EscopoGuia): string {
  if (alias.startsWith('@')) return alias;
  if (/^(USUARIO|ALVO|CENA|DANO|ITEM)\./i.test(alias)) return `@${alias}`;
  if (escopo === 'NENHUM') return `@${alias}`;
  return `@${escopo}.${alias}`;
}

export function coberturaCatalogoGuia() {
  const total = catalogo.length;
  const agrupadas = new Set(CHAVES_GUIA_OMNI.flatMap((chave) => [chave.id, ...chave.aliases].map((x) => x.toLowerCase())));
  const faltantes = catalogo.map(({ item }) => item.id).filter((id) => {
    const canonica = canonizarId(id).toLowerCase();
    return !agrupadas.has(canonica) && !agrupadas.has(id.toLowerCase());
  });
  return { total, cards: CHAVES_GUIA_OMNI.length, faltantes };
}

export const CONTAGEM_ACOES_GUIA_OMNI = ACOES_GUIA_OMNI.length;
export const CONTAGEM_GATILHOS_GUIA_OMNI = GATILHOS_GUIA_OMNI.length;
