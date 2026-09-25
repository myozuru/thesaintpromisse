/**
 * 🎯 Aliases pt-BR para gatilhos de eventos do Omni.
 *
 * Fonte ÚNICA da verdade que conecta o que o Mestre escreve no terminal
 * (`@fim_turno -> …`) com o `GatilhoId` canônico emitido pelo eventBus
 * (`noFimDoTurno`).
 *
 * Usado em três lugares:
 *  - `omniScript.ts` — serialização: ao reabrir um efeito, mostra o alias
 *    amigável em vez do id técnico.
 *  - `triggerEfeitos.ts` — disparo: casa o alias salvo em `eff.trigger`
 *    com o evento real do bus.
 *  - `dicionarioAutocomplete.ts` — terminal sugere `@fim_turno ->` etc.
 */
import type { GatilhoId } from './constantesDoSistema';
import { GATILHOS_EVENTOS, ROTULOS_GATILHOS } from './constantesDoSistema';

/**
 * Mapa GatilhoId → lista de aliases aceitos. O **primeiro** alias é o
 * "preferido" (usado na serialização). Todos são case-insensitive.
 */
export const ALIASES_POR_EVENTO: Record<GatilhoId, string[]> = {
  aoEquipar:                ['equipar',         'passivo',           'ao_equipar',           'aoequipar'],
  noInicioDoTurno:          ['inicio_turno',    'no_inicio_turno',   'no_inicio_do_turno',   'noiniciodoturno', 'ao_iniciar_turno', 'aoiniciarturno'],
  noFimDoTurno:             ['fim_turno',       'no_fim_turno',      'no_fim_do_turno',      'nofimdoturno', 'ao_terminar_turno', 'aoterminarturno'],
  aoAcertarAtaque:          ['acertar',         'ao_acertar',        'ao_acertar_ataque',    'aoacertarataque'],
  aoErrarAtaque:            ['errar',           'ao_errar',          'ao_errar_ataque',      'aoerrarataque'],
  aoSofrerDano:             ['sofrer_dano',     'ao_sofrer_dano',    'ao_receber_dano',      'ao_levar_dano',  'aosofrerdano'],
  aoCausarDano:             ['causar_dano',     'ao_causar_dano',    'ao_atacar',            'ao_dar_dano',    'aocausardano'],
  aoConjurarFeitico:        ['conjurar',        'ao_conjurar',       'ao_conjurar_feitico',  'aoconjurarfeitico'],
  aoMover:                  ['mover',           'ao_mover',          'aomover'],
  aoEntrarEmAura:           ['entrar_aura',     'ao_entrar_aura',    'ao_entrar_em_aura',    'aoentraremaura'],
  aoSairDaAura:             ['sair_aura',       'ao_sair_aura',      'ao_sair_da_aura',      'aosairdaaura'],
  aoAvancarRelogio:         ['tempo',           'relogio',           'ao_avancar_relogio',   'passagem_tempo', 'aoavancarrelogio'],
  aoCurar:                  ['curar',           'ao_curar',          'aocurar'],
  aoReceberCura:            ['receber_cura',    'ao_receber_cura',   'aorecebercura'],
  aoMorrer:                 ['morrer',          'ao_morrer',         'aomorrer'],
  aoAplicarCondicao:        ['aplicar_condicao','ao_aplicar_condicao','aoaplicarcondicao'],
  aoReceberCondicao:        ['receber_condicao','ao_receber_condicao','aorecebercondicao'],
  aoUsarTalento:            ['usar_talento',    'ao_usar_talento',   'aousartalento'],
  aoAtivarAptidao:          ['ativar_aptidao',  'ao_ativar_aptidao', 'aoativaraptidao'],
  aoAtivarHabilidadeSpec:   ['ativar_spec',     'ao_ativar_spec',    'ao_ativar_habilidade_spec'],
  aoIniciarRodadaCombate:   ['inicio_rodada',   'rodada',            'ao_iniciar_rodada',    'ao_iniciar_rodada_combate', 'aoiniciarrodadacombate'],
  aoFinalizarRodadaCombate: ['fim_rodada',      'fim_de_rodada',     'no_fim_da_rodada',     'ao_finalizar_rodada',       'ao_finalizar_rodada_combate', 'aofinalizarrodadacombate'],
  aoIniciarCombate:         ['inicio_combate',  'ao_iniciar_combate','comeco_combate',       'ao_entrar_em_combate',      'entrar_combate',              'aoiniciarcombate'],
  aoFinalizarCombate:       ['fim_combate',     'ao_finalizar_combate','ao_sair_do_combate', 'sair_combate',              'ao_terminar_combate',         'aofinalizarcombate'],
  aoDescansar:              ['descansar',       'ao_descansar',      'aodescansar'],
  aoVendar:                 ['vendar',          'ao_vendar',         'aovendar'],
  aoDescobrir:              ['descobrir',       'ao_descobrir',      'aodescobrir'],
  aoAtualizarContador:      ['atualizar_contador','ao_atualizar_contador','aoatualizarcontador'],
};

/** Reverse lookup: alias minúsculo → GatilhoId canônico. */
const REVERSO: Record<string, GatilhoId> = (() => {
  const m: Record<string, GatilhoId> = {};
  for (const [evento, aliases] of Object.entries(ALIASES_POR_EVENTO) as Array<[GatilhoId, string[]]>) {
    // O próprio id canônico também é um "alias" válido.
    m[evento.toLowerCase()] = evento;
    for (const a of aliases) m[a.toLowerCase()] = evento;
  }
  return m;
})();

/**
 * Resolve qualquer alias (ou id técnico) para o `GatilhoId` canônico.
 * Retorna `undefined` se não reconhecer (ex.: trigger custom legado).
 */
export function resolverGatilho(alias?: string): GatilhoId | undefined {
  if (!alias) return undefined;
  const k = alias.trim().toLowerCase().replace(/^@/, '');
  return REVERSO[k];
}

/** Verifica se um trigger salvo (qualquer forma) casa com o evento atual. */
export function gatilhoCasa(eventoAtual: GatilhoId, triggerSalvo?: string): boolean {
  const r = resolverGatilho(triggerSalvo);
  return r === eventoAtual;
}

/** Alias preferido (curto, pt-BR) para serialização. */
export function aliasPreferido(evento: GatilhoId): string {
  return ALIASES_POR_EVENTO[evento]?.[0] ?? evento;
}

/** Lista de pares { alias, evento, rotulo } para autocomplete. */
export function listarAliasesParaAutocomplete(): Array<{ alias: string; evento: GatilhoId; rotulo: string }> {
  const out: Array<{ alias: string; evento: GatilhoId; rotulo: string }> = [];
  for (const evento of Object.values(GATILHOS_EVENTOS) as GatilhoId[]) {
    out.push({
      alias: aliasPreferido(evento),
      evento,
      rotulo: ROTULOS_GATILHOS[evento],
    });
  }
  return out;
}
