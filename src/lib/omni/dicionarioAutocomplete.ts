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
  { valor: 'somar',     categoria: 'Verbo', hint: 'somar X em recurso (+)' },
  { valor: 'subtrair',  categoria: 'Verbo', hint: 'subtrair X em recurso (−)' },
  { valor: 'definir',   categoria: 'Verbo', hint: 'definir recurso = X' },
  { valor: 'imune',     categoria: 'Verbo', hint: '🛡 imune <condição|categoria:X|todas>' },
  { valor: 'desimune',  categoria: 'Verbo', hint: '🛡 remove imunidade (mesmo formato)' },
  { valor: 'todas',     categoria: 'Escopo', hint: '🛡 todas as condições' },
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
  { valor: 'por_fonte', categoria: 'Contador', hint: '🔢 teto separado para cada ficha de origem' },
  { valor: 'tudo',      categoria: 'Contador', hint: '🔢 subtrair tudo em contador_x (gasta tudo → @CENA.consumido)' },
];

/** Coleta todos os IDs/aliases relevantes do sistema. */
function compilarDicionario(): SugestaoAutocomplete[] {
  const lista: SugestaoAutocomplete[] = [...VERBOS];
  const seen = new Set<string>(VERBOS.map((v) => v.valor.toLowerCase()));

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

/** Caracteres considerados parte de uma "palavra" de identificador. */
const RE_PALAVRA = /[A-Za-z0-9_.@:]/;

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
  const matches = DICIONARIO_AUTOCOMPLETE.filter((s) =>
    s.valor.toLowerCase().startsWith(p),
  );
  // Ordena: exato primeiro, depois alfabético.
  matches.sort((a, b) => {
    if (a.valor.toLowerCase() === p) return -1;
    if (b.valor.toLowerCase() === p) return 1;
    return a.valor.localeCompare(b.valor);
  });
  return matches.slice(0, limite);
}
