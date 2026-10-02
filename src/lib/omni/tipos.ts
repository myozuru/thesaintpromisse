/**
 * Schema do Omni-Engine: tipos que descrevem qualquer entidade no-code
 * (item, feitiço, talento, aura, buff, condição).
 *
 * Tudo aqui é JSON-serializável para permitir export/import de pacotes.
 */
import type {
  AcaoEfeitoId,
  AlvoRefId,
  CondicaoId,
  DuracaoTipo,
  GatilhoId,
  OperadorId,
} from './constantesDoSistema';

/** Valor que pode ser fixo ou uma fórmula escalável. */
export type ValorDinamico =
  | { tipo: 'fixo'; valor: number }
  | { tipo: 'formula'; expressao: string /* ex: "@TREINO * 2 + 1d6" */ };

/** Lado de uma comparação lógica (ex: `@ALVO.vida_atual`). */
export interface ReferenciaEscalar {
  alvo: AlvoRefId; // USUARIO | ALVO | CENA
  caminho: string; // ex: "atributos.forca" ou "status.vida.atual"
}

/** Operando pode ser referência a um caminho, fixo, ou fórmula. */
export type Operando =
  | { tipo: 'ref'; ref: ReferenciaEscalar }
  | { tipo: 'fixo'; valor: number }
  | { tipo: 'condicao'; condicao: CondicaoId }
  | { tipo: 'formula'; expressao: string };

/** Uma condição lógica (uma frase "Se X OP Y"). */
export interface CondicaoLogica {
  id: string;
  esquerdo: Operando;
  operador: OperadorId;
  direito: Operando;
}

/** Uma ação "Então" a executar quando a condição vale. */
export interface AcaoLogica {
  id: string;
  acao: AcaoEfeitoId;
  alvoAplicacao: AlvoRefId;
  caminhoAlvo?: string; // para SOMAR/DEFINIR: caminho a alterar
  valor?: ValorDinamico;
  condicao?: CondicaoId; // para APLICAR/REMOVER_CONDICAO
  /**
   * Duração DESTE efeito específico, independente da entidade-fonte.
   * - Ausente em ações de mutação direta (DANO, CURAR, SOMAR, DEFINIR…)
   *   → o efeito é instantâneo: aplica e termina.
   * - Presente em ações que aplicam efeitos persistentes
   *   (APLICAR_CONDICAO, REROLL, buffs futuros) → controla quanto tempo
   *   o efeito permanece ativo no runtime.
   *
   * Quando ausente para ações persistentes, o motor cai no fallback
   * legado (1 rodada, ou o que a entidade-fonte definir).
   */
  duracao?: DuracaoEntidade;
  /**
   * Contadores (INCREMENTAR_CONTADOR): teto opcional. Fórmula livre
   * (ex.: `@USUARIO.treino`). Ausente = sem teto.
   */
  teto?: ValorDinamico;
  /**
   * 'global' (padrão): teto vale para o total. 'porFonte': cada criatura de
   * origem (o ALVO do evento — ex.: o aliado ferido) tem seu próprio teto,
   * e o total é a soma de todas as fontes.
   */
  escopoTeto?: 'global' | 'porFonte';
}

/** Um bloco Se/Então completo. */
export interface BlocoLogico {
  id: string;
  /** Se vazio, ação é incondicional. */
  condicoes: CondicaoLogica[];
  /** Conectivo entre condições. */
  modo: 'todas' | 'qualquer';
  acoes: AcaoLogica[];
}

/** Duração da entidade. */
export interface DuracaoEntidade {
  tipo: DuracaoTipo;
  valor?: ValorDinamico; // quando tipo ≠ instantaneo/permanente
}

/** Custo para ativar a entidade. */
export interface CustoEntidade {
  caminhoRecurso: string; // ex: "status.energiaAmaldicoada.atual"
  valor: ValorDinamico;
}

