// @vitest-environment jsdom
import { writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import inventory from '../../docs/omni/inventario-natural.json';
import { ficha, montarMesa, pegarFicha, limparMesa } from './helpers/mesaReal';
import { montarVariaveisDoPersonagem, lerCaminhoOmni } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { canonicalizarChave } from '@/lib/omni/keyAliases';
import { aplicarEfeitoNoPersonagem } from '@/lib/omni/aplicarEfeito';
import { parseOmniScript } from '@/lib/omni/omniScript';
import { resolverTipoDano } from '@/lib/omni/contextoDano';

afterEach(limparMesa);

describe('inventário natural: sondagem da implementação existente', () => {
  it('registra leitura, diagnóstico e escrita isolada de cada entrada sem certificar semântica', () => {
    const rows = inventory.map(entry => {
      const template = entry.key.includes('<') || entry.key.includes(' ');
      if (template) return { id: entry.id, key: entry.key, status: 'requer argumento ou comando; não sondado como variável' };
      const c = ficha('natural-audit', {
        hpCurrent: 17, hpMax: 31, peCurrent: 7, peMax: 19,
        escCurrent: 3, escMax: 9, trainingBonus: 4, level: 5,
        omniCounters: { rancor: 3, foco: 2 }, omniFlags: { flag_teste: 1 },
        attributes: [{ id: 'forca', name: 'Força', value: 4, externalBonus: 2, mastery: false }],
      });
      montarMesa([c], {});
      const bag = montarVariaveisDoPersonagem(c);
      const parsed = avaliarFormula(`@USUARIO.${entry.key}`, bag);
      const before = JSON.parse(JSON.stringify(pegarFicha(c.id))) as Record<string, unknown>;
      const applied = aplicarEfeitoNoPersonagem(c.id, 'ADICIONAR', entry.key, 1);
      const after = JSON.parse(JSON.stringify(pegarFicha(c.id))) as Record<string, unknown>;
      const changed = Object.keys(after).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
      const canonical = canonicalizarChave(entry.key);
      return {
        id: entry.id, key: entry.key, canonical,
        bag_present: Object.hasOwn(bag, canonical.toUpperCase()) || Object.hasOwn(bag, entry.key.toUpperCase()),
        formula_value: parsed.valor, formula_diagnostics: parsed.diagnosticos,
        direct_read: lerCaminhoOmni(c, entry.key),
        legacy_write_report: applied, changed_fields: changed,
        legacy_write_parser_errors: parseOmniScript(`somar 1 em ${entry.key}`).erros,
        status: 'sondagem em uma ficha; não comprova semântica, contexto, limites ou autorização',
      };
    });
    expect(rows).toHaveLength(345);
    const life = rows.find(row => row.key === 'vida_atual')!;
    expect(life).toMatchObject({ canonical: 'vida', formula_value: 17 });
    expect(life.changed_fields).toContain('hpCurrent');
    expect(rows.find(row => row.key === 'contador_foco')).toMatchObject({ formula_value: 2 });
    expect(rows.find(row => row.key === 'vida_pct')?.changed_fields).toEqual([]);
    if (process.env.OMNI_AUDIT_REPORT === '1') {
      writeFileSync('docs/omni/sondagem-runtime.json', JSON.stringify({
        base: 'ba47360e0f166ae227a6470985b087a261a970c8',
        method: 'Fixture real-store isolada por entrada; adicionar 1; somente implementação legada. Presença e alteração não certificam comportamento correto.',
        rows,
      }, null, 2) + '\n');
    }
  });

  it('expõe fallback de nome desconhecido sem tratá-lo como suporte', () => {
    const c = ficha('unknown');
    expect(canonicalizarChave('key_que_nao_existe')).toBe('key_que_nao_existe');
    expect(lerCaminhoOmni(c, 'key_que_nao_existe')).toBe(0);
    montarMesa([c], {});
    const before = pegarFicha(c.id);
    expect(aplicarEfeitoNoPersonagem(c.id, 'ADICIONAR', 'key_que_nao_existe', 1)).toEqual({ aplicado: 0 });
    expect(pegarFicha(c.id)).toEqual(before);
  });

  it('distingue alias de tipo aprovado de alias ainda ausente', () => {
    expect(resolverTipoDano('corte')).toBe('DCO');
    expect(resolverTipoDano('Energético')).toBe('DE');
    expect(resolverTipoDano('energia_amaldicoada')).toBeUndefined();
    expect(resolverTipoDano('energia_reversa')).toBeUndefined();
    expect(resolverTipoDano('forca')).toBeUndefined();
  });
});
