/**
 * 📚 Dicionário Unificado de Autocomplete — Omni-Script.
 *
 * Compila todas as palavras válidas (verbos/keywords, recursos, atributos,
 * perícias, TRs, flags, gatilhos e aliases) em uma única lista usada pelo
 * Tab-Completion estilo Minecraft/IntelliSense do terminal.
 */
import {
  ACOES_EFEITO,
  ALIASES_FORMULA,
  DICIONARIO_CHAVES_OMNI,
  ROTULOS_GATILHOS,
} from './constantesDoSistema';
import { listarAliasesParaAutocomplete } from './gatilhoAliases';
import { ALL_CONDITIONS, CONDITION_CATEGORIES } from '@/types/conditions';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from '@/types';
import { CATALOGO_COMPONENTES_UI } from './componentes/catalogoUI';
import { tokenizarComposicao } from './componentes/lexer';

export interface SugestaoAutocomplete {
  /** Texto que será inserido. */
  valor: string;
  /** Categoria amigável (Verbo, Recurso, Atributo, TR, Perícia, Alias…). */
  categoria: string;
  /** Hint/descrição para tooltip. */
  hint?: string;
}

/** Verbos e palavras reservadas da OmniScript. */
const VERBOS: SugestaoAutocomplete[] = [
  { valor: '@ARMA.DANO', categoria: 'Fórmula', hint: 'Rola o dano-base da arma ativa na fórmula.' },
  { valor: '@ARMA.DADOS', categoria: 'Fórmula', hint: 'Quantidade de dados no dano-base da arma.' },
  { valor: '@ARMA.PASSO', categoria: 'Fórmula', hint: 'Lados do maior dado-base da arma.' },
  { valor: '@ARMA.CRITICO_MARGEM', categoria: 'Fórmula', hint: 'Resultado natural que inicia um crítico da arma.' },
  { valor: 'somar',     categoria: 'Verbo', hint: 'somar X em recurso (+)' },
  { valor: 'subtrair',  categoria: 'Verbo', hint: 'subtrair X em recurso (−)' },
  { valor: 'definir',   categoria: 'Verbo', hint: 'definir recurso = X' },
  { valor: 'transferir', categoria: 'Verbo', hint: 'transferir 2 de reserva pe para pe: conserva o saldo que não cabe.' },
  { valor: 'imune',     categoria: 'Verbo', hint: '🛡 imune <condição|categoria:X|todas>' },
  { valor: 'desimune',  categoria: 'Verbo', hint: '🛡 remove imunidade (mesmo formato)' },
  { valor: 'todas',     categoria: 'Escopo', hint: '🛡 todas as condições' },
  { valor: 'tipo', categoria: 'Dano', hint: 'Tipo do golpe: subtrair 1d8 em vida tipo DQ (fogo).' },
  { valor: 'turnos', categoria: 'Duração', hint: 'aplicar cego turnos 2.' },
  { valor: 'rodadas', categoria: 'Duração', hint: 'aplicar cego rodadas 2.' },
  { valor: 'em',        categoria: 'Conector', hint: 'liga valor ao recurso' },
  { valor: 'quando',    categoria: 'Gatilho', hint: 'inicia bloco condicional' },
  { valor: 'se',        categoria: 'Condição', hint: 'condição lógica' },
  { valor: 'abaixo',    categoria: 'Comparador', hint: 'abaixo de X' },
  { valor: 'acima',     categoria: 'Comparador', hint: 'acima de X' },
  { valor: 'igual',     categoria: 'Comparador', hint: 'igual a X' },
  { valor: 'de',        categoria: 'Conector' },
  { valor: 'a',         categoria: 'Conector' },
  { valor: 'e',         categoria: 'Operador', hint: 'soma na fórmula (+)' },
  { valor: 'contador_', categoria: 'Contador', hint: '🔢 contador livre: somar 1 em contador_rancor' },
  { valor: 'ate',       categoria: 'Contador', hint: '🔢 teto: … em contador_x ate @USUARIO.treino' },
  { valor: 'por_fonte', categoria: 'Contador', hint: '🔢 registra a ficha que originou cada parcela; o teto continua global' },
  { valor: 'teto_aliado', categoria: 'Contador', hint: '🔢 limite por fonte; complete com uma quantidade e “por rodada” ou “por descanso”' },
  { valor: 'tudo',      categoria: 'Contador', hint: '🔢 subtrair tudo em contador_x (gasta tudo → @CENA.consumido)' },
];

