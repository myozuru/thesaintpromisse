import { CHAVES_MITIGACAO } from './chavesMitigacao';
/**
 * Dicionário de Chaves Universais do Omni-Engine (Pilar 2).
 *
 * TODO o construtor visual deve ser alimentado iterando sobre estas constantes,
 * e o parser resolve os caminhos em runtime contra o personagem / cena.
 *
 * Nomenclatura pt-BR para facilitar manutenção do Mestre.
 */

// 1. Atributos base ---------------------------------------------------------
// Os 6 atributos canônicos da ficha.
// Nota: Astúcia e Vontade NÃO são atributos — são Testes de Resistência (ver SISTEMA_TR).
export const SISTEMA_ATRIBUTOS = {
  FOR: 'atributos.forca',
  DES: 'atributos.destreza',
  CON: 'atributos.constituicao',
  INT: 'atributos.inteligencia',
  SAB: 'atributos.sabedoria',
  PRE: 'atributos.presenca',
} as const;

export type ChaveAtributo = keyof typeof SISTEMA_ATRIBUTOS;

export const ROTULOS_ATRIBUTOS: Record<ChaveAtributo, string> = {
  FOR: 'Força',
  DES: 'Destreza',
  CON: 'Constituição',
  INT: 'Inteligência',
  SAB: 'Sabedoria',
  PRE: 'Presença',
};

// 2. Recursos / Status ------------------------------------------------------
export const SISTEMA_RECURSOS = {
  VIDA_MAX: 'status.vida.max',
  VIDA_ATUAL: 'status.vida.atual',
  ENERGIA_MAX: 'status.energiaAmaldicoada.max',
  ENERGIA_ATUAL: 'status.energiaAmaldicoada.atual',
  DESLOCAMENTO: 'status.deslocamento',
  DEFESA: 'status.defesa',
  BONUS_TREINAMENTO: 'status.bonusTreinamento',
  NIVEL_EXAUSTAO: 'status.nivelExaustao', // 0..6
  NIVEL: 'status.nivel',
  // Métricas de Combate (Pilar de Dano) -----------------------------------
  ACERTO: 'stats.modificadorAtaque',
  CRIT_MARGEM: 'stats.margemCritico',
  CRIT_MULT: 'stats.multiplicadorCritico',
  ESQUIVA: 'stats.esquiva',
  RESISTENCIA_CURSE: 'stats.resistenciaAmaldicoada',
} as const;

export type ChaveRecurso = keyof typeof SISTEMA_RECURSOS;

export const ROTULOS_RECURSOS: Record<ChaveRecurso, string> = {
  VIDA_MAX: 'Vida Máxima',
  VIDA_ATUAL: 'Vida Atual',
  ENERGIA_MAX: 'Energia Amaldiçoada Máx.',
  ENERGIA_ATUAL: 'Energia Amaldiçoada Atual',
  DESLOCAMENTO: 'Deslocamento',
  DEFESA: 'Defesa',
  BONUS_TREINAMENTO: 'Bônus de Treinamento',
  NIVEL_EXAUSTAO: 'Nível de Exaustão',
  NIVEL: 'Nível',
  ACERTO: 'Modificador de Ataque',
  CRIT_MARGEM: 'Margem de Crítico',
  CRIT_MULT: 'Multiplicador de Crítico',
  ESQUIVA: 'Esquiva',
  RESISTENCIA_CURSE: 'Resistência Amaldiçoada',
};

/** Alias inglês para a matriz de Métricas de Combate (Pilar de Dano). */
export const COMBAT_METRICS = {
  ACERTO: SISTEMA_RECURSOS.ACERTO,
  CRIT_MARGEM: SISTEMA_RECURSOS.CRIT_MARGEM,
  CRIT_MULT: SISTEMA_RECURSOS.CRIT_MULT,
  ESQUIVA: SISTEMA_RECURSOS.ESQUIVA,
  RESISTENCIA_CURSE: SISTEMA_RECURSOS.RESISTENCIA_CURSE,
} as const;

// 3. Perícias ---------------------------------------------------------------
/**
 * Lista canônica de perícias da ficha (sincronizada com `defaults.ts`).
 * Cada chave técnica segue o padrão `pericia_<nome_normalizado>` e é
 * exposta no parser via `@USUARIO.pericia_<x>` / `@ALVO.pericia_<x>`.
 */
export const SISTEMA_PERICIAS = {
  ATLETISMO:        'pericias.atletismo',
  ACROBACIA:        'pericias.acrobacia',
  FURTIVIDADE:      'pericias.furtividade',
  PRESTIDIGITACAO:  'pericias.prestidigitacao',
  FEITICARIA:       'pericias.feiticaria',
  HISTORIA:         'pericias.historia',
  INVESTIGACAO:     'pericias.investigacao',
  OFICIO1:          'pericias.oficio1',
  OFICIO2:          'pericias.oficio2',
  OFICIO3:          'pericias.oficio3',
  TECNOLOGIA:       'pericias.tecnologia',
  TEOLOGIA:         'pericias.teologia',
  DIRECAO:          'pericias.direcao',
  INTUICAO:         'pericias.intuicao',
  MEDICINA:         'pericias.medicina',
  OCULTISMO:        'pericias.ocultismo',
  PERCEPCAO:        'pericias.percepcao',
  SOBREVIVENCIA:    'pericias.sobrevivencia',
  ENGANACAO:        'pericias.enganacao',
  INTIMIDACAO:      'pericias.intimidacao',
  PERFORMANCE:      'pericias.performance',
  PERSUASAO:        'pericias.persuasao',
} as const;

export type ChavePericia = keyof typeof SISTEMA_PERICIAS;

export const ROTULOS_PERICIAS: Record<ChavePericia, string> = {
  ATLETISMO:       'Atletismo',
  ACROBACIA:       'Acrobacia',
  FURTIVIDADE:     'Furtividade',
  PRESTIDIGITACAO: 'Prestidigitação',
  FEITICARIA:      'Feitiçaria',
  HISTORIA:        'História',
  INVESTIGACAO:    'Investigação',
  OFICIO1:         'Ofício 1',
  OFICIO2:         'Ofício 2',
  OFICIO3:         'Ofício 3',
  TECNOLOGIA:      'Tecnologia',
  TEOLOGIA:        'Teologia',
  DIRECAO:         'Direção',
  INTUICAO:        'Intuição',
  MEDICINA:        'Medicina',
  OCULTISMO:       'Ocultismo',
  PERCEPCAO:       'Percepção',
  SOBREVIVENCIA:   'Sobrevivência',
  ENGANACAO:       'Enganação',
  INTIMIDACAO:     'Intimidação',
  PERFORMANCE:     'Performance',
  PERSUASAO:       'Persuasão',
};

/** Ordem oficial para uso em UIs (mesma da ficha). */
export const ORDEM_PERICIAS: ChavePericia[] = [
  'ATLETISMO','ACROBACIA','FURTIVIDADE','PRESTIDIGITACAO',
  'FEITICARIA','HISTORIA','INVESTIGACAO',
  'OFICIO1','OFICIO2','OFICIO3','TECNOLOGIA','TEOLOGIA',
  'DIRECAO','INTUICAO','MEDICINA','OCULTISMO','PERCEPCAO','SOBREVIVENCIA',
  'ENGANACAO','INTIMIDACAO','PERFORMANCE','PERSUASAO',
];

// ── 3b. Testes de Resistência (TR) ─────────────────────────────────────────
/**
 * Os 5 Testes de Resistência canônicos do sistema. Chaves simplificadas —
 * expostas no parser via `@USUARIO.<nome>` / `@ALVO.<nome>` (ex:
 * `@USUARIO.fortitude`, `@ALVO.integridade`).
 */
export const SISTEMA_TR = {
  ASTUCIA:     'astucia',
  FORTITUDE:   'fortitude',
  INTEGRIDADE: 'integridade',
  REFLEXOS:    'reflexos',
  VONTADE:     'vontade',
} as const;

export type ChaveTR = keyof typeof SISTEMA_TR;

export const ROTULOS_TR: Record<ChaveTR, string> = {
  ASTUCIA:     'TR — Astúcia',
  FORTITUDE:   'TR — Fortitude',
  INTEGRIDADE: 'TR — Integridade',
  REFLEXOS:    'TR — Reflexos',
  VONTADE:     'TR — Vontade',
};

/** Ordem oficial para uso em UIs (mesma da ficha). */
export const ORDEM_TR: ChaveTR[] = ['ASTUCIA', 'FORTITUDE', 'INTEGRIDADE', 'REFLEXOS', 'VONTADE'];

// 4. Matriz de Condições (Status) ------------------------------------------
export const DICIONARIO_CONDICOES = [
  'desprevenido',
  'exposto',
  'condenado',
  'desorientado',
  'enjoado',
  'amedrontado',
  'agarrado',
  'enfeiticado',
  'inconsciente',
  'morto',
  'sangrando',
  'envenenado',
  'queimando',
  'paralisado',
  'atordoado',
  'cego',
  'surdo',
  'invisivel',
  'engasgando',
  'sangramento',
  'sofrendo',
  'indefeso',
  'abalado',
  'aterrorizado',
  'confuso',
  'caido',
  'enredado',
  'imovel',
  'lento',
  'surpreso',
  'fragilizado',
  'marcado',
  'desmaiado',
] as const;

export type CondicaoId = (typeof DICIONARIO_CONDICOES)[number];

// 5. Gatilhos de Eventos e Tempo -------------------------------------------
export const GATILHOS_EVENTOS = {
  PASSIVO: 'aoEquipar',
  INICIO_TURNO: 'noInicioDoTurno',
  FIM_TURNO: 'noFimDoTurno',
  AO_ACERTAR: 'aoAcertarAtaque',
  AO_ERRAR: 'aoErrarAtaque',
  AO_SOFRER_DANO: 'aoSofrerDano',
  AO_CAUSAR_DANO: 'aoCausarDano',
  AO_CONJURAR: 'aoConjurarFeitico',
  AO_MOVER: 'aoMover',
  AO_ENTRAR_AURA: 'aoEntrarEmAura',
  AO_SAIR_AURA: 'aoSairDaAura',
  PASSAGEM_TEMPO: 'aoAvancarRelogio',
  AO_CURAR: 'aoCurar',
  AO_RECEBER_CURA: 'aoReceberCura',
  AO_MORRER: 'aoMorrer',
  AO_APLICAR_CONDICAO: 'aoAplicarCondicao',
  AO_RECEBER_CONDICAO: 'aoReceberCondicao',
  AO_USAR_TALENTO: 'aoUsarTalento',
  AO_ATIVAR_APTIDAO: 'aoAtivarAptidao',
  AO_ATIVAR_HABILIDADE_SPEC: 'aoAtivarHabilidadeSpec',
  // Novos (Seis Olhos) — emitidos pelo combat store / rest pipeline / slot Venda.
  AO_INICIAR_RODADA_COMBATE: 'aoIniciarRodadaCombate',
  AO_FINALIZAR_RODADA_COMBATE: 'aoFinalizarRodadaCombate',
  AO_INICIAR_COMBATE: 'aoIniciarCombate',
  AO_FINALIZAR_COMBATE: 'aoFinalizarCombate',
  AO_DESCANSAR: 'aoDescansar',
  AO_VENDAR: 'aoVendar',
  AO_DESCOBRIR: 'aoDescobrir',
  AO_ATUALIZAR_CONTADOR: 'aoAtualizarContador',
  // Observação espacial — toda ficha observa; filtre com @CENA.distancia.
  AO_ALIADO_SOFRER_DANO: 'aoAliadoSofrerDano',
  AO_INIMIGO_SOFRER_DANO: 'aoInimigoSofrerDano',
  AO_ALIADO_CAUSAR_DANO: 'aoAliadoCausarDano',
  AO_INIMIGO_CAUSAR_DANO: 'aoInimigoCausarDano',
  AO_ALIADO_MORRER: 'aoAliadoMorrer',
  AO_INIMIGO_MORRER: 'aoInimigoMorrer',
} as const;

