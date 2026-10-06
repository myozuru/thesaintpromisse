import { describe, it, expect } from 'vitest';
import { dividirRecompensa, questExpirou, formatarRestante, prazoEmSegundos, diaDoMundo } from '@/lib/economia/quests';
import {
  PECHINCHA_PADRAO, cdEfetiva, faixaPechincha, registrarTentativa, tentativasRestantes, precoAjustado, ajusteVigente,
} from '@/lib/economia/pechincha';
import { canSellItemToShop } from '@/lib/omni/comercio';
import { novaEntidade } from '@/lib/omni/tipos';
import type { Shop } from '@/stores/useShopStore';

const shop = (p: Partial<Shop> = {}): Shop => ({ id: 's', name: 'L', description: '', acceptedTags: [], categorias: [], inventory: [], currencyId: 'yen', buyMultiplier: 0.5, createdAt: 0, ...p });

describe('recompensa de quest', () => {
  it('divide igualmente e o resto vai ao primeiro', () => {
    expect(dividirRecompensa(100, ['a', 'b', 'c'])).toEqual({ a: 34, b: 33, c: 33 });
    expect(dividirRecompensa(90, ['a', 'b'])).toEqual({ a: 45, b: 45 });
  });
});

describe('prazo no tempo do mundo', () => {
  it('expira quando o relógio do mundo alcança o fim', () => {
    const fim = 1000 + prazoEmSegundos(2, 5);
    expect(questExpirou(fim, fim - 1)).toBe(false);
    expect(questExpirou(fim, fim)).toBe(true);
    expect(questExpirou(null, 1e12)).toBe(false);
    expect(formatarRestante(fim, 1000)).toBe('2d 5h restantes');
  });
});

describe('categorias aceitas', () => {
  it('espada vende no ferreiro e não na padaria', () => {
    const it = novaEntidade('arma');
    it.comercio = { basePrice: 100, hiddenTags: [], isBought: false, categoriasAceitas: ['ferreiro'] };
    expect(canSellItemToShop(it, shop({ categorias: ['ferreiro'] })).ok).toBe(true);
    expect(canSellItemToShop(it, shop({ categorias: ['padaria'] })).ok).toBe(false);
  });
});

describe('pechincha', () => {
  const cfg = { ...PECHINCHA_PADRAO, cd: 15, descontoSucesso: 10, descontoSucessoMaior: 20, descontoCritico: 30, aumentoFalhaCritica: 15, tentativasPorDia: 1 };
  it('faixas por resultado', () => {
    expect(faixaPechincha(20, 21, 15)).toBe('critico');
    expect(faixaPechincha(1, 10, 15)).toBe('falha_critica');
    expect(faixaPechincha(12, 20, 15)).toBe('sucesso_maior');
    expect(faixaPechincha(10, 15, 15)).toBe('sucesso');
    expect(faixaPechincha(10, 14, 15)).toBe('falha');
  });
  it('humor hostil soma 5 e irritado soma mais 5', () => {
    expect(cdEfetiva({ ...cfg, humor: 'hostil' })).toBe(20);
    const irr = registrarTentativa(cfg, undefined, 3, 'falha_critica');
    expect(cdEfetiva(cfg, irr)).toBe(20);
    expect(irr.ajuste).toBe(15);
  });
  it('limite de tentativas reinicia no dia seguinte do mundo', () => {
    const e = registrarTentativa(cfg, undefined, diaDoMundo(86400 * 3), 'sucesso');
    expect(tentativasRestantes(cfg, e, 3)).toBe(0);
    expect(tentativasRestantes(cfg, e, 4)).toBe(1);
    expect(ajusteVigente(e, 3)).toBe(-10);
    expect(ajusteVigente(e, 4)).toBe(0);
  });
  it('desconto barateia compra e aumenta venda', () => {
    expect(precoAjustado(100, -20, 'comprar')).toBe(80);
    expect(precoAjustado(50, -20, 'vender')).toBe(60);
  });
});
