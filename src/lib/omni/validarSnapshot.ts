import type { EntidadeOmni } from "./tipos";
import type { EfeitoAtivo } from "@/stores/useOmniRuntimeStore";
import type { Posicao } from "@/stores/useOmniSpatialStore";
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
export const entidadeSyncValida = (x: unknown, id: string): x is EntidadeOmni =>
  obj(x) &&
  x.id === id &&
  typeof x.nome === "string" &&
  Array.isArray(x.gatilhos) &&
  Array.isArray(x.tags);
export const efeitoSyncValido = (x: unknown, id: string): x is EfeitoAtivo =>
  obj(x) &&
  x.id === id &&
  typeof x.entidadeId === "string" &&
  Number.isFinite(x.iniciadoEm) &&
  (x.expiraEm === null || Number.isFinite(x.expiraEm));
export const posicaoSyncValida = (x: unknown, _id: string): x is Posicao =>
  obj(x) && Number.isFinite(x.x) && Number.isFinite(x.y);