export type GatilhoId = (typeof GATILHOS_EVENTOS)[keyof typeof GATILHOS_EVENTOS];

export const ROTULOS_GATILHOS: Record<GatilhoId, string> = {
  aoEquipar: 'Passivo (ao equipar)',
  noInicioDoTurno: 'No início do turno',
  noFimDoTurno: 'No fim do turno',
  aoAcertarAtaque: 'Ao acertar ataque',
  aoErrarAtaque: 'Ao errar ataque',
  aoSofrerDano: 'Ao sofrer dano',
  aoCausarDano: 'Ao causar dano',
  aoConjurarFeitico: 'Ao conjurar feitiço',
  aoMover: 'Ao se mover',
  aoEntrarEmAura: 'Ao entrar em aura',
  aoSairDaAura: 'Ao sair da aura',
  aoAvancarRelogio: 'Ao avançar o relógio',
  aoCurar: 'Ao curar (origem)',
  aoReceberCura: 'Ao receber cura (alvo)',
  aoMorrer: 'Ao morrer (HP ≤ 0)',
  aoAplicarCondicao: 'Ao aplicar condição (origem)',
  aoReceberCondicao: 'Ao receber condição (alvo)',
  aoUsarTalento: 'Ao usar talento',
  aoAtivarAptidao: 'Ao ativar aptidão',
  aoAtivarHabilidadeSpec: 'Ao ativar habilidade de especialização',
  aoIniciarRodadaCombate: 'Ao iniciar rodada (em combate)',
  aoFinalizarRodadaCombate: 'Ao finalizar rodada (em combate)',
  aoIniciarCombate: 'Ao iniciar combate',
  aoFinalizarCombate: 'Ao finalizar combate',
  aoDescansar: 'Ao descansar (curto/longo)',
  aoVendar: 'Ao vendar (slot Venda equipado)',
  aoDescobrir: 'Ao descobrir (slot Venda removido)',
  aoAtualizarContador: 'Ao atualizar contador',
  aoAliadoSofrerDano: 'Quando um aliado sofrer dano (use @CENA.distancia)',
  aoInimigoSofrerDano: 'Quando um inimigo sofrer dano (use @CENA.distancia)',
  aoAliadoCausarDano: 'Quando um aliado causar dano',
  aoInimigoCausarDano: 'Quando um inimigo causar dano',
  aoAliadoMorrer: 'Quando um aliado cair (PV 0)',
  aoInimigoMorrer: 'Quando um inimigo cair (PV 0)',
};

// 6. Operadores Lógicos Visuais --------------------------------------------
export const OPERADORES_LOGICOS = {
  MAIOR_QUE: { ui: 'For maior que', math: '>' },
  MAIOR_IGUAL: { ui: 'For maior ou igual a', math: '>=' },
  MENOR_QUE: { ui: 'For menor que', math: '<' },
  MENOR_IGUAL: { ui: 'For menor ou igual a', math: '<=' },
  IGUAL: { ui: 'For exatamente', math: '===' },
  DIFERENTE: { ui: 'For diferente de', math: '!==' },
  PORCENTAGEM_ABAIXO: { ui: 'Porcentagem de Vida abaixo de', math: '<%' },
  PORCENTAGEM_ACIMA: { ui: 'Porcentagem de Vida acima de', math: '>%' },
  TEM_CONDICAO: { ui: 'Possui a condição', math: 'has' },
  NAO_TEM_CONDICAO: { ui: 'Não possui a condição', math: '!has' },
} as const;

export type OperadorId = keyof typeof OPERADORES_LOGICOS;

// 7. Efeitos Matemáticos (ações que um bloco pode produzir) ---------------
export const ACOES_EFEITO = {
  SOMAR: { ui: 'Somar', math: '+' },
  SUBTRAIR: { ui: 'Subtrair', math: '-' },
  MULTIPLICAR: { ui: 'Multiplicar', math: '*' },
  DIVIDIR: { ui: 'Dividir', math: '/' },
  DEFINIR: { ui: 'Definir como', math: '=' },
  APLICAR_CONDICAO: { ui: 'Aplicar condição', math: 'applyCondition' },
  REMOVER_CONDICAO: { ui: 'Remover condição', math: 'removeCondition' },
  CURAR: { ui: 'Curar Vida', math: 'heal' },
  DANO: { ui: 'Causar Dano', math: 'damage' },
  REROLL: { ui: 'Forçar Re-rolagem', math: 'reroll' },
  CONSUMIR_RECURSO: { ui: 'Consumir Recurso', math: 'consume' },
  DISPARAR_GATILHO: { ui: 'Disparar Gatilho (macro)', math: 'macro' },
  CONCEDER_TALENTO:        { ui: 'Conceder Talento',           math: 'grantTalent' },
  REMOVER_TALENTO:         { ui: 'Remover Talento',            math: 'removeTalent' },
  RECARREGAR_HABILIDADE:   { ui: 'Recarregar Habilidade Spec', math: 'rechargeAbility' },
  MODIFICAR_USOS_APTIDAO:  { ui: 'Modificar Usos de Aptidão',  math: 'setAptitudeUsage' },
  CONCEDER_VANTAGEM:       { ui: 'Conceder Vantagem',          math: 'grantAdvantage' },
  CONCEDER_DESVANTAGEM:    { ui: 'Conceder Desvantagem',       math: 'grantDisadvantage' },
  LIMPAR_VANT_DESV:        { ui: 'Limpar Vantagem/Desvantagem',math: 'clearAdvantage' },
  CONCEDER_IMUNIDADE:      { ui: 'Conceder Imunidade (condição)', math: 'grantImmunity' },
  REMOVER_IMUNIDADE:       { ui: 'Remover Imunidade (condição)',  math: 'removeImmunity' },
  // ── Flags booleanas/numéricas (estado narrativo/tático) ──────────────
  ATIVAR_FLAG:             { ui: 'Ativar Flag',                  math: 'setFlag' },
  DESATIVAR_FLAG:          { ui: 'Desativar Flag',               math: 'unsetFlag' },
  ALTERNAR_FLAG:           { ui: 'Alternar Flag (toggle)',       math: 'toggleFlag' },
  // ── Contadores nomeados (fadiga, stacks, etc.) ───────────────────────
  INCREMENTAR_CONTADOR:    { ui: 'Incrementar Contador',         math: 'addCounter' },
  ZERAR_CONTADOR:          { ui: 'Zerar Contador',               math: 'resetCounter' },
  DEFINIR_CONTADOR:        { ui: 'Definir Contador',             math: 'setCounter' },
  CONSUMIR_CONTADOR:       { ui: 'Consumir Contador (valor ou tudo) → @CENA.consumido', math: 'consumeCounter' },
  // ── Custo de recurso com piso mínimo ─────────────────────────────────
  REDUZIR_CUSTO:           { ui: 'Reduzir Custo de Recurso',     math: 'reduceCost' },
  LIMPAR_REDUTOR_CUSTO:    { ui: 'Limpar Redutor de Custo',      math: 'clearCostReduction' },
  // ── Redutor de PE de feitiços (atômico + ESCOPO_* compositivos) ──────
  REDUZIR_PE:              { ui: 'Reduzir PE de Feitiço',        math: 'reducePE' },
  ESCOPO_FEITICO:          { ui: 'Escopo: feitiço (filtro base)', math: 'scopeSpell' },
  ESCOPO_NIVEL:            { ui: 'Escopo: nível do feitiço',      math: 'scopeLevel' },
  ESCOPO_TIPO:             { ui: 'Escopo: tipo do feitiço',       math: 'scopeType' },
  ESCOPO_NOME:             { ui: 'Escopo: nome do feitiço',       math: 'scopeName' },
  LIMPAR_REDUTOR_PE:       { ui: 'Limpar Redutor de PE',          math: 'clearPEReduction' },
  // ── Modificador de economia de ação por habilidade nomeada ───────────
  MODIFICAR_CUSTO_ACAO:    { ui: 'Modificar Custo de Ação',      math: 'setActionCost' },
  // ── Exaustão (escada genérica) ───────────────────────────────────────
  ADICIONAR_EXAUSTAO:      { ui: 'Adicionar Nível de Exaustão',  math: 'addExhaustion' },
} as const;

/**
 * Escopos válidos para CONCEDER_IMUNIDADE/REMOVER_IMUNIDADE.
 * Use no campo `caminhoAlvo` no formato `<scope>` ou `<scope>:<target>`.
 *  - `condicao:<id>`     → imune à condição específica (ex.: `condicao:atordoado`)
 *  - `categoria:<NOME>`  → imune a uma categoria inteira (ex.: `categoria:MENTAL`)
 *                          Categorias: FÍSICA, INCAPACITAÇÃO, MENTAL, MOVIMENTO,
 *                          SENSORIAL, VULNERABILIDADE.
 *  - `todas`             → imune a TODAS as condições.
 */
export const ESCOPOS_IMUNIDADE = {
  todas:       'Todas as condições',
  categoria:   'Categoria inteira (ex.: categoria:MENTAL)',
  condicao:    'Condição específica (ex.: condicao:atordoado)',
} as const;
export type EscopoImunidadeId = keyof typeof ESCOPOS_IMUNIDADE;

/**
 * Escopos válidos para CONCEDER_VANTAGEM/DESVANTAGEM.
 * Use no campo `caminhoAlvo` no formato `<scope>` ou `<scope>:<target>`.
 *  - next_*       → consumido na 1ª rolagem aplicável
 *  - attack_*     → vale enquanto efeito ativo (expira no fim do turno)
 *  - *_specific   → exige `:nome` (ex: skill_specific:furtividade)
 */