/** Coleta todos os IDs/aliases relevantes do sistema. */
function compilarDicionario(): SugestaoAutocomplete[] {
  const lista: SugestaoAutocomplete[] = [...VERBOS];
  const seen = new Set<string>(VERBOS.map((v) => v.valor.toLowerCase()));
  for (const c of CATALOGO_COMPONENTES_UI) {
    if (seen.has(c.key)) {
      const existente = lista.find(s => s.valor === c.key);
      if (existente) { existente.hint = c.funcao; existente.categoria = 'Componente'; }
      continue;
    }
    seen.add(c.key);
    lista.push({ valor: c.key, categoria: 'Componente', hint: c.funcao });
  }

  // Recursos / atributos / perícias / TRs vindos do dicionário oficial.
  for (const cat of DICIONARIO_CHAVES_OMNI) {
    for (const item of cat.itens) {
      // Pega só a parte "limpa" (após o último ponto), exceto se já é prefixada.
      const id = item.id;
      const base = id.includes('.') ? id : id;
      const key = base.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        lista.push({ valor: base, categoria: cat.grupo, hint: item.hint || item.label });
      }
    }
  }

  for (const codigo of DAMAGE_TYPES) {
    lista.push({ valor: codigo, categoria: 'Tipo de dano', hint: DAMAGE_TYPE_LABELS[codigo] });
  }

  // Aliases de fórmula (TREINO, VIDA, PE, FOR…) — em minúsculas para o usuário.
  for (const alias of Object.keys(ALIASES_FORMULA)) {
    const key = alias.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lista.push({ valor: key, categoria: 'Alias', hint: `→ ${ALIASES_FORMULA[alias]}` });
    }
  }

  // Gatilhos nomeados (ids técnicos — fallback p/ retrocompat).
  for (const [id, label] of Object.entries(ROTULOS_GATILHOS)) {
    const key = id.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lista.push({ valor: id, categoria: 'Gatilho', hint: label });
    }
  }

  // Aliases pt-BR de eventos (`@fim_turno`, `@inicio_rodada`, …) —
  // forma preferida; insere com `@` e ` -> ` pré-prontos.
  for (const { alias, rotulo } of listarAliasesParaAutocomplete()) {
    const valor = `@${alias} -> `;
    const key = valor.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lista.push({ valor, categoria: 'Evento', hint: rotulo });
    }
  }

  // Ações/keys do construtor (REDUZIR_PE, ESCOPO_*, APLICAR_CONDICAO…).
  for (const [id, def] of Object.entries(ACOES_EFEITO)) {
    const key = id.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lista.push({ valor: id, categoria: 'Ação', hint: def.ui });
    }
  }

  // 🛡 Escopos de imunidade — usados após `imune`/`desimune`.
  // Inclui cada condição (`condicao:<id>`), cada categoria (`categoria:<NOME>`)
  // e também o NOME NU da condição (ex.: `cego`), que o parser interpreta
  // como `condicao:cego` automaticamente.
  for (const cond of ALL_CONDITIONS) {
    // Forma com prefixo (explícita)
    const valor = `condicao:${cond.id}`;
    const key = valor.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lista.push({
        valor,
        categoria: 'Imunidade',
        hint: `${cond.icon ?? '🛡'} ${cond.name} — ${cond.category}`,
      });
    }
    // Forma curta (nome nu) — sugerida em qualquer lugar do script.
    const keyNu = cond.id.toLowerCase();
    if (!seen.has(keyNu)) {
      seen.add(keyNu);
      lista.push({
        valor: cond.id,
        categoria: 'Condição',
        hint: `${cond.icon ?? '🛡'} ${cond.name} — use após 'imune' ou 'desimune'`,
      });
    }
  }
  for (const cat of CONDITION_CATEGORIES) {
    const valor = `categoria:${cat}`;
    const key = valor.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lista.push({
        valor,
        categoria: 'Imunidade',
        hint: `🛡 Categoria inteira: ${cat}`,
      });
    }
  }

  return lista;
}

