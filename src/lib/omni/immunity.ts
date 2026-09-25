/**
 * 🛡 Sistema nativo de Imunidade do Omni-Engine.
 *
 * Diferente do padrão "remover ao receber" (que ainda dispara a condição
 * por uma fração de segundo), aqui a condição é **bloqueada na fonte**:
 * `useCharacterStore.addCondition` consulta `temImunidade()` antes de
 * persistir no `activeConditions` do personagem.
 *
 * Escopos suportados (campo `caminhoAlvo` da AcaoLogica):
 *   - `todas`               → imunidade a qualquer condição
 *   - `categoria:<NOME>`    → categoria inteira (FÍSICA, MENTAL, …)
 *   - `condicao:<id>`       → condição específica (ex.: atordoado)
 *
 * Persistência: armazenado em `Character.omniImmunities` (Set serializado
 * como string[]). Cada entrada é o escopo bruto (`condicao:atordoado`,
 * `categoria:MENTAL`, `todas`).
 */
import { ALL_CONDITIONS, type ConditionCategory } from '@/types/conditions';
import type { Character } from '@/types';
import { derivarPassivasContinuas } from './passivasDerivadas';

export type EscopoImunidade = string; // ex.: "condicao:atordoado"

function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Resolve qualquer entrada (id ou nome) para o `id` canônico da condição. */
function idCondicao(input: string): string | null {
  const norm = normalizar(input);
  const def = ALL_CONDITIONS.find(
    (c) => normalizar(c.id) === norm || normalizar(c.name) === norm,
  );
  return def?.id ?? null;
}

function categoriaDe(condId: string): ConditionCategory | null {
  return ALL_CONDITIONS.find((c) => c.id === condId)?.category ?? null;
}

/** Decide se um personagem é imune à condição informada. */
export function temImunidade(char: Pick<Character, 'omniImmunities'>, condicao: { id?: string; name?: string }): boolean {
  // 🪶 Une imunidades persistidas + derivadas de passivas contínuas.
  const persistidas = char.omniImmunities ?? [];
  let derivadas: string[] = [];
  // Só calcula se o char vier com omniAtivos (ou seja, é o Character cheio).
  const cheio = char as Partial<Character>;
  if (cheio.omniAtivos?.length) {
    try {
      derivadas = derivarPassivasContinuas(cheio as Character).immunities;
    } catch {
      derivadas = [];
    }
  }
  const list = [...persistidas, ...derivadas];
  if (list.length === 0) return false;

  const cid = idCondicao(condicao.id ?? condicao.name ?? '');
  if (!cid) return false;
  const cat = categoriaDe(cid);

  for (const escopoRaw of list) {
    const escopo = escopoRaw.trim();
    if (!escopo) continue;
    if (normalizar(escopo) === 'todas') return true;

    const [tipo, valor] = escopo.split(':').map((s) => s.trim());
    if (!tipo) continue;

    if (normalizar(tipo) === 'condicao' && valor) {
      const alvoId = idCondicao(valor);
      if (alvoId && alvoId === cid) return true;
    }
    if (normalizar(tipo) === 'categoria' && valor && cat) {
      if (normalizar(valor) === normalizar(cat)) return true;
    }
  }
  return false;
}

/** Adiciona um escopo de imunidade (sem duplicar). */
export function adicionarImunidade(lista: string[] | undefined, escopo: string): string[] {
  const atual = lista ?? [];
  const norm = normalizar(escopo);
  if (atual.some((e) => normalizar(e) === norm)) return atual;
  return [...atual, escopo];
}

/** Remove um escopo de imunidade. */
export function removerImunidade(lista: string[] | undefined, escopo: string): string[] {
  const atual = lista ?? [];
  const norm = normalizar(escopo);
  return atual.filter((e) => normalizar(e) !== norm);
}

/** Rótulo bonito para UI. */
export function formatarImunidade(escopo: string): string {
  const e = escopo.trim();
  if (normalizar(e) === 'todas') return '🛡 Todas as condições';
  const [tipo, valor] = e.split(':').map((s) => s.trim());
  if (normalizar(tipo) === 'categoria' && valor) return `🛡 Categoria ${valor}`;
  if (normalizar(tipo) === 'condicao' && valor) {
    const cid = idCondicao(valor);
    const def = cid ? ALL_CONDITIONS.find((c) => c.id === cid) : null;
    return `🛡 ${def?.icon ?? ''} ${def?.name ?? valor}`.trim();
  }
  return `🛡 ${escopo}`;
}