export const ESCOPOS_VANTAGEM = {
  next_any:           'Próxima rolagem qualquer',
  next_attack:        'Próximo ataque (qualquer)',
  next_save:          'Próximo Teste de Resistência',
  next_skill:         'Próxima Perícia',
  next_attribute:     'Próximo teste de Atributo',
  attack_all:         'Todos os ataques (até fim do turno)',
  attack_melee:       'Ataques Corpo a Corpo (até fim do turno)',
  attack_ranged:      'Ataques à Distância (até fim do turno)',
  attack_cursed:        'Ataques Amaldiçoados (até fim do turno)',
  attack_weapon_group:  'Ataques com grupo de arma (ex.: attack_weapon_group:Machado)',
  attack_weapon_name:   'Ataques com arma específica (ex.: attack_weapon_name:Machado de Batalha)',
  save_specific:        'TR específico (ex.: save_specific:Reflexos)',
  skill_specific:       'Perícia específica (ex.: skill_specific:Furtividade)',
  attribute_specific:   'Atributo específico (ex.: attribute_specific:FOR)',
} as const;
export type EscopoVantagemId = keyof typeof ESCOPOS_VANTAGEM;

export type AcaoEfeitoId = keyof typeof ACOES_EFEITO;

// 8. Alvos válidos (usado no construtor Se/Então) -------------------------
export const ALVOS_REFERENCIA = {
  USUARIO: { ui: 'Usuário', ctx: '@USUARIO' },
  ALVO: { ui: 'Alvo', ctx: '@ALVO' },
  CENA: { ui: 'Cena', ctx: '@CENA' },
} as const;

export type AlvoRefId = keyof typeof ALVOS_REFERENCIA;

// 9. Tipos de Duração -------------------------------------------------------
export const TIPOS_DURACAO = {
  INSTANTANEO: 'instantaneo',
  RODADAS: 'rodadas',
  TURNOS: 'turnos',
  MINUTOS: 'minutos',
  HORAS: 'horas',
  DIAS: 'dias',
  PERMANENTE: 'permanente',
  ATE_DISSIPAR: 'ateDissipar',
} as const;

export type DuracaoTipo = (typeof TIPOS_DURACAO)[keyof typeof TIPOS_DURACAO];

// 9b. Tipos de Dano de Combate ---------------------------------------------
/** Vocabulário legado de tipos Omni; o editor usa os códigos de @/types. */
export const DAMAGE_TYPES = [
  // Físicos
  'Cortante', 'Perfurante', 'Impacto',
  // Elementares
  'Amaldiçoado', 'Fogo', 'Frio', 'Elétrico', 'Ácido',
  // Esotéricos
  'Mental', 'Necrótico', 'Radiante', 'Veneno', 'Força',
  // Especiais
  'Verdadeiro', 'Cura',
] as const;

export type TipoDanoId = (typeof DAMAGE_TYPES)[number];

/** Mantido por compatibilidade — espelho indexado de DAMAGE_TYPES. */
export const SISTEMA_DANOS = Object.freeze(
  Object.fromEntries(DAMAGE_TYPES.map((d) => [d.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '_'), d]))
) as Record<string, TipoDanoId>;

// 9c. Economia de Ações (Action Economy) -----------------------------------
export const SYSTEM_ACTIONS = {
  LIVRE:        { id: 'action_free',      label: 'Ação Livre',        cost: 0 },
  MOVIMENTO:    { id: 'action_move',      label: 'Ação de Movimento', cost: 1 },
  PADRAO:       { id: 'action_standard',  label: 'Ação Padrão',       cost: 1 },
  BONUS:        { id: 'action_bonus',     label: 'Ação Bônus',        cost: 1 },
  REACAO:       { id: 'action_reaction',  label: 'Reação',            cost: 1 },
  COMPLETA:     { id: 'action_full',      label: 'Ação Completa',     cost: 2 },
  INTERROMPER:  { id: 'action_interrupt', label: 'Interrupção',       cost: 1 },
} as const;

export type ActionKey = keyof typeof SYSTEM_ACTIONS;
export type ActionId = (typeof SYSTEM_ACTIONS)[ActionKey]['id'];

// 9d. Tipos de Alcance ------------------------------------------------------
export const RANGE_TYPES = [
  { id: 'self',      label: 'Pessoal' },
  { id: 'touch',     label: 'Toque' },
  { id: 'ranged',    label: 'Distância' },
  { id: 'unlimited', label: 'Ilimitado' },
] as const;

export type RangeTypeId = (typeof RANGE_TYPES)[number]['id'];

// 9e. Formas de Área de Efeito ---------------------------------------------
export const AOE_SHAPES = [
  { id: 'single', label: 'Alvo Único' },
  { id: 'cone',   label: 'Cone' },
  { id: 'line',   label: 'Linha' },
  { id: 'circle', label: 'Círculo (Raio)' },
  { id: 'square', label: 'Quadrado/Cubo' },
  { id: 'aura',   label: 'Aura (Em volta do Usuário)' },
] as const;

export type AoeShapeId = (typeof AOE_SHAPES)[number]['id'];

// 10. Vistas agregadas para a UI (alimenta Smart Dropdowns) ---------------
export interface CaminhoOpcao {
  chave: string; // e.g. "FOR"
  caminho: string; // e.g. "atributos.forca"
  rotulo: string; // e.g. "Força"
  grupo: 'Atributos' | 'Recursos' | 'Perícias';
}

export function listarCaminhosNumericos(): CaminhoOpcao[] {
  const out: CaminhoOpcao[] = [];
  (Object.keys(SISTEMA_ATRIBUTOS) as ChaveAtributo[]).forEach((k) => {
    out.push({ chave: k, caminho: SISTEMA_ATRIBUTOS[k], rotulo: ROTULOS_ATRIBUTOS[k], grupo: 'Atributos' });
  });
  (Object.keys(SISTEMA_RECURSOS) as ChaveRecurso[]).forEach((k) => {
    out.push({ chave: k, caminho: SISTEMA_RECURSOS[k], rotulo: ROTULOS_RECURSOS[k], grupo: 'Recursos' });
  });
  (Object.keys(SISTEMA_PERICIAS) as ChavePericia[]).forEach((k) => {
    out.push({ chave: k, caminho: SISTEMA_PERICIAS[k], rotulo: ROTULOS_PERICIAS[k], grupo: 'Perícias' });
  });
  return out;
}

// 11. Aliases curtos usados em fórmulas (@TREINO, @NIVEL, etc.) ----------
export const ALIASES_FORMULA: Record<string, string> = {
  TREINO: SISTEMA_RECURSOS.BONUS_TREINAMENTO,
  NIVEL: SISTEMA_RECURSOS.NIVEL,
  VIDA: SISTEMA_RECURSOS.VIDA_ATUAL,
  VIDA_MAX: SISTEMA_RECURSOS.VIDA_MAX,
  PE: SISTEMA_RECURSOS.ENERGIA_ATUAL,
  PE_MAX: SISTEMA_RECURSOS.ENERGIA_MAX,
  DEFESA: SISTEMA_RECURSOS.DEFESA,
  FOR: SISTEMA_ATRIBUTOS.FOR,
  DES: SISTEMA_ATRIBUTOS.DES,
  CON: SISTEMA_ATRIBUTOS.CON,
  INT: SISTEMA_ATRIBUTOS.INT,
  SAB: SISTEMA_ATRIBUTOS.SAB,
  PRE: SISTEMA_ATRIBUTOS.PRE,
};

// 12. Dicionário agrupado para os dropdowns de "Inserir @" do construtor. -----
/**
 * Estrutura única para alimentar os Smart Dropdowns do Omni-Helper e do
 * construtor de efeitos. Cada item já vem na forma `ESCOPO.chave` (ex:
 * `USUARIO.vida_max`) ou plana (ex: `RODADA`) — basta o consumidor prefixar
 * com `@` na exibição.
 */
export interface ChaveOmniOpcao {
  /** Identificador a ser inserido na fórmula (sem o `@`). */
  id: string;
  /** Rótulo amigável exibido no dropdown. */
  label: string;
  /** Curta descrição mostrada como hint. */
  hint?: string;
}

export interface CategoriaChavesOmni {
  /** Nome do grupo (Atributos, Recursos, Progressão, Combate, Cena…). */
  grupo: string;
  /** Escopo padrão sugerido — UI usa para gerar duas listas (USUARIO/ALVO). */
  escopos: Array<'USUARIO' | 'ALVO' | 'NENHUM'>;
  itens: ChaveOmniOpcao[];
}

/** Atributos básicos (Core Stats). Disponíveis em USUARIO e ALVO. */
const ATRIBUTOS_OMNI: ChaveOmniOpcao[] = [
  { id: 'forca',         label: 'FOR — Força',          hint: 'Atributo físico bruto' },
  { id: 'destreza',      label: 'DES — Destreza',       hint: 'Agilidade e reflexos' },
  { id: 'constituicao',  label: 'CON — Constituição',   hint: 'Vigor e resistência' },
  { id: 'inteligencia',  label: 'INT — Inteligência',   hint: 'Raciocínio e estudo' },
  { id: 'sabedoria',     label: 'Sabedoria',            hint: 'Alias de SAB.' },
  { id: 'presenca',      label: 'Presença',             hint: 'Alias de PRE.' },
];

/** Flags Omni — estados táticos genéricos no `Character.omniFlags`. */
const FLAGS_OMNI: ChaveOmniOpcao[] = [
  { id: 'bloqueio_total', label: 'Bloqueio Total', hint: 'Quando 1, o próximo dano em Vida Atual é absorvido (e a flag zera).' },
];

/** Variáveis do próprio item Omni. Resolvidas pela instância em uso. */
const ITEM_OMNI: ChaveOmniOpcao[] = [
  { id: 'ITEM.usos_restantes', label: '@ITEM.usos_restantes', hint: 'Cargas restantes desta cópia do item.' },
  { id: 'ITEM.usos_totais',    label: '@ITEM.usos_totais',    hint: 'Total de cargas por ciclo de recarga.' },
];

/** Recursos vitais (Vida e Energia). */
const RECURSOS_OMNI: ChaveOmniOpcao[] = [
  { id: 'vida_atual',    label: 'Vida Atual',           hint: 'Pontos de vida no momento' },
  { id: 'vida_max',      label: 'Vida Máxima',          hint: 'Limite de vida (use para cálculos %)' },
  { id: 'energia',       label: 'Energia Atual',        hint: 'Energia / Mana / Recurso amaldiçoado' },
  { id: 'energia_max',   label: 'Energia Máxima',       hint: 'Limite máximo de energia' },
];

/** Atributos de progressão (escalonamento). */
const PROGRESSAO_OMNI: ChaveOmniOpcao[] = [
  { id: 'treino',            label: 'Bônus de Treinamento', hint: 'Escala com o nível (½ nível)' },
  { id: 'nivel',             label: 'Nível',                hint: 'Nível total do personagem' },
];

