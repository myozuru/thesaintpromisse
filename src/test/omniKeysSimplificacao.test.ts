/**
 * 🧪 Auditoria da SIMPLIFICAÇÃO de keys do Omni.
 *
 * Garante que toda forma legada (caminhos profundos, sinônimos pt-BR,
 * siglas) colapsa para a mesma chave canônica curta — e que a leitura
 * (parser/resolvedor) e a escrita (aplicarEfeito) tratam ambas idênticas.
 */
import { describe, it, expect } from 'vitest';
import {
  canonicalizarChave,
  expandirParaCaminhoLegado,
  CHAVES_CANONICAS,
} from '@/lib/omni/keyAliases';
import { simplificarKeysEntidade } from '@/lib/omni/simplificarKeys';
import type { EntidadeOmni } from '@/lib/omni/tipos';

describe('🧭 canonicalizarChave', () => {
  const pares: Array<[string, string]> = [
    ['status.vida.atual', 'vida'],
    ['vida_atual', 'vida'],
    ['HP', 'vida'],
    ['pv', 'vida'],
    ['status.vida.max', 'vida_max'],
    ['status.energiaAmaldicoada.atual', 'pe'],
    ['energia', 'pe'],
    ['energia_max', 'pe_max'],
    ['atributos.forca', 'for'],
    ['Forca', 'for'],
    ['Força', 'for'],
    ['atributos.presenca', 'pre'],
    ['carisma', 'pre'],
    ['status.bonusTreinamento', 'treino'],
    ['status.deslocamento', 'desloc'],
    ['status.nivel', 'nivel'],
    ['stats.modificadorAtaque', 'acerto'],
    ['stats.esquiva', 'esquiva'],
    ['@USUARIO.vida_atual', 'vida'],
    ['@ALVO.atributos.forca', 'for'],
  ];
  it.each(pares)('%s → %s', (entrada, esperado) => {
    expect(canonicalizarChave(entrada)).toBe(esperado);
  });

  it('chave já canônica permanece igual (idempotente)', () => {
    for (const k of CHAVES_CANONICAS) {
      expect(canonicalizarChave(k)).toBe(k);
    }
  });

  it('perícias e TRs passam intactos', () => {
    expect(canonicalizarChave('pericia_furtividade')).toBe('pericia_furtividade');
    expect(canonicalizarChave('fortitude')).toBe('fortitude');
    expect(canonicalizarChave('reflexos')).toBe('reflexos');
  });

  it('chave desconhecida vira lowercase neutra', () => {
    expect(canonicalizarChave('Custom_Flag_X')).toBe('custom_flag_x');
  });
});

describe('🔁 expandirParaCaminhoLegado (canon → caminho profundo)', () => {
  it.each([
    ['vida',     'status.vida.atual'],
    ['vida_max', 'status.vida.max'],
    ['pe',       'status.energiaAmaldicoada.atual'],
    ['for',      'atributos.forca'],
    ['treino',   'status.bonusTreinamento'],
  ])('%s → %s', (canon, legado) => {
    expect(expandirParaCaminhoLegado(canon)).toBe(legado);
  });
});

describe('🧹 simplificarKeysEntidade — migração automática', () => {
  const ent: EntidadeOmni = {
    id: 'e1', versao: 1, nome: 'Poção', categoria: 'item',
    descricao: '', tags: [],
    duracao: { tipo: 'instantaneo' },
    custos: [{ caminhoRecurso: 'status.energiaAmaldicoada.atual', valor: { tipo: 'fixo', valor: 2 } }],
    gatilhos: [{
      id: 'g1', evento: 'aoEquipar',
      blocos: [{
        id: 'b1', condicoes: [], modo: 'todas',
        acoes: [
          { id: 'a1', acao: 'CURAR', alvoAplicacao: 'USUARIO',
            caminhoAlvo: 'status.vida.atual', valor: { tipo: 'fixo', valor: 5 } },
          { id: 'a2', acao: 'SOMAR', alvoAplicacao: 'USUARIO',
            caminhoAlvo: 'atributos.forca', valor: { tipo: 'formula', expressao: 'atributos.forca + status.bonusTreinamento' } },
          // Vantagem deve ser preservada (escopo não é caminho).
          { id: 'a3', acao: 'CONCEDER_VANTAGEM', alvoAplicacao: 'USUARIO',
            caminhoAlvo: 'attack_weapon_group:Machado' },
        ],
      }],
    }],
    criadoEm: 0, atualizadoEm: 0,
  };

  const simpl = simplificarKeysEntidade(ent);
  const acoes = simpl.gatilhos[0].blocos[0].acoes;

  it('caminhoAlvo de CURAR vira "vida"', () => expect(acoes[0].caminhoAlvo).toBe('vida'));
  it('caminhoAlvo de SOMAR vira "for"', () => expect(acoes[1].caminhoAlvo).toBe('for'));
  it('fórmula tem caminhos canonicalizados', () => {
    const f = acoes[1].valor as { tipo: 'formula'; expressao: string };
    expect(f.expressao).toBe('for + treino');
  });
  it('CONCEDER_VANTAGEM preserva o escopo', () => {
    expect(acoes[2].caminhoAlvo).toBe('attack_weapon_group:Machado');
  });
  it('caminhoRecurso de custo vira "pe"', () => {
    expect(simpl.custos[0].caminhoRecurso).toBe('pe');
  });

  it('é idempotente (rodar de novo não muda nada)', () => {
    expect(simplificarKeysEntidade(simpl)).toEqual(simpl);
  });
});
