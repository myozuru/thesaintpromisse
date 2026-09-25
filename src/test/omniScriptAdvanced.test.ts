import { describe, it, expect } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { parseOmniScript, desconstruirScript } from '@/lib/omni/omniScript';

describe('OmniScript advanced grammar', () => {
  it('aceita gatilho + condicional + parênteses + ações encadeadas', () => {
    const script =
      'ao_receber_dano -> se usos_restantes > 0 entao ( definir 1 em bloqueio_total, subtrair 1 em usos_restantes )';
    const r = parseOmniScript(script, { defaultTarget: 'USUARIO' });
    expect(r.erros).toHaveLength(0);
    expect(r.efeitos).toHaveLength(2);
    expect(r.efeitos[0].trigger).toBe('aoSofrerDano');
    expect(r.efeitos[0].condition).toContain('usos_restantes');
    expect(r.efeitos[0].type).toBe('MODIFICADOR');
    expect(r.efeitos[1].type).toBe('SUBTRAIR');
  });

  it('script simples (sem gatilho) continua funcionando', () => {
    const r = parseOmniScript('somar 5 em vida_atual');
    expect(r.erros).toHaveLength(0);
    expect(r.efeitos[0].trigger).toBeUndefined();
    expect(r.efeitos[0].condition).toBeUndefined();
  });

  it('aceita símbolos lógicos >=, <=, ==, != na condição', () => {
    for (const op of ['>=', '<=', '==', '!=']) {
      const r = parseOmniScript(`se vida_atual ${op} 10 entao definir 0 em vida_atual`);
      expect(r.erros, `op ${op}`).toHaveLength(0);
      expect(r.efeitos[0].condition).toContain(op);
    }
  });

  it('normaliza condição natural com contador customizado: fadiga igual a 2', () => {
    const r = parseOmniScript('se fadiga igual a 2 entao somar 1 em exaustao', { defaultTarget: 'USUARIO' });

    expect(r.erros).toHaveLength(0);
    expect(r.efeitos[0].condition).toBe('fadiga igual a 2');
    expect(avaliarFormula(r.efeitos[0].condition!, { FADIGA: 2, USUARIO_FADIGA: 2 }).valor).toBe(1);
    expect(avaliarFormula(r.efeitos[0].condition!, { FADIGA: 1, USUARIO_FADIGA: 1 }).valor).toBe(0);
  });

  it('desconstrutor isola corretamente cada etapa', () => {
    const d = desconstruirScript('ao_iniciar_turno -> se @USUARIO.pe > 0 entao (subtrair 1 em pe)');
    expect(d.trigger).toBe('noInicioDoTurno');
    expect(d.condition).toBe('@USUARIO.pe > 0');
    expect(d.acoes).toBe('subtrair 1 em pe');
  });

  it('mapeia `dano_recebido` → `dano_pendente` (alias de recurso)', () => {
    const r = parseOmniScript('ao_receber_dano -> definir 0 em dano_recebido');
    expect(r.erros).toHaveLength(0);
    expect(r.efeitos[0].resourcePath).toBe('dano_pendente');
  });

  it('aceita verbos absolutos `anular` / `ignorar` (≡ definir 0)', () => {
    for (const v of ['anular', 'ignorar'] as const) {
      const r = parseOmniScript(`ao_receber_dano -> ${v} dano_recebido`);
      expect(r.erros, `verbo ${v}`).toHaveLength(0);
      expect(r.efeitos[0].type).toBe('MODIFICADOR');
      expect(r.efeitos[0].formula).toBe('0');
      expect(r.efeitos[0].resourcePath).toBe('dano_pendente');
      expect(r.efeitos[0].absoluteVerb).toBe(v);
    }
  });

  it('`reduzir` é alias amigável de `subtrair`', () => {
    const r = parseOmniScript('reduzir 5 em dano_recebido');
    expect(r.erros).toHaveLength(0);
    expect(r.efeitos[0].type).toBe('SUBTRAIR');
    expect(r.efeitos[0].formula).toBe('5');
    expect(r.efeitos[0].resourcePath).toBe('dano_pendente');
  });

  describe('Watcher (gatilhos dinâmicos `quando`)', () => {
    it('parseia operador matemático puro: vida_atual <= 0', () => {
      const r = parseOmniScript('quando vida_atual <= 0 -> definir vida_max em vida_atual', { defaultTarget: 'USUARIO' });
      expect(r.erros).toHaveLength(0);
      const w = r.efeitos[0].watcher!;
      expect(w.resource).toBe('vida_atual');
      expect(w.op).toBe('<=');
      expect(w.threshold).toBe(0);
      expect(w.percent).toBeUndefined();
    });

    it('aceita aliases pt-BR: "baixar para"', () => {
      const r = parseOmniScript('quando vida_atual baixar para 0 -> anular dano_recebido');
      expect(r.erros).toHaveLength(0);
      expect(r.efeitos[0].watcher?.op).toBe('<=');
      expect(r.efeitos[0].watcher?.threshold).toBe(0);
    });

    it('aceita aliases pt-BR: "atingir"', () => {
      const r = parseOmniScript('quando pe atingir 10 -> somar 5 em vida_atual');
      expect(r.erros).toHaveLength(0);
      expect(r.efeitos[0].watcher?.op).toBe('>=');
      expect(r.efeitos[0].watcher?.threshold).toBe(10);
    });

    it('parseia porcentagem com base implícita (_max)', () => {
      const r = parseOmniScript('quando vida_atual <= 20% -> somar 10 em vida_atual');
      expect(r.erros).toHaveLength(0);
      const w = r.efeitos[0].watcher!;
      expect(w.percent).toBe(true);
      expect(w.threshold).toBeCloseTo(0.2);
      expect(w.percentBase).toBe('vida_max');
    });

    it('parseia porcentagem com base explícita (`de`)', () => {
      const r = parseOmniScript('quando pe <= 50% de pe_max -> definir 0 em pe');
      expect(r.erros).toHaveLength(0);
      expect(r.efeitos[0].watcher?.percentBase).toBe('pe_max');
    });

    it('migra `ao_morrer` para watcher equivalente (vida_atual <= 0)', () => {
      const r = parseOmniScript('ao_morrer -> definir vida_max em vida_atual');
      expect(r.erros).toHaveLength(0);
      const eff = r.efeitos[0];
      expect(eff.trigger).toBeUndefined();
      expect(eff.watcher).toEqual({ resource: 'vida_atual', op: '<=', threshold: 0 });
    });

    it('encadeia 2 gatilhos diferentes em um único script', () => {
      const r = parseOmniScript(
        'somar treino em vida_max, quando vida_atual <= 0 -> definir vida_max em vida_atual',
        { defaultTarget: 'USUARIO' },
      );
      expect(r.erros).toHaveLength(0);
      expect(r.efeitos).toHaveLength(2);
      expect(r.efeitos[0].watcher).toBeUndefined();
      expect(r.efeitos[1].watcher?.resource).toBe('vida_atual');
    });
  });
});