/** Defesas e métricas de combate. */
const COMBATE_OMNI: ChaveOmniOpcao[] = [
  { id: 'defesa',        label: 'Defesa (CA)',          hint: 'Classe de armadura passiva' },
  { id: 'esquiva',       label: 'Esquiva',              hint: 'Recurso legado de esquiva; corresponde aos PVTs da ficha.' },
  { id: 'resistencia',   label: 'Resistência (RD)',     hint: 'Redução de dano configurada na ficha, sem bônus contextuais.' },
  { id: 'acerto',        label: 'Acerto',               hint: 'Bônus configurado para acerto personalizado. Ataques CaC, à distância e amaldiçoados têm cálculos próprios.' },
  { id: 'deslocamento',  label: 'Deslocamento',         hint: 'Deslocamento base em metros.' },
];

/** Variáveis sem prefixo (globais à cena ou ao golpe atual). */
const GLOBAIS_OMNI: ChaveOmniOpcao[] = [
  { id: 'DANO',          label: '@DANO',                hint: 'Dano base da arma/habilidade (modificadores)' },
];

/** Variáveis de cena. */
const CENA_OMNI: ChaveOmniOpcao[] = [
  { id: 'CENA.rodada',   label: '@CENA.rodada',         hint: 'Rodada atual do combate' },
  { id: 'CENA.dificuldade',       label: '@CENA.dificuldade',             hint: 'CD definida pelo Mestre.' },
  { id: 'CENA.distancia_m',label: '@CENA.distancia_m',      hint: 'Distância entre usuário e alvo, em metros.' },
  { id: 'CENA.no_mapa',  label: '@CENA.no_mapa',        hint: 'Eventos observados: 1 se ambos têm peça no mapa.' },
  { id: 'CENA.sujeito_aliado', label: '@CENA.sujeito_aliado', hint: '1 se a criatura observada é aliada.' },
  { id: 'CENA.outro_inimigo',  label: '@CENA.outro_inimigo',  hint: '1 se o outro envolvido é inimigo.' },
  { id: 'CENA.outro_aliado',   label: '@CENA.outro_aliado',   hint: '1 se o outro envolvido é aliado.' },
  { id: 'CENA.outro_e_voce',     label: '@CENA.outro_e_voce',     hint: '1 se o outro envolvido é você.' },
  { id: 'CENA.consumido',         label: '@CENA.consumido',         hint: 'Quanto o último CONSUMIR_CONTADOR do bloco gastou (use (@CENA.consumido)d8).' },
  { id: 'CENA.dano',              label: '@CENA.dano',              hint: 'Dano do evento atual.' },
];

/**
 * 🥋 Perícias da ficha — chaves técnicas no formato `pericia_<nome>`
 * já normalizadas para uso direto em fórmulas e no Omni-Target Selector.
 * A ordem espelha a ficha (ORDEM_PERICIAS).
 */
const PERICIAS_OMNI: ChaveOmniOpcao[] = ORDEM_PERICIAS.map((k) => {
  const id = SISTEMA_PERICIAS[k].replace(/^pericias\./, 'pericia_');
  return { id, label: ROTULOS_PERICIAS[k], hint: `Perícia: ${ROTULOS_PERICIAS[k]}` };
});

/**
 * 🛡️ Testes de Resistência — chaves simplificadas (ex: `fortitude`,
 * `integridade`). Espelham a ficha (ORDEM_TR).
 */
const TR_OMNI: ChaveOmniOpcao[] = ORDEM_TR.map((k) => {
  const id = SISTEMA_TR[k];
  return { id, label: ROTULOS_TR[k], hint: `Teste de Resistência: ${ROTULOS_TR[k]}` };
});

// ─── Novas categorias (Recursos & Pools, Combate Avançado, Estado, Cena) ──
const POOLS_OMNI: ChaveOmniOpcao[] = [
  { id: 'vida_temp',       label: 'Vida Temporária',       hint: 'Pontos de vida temporários (consumidos antes da vida).' },
  { id: 'vida_temp_max',   label: 'Vida Temporária (máx)', hint: 'Máximo de PVTs configurado na ficha, sem bônus de equipamento/passivas.' },
  { id: 'vida_temp_pct',   label: 'Vida Temporária (%)', hint: 'PVTs atuais em relação ao máximo configurado; 0 quando o máximo é zero.' },
  { id: 'vida_total',      label: 'Vida + PVTs', hint: 'Soma da vida atual com os pontos de vida temporários atuais.' },
  { id: 'vida_pct',        label: 'Vida (%)',              hint: 'Porcentagem da vida atual em relação ao máximo.' },
  { id: 'energia_pct',     label: 'Energia (%)',           hint: 'Porcentagem da energia atual em relação ao máximo.' },
  { id: 'pe_pct',          label: 'PE (%)',                hint: 'Alias de energia_pct.' },
  { id: 'pe_temp',         label: 'PE Temporário',         hint: 'Energia temporária (consumida antes do PE normal).' },
  { id: 'pe_faltante',     label: 'PE Faltante', hint: 'Quanto falta para alcançar o PE máximo configurado, mínimo 0.' },
  { id: 'pe_faltante_pct', label: 'PE Faltante (%)', hint: 'Percentual que falta para o PE máximo configurado; 0 quando o máximo é zero.' },
  { id: 'sorte',           label: 'Sorte (atual)',         hint: 'Usos atuais de Sorte.' },
  { id: 'sorte_max',       label: 'Sorte (máx)',           hint: 'Usos máximos de Sorte por dia.' },
  { id: 'dado_vida',       label: 'Dado de Vida (atual)',  hint: 'Dados de vida disponíveis no descanso curto.' },
  { id: 'dado_vida_max',   label: 'Dado de Vida (máx)',    hint: 'Total de dados de vida = nível.' },
  { id: 'reserva_pe',      label: 'Reserva de PE',         hint: 'Energia armazenada por Economia de Energia.' },
  { id: 'reserva_pe_disponivel', label: 'Tem Reserva de PE', hint: '1 se há PE armazenado na reserva; 0 se vazia.' },
  { id: 'reserva_pe_recuperavel', label: 'PE Recuperável da Reserva', hint: 'Quanto da reserva cabe no estoque atual até o PE máximo configurado.' },
];

const SOBREVIVENCIA_OMNI: ChaveOmniOpcao[] = [
  { id: 'exaustao',        label: 'Exaustão',              hint: 'Alias de exaustao_nivel.' },
  { id: 'exaustao_nivel',  label: 'Nível de Exaustão',     hint: '0..6 — penalidades cumulativas.' },
  { id: 'fome',            label: 'Fome',                  hint: 'Barras de fome (24 = saciado).' },
];

const COMBATE_AVANCADO_OMNI: ChaveOmniOpcao[] = [
  { id: 'defesa_cac',      label: 'Defesa Corpo-a-Corpo',  hint: 'Defesa contra ataques CaC.' },
  { id: 'defesa_dist',     label: 'Defesa à Distância',    hint: 'Defesa contra ataques à distância.' },
  { id: 'iniciativa',      label: 'Iniciativa',            hint: 'Bônus de iniciativa.' },
  { id: 'atencao',         label: 'Atenção',               hint: 'Atenção passiva (percepção).' },
  { id: 'ataques_no_turno', label: 'Ataques no Turno',     hint: 'Quantos ataques pode fazer.' },
  { id: 'acoes_restantes', label: 'Ações Restantes',       hint: 'Alias de ataques_restantes.' },
  { id: 'acao_bonus',      label: 'Ação Bônus',            hint: 'Ações bônus disponíveis nesta rodada.' },
  { id: 'ado_max',         label: 'ADO Máx (oportunidade)',hint: 'Ataques de oportunidade máximos.' },
  { id: 'ado_restantes',   label: 'ADO Restantes',         hint: 'Ataques de oportunidade que restam.' },
  { id: 'reacao_disponivel',label: 'Reação Disponível',    hint: '1 se ainda tem reação na rodada.' },
  { id: 'movimento_restante',label: 'Movimento Restante',  hint: 'Metros de movimento que restam.' },
];

const ESTADO_OMNI: ChaveOmniOpcao[] = [
  { id: 'tamanho',         label: 'Tamanho',               hint: '1=Pequeno, 2=Médio, 3=Grande.' },
  { id: 'morrendo',        label: 'Está Morrendo',         hint: '1 se em estado de morrendo.' },
  { id: 'morto',           label: 'Morto',                 hint: '1 se morto.' },
  { id: 'inconsciente',    label: 'Inconsciente',          hint: '1 se inconsciente.' },
  { id: 'escudo_equipado', label: 'Escudo Equipado',       hint: '1 se proficiente/usando escudo.' },
  { id: 'categoria',       label: 'Categoria',             hint: '1=PLAYER, 2=NPC, 3=INIMIGO.' },
  { id: 'concentrando',    label: 'Concentrando',          hint: '1 se mantém ao menos uma fonte de concentração ativa.' },
  { id: 'empolgacao',      label: 'Empolgação (Lutador)',  hint: 'Nível de empolgação 1..5.' },
  { id: 'vendado',         label: 'Vendado',               hint: '1 se o slot de Venda está equipado.' },
  { id: 'descoberto',      label: 'Descoberto',            hint: '1 se o slot de Venda está vazio.' },
  { id: 'rodada',          label: 'Rodada (cena)',         hint: 'Rodada atual do combate.' },
  { id: 'rodadas_em_combate', label: 'Rodadas em Combate', hint: 'Alias de rodada.' },
  { id: 'au',              label: 'AU — Aura',             hint: 'Aptidão amaldiçoada AU.' },
  { id: 'cl',              label: 'CL — Clareza',          hint: 'Aptidão amaldiçoada CL.' },
  { id: 'bar',             label: 'BAR — Barreira',        hint: 'Aptidão amaldiçoada BAR.' },
  { id: 'dom',             label: 'DOM — Domínio',         hint: 'Aptidão amaldiçoada DOM.' },
  { id: 'er',              label: 'ER — Expansão',         hint: 'Aptidão amaldiçoada ER.' },
];

const CENA_AVANCADA_OMNI: ChaveOmniOpcao[] = [
  { id: 'CENA.turno_indice', label: '@CENA.turno_indice', hint: 'Índice do turno atual na iniciativa (começa em 0); -1 quando não há turno válido.' },
  { id: 'CENA.rodadas_em_combate', label: '@CENA.rodadas_em_combate', hint: 'Rodada atual enquanto em combate; 0 fora de combate.' },
];

