import { describe, expect, it } from 'vitest';
import {
  ACOES_GUIA_OMNI,
  CHAVES_GUIA_OMNI,
  CONTAGEM_ACOES_GUIA_OMNI,
  CONTAGEM_GATILHOS_GUIA_OMNI,
  GATILHOS_GUIA_OMNI,
  coberturaCatalogoGuia,
  referenciaDaChaveGuia,
} from '@/lib/omni/guiaDados';
import { DICIONARIO_CHAVES_OMNI, GATILHOS_EVENTOS, ACOES_EFEITO } from '@/lib/omni/constantesDoSistema';

describe('dados do guia OMNI', () => {
  it('inclui toda key estática e todo template do catálogo oficial', () => {
    const cobertura = coberturaCatalogoGuia();
    expect(cobertura.faltantes).toEqual([]);
    expect(cobertura.total).toBe(DICIONARIO_CHAVES_OMNI.flatMap((g) => g.itens).length);
  });

  it('consolida sinônimos em um único card e mantém aliases inseríveis', () => {
    const porId = new Map(CHAVES_GUIA_OMNI.map((c) => [c.id, c]));
    for (const [canonica, aliases] of [
      ['sab', ['sabedoria']],
      ['pre', ['presenca', 'car']],
      ['vida', ['vida_atual', 'hp', 'pv']],
      ['vida_max', ['hp_max', 'pv_max']],
      ['pe', ['energia', 'energia_atual', 'pe_atual']],
      ['treino', ['treinamento', 'bonus_treinamento', 'bonusdetreinamento']],
      ['CENA.turno_indice', ['CENA.turno_de']],
    ] as Array<[string, string[]]>) {
      for (const alias of aliases) expect(porId.get(canonica)?.aliases).toContain(alias);
    }
  });

  it('mostra os aliases antigos dos templates dinâmicos', () => {
    const porId = new Map(CHAVES_GUIA_OMNI.map((c) => [c.id, c]));
    expect(porId.get('origem_<id>')?.aliases).toContain('origem_id_<id>');
    expect(porId.get('especializacao_<id>')?.aliases).toContain('especializacao_id_<id>');
    expect(porId.get('condicao_rodadas_desde_<id>')?.aliases).toContain('condicao_idade_rodadas_<id>');
    expect(porId.get('condicao_tem_idade_<id>')?.aliases).toContain('condicao_idade_conhecida_<id>');
    expect(porId.get('condicao_rodadas_restantes_<id>')?.aliases).toContain('condicao_rodadas_<id>');
    expect(porId.get('qtd_feiticos_tipo_<tipo>')?.aliases).toContain('qtd_feiticos_elemento_<tipo>');
  });

  it('gera referências de cada escopo sem ocultar prefixos globais', () => {
    const usuarioVida = CHAVES_GUIA_OMNI.find((c) => c.id === 'vida')!;
    expect(referenciaDaChaveGuia(usuarioVida, 'USUARIO')).toBe('@USUARIO.vida');
    expect(referenciaDaChaveGuia(usuarioVida, 'ALVO')).toBe('@ALVO.vida');
    const cena = CHAVES_GUIA_OMNI.find((c) => c.id === 'CENA.turno_indice')!;
    expect(referenciaDaChaveGuia(cena, 'NENHUM')).toBe('@CENA.turno_indice');
  });

  it('usa todas as definições oficiais de gatilhos e ações', () => {
    expect(CONTAGEM_GATILHOS_GUIA_OMNI).toBe(34);
    expect(CONTAGEM_GATILHOS_GUIA_OMNI).toBe(Object.keys(GATILHOS_EVENTOS).length);
    expect(CONTAGEM_ACOES_GUIA_OMNI).toBe(38);
    expect(CONTAGEM_ACOES_GUIA_OMNI).toBe(Object.keys(ACOES_EFEITO).length);
    expect(GATILHOS_GUIA_OMNI.every((g) => g.aliases.length > 0 && g.exemplo.startsWith('@'))).toBe(true);
    expect(ACOES_GUIA_OMNI).toHaveLength(Object.keys(ACOES_EFEITO).length);
  });
});
