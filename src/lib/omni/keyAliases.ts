import { interpretarComposicao } from './componentes/interpretar';
import { interpretarChaveMitigacao } from './chavesMitigacao';
/**
 * 🧭 Mapa central de aliases ↔ chaves canônicas curtas do Omni.
 *
 * Antes desta unificação coexistiam:
 *   - Caminhos longos legados (ex.: `status.vida.atual`, `atributos.forca`).
 *   - Caminhos curtos no parser (ex.: `VIDA`, `FOR`).
 *   - Sinônimos pt-BR (`vida_atual`, `hp`, `pv`, `forca`).
 *
 * Agora todos colapsam para uma chave canônica curta (snake_case).
 * Tanto a leitura (resolvedor) quanto a escrita (aplicarEfeito) e o parser
 * passam a normalizar via {@link canonicalizarChave}, mantendo
 * retro-compatibilidade total com efeitos/entidades já salvos.
 */

import { ROTULOS_PERICIAS, SISTEMA_PERICIAS } from './constantesDoSistema';

/** Mapa: forma legada (qualquer variação) → chave canônica curta. */
export const LEGACY_TO_CANONICAL: Record<string, string> = {
  // — Vida —
  'status.vida.atual': 'vida',
  'vida_atual': 'vida',
  'hp': 'vida',
  'pv': 'vida',
  'status.vida.max': 'vida_max',
  'hp_max': 'vida_max',
  'pv_max': 'vida_max',

  // — Energia (PE / Amaldiçoada) —
  'status.energiaamaldicoada.atual': 'pe',
  'energia': 'pe',
  'energia_atual': 'pe',
  'pe_atual': 'pe',
  'status.energiaamaldicoada.max': 'pe_max',
  'energia_max': 'pe_max',

  // — Status de combate —
  'status.defesa': 'defesa',
  'status.deslocamento': 'desloc',
  'deslocamento': 'desloc',
  'status.bonustreinamento': 'treino',
  'bonus_treinamento': 'treino',
  'bonustreinamento': 'treino',
  'status.nivel': 'nivel',
  'status.nivelexaustao': 'exaustao',
  'nivel_exaustao': 'exaustao',
  'exaustao_nivel': 'exaustao',
  'stats.modificadorataque': 'acerto',
  'stats.margemcritico': 'crit_marg',
  'stats.multiplicadorcritico': 'crit_mult',
  'stats.esquiva': 'esquiva',
  'stats.resistenciaamaldicoada': 'rd_curse',

  // — Atributos —
  'atributos.forca':         'for',
  'atributos.destreza':      'des',
  'atributos.constituicao':  'con',
  'atributos.inteligencia':  'int',
  'atributos.sabedoria':     'sab',
  'atributos.presenca':      'pre',
  'forca': 'for',
  'destreza': 'des',
  'constituicao': 'con',
  'inteligencia': 'int',
  'sabedoria': 'sab',
  'presenca': 'pre',
  'carisma': 'pre',
  'car': 'pre',
};

/**
 * Reverso (curto → caminho legado profundo). Usado pelo resolvedor para
 * continuar lendo do `Character` real sem reescrever o schema interno.
 */
export const CANONICAL_TO_LEGACY_PATH: Record<string, string> = {
  vida:      'status.vida.atual',
  vida_max:  'status.vida.max',
  pe:        'status.energiaAmaldicoada.atual',
  pe_max:    'status.energiaAmaldicoada.max',
  defesa:    'status.defesa',
  desloc:    'status.deslocamento',
  treino:    'status.bonusTreinamento',
  nivel:     'status.nivel',
  exaustao:  'status.nivelExaustao',
  acerto:    'stats.modificadorAtaque',
  crit_marg: 'stats.margemCritico',
  crit_mult: 'stats.multiplicadorCritico',
  esquiva:   'stats.esquiva',
  rd_curse:  'stats.resistenciaAmaldicoada',
  for: 'atributos.forca',
  des: 'atributos.destreza',
  con: 'atributos.constituicao',
  int: 'atributos.inteligencia',
  sab: 'atributos.sabedoria',
  pre: 'atributos.presenca',
};

/** Lista de canônicas curtas (para auditoria / UI). */
export const CHAVES_CANONICAS = Object.keys(CANONICAL_TO_LEGACY_PATH);

function normalizar(s: string): string {
  return s
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizarId(s: string): string {
  return normalizar(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function canonicalizarPericiaNatural(norm: string): string | undefined {
  for (const [chave, caminho] of Object.entries(SISTEMA_PERICIAS)) {
    const id = caminho.replace(/^pericias\./, 'pericia_');
    const sub = id.slice('pericia_'.length);
    const rotulo = ROTULOS_PERICIAS[chave as keyof typeof ROTULOS_PERICIAS];
    if (
      norm === normalizar(caminho) ||
      norm === normalizar(id) ||
      norm === normalizar(sub) ||
      normalizarId(norm) === normalizarId(rotulo)
    ) {
      return id;
    }
  }
  return undefined;
}

/**
 * Resolve qualquer forma (legada longa, sinônimo pt-BR, sigla, prefixo
 * `@USUARIO.`) para a chave canônica curta. Mantém perícias e TRs intactos
 * (já são curtos por design: `pericia_<x>`, `fortitude`, etc.).
 */
export function canonicalizarChave(raw?: string): string {
  if (!raw) return '';
  const semPrefixo = raw.replace(/^@?(usuario|alvo|cena|area|item)\./i, '');
  if (/\s/.test(semPrefixo)) {
    const p = interpretarComposicao(semPrefixo.trim());
    if (p.referencia && !p.erro && p.consumido === semPrefixo.trim().length) return semPrefixo.trim();
  }
  const norm = normalizar(semPrefixo);
  const mitigacao = interpretarChaveMitigacao(norm);
  if (mitigacao) return mitigacao.chave;
  if (LEGACY_TO_CANONICAL[norm]) return LEGACY_TO_CANONICAL[norm];
  const periciaNatural = canonicalizarPericiaNatural(norm);
  if (periciaNatural) return periciaNatural;
  // Já está canônico? devolve como tá.
  if (CANONICAL_TO_LEGACY_PATH[norm]) return norm;
  // Perícias e TRs: padrões já curtos.
  if (/^pericia_[a-z0-9_]+$/.test(norm)) return norm;
  if (/^(fortitude|reflexos|integridade|astucia|vontade)$/.test(norm)) return norm;
  return norm; // mantém custom flags / outros como estão
}

/**
 * Devolve o caminho profundo no Character correspondente à chave canônica.
 * Usado pelo resolvedor para ler do shape projetado.
 */
export function expandirParaCaminhoLegado(canonical: string): string {
  return CANONICAL_TO_LEGACY_PATH[canonical] ?? canonical;
}