const DANO_CTX_OMNI: ChaveOmniOpcao[] = [

  { id: 'DANO.tipo',               label: '@DANO.tipo',               hint: 'Código do tipo resolvido: DCO=1, DP=2, DI=3, DA=4, DCG=5, DCC=6, DQ=7, DS=8, DAL=9, DNR=10, DE=11, DPS=12, DR=13, DN=14, DV=15. Ausente se desconhecido.' },
  { id: 'DANO.fonte',              label: '@DANO.fonte',              hint: 'Categoria do produtor: 1=arma, 2=feitiço, 3=Omni, 4=ambiente. Não é ID ou nome da ficha. Ausente sem origem informada.' },
  { id: 'DANO.foi_critico',        label: '@DANO.foi_critico',        hint: '1/0 conforme o resultado informado pelo ataque. Ausente quando desconhecido.' },
  { id: 'DANO.foi_falha_critica',  label: '@DANO.foi_falha_critica',  hint: '1/0 conforme o resultado informado pelo ataque. Erros não criam eventos de dano.' },
  // ── PR-1: Contexto de dano expandido ─────────────────────────────────
  { id: 'DANO.valor_inicial',      label: '@DANO.valor_inicial',      hint: 'Dano recebido por applyDamage antes do pre-hook e da mitigação desta resolução.' },
  { id: 'DANO.valor_final',        label: '@DANO.valor_final',        hint: 'Dano resolvido após RD/imunidade/vulnerabilidade, incluindo PVT. Disponível após resolução.' },
  { id: 'DANO.vida_perdida',       label: '@DANO.vida_perdida',       hint: 'PV realmente removidos do alvo após proteções. Zero quando escudo/PVT absorvem todo o golpe.' },
  { id: 'DANO.absorvido',          label: '@DANO.absorvido',          hint: 'max(0, inicial - final). Disponível após resolução; não representa a RD isolada.' },
  { id: 'DANO.tem_atacante',          label: '@DANO.tem_atacante',          hint: '1 se o golpe informa um atacante; 0 caso contrário.' },
  { id: 'DANO.tem_alvo',            label: '@DANO.tem_alvo',            hint: '1 se a ficha do alvo existe; 0 caso contrário.' },
  { id: 'DANO.alcance',            label: '@DANO.alcance',            hint: 'Distância real (m) entre as peças no início da resolução. Ausente sem peças.' },
  { id: 'DANO.foi_ataque_oportunidade', label: '@DANO.foi_ataque_oportunidade', hint: '1/0 conforme a marcação do ataque. No painel, marque Ataque de oportunidade antes de rolar.' },
  { id: 'DANO.foi_furtivo',        label: '@DANO.foi_furtivo',        hint: '1/0 informado pelo ataque; no painel principal, preserva escondidoDe antes de revelar o atacante.' },
  { id: 'DANO.tipo_ataque',        label: '@DANO.tipo_ataque',        hint: '1=CaC, 2=Distância, 3=Amaldiçoado. Classificação explícita; ausente se desconhecida.' },
];

// ── PR-1: Visão / Iluminação (flags lidas de omniFlags) ────────────────
const VISAO_OMNI: ChaveOmniOpcao[] = [
  { id: 'visao_normal',        label: 'Visão Normal',          hint: '1 se a cena está em iluminação plena.' },
  { id: 'visao_penumbra',      label: 'Visão em Penumbra',     hint: '1 se em penumbra (luz fraca).' },
  { id: 'visao_escuridao',     label: 'Visão na Escuridão',    hint: '1 se em escuridão total.' },
  { id: 'na_escuridao',        label: 'Está na Escuridão',     hint: 'Alias de visao_escuridao.' },
  { id: 'na_penumbra',         label: 'Está na Penumbra',      hint: 'Alias de visao_penumbra.' },
  { id: 'esta_iluminado',      label: 'Está Iluminado',        hint: '1 se sob fonte de luz.' },
  { id: 'esta_oculto',         label: 'Está Oculto do Alvo',   hint: '1 se atrás de cobertura/fora da linha de visão.' },
  { id: 'linha_de_visao',      label: 'Tem Linha de Visão',    hint: '1 se há linha de visão para o alvo.' },
  { id: 'atras_de_cobertura',  label: 'Atrás de Cobertura',    hint: '1 se em meia cobertura ou superior.' },
  { id: 'fonte_de_luz_ativa',  label: 'Fonte de Luz Ativa',    hint: '1 se carrega fonte de luz ligada.' },
];

// ── PR-1: Ataque de Oportunidade / Reações ─────────────────────────────
const ADO_OMNI: ChaveOmniOpcao[] = [
  { id: 'ado_concedida',             label: 'AdO Concedida',          hint: '1 se o Mestre concedeu AdO ativa nesta rodada.' },
  { id: 'ado_modo',                  label: 'Modo da AdO',            hint: '0=nenhum, 1=reação, 2=ação, 3=qualquer.' },
  { id: 'ado_consumida',             label: 'AdO Consumida',          hint: '1 se já usou a AdO concedida.' },
  { id: 'ado_restrita',              label: 'AdO Restrita a Alvo',    hint: '1 se a AdO só dispara contra um alvo específico.' },
  { id: 'reacoes_max',               label: 'Reações Máximas',        hint: 'Total de reações por rodada.' },
  { id: 'reacoes_restantes',         label: 'Reações Restantes',      hint: 'Reações ainda disponíveis na rodada.' },
  { id: 'reacao_usada', label: 'Reação usada', hint: '1 se já usou a reação nesta rodada.' },
];

// ── PR-2: Mapa & Distância (lê CENA + flags + contadores) ──────────────
const MAPA_OMNI: ChaveOmniOpcao[] = [
  { id: 'CENA.distancia_plana',         label: '@CENA.distancia_plana',         hint: 'Distância em metros, sem considerar altura.' },
  { id: 'CENA.distancia_grade',  label: '@CENA.distancia_grade',  hint: 'Distância em metros pelas casas da grade.' },
  { id: 'CENA.diferenca_altura',        label: '@CENA.diferenca_altura',        hint: 'Altura do alvo menos a do usuário, em metros.' },
  { id: 'CENA.terreno',              label: '@CENA.terreno',              hint: '0=normal, 1=difícil, 2=intransponível.' },
  { id: 'em_terreno_dificil',        label: 'Em Terreno Difícil',         hint: '1 se o Mestre marcou terreno difícil.' },
  { id: 'voando',                    label: 'Voando',                     hint: '1 se está voando.' },
  { id: 'prono',                     label: 'Prono',                      hint: '1 se está caído/prono.' },
  { id: 'agachado',                  label: 'Agachado',                   hint: '1 se está agachado.' },
  { id: 'velocidade_atual',          label: 'Velocidade Atual',           hint: 'Movimento efetivo (m) considerando sobrecarga.' },
  { id: 'metros_movidos',label: 'Metros movidos',    hint: 'Distância percorrida neste turno.' },
  { id: 'usou_corrida',              label: 'Usou Corrida',               hint: '1 se gastou ação de corrida no turno.' },
  { id: 'sobrecarregado',            label: 'Sobrecarregado',             hint: '1 se slots ocupados > slots máximos.' },
];

// ── PR-2: Recursos Detalhados (thresholds de vida) ─────────────────────
const RECURSOS_DETALHADOS_OMNI: ChaveOmniOpcao[] = [
  { id: 'vida_pct_abaixo_50',  label: 'Vida abaixo de 50%',   hint: '1 se vida_atual/vida_max ≤ 0.5 (bloodied).' },
  { id: 'vida_pct_abaixo_25',  label: 'Vida abaixo de 25%',   hint: '1 se vida_atual/vida_max ≤ 0.25 (criticamente ferido).' },
  { id: 'bloodied',            label: 'Bloodied',             hint: 'Alias de vida_pct_abaixo_50.' },
  { id: 'criticamente_ferido', label: 'Criticamente Ferido',  hint: 'Alias de vida_pct_abaixo_25.' },
  { id: 'pe_pct_abaixo_50',    label: 'PE abaixo de 50%',     hint: '1 se energia_atual/energia_max ≤ 0.5.' },
  { id: 'pe_pct_abaixo_25',    label: 'PE abaixo de 25%',     hint: '1 se energia_atual/energia_max ≤ 0.25.' },
];

// ── PR-2: Empunhadura (armas equipadas) ────────────────────────────────
const EMPUNHADURA_OMNI: ChaveOmniOpcao[] = [
  { id: 'desarmado',                  label: 'Desarmado',                  hint: '1 se nenhuma arma equipada.' },
  { id: 'duas_maos',                  label: 'Empunhando a Duas Mãos',     hint: '1 se main e off têm a mesma arma de duas-mãos.' },
  { id: 'duas_armas',                 label: 'Usa duas armas',          hint: '1 se está usando duas armas.' },
  { id: 'arma_principal_corpo_a_corpo',      label: 'Arma principal corpo a corpo',  hint: '1 se a arma principal é corpo a corpo.' },
  { id: 'arma_principal_a_distancia',label: 'Arma principal à distância',    hint: '1 se a arma principal é à distância.' },
  { id: 'arma_principal_leve',        label: 'Principal é Leve',           hint: '1 se a arma principal tem propriedade Leve.' },
  { id: 'arma_principal_versatil',    label: 'Principal é Versátil',       hint: '1 se a arma principal tem propriedade Versátil.' },
  { id: 'arma_principal_fineza',      label: 'Principal tem Fineza',       hint: '1 se a arma principal tem propriedade Fineza.' },
  { id: 'arma_principal_pesada',      label: 'Principal é Pesada',         hint: '1 se a arma principal tem propriedade Pesada.' },
  { id: 'escudo_id_equipado',         label: 'Escudo Equipado (id)',       hint: '1 se há escudo equipado.' },
  { id: 'swaps_armas_neste_turno',    label: 'Trocas de Arma no Turno',    hint: 'Quantas trocas de empunhadura feitas.' },
  { id: 'ataques_neste_turno',        label: 'Ataques Feitos no Turno',    hint: 'Quantos ataques já realizados.' },
  { id: 'ultimo_ataque_acertou',      label: 'Último Ataque Acertou',      hint: '1 se o último ataque acertou.' },
  { id: 'ultimo_ataque_errou',        label: 'Último Ataque Errou',        hint: '1 se o último ataque errou.' },
  { id: 'arma_grupo_<grupo>',         label: 'arma_grupo_<grupo>',         hint: 'Predicate: 1 se equipa arma do grupo (ex.: arma_grupo_espada).' },
];

// ── PR-3: Identidade ────────────────────────────────────────────────────
const IDENTIDADE_OMNI: ChaveOmniOpcao[] = [
  { id: 'eh_player',           label: 'É Player',           hint: '1 se categoria=PLAYER.' },
  { id: 'eh_npc',              label: 'É NPC',              hint: '1 se categoria=NPC.' },
  { id: 'eh_inimigo',          label: 'É Inimigo',          hint: '1 se categoria=INIMIGO.' },
  { id: 'origem_<id>',      label: 'Origem: <id>',     hint: '1 se o personagem tem essa origem.' },
  { id: 'especializacao_<id>', label: 'Especialização: <id>', hint: '1 se o personagem tem essa especialização.' },
];