/** Gatilho + blocos lógicos associados. */
export interface GatilhoEntidade {
  id: string;
  evento: GatilhoId;
  blocos: BlocoLogico[];
}

export type CategoriaEntidade =
  | 'item'
  | 'arma'
  | 'feitico'
  | 'talento'
  | 'aura'
  | 'passiva'
  | 'condicao'
  | 'voto';

/**
 * Tipo de slot de equipamento (apenas para `categoria: 'item'`).
 * Reflete `ITEM_SLOT_TYPES` em `src/types/index.ts`.
 */
export type OmniSlotType =
  | 'nenhum'
  | 'colar' | 'anel' | 'pulseira'
  | 'cabeca' | 'corpo' | 'maos' | 'pes';

/** Entidade Omni completa. Schema único para itens/feitiços/etc. */
export interface EntidadeOmni {
  id: string;
  versao: 1;
  nome: string;
  categoria: CategoriaEntidade;
  descricao: string;
  icone?: string; // emoji ou url
  tags: string[];
  duracao: DuracaoEntidade;
  custos: CustoEntidade[];
  alcance?: ValorDinamico; // metros
  areaRaio?: ValorDinamico; // metros (aura / AoE)
  gatilhos: GatilhoEntidade[];
  /**
   * Tipo de slot de equipamento. Padrão: 'nenhum' (item de inventário).
   * Quando definido como colar/anel/pulseira/etc., o item pode ser
   * equipado em slots da ficha (aba Acessórios).
   */
  slotType?: OmniSlotType;
  /**
   * Bônus matemáticos aplicados automaticamente quando o item está
   * equipado em um slot. Aplicado pela aba Acessórios (resolvedor
   * passivo). Independente da camada de gatilhos lógicos.
   */
  bonusEquipado?: {
    hp?: number;
    pe?: number;
    ca?: number;
    rd?: number;
    esc?: number;
    slots?: number;
  };
  /**
   * Bônus dinâmicos calculados por fórmula quando o item está equipado.
   * Avaliados a cada render usando o contexto do USUARIO (dono do item).
   * Ex.: `vida_max = "(@USUARIO.treino * 2)"` aumenta a vida máxima
   *      proporcionalmente ao bônus de treinamento.
   *
   * Aceita as mesmas chaves de `bonusEquipado`. Resultado é somado ao
   * valor numérico fixo (se ambos existirem).
   */
  bonusEquipadoFormula?: {
    hp?: string;
    pe?: string;
    ca?: string;
    rd?: string;
    esc?: string;
    slots?: string;
  };
  /**
   * Dados nativos de combate (Pilar de Dano).
   * Quando preenchido, a entidade pode ser usada como ataque direto:
   * itens com `combatData.damageFormula` exibem botão "Atacar" na ficha,
   * e o simulador mostra o Dano Médio calculado.
   */
  combatData?: CombatData;
  /**
   * Usos limitados (Pilar de Recursos). Quando definido, cada instância
   * no inventário ganha um contador `usosRestantes` decrementado a cada
   * uso do Script Ativo. Recarga acontece conforme `recargaTipo`.
   *
   * Exposto em fórmulas como `@ITEM.usos_restantes` e `@ITEM.usos_totais`.
   * Ausente = uso ilimitado (comportamento legado).
   */
  usos?: {
    /** Total de cargas por ciclo de recarga. */
    total: number;
    /** Quando o contador volta para `total`. */
    recarga: 'diaria' | 'porCena' | 'descansoCurto' | 'manual';
  };
  /**
   * Réplica Materializável: o jogador materializa no turno pagando
   * `peInvocacao` e sustenta pagando `peSustentacao` no começo de cada turno.
   */
  replica?: ReplicaConfig;
  /** Ações ativas genéricas (TR ramificado, ataque, cargas, puxão…). Ver acaoAtiva.ts. */
  acoesAtivas?: AcaoAtivaConfig[];
  /**
   * Camada de Comércio (visível apenas para o Mestre no construtor).
   * Aplicável principalmente a categoria 'item', mas o schema permite
   * em qualquer entidade para casos futuros (pergaminhos de feitiço, etc.).
   */
  comercio?: ComercioEntidade;
  criadoEm: number;
  atualizadoEm: number;
}

