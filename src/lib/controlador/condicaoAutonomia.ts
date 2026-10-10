type ValorCondicao = string | number | boolean | null;
export type CondicaoAutonomia =
  | { op: 'all' | 'any'; conditions: CondicaoAutonomia[] }
  | { op: 'not'; condition: CondicaoAutonomia }
  | { op: 'exists'; path: string }
  | { op: 'compare'; path: string; cmp: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; value: ValorCondicao };

const MAX_PROFUNDIDADE_CONDICAO = 8;
const MAX_NOS_CONDICAO = 64;

function objeto(valor: unknown): Record<string, unknown> | undefined {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : undefined;
}

export function caminhoSeguro(path: string): boolean {
  if (path.length > 160 || path.split('.').some(parte => !parte || parte === '__proto__' || parte === 'prototype' || parte === 'constructor')) return false;
  return /^(evento\.(nome|usuarioId|alvoId|cena\.[A-Za-z][A-Za-z0-9_]*|dano\.[A-Za-z][A-Za-z0-9_]*)|dono\.(id|name|category|hpCurrent|hpMax|peCurrent)|alvo\.(id|name|category|hpCurrent|hpMax|peCurrent)|shikigami\.(id|nome|estado|hpAtual|hpMaximo))$/.test(path);
}

export function validarCondicaoAutonomia(valor: unknown, profundidade = 0, contador = { total: 0 }): CondicaoAutonomia | undefined {
  if (profundidade > MAX_PROFUNDIDADE_CONDICAO || contador.total >= MAX_NOS_CONDICAO) return undefined;
  contador.total += 1;
  const registro = objeto(valor);
  if (!registro || typeof registro.op !== 'string') return undefined;
  if (registro.op === 'all' || registro.op === 'any') {
    if (!Array.isArray(registro.conditions) || registro.conditions.length < 1 || registro.conditions.length > 16) return undefined;
    const conditions = registro.conditions.map(item => validarCondicaoAutonomia(item, profundidade + 1, contador));
    if (conditions.some(item => !item)) return undefined;
    return { op: registro.op, conditions: conditions as CondicaoAutonomia[] };
  }
  if (registro.op === 'not') {
    const condition = validarCondicaoAutonomia(registro.condition, profundidade + 1, contador);
    return condition ? { op: 'not', condition } : undefined;
  }
  if ((registro.op === 'exists' || registro.op === 'compare') && typeof registro.path === 'string' && caminhoSeguro(registro.path)) {
    if (registro.op === 'exists') return { op: 'exists', path: registro.path };
    const value = registro.value;
    const cmp = registro.cmp;
    if (((typeof value === 'string' && value.length <= 500) || typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' || value === null) &&
      ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(String(cmp))) {
      return { op: 'compare', path: registro.path, cmp: cmp as 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte', value };
    }
  }
  return undefined;
}

function lerCaminho(contexto: Record<string, unknown>, caminho: string): ValorCondicao | undefined {
  const partes = caminho.split('.');
  let atual: unknown = contexto;
  for (const parte of partes) {
    const registro = objeto(atual);
    if (!registro || !Object.hasOwn(registro, parte)) return undefined;
    atual = registro[parte];
  }
  if (typeof atual === 'string' || typeof atual === 'boolean' || atual === null) return atual;
  return typeof atual === 'number' && Number.isFinite(atual) ? atual : undefined;
}

export function avaliarCondicaoAutonomia(condicao: CondicaoAutonomia | undefined, contexto: Record<string, unknown>): boolean {
  if (!condicao) return true;
  if (condicao.op === 'all') return condicao.conditions.every(item => avaliarCondicaoAutonomia(item, contexto));
  if (condicao.op === 'any') return condicao.conditions.some(item => avaliarCondicaoAutonomia(item, contexto));
  if (condicao.op === 'not') return !avaliarCondicaoAutonomia(condicao.condition, contexto);
  if (condicao.op !== 'exists' && condicao.op !== 'compare') return false;
  const atual = lerCaminho(contexto, condicao.path);
  if (condicao.op === 'exists') return atual !== undefined && atual !== null;
  if (atual === undefined) return false;
  switch (condicao.cmp) {
    case 'eq': return atual === condicao.value;
    case 'neq': return atual !== condicao.value;
    case 'gt': return typeof atual === 'number' && typeof condicao.value === 'number' && atual > condicao.value;
    case 'gte': return typeof atual === 'number' && typeof condicao.value === 'number' && atual >= condicao.value;
    case 'lt': return typeof atual === 'number' && typeof condicao.value === 'number' && atual < condicao.value;
    case 'lte': return typeof atual === 'number' && typeof condicao.value === 'number' && atual <= condicao.value;
    default: return false;
  }
}