// ── PR-3: Condições ─────────────────────────────────────────────────────
const CONDICOES_OMNI: ChaveOmniOpcao[] = [
  { id: 'tem_condicao_<id>',   label: 'tem_condicao_<id>',  hint: 'Predicate: 1 se possui a condição (ex.: tem_condicao_atordoado).' },
  { id: 'condicao_rodadas_desde_<id>', label: 'Rodadas desde a condição', hint: 'Rodadas completas decorridas; -1 se ausente ou desconhecida.' },
  { id: 'condicao_tem_idade_<id>', label: 'Idade da condição conhecida', hint: '1 se há idade registrada; 0 caso contrário.' },
  { id: 'condicao_rodadas_restantes_<id>', label: 'Rodadas restantes da condição', hint: '999 significa duração indefinida.' },
  { id: 'qtd_condicoes',       label: 'Qtd. Condições',     hint: 'Total de condições ativas.' },
  { id: 'qtd_condicoes_fisica',       label: 'Condições Físicas',         hint: 'Quantas condições da categoria FÍSICA.' },
  { id: 'qtd_condicoes_incapacitacao',label: 'Condições Incapacitação',   hint: 'Quantas condições da categoria INCAPACITAÇÃO.' },
  { id: 'qtd_condicoes_mental',       label: 'Condições Mentais',         hint: 'Quantas condições da categoria MENTAL.' },
  { id: 'qtd_condicoes_movimento',    label: 'Condições de Movimento',    hint: 'Quantas condições da categoria MOVIMENTO.' },
  { id: 'qtd_condicoes_sensorial',    label: 'Condições Sensoriais',      hint: 'Quantas condições da categoria SENSORIAL.' },
  { id: 'qtd_condicoes_vulnerabilidade', label: 'Condições Vulnerabilidade', hint: 'Quantas condições da categoria VULNERABILIDADE.' },
];

// ── PR-3: Concentração & Sustentados ───────────────────────────────────
const CONCENTRACAO_OMNI: ChaveOmniOpcao[] = [
  { id: 'qtd_concentrando',         label: 'Qtd. Concentrando',     hint: 'Quantidade de fontes de concentração ativas; não inclui feitiços sustentados.' },
  { id: 'qtd_sustentados',          label: 'Qtd. Sustentados',      hint: 'Conjurações sustentadas ativas; vários buffs/alvos da mesma conjuração contam uma vez.' },
  { id: 'slots_concentracao_livres',label: 'Slots Concentração Livres', hint: 'max_concentracao - qtd_concentrando.' },
  { id: 'slots_sustentado_livres',  label: 'Slots Sustentado Livres',   hint: 'max_sustentados - qtd_sustentados.' },
];


const TALENTOS_DERIVADOS_OMNI: ChaveOmniOpcao[] = [
  { id: 'escudo_proficiente',      label: 'Escudo Proficiente',           hint: '1 se possui talento de escudo.' },

  { id: 'grupos_critico_arma',     label: 'Grupos com Crítico Aprimorado',hint: 'Quantos grupos de arma têm crítico aprimorado.' },
  { id: 'defesa_duas_armas',          label: 'Defesa com duas armas', hint: 'Bônus de Defesa por empunhadura dupla.' },
  { id: 'bonus_movimento',  label: 'Bônus de movimento',       hint: 'Metros extras de movimento por talentos.' },
  { id: 'vigor_maldito_bonus',     label: 'Vigor Maldito (cura+)',        hint: 'Bônus de cura no Vigor Maldito.' },
  { id: 'suporte_lv2_unlocked',    label: 'Suporte Lv2 Desbloqueado',     hint: '1 se Adepto de Medicina liberou.' },
  { id: 'reducao_dano_alma',                 label: 'Redução de dano de Alma',                   hint: 'RD contra dano de Alma.' },
  { id: 'atencao_bonus',           label: 'Bônus de Atenção',             hint: 'Bônus em Atenção via talentos.' },
  { id: 'bonus_tr_defesa_reduzida',label: 'Bônus em TR contra defesa reduzida',      hint: 'Bônus de TR contra efeitos que reduzem Defesa.' },
  { id: 'concentracao_maxima',        label: 'Concentração máxima',            hint: 'Limite de espaços de concentração.' },
  { id: 'sustentados_maximos',         label: 'Feitiços sustentados máximos',             hint: 'Limite de feitiços sustentados.' },
  { id: 'bonus_slots_liberacao',   label: 'Bônus de espaços de Liberação',     hint: 'Espaços universais extras de Variação.' },
  { id: 'pe_temp_por_rodada',      label: 'PE Temp por Rodada',           hint: 'PE temporário só para Aptidões.' },
  { id: 'aura_bonus_defesa',           label: 'Bônus de Defesa da Aura',              hint: 'Bônus de Defesa concedido por aura.' },
  { id: 'aura_reducao_dano_fisico',          label: 'RD física da Aura',             hint: 'Redução de dano físico concedida por aura.' },
  { id: 'aura_bonus_furtividade',  label: 'Bônus de Furtividade da Aura',           hint: 'Bônus em Furtividade concedido por aura.' },
  { id: 'aura_bonus_agarrar',      label: 'Bônus de Agarrar da Aura',               hint: 'Bônus em Agarrar concedido por aura.' },
];

const CONTADORES_OMNI: ChaveOmniOpcao[] = [
  { id: '<nome_do_contador>',      label: '<nome_do_contador>',           hint: 'Qualquer contador livre (rancor, brasas, almas…). Total somado de todas as fontes.' },
  { id: 'contador_<nome>',         label: 'contador_<nome>',              hint: 'Alias do total do contador.' },
  { id: '<nome>__fonte__<id>',     label: '<nome>__fonte__<id>',          hint: 'Parcela vinda de uma ficha específica (teto por fonte).' },
  { id: 'qtd_talentos',            label: 'Qtd. Talentos',                hint: 'Total de talentos escolhidos.' },
  { id: 'qtd_aptidoes',            label: 'Qtd. Aptidões',                hint: 'Total de aptidões adquiridas.' },
  { id: 'qtd_habilidades_especializacao', label: 'Qtd. Habilidades de Especialização', hint: 'Total de habilidades de especialização escolhidas.' },
  { id: 'qtd_talentos_combate',    label: 'Qtd. Talentos de Combate',     hint: 'Talentos de combate escolhidos.' },
  { id: 'qtd_aptidoes_aura',       label: 'Qtd. Aptidões de Aura',        hint: 'Aptidões da família Aura escolhidas.' },
  { id: 'tem_talento_<id>',        label: 'tem_talento_<id>',             hint: 'Predicate: 1 se possui o talento de id <id>.' },
  { id: 'tem_aptidao_<id>',        label: 'tem_aptidao_<id>',             hint: 'Predicate: 1 se possui a aptidão <id>.' },
  { id: 'tem_habilidade_<id>',     label: 'tem_habilidade_<id>',          hint: 'Predicate: 1 se possui a habilidade <id>.' },
];


// ── PR-4: Economia (carteiras / moedas) ────────────────────────────────
const ECONOMIA_OMNI: ChaveOmniOpcao[] = [
  { id: 'saldo_total',            label: 'Saldo Total',              hint: 'Soma de todas as moedas em todas as carteiras do personagem.' },
  { id: 'saldo_padrao',           label: 'Saldo (moeda padrão)',     hint: 'Soma da moeda padrão em todas as carteiras do personagem.' },
  { id: 'saldo_pessoal',          label: 'Saldo Pessoal',            hint: 'Saldo da carteira pessoal (moeda padrão).' },
  { id: 'carteiras_qtd',          label: 'Carteiras',                hint: 'Quantas carteiras o personagem participa.' },
  { id: 'carteiras_compartilhadas', label: 'Carteiras Compartilhadas', hint: 'Carteiras não-pessoais.' },
  { id: 'tem_carteira_pessoal',   label: 'Tem Carteira Pessoal',     hint: '1 se a carteira pessoal existe.' },
  { id: 'saldo_<moeda>',          label: 'saldo_<moeda>',            hint: 'Predicate: saldo de uma moeda específica (ex.: saldo_yen).' },
  { id: 'tem_moeda_<moeda>',      label: 'tem_moeda_<moeda>',        hint: 'Predicate: 1 se possui saldo > 0 dessa moeda.' },
];

// ── PR-4: Tempo & Calendário (lê Chronos/Calendar; expõe via @CENA.*) ─
const TEMPO_OMNI: ChaveOmniOpcao[] = [
  { id: 'CENA.hora',            label: '@CENA.hora',            hint: 'Hora atual (0–23).' },
  { id: 'CENA.minuto',          label: '@CENA.minuto',          hint: 'Minuto atual (0–59).' },
  { id: 'CENA.segundo',         label: '@CENA.segundo',         hint: 'Segundo atual (0–59).' },
  { id: 'CENA.dia',             label: '@CENA.dia',             hint: 'Dia do mês.' },
  { id: 'CENA.mes',             label: '@CENA.mes',             hint: 'Mês (1–12).' },
  { id: 'CENA.ano',             label: '@CENA.ano',             hint: 'Ano in-game.' },
  { id: 'CENA.eh_dia',          label: '@CENA.eh_dia',          hint: '1 entre 07h e 18h.' },
  { id: 'CENA.eh_noite',        label: '@CENA.eh_noite',        hint: '1 entre 20h e 05h.' },
  { id: 'CENA.eh_amanhecer',    label: '@CENA.eh_amanhecer',    hint: '1 entre 05h e 07h.' },
  { id: 'CENA.eh_anoitecer',    label: '@CENA.eh_anoitecer',    hint: '1 entre 18h e 20h.' },
  { id: 'CENA.relogio_ativo',   label: '@CENA.relogio_ativo',   hint: '1 se o relógio in-game está rodando.' },
  { id: 'CENA.multiplicador_tempo', label: '@CENA.multiplicador_tempo', hint: 'Velocidade atual do relógio.' },
  { id: 'CENA.timestamp_segundos', label: '@CENA.timestamp_segundos', hint: 'Segundos desde 00:00 do dia atual.' },
  { id: 'CENA.eventos_hoje',    label: '@CENA.eventos_hoje',    hint: 'Quantos eventos do calendário caem hoje.' },
];

// ── PR-4: Inventário ──────────────────────────────────────────────────
const INVENTARIO_OMNI: ChaveOmniOpcao[] = [
  { id: 'qtd_itens_inventario', label: 'Qtd. Itens no Inventário', hint: 'Total de itens no inventário do personagem.' },
  { id: 'qtd_itens_equipados',  label: 'Qtd. Itens Equipados',     hint: 'Itens atualmente equipados em slots.' },
  { id: 'tem_item_<id>',        label: 'tem_item_<id>',            hint: 'Predicate: 1 se o item de id <id> está no inventário.' },
  { id: 'equipado_<id>',        label: 'equipado_<id>',            hint: 'Predicate: 1 se o item de id <id> está equipado.' },
];

