/**
 * LOTE 4 — Corretude semântica (30 chaves)
 *   🕰️ Tempo & Calendário (15 — todas @CENA.*)
 *   🎯 Cena Tática (15)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetStores, makeChar, vEval } from './_helper';
import { useChronosStore } from '@/stores/useChronosStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

beforeEach(resetStores);

// ─── 🕰️ Tempo & Calendário ─────────────────────────────────────────────
describe('Lote 4 — 🕰️ Tempo & Calendário (15)', () => {
  it('hora / minuto / segundo / dia / mes / ano + timestamp', () => {
    useChronosStore.setState({
      hours: 14, minutes: 30, seconds: 15,
      day: 7, month: 4, year: 2030,
      isRunning: true, multiplier: 2,
    } as never);
    const c = makeChar();
    expect(vEval(c, 'NENHUM', 'CENA.hora')).toBe(14);
    expect(vEval(c, 'NENHUM', 'CENA.minuto')).toBe(30);
    expect(vEval(c, 'NENHUM', 'CENA.segundo')).toBe(15);
    expect(vEval(c, 'NENHUM', 'CENA.dia')).toBe(7);
    expect(vEval(c, 'NENHUM', 'CENA.mes')).toBe(4);
    expect(vEval(c, 'NENHUM', 'CENA.ano')).toBe(2030);
    expect(vEval(c, 'NENHUM', 'CENA.relogio_ativo')).toBe(1);
    expect(vEval(c, 'NENHUM', 'CENA.multiplicador_tempo')).toBe(2);
    // 14*3600 + 30*60 + 15
    expect(vEval(c, 'NENHUM', 'CENA.timestamp_segundos')).toBe(14 * 3600 + 30 * 60 + 15);
  });

  it('períodos do dia: amanhecer (5–7) / dia (7–18) / anoitecer (18–20) / noite (20–5)', () => {
    const c = makeChar();
    const set = (h: number) => useChronosStore.setState({ hours: h, minutes: 0, seconds: 0, day: 1, month: 1, year: 2025, isRunning: false, multiplier: 1 } as never);

    set(6);  expect(vEval(c, 'NENHUM', 'CENA.eh_amanhecer')).toBe(1);
             expect(vEval(c, 'NENHUM', 'CENA.eh_dia')).toBe(0);
    set(12); expect(vEval(c, 'NENHUM', 'CENA.eh_dia')).toBe(1);
             expect(vEval(c, 'NENHUM', 'CENA.eh_noite')).toBe(0);
    set(19); expect(vEval(c, 'NENHUM', 'CENA.eh_anoitecer')).toBe(1);
             expect(vEval(c, 'NENHUM', 'CENA.eh_dia')).toBe(0);
    set(23); expect(vEval(c, 'NENHUM', 'CENA.eh_noite')).toBe(1);
    set(3);  expect(vEval(c, 'NENHUM', 'CENA.eh_noite')).toBe(1);
             expect(vEval(c, 'NENHUM', 'CENA.eh_amanhecer')).toBe(0);
  });

  it('eventos_hoje conta eventos no calendário com data == hoje', () => {
    useChronosStore.setState({ hours: 10, minutes: 0, seconds: 0, day: 5, month: 6, year: 2030, isRunning: false, multiplier: 1 } as never);
    useCalendarStore.setState({
      events: [
        { day: 5, month: 6, year: 2030, title: 'A' },
        { day: 5, month: 6, year: 2030, title: 'B' },
        { day: 6, month: 6, year: 2030, title: 'C' }, // outro dia
      ],
    } as never);
    const c = makeChar();
    expect(vEval(c, 'NENHUM', 'CENA.eventos_hoje')).toBe(2);
  });
});

// ─── 🎯 Cena Tática ────────────────────────────────────────────────────
function mkToken(id: string, x: number, y: number, characterId?: string) {
  return { id, x, y, w: 1, h: 1, characterId };
}

describe('Lote 4 — 🎯 Cena Tática (15)', () => {
  it('sem token no mapa: esta_no_mapa=0, sozinho=1', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'esta_no_mapa')).toBe(0);
    expect(vEval(c, 'USUARIO', 'sozinho')).toBe(1);
    expect(vEval(c, 'USUARIO', 'aliado_adjacente')).toBe(0);
    expect(vEval(c, 'USUARIO', 'inimigo_adjacente')).toBe(0);
    expect(vEval(c, 'NENHUM', 'CENA.qtd_tokens')).toBe(0);
  });

  it('contagens globais (qtd_tokens / aliados / inimigos)', () => {
    useCharacterStore.setState({
      characters: [
        makeChar({ id: 'hero',  category: 'PLAYER' } as Partial<Character>),
        makeChar({ id: 'amigo', category: 'PLAYER' } as Partial<Character>),
        makeChar({ id: 'bicho', category: 'INIMIGO' } as Partial<Character>),
        makeChar({ id: 'bicho2',category: 'INIMIGO' } as Partial<Character>),
      ],
    } as never);
    useMapStore.setState({
      grid: { metersPerCell: 1 },
      entities: {
        t1: mkToken('t1', 0, 0,  'hero'),
        t2: mkToken('t2', 1, 0,  'amigo'),
        t3: mkToken('t3', 0, 1,  'bicho'),
        t4: mkToken('t4', 1, 1,  'bicho2'),
      },
    } as never);
    const c = useCharacterStore.getState().characters.find((x) => x.id === 'hero')!;
    expect(vEval(c, 'NENHUM', 'CENA.qtd_tokens')).toBe(4);
    expect(vEval(c, 'NENHUM', 'CENA.qtd_aliados')).toBe(2);
    expect(vEval(c, 'NENHUM', 'CENA.qtd_inimigos')).toBe(2);
    expect(vEval(c, 'USUARIO', 'esta_no_mapa')).toBe(1);
  });

  it('flanqueado=1 com 2 inimigos adjacentes; aliado_adjacente=1 com aliado a 1 célula', () => {
    useCharacterStore.setState({
      characters: [
        makeChar({ id: 'hero',  category: 'PLAYER' } as Partial<Character>),
        makeChar({ id: 'amigo', category: 'PLAYER' } as Partial<Character>),
        makeChar({ id: 'orc1',  category: 'INIMIGO' } as Partial<Character>),
        makeChar({ id: 'orc2',  category: 'INIMIGO' } as Partial<Character>),
      ],
    } as never);
    useMapStore.setState({
      grid: { metersPerCell: 1 },
      entities: {
        t1: mkToken('t1', 0, 0, 'hero'),
        t2: mkToken('t2', 1, 0, 'amigo'),  // adjacente
        t3: mkToken('t3', 0, 1, 'orc1'),   // adjacente
        t4: mkToken('t4', -1, 0,'orc2'),   // adjacente
      },
    } as never);
    const c = useCharacterStore.getState().characters.find((x) => x.id === 'hero')!;
    expect(vEval(c, 'USUARIO', 'qtd_aliados_adjacentes')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_inimigos_adjacentes')).toBe(2);
    expect(vEval(c, 'USUARIO', 'qtd_inimigos_engajados')).toBe(2);
    expect(vEval(c, 'USUARIO', 'aliado_adjacente')).toBe(1);
    expect(vEval(c, 'USUARIO', 'inimigo_adjacente')).toBe(1);
    expect(vEval(c, 'USUARIO', 'flanqueado')).toBe(1);
    expect(vEval(c, 'USUARIO', 'na_linha_de_frente')).toBe(1);
    expect(vEval(c, 'USUARIO', 'sozinho')).toBe(0);
  });

  it('inimigo a 5m: próximo mas não adjacente; sozinho=1 sem aliados', () => {
    useCharacterStore.setState({
      characters: [
        makeChar({ id: 'hero', category: 'PLAYER' } as Partial<Character>),
        makeChar({ id: 'orc',  category: 'INIMIGO' } as Partial<Character>),
      ],
    } as never);
    useMapStore.setState({
      grid: { metersPerCell: 1 },
      entities: {
        t1: mkToken('t1', 0, 0, 'hero'),
        t2: mkToken('t2', 5, 0, 'orc'),
      },
    } as never);
    const c = useCharacterStore.getState().characters.find((x) => x.id === 'hero')!;
    expect(vEval(c, 'USUARIO', 'qtd_inimigos_adjacentes')).toBe(0);
    expect(vEval(c, 'USUARIO', 'qtd_inimigos_proximos')).toBe(1);
    expect(vEval(c, 'USUARIO', 'inimigo_adjacente')).toBe(0);
    expect(vEval(c, 'USUARIO', 'flanqueado')).toBe(0);
    expect(vEval(c, 'USUARIO', 'sozinho')).toBe(1);
  });

  it('CENA.token_x / token_y refletem posição do meu token', () => {
    useCharacterStore.setState({
      characters: [makeChar({ id: 'hero', category: 'PLAYER' } as Partial<Character>)],
    } as never);
    useMapStore.setState({
      grid: { metersPerCell: 1 },
      entities: { t1: mkToken('t1', 3, 4, 'hero') },
    } as never);
    const c = useCharacterStore.getState().characters[0];
    // centro = (3.5, 4.5)
    expect(vEval(c, 'NENHUM', 'CENA.token_x')).toBe(3.5);
    expect(vEval(c, 'NENHUM', 'CENA.token_y')).toBe(4.5);
  });
});
