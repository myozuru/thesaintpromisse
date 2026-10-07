/** Viagem no Mapa do Mundo: distância pela escala, tempo pelo transporte e encontros sorteados. */
export const TRANSPORTES = {
  a_pe: { nome: 'A pé', kmDia: 30 },
  cavalo: { nome: 'Cavalo', kmDia: 60 },
  carroca: { nome: 'Carroça', kmDia: 40 },
  carro: { nome: 'Carro', kmDia: 400 },
  trem: { nome: 'Trem', kmDia: 800 },
  barco: { nome: 'Barco', kmDia: 120 },
} as const;
export type Transporte = keyof typeof TRANSPORTES;

/** Pontos em % da imagem; escalaKm = largura total do mapa em km; proporcao = altura/largura. */
export function distanciaKm(a: { x: number; y: number }, b: { x: number; y: number }, escalaKm: number, proporcao: number): number {
  const dx = ((b.x - a.x) / 100) * escalaKm;
  const dy = ((b.y - a.y) / 100) * escalaKm * proporcao;
  return Math.hypot(dx, dy);
}

/** Segundos do mundo gastos na viagem (mínimo 1 minuto). */
export function tempoViagemSegundos(km: number, kmDia: number): number {
  if (km <= 0 || kmDia <= 0) return 0;
  return Math.max(60, Math.round((km / kmDia) * 86400));
}

/** Uma chance por dia iniciado de viagem; devolve em quais dias (1..n) houve encontro. */
export function sortearEncontros(chancePct: number, segundos: number, rng: () => number = Math.random): number[] {
  const dias = Math.max(1, Math.ceil(segundos / 86400));
  const out: number[] = [];
  for (let d = 1; d <= dias; d++) if (rng() * 100 < chancePct) out.push(d);
  return out;
}

export function formatarDuracao(seg: number): string {
  const d = Math.floor(seg / 86400), h = Math.floor((seg % 86400) / 3600), m = Math.floor((seg % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, !d && m && `${m}min`].filter(Boolean).join(' ') || '0min';
}