/** Metadados comerciais de uma entidade. */
export interface ComercioEntidade {
  /** Valor base em moedas (na moeda padrão do sistema). */
  basePrice: number;
  /**
   * Tags ocultas usadas pelas lojas para decidir se aceitam comprar
   * o item. NUNCA expor ao jogador na ficha. Ex: 'amaldicoado', 'reliquia'.
   */
  hiddenTags: string[];
  /**
   * true se o item foi adquirido via Loja por um jogador.
   * Bloqueia revenda comercial (regra Anti-Revenda).
   */
  isBought: boolean;
}

/** Dados de combate para ataque direto / cálculo de dano. */
export interface CombatData {
  /**
   * @deprecated Mantido apenas para migração de dados antigos. A natureza
   * ativa/passiva agora é DERIVADA de `effectsActive.length > 0`. Itens
   * podem ser híbridos (passivo ao equipar + ativo ao usar) simultaneamente.
   */
  isActive?: boolean;
  /**
   * União concatenada de `effectsPassive + effectsActive` mantida para
   * compatibilidade com leitores antigos. SEMPRE re-derivada por
   * `normalizarCombatData`. Não escreva diretamente — escreva nos splits.
   */
  effects: CombatEffect[];
  /**
   * 🛡️ Script Passivo (Ao Equipar): roda automaticamente enquanto o item
   * estiver em um slot de equipamento. Tipicamente mira `@USUARIO` em
   * recursos persistentes (vida_max, defesa, etc.). Duração permanente.
   */
  effectsPassive?: CombatEffect[];
  /**
   * ⚔️ Script Ativo (Ação/Uso): roda apenas quando o jogador clica em
   * "Usar / Atacar" no inventário ou no slot equipado. Habilita os campos
   * de Margem de Crítico, Custo de Ação, Alcance e Área.
   */
  effectsActive?: CombatEffect[];
  /** Valor mínimo no d20 para crítico. Padrão 20. */
  critRange: number;
  /** Multiplicador de dano em crítico. Padrão 2. */
  critMultiplier: number;
  /** Custo de Ação para usar (ver SYSTEM_ACTIONS). Padrão 'action_standard'. */
  actionCost?: string;
  /** Tipo de alcance (ver RANGE_TYPES). Padrão 'ranged'. */
  rangeType?: string;
  /** Forma de área de efeito (ver AOE_SHAPES). Padrão 'single'. */
  aoeShape?: string;
  /** Raio/distância em metros para alcance ou AoE quando aplicável. */
  aoeSize?: number;
}

