import type { AcaoAtivaConfig } from './tipos';

/** Golpes que usam dano da arma exigem acerto, inclusive em configurações antigas. */
export function testeEfetivoAtivo(cfg: AcaoAtivaConfig): AcaoAtivaConfig['teste'] {
  if (cfg.teste !== 'nenhum' || (cfg.tipo_efeito ?? 'dano') !== 'dano' ||
      cfg.tipo_alvo === 'area' || cfg.tipo_alvo === 'proprio' || cfg.filtro_alvo === 'aliados') return cfg.teste;
  return cfg.incluirArma || /@ARMA\.DANO\b/i.test(cfg.dano ?? '') ? 'ataque' : cfg.teste;
}
