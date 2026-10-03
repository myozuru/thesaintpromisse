import type { AcaoAtivaConfig, EntidadeOmni } from './tipos';

export type AcaoDoInventario = { instanceId: string; ent: EntidadeOmni; cfg: AcaoAtivaConfig };
export type GrupoAcaoAtiva = { chave: string; exemplares: AcaoDoInventario[] };

/** Um card por ação equivalente do mesmo template, mantendo as instâncias utilizáveis. */
export function agruparAcoesAtivas(acoes: AcaoDoInventario[]): GrupoAcaoAtiva[] {
  const grupos = new Map<string, GrupoAcaoAtiva>();
  // Ordenação das propriedades torna a comparação independente da ordem no JSON.
  const serializar = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(serializar).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${serializar(x)}`).join(',')}}`;
    return JSON.stringify(v) ?? 'null';
  };
  for (const acao of acoes) {
    const { id: _id, ...regra } = acao.cfg;
    const chave = `${acao.ent.id}:${serializar(regra)}`;
    let grupo = grupos.get(chave);
    if (!grupo) { grupo = { chave, exemplares: [] }; grupos.set(chave, grupo); }
    if (!grupo.exemplares.some(e => e.instanceId === acao.instanceId)) grupo.exemplares.push(acao);
  }
  return [...grupos.values()];
}