/** Um efeito atômico dentro de `CombatData.effects`. */
export interface CombatEffect {
  id: string;
  /**
   * Fórmula matemática. Aceita @USUARIO.X, @ALVO.X, @CENA.X, dados (XdY)
   * e funções (floor/ceil/round/min/max/abs). Pode referenciar resultados
   * anteriores via `@RESULTADO_N` (1-indexado).
   */
  formula: string;
  /**
   * Como o resultado é aplicado:
   *  - SUBTRAIR    → dano (reduz vida do alvo).         [vermelho]
   *  - ADICIONAR   → cura / energia (aumenta recurso).  [verde]
   *  - MODIFICADOR → buff/debuff (sinal define cor).
   */
  type: 'SUBTRAIR' | 'ADICIONAR' | 'MODIFICADOR';
  /** Contadores (`contador_<nome>`): teto em fórmula (`... ate @USUARIO.treino`). */
  counterCap?: string;
  /** Contadores: teto vale por ficha de origem (`... por_fonte`). */
  counterPerSource?: boolean;
  /** Quem recebe ESTE efeito. */
  target: 'ALVO' | 'USUARIO' | 'AREA';
  /** Tipo de dano / cura / efeito (ver DAMAGE_TYPES). Opcional. */
  damageType?: string;
  /**
   * Recurso/atributo do alvo afetado pelo efeito (ex.: `vida_atual`,
   * `vida_max`, `energia`, `defesa`). Usado para descrever a regra
   * (Ação + Alvo + Valor) e para o log do chat. Quando omitido, assume
   * `vida_atual` para SUBTRAIR/ADICIONAR.
   */
  resourcePath?: string;
  /**
   * Gatilho opcional extraído da OmniScript avançada
   * (ex.: `ao_receber_dano`, `ao_iniciar_turno`). Quando presente, indica
   * que este efeito só roda em resposta ao evento nomeado.
   */
  trigger?: string;
  /**
   * Condição lógica opcional avaliada antes da execução
   * (ex.: `usos_restantes > 0`, `@USUARIO.vida_atual <= 10`). String é
   * passada ao `avaliarFormula` que já entende >, <, >=, <=, ==, !=.
   */
  condition?: string;
  /**
   * Verbo absoluto usado na escrita original do script (`anular` ou
   * `ignorar`). Tecnicamente equivale a `definir 0`, mas é preservado
   * aqui para que o Plano de Execução o renderize de forma elegante
   * ("Anular Dano Recebido") em vez de mostrar a tradução matemática.
   */
  absoluteVerb?: 'anular' | 'ignorar';
  /**
   * 🎯 Gatilho condicional dinâmico (Watcher).
   *
   * Em vez de escutar um evento nomeado (`ao_morrer`), o motor escuta
   * mudanças de **estado** de um recurso. O efeito dispara em
   * **edge-trigger**: somente no instante em que a condição passa de
   * falsa → verdadeira.
   *
   * - `resource`     — chave do recurso (ex.: `vida_atual`, `pe`).
   * - `op`           — operador de comparação (`<=`, `>=`, `<`, `>`, `==`, `!=`).
   * - `threshold`    — número literal OU percentual (ver `percent`).
   * - `percent`      — `true` quando o threshold é uma fração (0..1)
   *                    a ser multiplicada pelo valor atual de `percentBase`.
   * - `percentBase`  — recurso base do percentual. Padrão = `${resource}_max`.
   *                    Ex.: `vida_atual` → base = `vida_max`.
   */
  watcher?: {
    resource: string;
    op: '<=' | '>=' | '<' | '>' | '==' | '!=';
    threshold: number;
    percent?: boolean;
    percentBase?: string;
  };
  /**
   * 🪄 Quando presente, este efeito NÃO altera um recurso numérico — ele
   * cria/atualiza um redutor de custo de PE de feitiços em
   * `omniSpellCostReduction[]`. A `formula` é quanto reduzir; `filtro`
   * segue a sintaxe de `spellCostReduction.ts` (`todos`, `nivel:1-3`,
   * `tipo:damage`, `nome:bola_de_fogo`, combinados com `&`); `min` é o
   * piso mínimo de custo após o desconto.
   */
  peSpellReduction?: {
    filtro: string;
    min: number;
  };
  /**
   * 🛡 Quando presente, este efeito NÃO altera recurso numérico — ele
   * concede (`grant`) ou remove (`revoke`) uma imunidade no
   * `omniImmunities[]` do alvo. `escopo` segue a sintaxe de `immunity.ts`
   * (`todas`, `categoria:MENTAL`, `condicao:atordoado`).
   */
  immunityGrant?: {
    escopo: string;
    mode: 'grant' | 'revoke';
  };
  /**
   * 🩸 Aplica/remove uma condição (cego, surdo, morto…) no alvo.
   * Quando presente, o efeito NÃO altera recursos numéricos — apenas
   * registra/limpa a condição via `useCharacterStore.addCondition`/`removeCondition`.
   *
   * `id` deve ser um id válido em `ALL_CONDITIONS` (src/types/conditions.ts);
   * desconhecido = no-op silencioso.
   * `mode`:
   *   - 'apply'  → adiciona a condição (respeita imunidades).
   *   - 'remove' → remove todas as instâncias dessa condição do alvo.
   * `durationRounds`/`durationTurns`: -1 = indefinido (padrão).
   */
  conditionApply?: {
    id: string;
    mode: 'apply' | 'remove';
    durationRounds?: number;
    durationTurns?: number;
  };
  /**
   * 🎲 Switch baseado em rolagem aleatória.
   * No momento da execução, rola `dice` (ex.: `1d4`) e executa os
   * sub-efeitos da branch cujo `values` contém o resultado.
   *
   * Cada sub-efeito é um CombatEffect completo, executado pelo mesmo
   * runtime (suporta `conditionApply`, `peSpellReduction`, `immunityGrant`,
   * verbos numéricos e diceSwitch aninhado).
   *
   * O efeito-pai não consome a fórmula numérica nem o resourcePath:
   * funciona puramente como dispatcher.
   */
  diceSwitch?: {
    dice: string; // ex.: "1d4", "2d6"
    branches: Array<{
      values: number[]; // ex.: [1] ou [1,2,3]
      effects: CombatEffect[];
    }>;
  };
  /**
   * 🔘 Marcador "botão" — efeito sem ação que existe apenas para garantir
   * que o item apareça como botão clicável no painel mesmo sem nenhuma
   * outra ação atribuída. `formula` carrega o rótulo opcional do botão.
   */
  buttonOnly?: {
    label?: string;
  };
}