export const DICIONARIO_AUTOCOMPLETE: SugestaoAutocomplete[] = compilarDicionario();

// Ordenação e normalização feitas uma vez, fora do caminho de digitação.
const INDICE_AUTOCOMPLETE = DICIONARIO_AUTOCOMPLETE
  .map(s => ({ sugestao: s, prefixo: s.valor.toLowerCase() }))
  .sort((a, b) => a.sugestao.valor.localeCompare(b.sugestao.valor));

/** Caracteres considerados parte de uma "palavra" de identificador. */
const RE_PALAVRA = /[\p{L}\p{N}_.@:-]/u;

/**
 * Dado o texto completo e a posição do caret, devolve o prefixo (palavra
 * incompleta imediatamente antes do cursor) e seus limites.
 */
export function extrairPrefixoNoCaret(texto: string, caret: number): {
  prefixo: string;
  inicio: number;
  fim: number;
} {
  let i = caret;
  while (i > 0 && RE_PALAVRA.test(texto[i - 1])) i--;
  return { prefixo: texto.slice(i, caret), inicio: i, fim: caret };
}

/** Filtra o dicionário por prefixo (case-insensitive), ordenado. */
export function filtrarSugestoes(prefixo: string, limite = 12): SugestaoAutocomplete[] {
  if (!prefixo) return [];
  const p = prefixo.toLowerCase();
  const exatos: SugestaoAutocomplete[] = [], demais: SugestaoAutocomplete[] = [];
  for (const item of INDICE_AUTOCOMPLETE) {
    if (item.prefixo === p) exatos.push(item.sugestao);
    else if (item.prefixo.startsWith(p)) demais.push(item.sugestao);
  }
  return [...exatos, ...demais].slice(0, limite);
}

/** Completa uma parte, preservando as anteriores e evitando tratar argumentos como keys. */
export function sugerirNoCaret(texto: string, caret: number, limite = 12): SugestaoAutocomplete[] {
  const p = extrairPrefixoNoCaret(texto, caret);
  const antes = texto.slice(0, p.inicio);
  // Aspas abertas indicam um argumento em edição, não uma nova key.
  if (/["'“]/.test(antes)) {
    let aspas = '';
    for (let i = 0; i < antes.length; i++) {
      const c = antes[i];
      if (aspas && c === '\\') { i++; continue; }
      if (aspas && c === aspas) aspas = '';
      else if (!aspas && ['"', "'", '“'].includes(c)) aspas = c === '“' ? '”' : c;
    }
    if (aspas) return [];
  }
  let fim = antes.length;
  while (fim > 0 && /\s/u.test(antes[fim - 1])) fim--;
  let inicio = fim;
  while (inicio > 0 && /[\p{L}\p{N}_]/u.test(antes[inicio - 1])) inicio--;
  const ultimo = inicio < fim ? tokenizarComposicao(antes.slice(inicio, fim)).tokens.at(-1) : undefined;
  if (ultimo?.tipo === 'componente' && ['contador','buff','item','feitico','talento','habilidade','origem','especializacao','fonte','grupo','moeda','saldo'].includes(ultimo.valor)) return [];
  if (ultimo?.tipo === 'componente' && ultimo.valor === 'condicao') return ALL_CONDITIONS
    .filter(c => c.id.toLowerCase().startsWith(p.prefixo.toLowerCase())).slice(0, limite)
    .map(c => ({ valor: c.id, categoria: 'Condição', hint: `${c.name}: ${c.description}` }));
  const lista = filtrarSugestoes(p.prefixo, 1000);
  const comp = lista.filter(s => s.categoria === 'Componente');
  if (ultimo?.tipo === 'componente' && ultimo.valor === 'arma_principal') {
    const propriedades = new Set(['leve','pesada','versatil','fineza','corpo_a_corpo','distancia','grupo','margem_critico']);
    return comp.filter(s => propriedades.has(s.valor)).slice(0, limite);
  }
  return [...comp, ...lista.filter(s => s.categoria !== 'Componente')].slice(0, limite);
}