// ── PR-5: Cena Tática (proximidade, aliados/inimigos) ─────────────────
const CENA_TATICA_OMNI: ChaveOmniOpcao[] = [
  { id: 'esta_no_mapa',           label: 'Está no Mapa',             hint: '1 se há token deste personagem na cena ativa.' },
  { id: 'CENA.token_x',           label: '@CENA.token_x',            hint: 'Posição X do token (metros).' },
  { id: 'CENA.token_y',           label: '@CENA.token_y',            hint: 'Posição Y do token (metros).' },
  { id: 'CENA.qtd_tokens',        label: '@CENA.qtd_tokens',         hint: 'Tokens visíveis na cena.' },
  { id: 'CENA.qtd_aliados',       label: '@CENA.qtd_aliados',        hint: 'Tokens de PLAYER na cena.' },
  { id: 'CENA.qtd_inimigos',      label: '@CENA.qtd_inimigos',       hint: 'Tokens de INIMIGO na cena.' },
  { id: 'qtd_aliados_adjacentes', label: 'Aliados Adjacentes',       hint: 'Aliados dentro de 1,5m.' },
  { id: 'qtd_aliados_proximos',   label: 'Aliados Próximos',         hint: 'Aliados dentro de 6m.' },
  { id: 'qtd_inimigos_adjacentes',label: 'Inimigos Adjacentes',      hint: 'Inimigos dentro de 1,5m.' },
  { id: 'qtd_inimigos_proximos',  label: 'Inimigos Próximos',        hint: 'Inimigos dentro de 6m.' },
  { id: 'qtd_inimigos_engajados', label: 'Inimigos Engajados',       hint: 'Alias de qtd_inimigos_adjacentes.' },
  { id: 'aliado_adjacente',       label: 'Aliado Adjacente',         hint: '1 se ≥1 aliado dentro de 1,5m.' },
  { id: 'inimigo_adjacente',      label: 'Inimigo Adjacente',        hint: '1 se ≥1 inimigo dentro de 1,5m.' },
  { id: 'flanqueado',             label: 'Flanqueado',               hint: '1 se ≥2 inimigos adjacentes.' },
  { id: 'sozinho',                label: 'Sozinho',                  hint: '1 se nenhum aliado próximo (≤6m).' },
  { id: 'na_linha_de_frente',     label: 'Na Linha de Frente',       hint: '1 se há inimigo adjacente.' },
];

// ── PR-6: Cura / Recursos Avançados ────────────────────────────────────
const CURA_RECURSOS_OMNI: ChaveOmniOpcao[] = [
  { id: 'pode_ser_curado',             label: 'Pode Ser Curado',           hint: '1 se vida_atual < vida_max e não está morto/morrendo.' },
  { id: 'vida_faltante',               label: 'Vida Faltante',             hint: 'vida_max - vida_atual.' },
  { id: 'vida_faltante_pct',           label: 'Vida Faltante %',           hint: '0–100, quanto falta para vida cheia.' },
  { id: 'cura_recebida',               label: 'Cura Recebida (última)',    hint: 'Última cura recebida (omniCounter).' },
  { id: 'cura_recebida_nesta_rodada',  label: 'Cura Recebida na Rodada',   hint: 'Soma de cura na rodada atual (omniCounter).' },
  { id: 'ultimo_dano_recebido',        label: 'Último Dano Recebido',      hint: 'Valor do último dano sofrido (omniCounter).' },
  { id: 'dano_recebido_nesta_rodada',  label: 'Dano Recebido na Rodada',   hint: 'Soma de dano sofrido na rodada (omniCounter).' },
  { id: 'vida_perdida_nesta_rodada',   label: 'Vida Perdida na Rodada',    hint: 'Alias de dano_recebido_nesta_rodada.' },
  { id: 'acao_disponivel',             label: 'Ação Disponível',           hint: '1 se ainda tem ação na rodada.' },
  { id: 'bonus_acao_disponivel',       label: 'Ação Bônus Disponível',     hint: '1 se ainda tem ação bônus.' },
  { id: 'movimento_disponivel',        label: 'Movimento Disponível',      hint: '1 se ainda tem metros para mover.' },
  { id: 'slots_descanso_curto',        label: 'Slots Descanso Curto',      hint: 'Dados de Vida atuais (hit dice).' },
  { id: 'slots_descanso_curto_max',    label: 'Slots Descanso Curto Máx.', hint: 'Dados de Vida máximos.' },
  { id: 'slots_descanso_curto_pct',    label: 'Slots Descanso Curto %',    hint: '0–100, hd_atual/hd_max.' },
  { id: 'vigor_maldito_usos',          label: 'Vigor Maldito Usos',        hint: 'Usos restantes de Vigor Maldito.' },
  { id: 'vigor_maldito_max',           label: 'Vigor Maldito Máx.',        hint: 'Capacidade total de Vigor Maldito.' },
  { id: 'vigor_maldito_disponivel',    label: 'Vigor Maldito Disponível',  hint: '1 se tem ≥1 uso restante.' },
  { id: 'hp_sacrificado',              label: 'HP Sacrificado',            hint: 'Total de HP sacrificado por Sacrifício pela Energia.' },
  { id: 'sacrificio_pct',              label: 'Sacrifício %',              hint: '0–100, hp_sacrificado/vida_max.' },
];

// ── PR-7: Combate Avançado (vantagem, cobertura, alcance, crítico) ─────
const COMBATE_AVANCADO_PR7_OMNI: ChaveOmniOpcao[] = [
  { id: 'tem_vantagem',                 label: 'Tem Vantagem',                hint: '1 se há ≥1 modificador de vantagem ativo.' },
  { id: 'tem_desvantagem',              label: 'Tem Desvantagem',             hint: '1 se há ≥1 modificador de desvantagem ativo.' },
  { id: 'qtd_vantagens',                label: 'Qtd. Vantagens',              hint: 'Quantos modificadores de vantagem ativos.' },
  { id: 'qtd_desvantagens',             label: 'Qtd. Desvantagens',           hint: 'Quantos modificadores de desvantagem ativos.' },
  { id: 'vantagem_proximo_ataque',      label: 'Vantagem no Próx. Ataque',    hint: '1 se algum mod de vantagem afeta ataques.' },
  { id: 'desvantagem_proximo_ataque',   label: 'Desvantagem no Próx. Ataque', hint: '1 se algum mod de desvantagem afeta ataques.' },
  { id: 'vantagem_proximo_tr',          label: 'Vantagem no Próx. TR',        hint: '1 se algum mod de vantagem afeta TR.' },
  { id: 'desvantagem_proximo_tr',       label: 'Desvantagem no Próx. TR',     hint: '1 se algum mod de desvantagem afeta TR.' },
  { id: 'vantagem_proxima_pericia',     label: 'Vantagem na Próx. Perícia',   hint: '1 se algum mod de vantagem afeta perícia.' },
  { id: 'desvantagem_proxima_pericia',  label: 'Desvantagem na Próx. Perícia',hint: '1 se algum mod de desvantagem afeta perícia.' },
  { id: 'cobertura_meia',               label: 'Cobertura — Meia',            hint: '1 se em meia cobertura (+2 def).' },
  { id: 'cobertura_tres_quartos',       label: 'Cobertura — 3/4',             hint: '1 se em 3/4 de cobertura (+5 def).' },
  { id: 'cobertura_total',              label: 'Cobertura — Total',           hint: '1 se cobertura total (imune a ataque direto).' },
  { id: 'bonus_defesa_cobertura',       label: 'Bônus de Defesa (Cobertura)', hint: '0/2/5/999 conforme nível de cobertura.' },
  { id: 'imune_por_cobertura',          label: 'Imune por Cobertura',         hint: 'Alias de cobertura_total.' },
  { id: 'arma_principal_alcance',       label: 'Alcance Principal (m)',       hint: 'Alcance de corpo-a-corpo da arma principal (1,5m default).' },
  { id: 'arma_principal_alcance_curto', label: 'Alcance Curto (m)',           hint: 'rangeShort da arma principal (arremessável/distância).' },
  { id: 'arma_principal_alcance_longo', label: 'Alcance Longo (m)',           hint: 'rangeLong da arma principal.' },
  { id: 'arma_margem_critico',    label: 'Margem de crítico da arma',        hint: 'Rolagem igual ou maior a este valor é crítico.' },
  { id: 'arma_principal_crit_ampliado', label: 'Crítico Ampliado',            hint: '1 se critRange < 20.' },
  { id: 'reacoes_usadas',  label: 'Reações usadas',    hint: 'Reações consumidas nesta rodada.' },
];

// ── PR-8: Magia / Técnicas ─────────────────────────────────────────────
const MAGIA_TECNICAS_OMNI: ChaveOmniOpcao[] = [
  { id: 'qtd_feiticos',              label: 'Qtd. Feitiços',              hint: 'Total de feitiços no grimório.' },
  { id: 'qtd_feiticos_dano',         label: 'Qtd. Feitiços de Dano',      hint: 'spellType=damage.' },
  { id: 'qtd_feiticos_cura',         label: 'Qtd. Feitiços de Cura',      hint: 'spellType=heal.' },
  { id: 'qtd_feiticos_buff',         label: 'Qtd. Feitiços de Buff',      hint: 'spellType=buff.' },
  { id: 'qtd_feiticos_condicao',     label: 'Qtd. Feitiços de Condição',  hint: 'spellType=condition.' },
  { id: 'qtd_feiticos_prontos',      label: 'Qtd. Feitiços Prontos',      hint: 'Feitiços com Memorização Imediata.' },
  { id: 'tem_feitico_pronto',        label: 'Tem Feitiço Pronto',         hint: '1 se ≥1 feitiço isPrepared.' },
  { id: 'pe_minimo_feitico',         label: 'PE Mínimo (feitiço)',        hint: 'Menor costPE do grimório.' },
  { id: 'pe_maximo_feitico',         label: 'PE Máximo (feitiço)',        hint: 'Maior costPE do grimório.' },
  { id: 'qtd_buffs_ativos',          label: 'Qtd. Buffs Ativos',          hint: 'Total de buffs em activeBuffs.' },
  { id: 'qtd_buffs_sustentados',     label: 'Qtd. Buffs Sustentados',     hint: 'isSustained=true.' },
  { id: 'pe_sustentacao_por_rodada',  label: 'PE de sustentação por rodada',    hint: 'PE gasto por rodada para manter feitiços.' },
  { id: 'tem_ultimo_feitico',        label: 'Tem Último Feitiço',         hint: '1 se há lastSpellUsedId.' },
  { id: 'bonus_ataque_magia',        label: 'Bônus de ataque mágico', hint: 'Bônus de ataque de magia.' },
  { id: 'tem_tecnica', label: 'Tem técnica amaldiçoada', hint: '1 se o personagem definiu uma técnica.' },
  { id: 'qtd_fundamentos',   label: 'Fundamentos da técnica', hint: 'Quantidade de fundamentos da técnica.' },
  { id: 'foco_destruicao',           label: 'Foco: Destruição',           hint: '1 se tecnicaFoco=Destruição.' },
  { id: 'foco_economia',             label: 'Foco: Economia',             hint: '1 se tecnicaFoco=Economia.' },
  { id: 'foco_refino',               label: 'Foco: Refino',               hint: '1 se tecnicaFoco=Refino.' },
  { id: 'imbuir_armado',             label: 'Imbuir Armado',              hint: '1 se há imbuedSpell pendente.' },
  { id: 'absorcao_armada',           label: 'Absorção Elemental Armada',  hint: '1 se há absorção elemental pendente.' },
  { id: 'au_concentrada',            label: 'AU Concentrada',             hint: 'Valor de AU concentrado em aura.' },
  { id: 'tem_feitico_<id>',          label: 'tem_feitico_<id>',           hint: 'Predicate: 1 se possui o feitiço de id <id>.' },
  { id: 'tem_buff_<nome>',      label: 'Tem buff <nome>',       hint: '1 se há um buff ativo com esse nome.' },
  { id: 'qtd_feiticos_tipo_<tipo>', label: 'Feitiços por tipo de dano', hint: 'Quantidade de feitiços com o tipo de dano informado.' },
];