/** Cria um efeito vazio padrão. */
export function novoEfeitoCombate(): CombatEffect {
  return {
    id: crypto.randomUUID(),
    formula: '',
    type: 'SUBTRAIR',
    target: 'ALVO',
    damageType: 'Cortante',
    resourcePath: 'vida_atual',
  };
}

/**
 * Migração transparente: aceita CombatData antigo (`damageFormula` +
 * `damageType` + `resultType`) e devolve a forma nova com `effects[]`.
 *
 * Usado por leitores (CharacterCard / SimuladorPreview / ConstrutorEntidade)
 * para nunca quebrar entidades persistidas no zustand antes da refatoração.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizarCombatData(cd: any): CombatData | undefined {
  if (!cd) return undefined;

  // ---- Caminho A: já tem effects (forma nova ou intermediária) ----
  if (Array.isArray(cd.effects) || Array.isArray(cd.effectsActive) || Array.isArray(cd.effectsPassive)) {
    const passive: CombatEffect[] = Array.isArray(cd.effectsPassive) ? cd.effectsPassive : [];
    const active: CombatEffect[] = Array.isArray(cd.effectsActive) ? cd.effectsActive : [];

    let effectsPassive = passive;
    let effectsActive = active;

    // Migração: nem effectsPassive nem effectsActive existem ainda.
    // Distribui o `effects` legado conforme o antigo flag isActive.
    if (!Array.isArray(cd.effectsPassive) && !Array.isArray(cd.effectsActive)) {
      const legacy: CombatEffect[] = Array.isArray(cd.effects) ? cd.effects : [];
      if (cd.isActive === true) effectsActive = legacy;
      else effectsPassive = legacy;
    }

    return {
      effects: [...effectsPassive, ...effectsActive], // união derivada (back-compat)
      effectsPassive,
      effectsActive,
      critRange: cd.critRange ?? 20,
      critMultiplier: cd.critMultiplier ?? 2,
      actionCost: cd.actionCost,
      rangeType: cd.rangeType,
      aoeShape: cd.aoeShape,
      aoeSize: cd.aoeSize,
      isActive: effectsActive.length > 0, // derivado
    };
  }

  // ---- Caminho B: forma muito antiga (damageFormula/damageType/resultType) ----
  const legacyFormula: string = typeof cd.damageFormula === 'string' ? cd.damageFormula : '';
  const legacyType: string = typeof cd.damageType === 'string' ? cd.damageType : 'Cortante';
  const legacyResult: 'damage' | 'heal' | 'modifier' =
    cd.resultType === 'heal' ? 'heal' : cd.resultType === 'modifier' ? 'modifier' : 'damage';
  const mapType: CombatEffect['type'] =
    legacyResult === 'heal' ? 'ADICIONAR' : legacyResult === 'modifier' ? 'MODIFICADOR' : 'SUBTRAIR';
  const baseEffects: CombatEffect[] = legacyFormula
    ? [{
        id: crypto.randomUUID(),
        formula: legacyFormula,
        type: mapType,
        target: 'ALVO',
        damageType: legacyType,
      }]
    : [];
  // Heurística: forma muito antiga sem hint → trata como ativo (era o caso original).
  const effectsActive = baseEffects;
  const effectsPassive: CombatEffect[] = [];
  return {
    effects: [...effectsPassive, ...effectsActive],
    effectsPassive,
    effectsActive,
    critRange: cd.critRange ?? 20,
    critMultiplier: cd.critMultiplier ?? 2,
    actionCost: cd.actionCost,
    rangeType: cd.rangeType,
    aoeShape: cd.aoeShape,
    aoeSize: cd.aoeSize,
    isActive: effectsActive.length > 0,
  };
}

/** Pacote exportável (conjunto de entidades + metadados). */
export interface PacoteOmni {
  formato: 'omni-engine.v1';
  nome: string;
  autor?: string;
  geradoEm: number;
  entidades: EntidadeOmni[];
}

// ===== Helpers de criação =====

/**
 * Categorias cuja entidade é uma FONTE sempre-ativa enquanto existir
 * (passiva, aura, talento, condição). Para essas, a duração da entidade
 * NÃO faz sentido — ela é, por definição, `permanente` (i.e. enquanto
 * a fonte estiver presente). A duração relevante vive nas AÇÕES que
 * aplicam efeitos persistentes (APLICAR_CONDICAO, REROLL, buffs).
 *
 * Itens e feitiços continuam podendo declarar duração na entidade
 * (ex.: poção de cura instantânea, feitiço de 10 minutos).
 */
export const CATEGORIAS_SEMPRE_ATIVAS: ReadonlySet<CategoriaEntidade> = new Set([
  'passiva',
  'aura',
  'talento',
  'condicao',
  'voto',
]);

export function ehCategoriaSempreAtiva(c: CategoriaEntidade): boolean {
  return CATEGORIAS_SEMPRE_ATIVAS.has(c);
}

export function novaEntidade(categoria: CategoriaEntidade, nome = 'Nova Entidade'): EntidadeOmni {
  const now = Date.now();
  // Passivas/auras/talentos/condições nascem como `permanente` — a duração
  // pertence aos efeitos individuais aplicados pelos gatilhos delas.
  const duracaoInicial: DuracaoEntidade = ehCategoriaSempreAtiva(categoria)
    ? { tipo: 'permanente' }
    : { tipo: 'instantaneo' };
  return {
    id: crypto.randomUUID(),
    versao: 1,
    nome,
    categoria,
    descricao: '',
    tags: [],
    duracao: duracaoInicial,
    custos: [],
    gatilhos: [
      {
        id: crypto.randomUUID(),
        evento: 'aoEquipar',
        blocos: [],
      },
    ],
    criadoEm: now,
    atualizadoEm: now,
  };
}

export function novoBloco(): BlocoLogico {
  return {
    id: crypto.randomUUID(),
    condicoes: [],
    modo: 'todas',
    acoes: [],
  };
}

export type ReplicaPorte = 'minusculo' | 'pequeno' | 'medio' | 'grande' | 'enorme' | 'colossal';

/** Configuração de Réplica Materializável definida pelo Mestre. */
export interface ReplicaConfig {
  porte: ReplicaPorte;
  peInvocacao: number;
  peSustentacao: number;
  desintegrarAoSoltar: boolean;
  cobrarPorRodada: boolean;
}