// ── PR-9: Meta / Narrativa (combate, iniciativa, cronômetro) ──────────
const META_NARRATIVA_OMNI: ChaveOmniOpcao[] = [
  { id: 'em_combate',                label: 'Em Combate',                hint: '1 se há combate ativo.' },
  { id: 'numero_da_rodada',          label: 'Número da Rodada',          hint: 'Round atual do combate.' },
  { id: 'indice_turno_atual',         label: 'Índice do turno atual',     hint: 'Posição zero-based na ordem do combate.' },
  { id: 'ordem_na_iniciativa',       label: 'Ordem na Iniciativa',       hint: 'Posição 1-based; 0 se fora do combate.' },
  { id: 'eh_meu_turno',              label: 'É Meu Turno',               hint: '1 se for o turno deste personagem.' },
  { id: 'iniciativa_total',          label: 'Iniciativa (total)',        hint: 'roll + bonus do entry.' },
  { id: 'iniciativa_bonus',          label: 'Iniciativa (bônus)',        hint: 'Bônus de iniciativa do entry.' },
  { id: 'iniciativa_rolagem',        label: 'Iniciativa (rolagem)',      hint: 'Valor do d20 da iniciativa.' },
  { id: 'qtd_participantes_combate', label: 'Qtd. Participantes',        hint: 'Tamanho da ordem de iniciativa.' },
  { id: 'turnos_ate_meu_turno',            label: 'Turnos até meu turno',          hint: 'Quantos turnos até este personagem agir.' },
  { id: 'sou_proximo_no_turno',          label: 'Sou o próximo no turno',          hint: '1 se este personagem age em seguida.' },
  { id: 'sou_ultimo_no_turno',           label: 'Sou o último na ordem',           hint: '1 se este personagem é o último da rodada.' },
  { id: 'metros_movidos_combate',    label: 'Metros Movidos no Combate', hint: 'movementUsedByChar do combate atual.' },
  { id: 'turno_cronometro_ativo',    label: 'Cronômetro Ativo',          hint: '1 se o cronômetro de turno está ligado.' },
  { id: 'duracao_turno_segundos',         label: 'Duração do turno em segundos',      hint: 'Tempo configurado para cada turno.' },
  { id: 'segundos_restantes_turno',  label: 'Segundos restantes no turno',        hint: 'Tempo restante do turno atual.' },
  { id: 'turno_pausado',             label: 'Turno Pausado',             hint: '1 se o cronômetro está pausado.' },
  { id: 'qtd_flags',            label: 'Quantidade de flags',           hint: 'Total de flags personalizadas na ficha.' },
  { id: 'qtd_contadores',       label: 'Quantidade de contadores',      hint: 'Total de contadores personalizados na ficha.' },
];









export const DICIONARIO_CHAVES_OMNI: CategoriaChavesOmni[] = [
  { grupo: 'Atributos',  escopos: ['USUARIO', 'ALVO'], itens: ATRIBUTOS_OMNI },
  { grupo: 'Recursos',   escopos: ['USUARIO', 'ALVO'], itens: RECURSOS_OMNI },
  { grupo: '🩺 Pools',    escopos: ['USUARIO', 'ALVO'], itens: POOLS_OMNI },
  { grupo: '🍖 Sobrevivência', escopos: ['USUARIO', 'ALVO'], itens: SOBREVIVENCIA_OMNI },
  { grupo: 'Progressão', escopos: ['USUARIO', 'ALVO'], itens: PROGRESSAO_OMNI },
  { grupo: '🛡️ Mitigação de dano', escopos: ['USUARIO', 'ALVO'], itens: CHAVES_MITIGACAO },
  { grupo: 'Combate',    escopos: ['USUARIO', 'ALVO'], itens: COMBATE_OMNI },
  { grupo: '⚔️ Combate Avançado', escopos: ['USUARIO', 'ALVO'], itens: COMBATE_AVANCADO_OMNI },
  { grupo: '🧍 Estado',   escopos: ['USUARIO', 'ALVO'], itens: ESTADO_OMNI },
  { grupo: '🌟 Talentos & Auras', escopos: ['USUARIO', 'ALVO'], itens: TALENTOS_DERIVADOS_OMNI },
  { grupo: '🔢 Contadores', escopos: ['USUARIO', 'ALVO'], itens: CONTADORES_OMNI },
  { grupo: '🛡️ Flags',    escopos: ['USUARIO', 'ALVO'], itens: FLAGS_OMNI },
  { grupo: '🥋 Perícias', escopos: ['USUARIO', 'ALVO'], itens: PERICIAS_OMNI },
  { grupo: '🛡️ Testes de Resistência', escopos: ['USUARIO', 'ALVO'], itens: TR_OMNI },
  { grupo: '🧪 Item',     escopos: ['NENHUM'],          itens: ITEM_OMNI },
  { grupo: 'Globais',    escopos: ['NENHUM'],          itens: GLOBAIS_OMNI },
  { grupo: 'Cena',       escopos: ['NENHUM'],          itens: [...CENA_OMNI, ...CENA_AVANCADA_OMNI] },
  { grupo: '💥 Dano (contexto)', escopos: ['NENHUM'],   itens: DANO_CTX_OMNI },
  { grupo: '👁️ Visão & Iluminação', escopos: ['USUARIO', 'ALVO'], itens: VISAO_OMNI },
  { grupo: '⚡ AdO & Reações', escopos: ['USUARIO', 'ALVO'], itens: ADO_OMNI },
  { grupo: '🗺️ Mapa & Distância', escopos: ['NENHUM'], itens: MAPA_OMNI },
  { grupo: '🩹 Recursos Detalhados', escopos: ['USUARIO', 'ALVO'], itens: RECURSOS_DETALHADOS_OMNI },
  { grupo: '🗡️ Empunhadura', escopos: ['USUARIO', 'ALVO'], itens: EMPUNHADURA_OMNI },
  { grupo: '🪪 Identidade', escopos: ['USUARIO', 'ALVO'], itens: IDENTIDADE_OMNI },
  { grupo: '🤕 Condições (ativas)', escopos: ['USUARIO', 'ALVO'], itens: CONDICOES_OMNI },
  { grupo: '🌀 Concentração & Sustentados', escopos: ['USUARIO', 'ALVO'], itens: CONCENTRACAO_OMNI },
  { grupo: '💰 Economia', escopos: ['USUARIO', 'ALVO'], itens: ECONOMIA_OMNI },
  { grupo: '🕰️ Tempo & Calendário', escopos: ['NENHUM'], itens: TEMPO_OMNI },
  { grupo: '🎒 Inventário', escopos: ['USUARIO', 'ALVO'], itens: INVENTARIO_OMNI },
  { grupo: '🎯 Cena Tática', escopos: ['NENHUM'], itens: CENA_TATICA_OMNI },
  { grupo: '🩹 Cura & Recursos Avançados', escopos: ['USUARIO', 'ALVO'], itens: CURA_RECURSOS_OMNI },
  { grupo: '⚔️ Combate Avançado (PR-7)', escopos: ['USUARIO', 'ALVO'], itens: COMBATE_AVANCADO_PR7_OMNI },
  { grupo: '🔮 Magia & Técnicas', escopos: ['USUARIO', 'ALVO'], itens: MAGIA_TECNICAS_OMNI },
  { grupo: '🎬 Meta & Narrativa', escopos: ['USUARIO', 'ALVO'], itens: META_NARRATIVA_OMNI },




];




/** Funções matemáticas suportadas pelo parser — usado pelo Guia Flutuante. */
export const FUNCOES_MATEMATICAS_OMNI: Array<{ fn: string; desc: string; ex: string }> = [
  { fn: 'floor(x)', desc: 'Arredonda para baixo.',          ex: 'floor(@treino / 2)' },
  { fn: 'ceil(x)',  desc: 'Arredonda para cima.',           ex: 'ceil(@USUARIO.vida / 10)' },
  { fn: 'round(x)', desc: 'Arredonda para o mais próximo.', ex: 'round(7.5) = 8' },
  { fn: 'abs(x)',   desc: 'Valor absoluto.',                ex: 'abs(-3) = 3' },
  { fn: 'min(a,b)', desc: 'Menor entre dois valores.',      ex: 'min(@FOR, 5)' },
  { fn: 'max(a,b)', desc: 'Maior entre dois valores.',      ex: 'max(@DES, @FOR)' },
  { fn: 'if(cond,a,b)', desc: 'Se cond≠0 retorna a, senão b.', ex: 'if(@BLOODIED, 2, 0)' },
  { fn: 'clamp(x,a,b)', desc: 'Limita x entre a e b.',         ex: 'clamp(@FOR, 0, 5)' },
  { fn: 'between(x,a,b)', desc: '1 se a ≤ x ≤ b, senão 0.',    ex: 'between(@NIVEL, 5, 10)' },
  { fn: 'pct(parte,total)', desc: '% inteira (0–100).',         ex: 'pct(@VIDA, @VIDA_MAX)' },
  { fn: 'sqrt(x)', desc: 'Raiz quadrada.',                       ex: 'sqrt(16) = 4' },
  { fn: 'pow(x,y)', desc: 'x elevado a y (mesmo que x^y).',      ex: 'pow(2, @TREINO)' },
  { fn: 'rand(min,max)', desc: 'Inteiro aleatório no intervalo.', ex: 'rand(1, 6)' },
  { fn: 'coin()',  desc: 'Cara/coroa (0 ou 1).',                  ex: 'if(coin(), @FOR, @DES)' },
  { fn: 'd(n)',    desc: 'Rola 1 dado de n faces (atalho).',      ex: 'd(20) + @TREINO' },
];
