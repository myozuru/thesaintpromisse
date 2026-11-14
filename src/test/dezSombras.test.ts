import { describe, expect, it } from 'vitest';
import {
  DEZ_SOMBRAS_MODELOS,
  HABILIDADES_TECNICA_DEZ_SOMBRAS,
  criarPacoteDezSombras,
  dadosAdicionaisInvestidaPerfurante,
  medirInvestidaRetaEmMetros,
  transformarCaoEmTotalidade,
} from '@/lib/controlador/dezSombras';

const PERFIS_OFICIAIS = [
  { id: 'cao-branco', grau: 'quarto', custo: 2, pv: 26, defesa: 12, movimento: 12, pagina: 76 },
  { id: 'cao-preto', grau: 'quarto', custo: 2, pv: 26, defesa: 12, movimento: 12, pagina: 76 },
  { id: 'nue', grau: 'quarto', custo: 3, pv: 26, defesa: 13, movimento: 12, pagina: 78 },
  { id: 'sapo', grau: 'quarto', custo: 3, pv: 28, defesa: 10, movimento: 9, pagina: 77 },
  { id: 'grande-serpente', grau: 'quarto', custo: 3, pv: 26, defesa: 12, movimento: 9, pagina: 79 },
  { id: 'fuga-do-coelho', grau: 'terceiro', custo: 6, pv: 56, defesa: 13, movimento: 9, pagina: 81 },
  { id: 'elefante-maximo', grau: 'terceiro', custo: 6, pv: 90, defesa: 12, movimento: 9, pagina: 80 },
  { id: 'cervo-circular', grau: 'segundo', custo: 10, pv: 94, defesa: 16, movimento: 9, pagina: 83 },
  { id: 'touro-perfurante', grau: 'segundo', custo: 8, pv: 96, defesa: 16, movimento: 15, pagina: 84 },
  { id: 'mahoraga', grau: 'especial', custo: 20, pv: 1000, defesa: 24, movimento: 15, pagina: 88 },
  { id: 'tigre-funebre', grau: 'primeiro', custo: 11, pv: 140, defesa: 12, movimento: 9, pagina: 85 },
] as const;

const ACOES_OFICIAIS: Record<(typeof PERFIS_OFICIAIS)[number]['id'], string[]> = {
  'cao-branco': ['mordida', 'instinto-cacador', 'matilha-das-sombras'],
  'cao-preto': ['mordida', 'instinto-cacador', 'matilha-das-sombras'],
  nue: ['investida-eletrizante', 'voo-maldito', 'choque-estatico'],
  sapo: ['protusao-lingua', 'lingua-sombria', 'anfibio-sombrio'],
  'grande-serpente': ['bote-sombrio', 'emergir-das-sombras', 'grande-serpente'],
  'fuga-do-coelho': ['fuga', 'dispersao-tatica', 'horda-infindavel', 'tesouro-escondido'],
  'elefante-maximo': ['torrente-agua', 'massa-esmagadora', 'robustez', 'grande'],
  'cervo-circular': ['aura-da-quietude', 'toque-da-vida', 'pisotear', 'bencao', 'neutralizacao', 'grande'],
  'touro-perfurante': ['investida-perfurante', 'ruptura', 'trajetoria-fixa', 'inercia-imparavel', 'grande'],
  mahoraga: ['punho-do-exterminio', 'espada-do-exterminio', 'regeneracao-adaptativa', 'ataque-adaptativo', 'roda-de-dharma', 'vontade-divina'],
  'tigre-funebre': ['retalhar', 'garras-de-exterminio', 'reflexos-felinos', 'predador-apice', 'grande'],
};

describe('Dez Sombras: pacote canônico v1.1.1', () => {
  it('inclui as dez entradas oficiais, com duas fichas para o par de Cães', () => {
    expect(DEZ_SOMBRAS_MODELOS.map(perfil => perfil.id)).toEqual(PERFIS_OFICIAIS.map(perfil => perfil.id));
    expect(criarPacoteDezSombras('dono')).toHaveLength(11);
    expect(DEZ_SOMBRAS_MODELOS.every(perfil => !perfil.opcionalHomebrew)).toBe(true);
    expect(criarPacoteDezSombras('dono').every(modelo => modelo.pacoteRegras === 'dez-sombras')).toBe(true);
  });

  it('mantém grau, custo, PV, Defesa, deslocamento e página da ficha impressa', () => {
    const pacote = criarPacoteDezSombras('dono');
    for (const esperado of PERFIS_OFICIAIS) {
      const perfil = DEZ_SOMBRAS_MODELOS.find(item => item.id === esperado.id)!;
      const ficha = pacote.find(item => item.subcategoria === `dez-sombras:${esperado.id}`)!;
      expect({
        grau: perfil.grau,
        custo: perfil.custoPE,
        pv: ficha.hpMaximo,
        defesa: ficha.defesa,
        movimento: ficha.deslocamentoM,
        pagina: perfil.pagina,
      }).toEqual({
        grau: esperado.grau,
        custo: esperado.custo,
        pv: esperado.pv,
        defesa: esperado.defesa,
        movimento: esperado.movimento,
        pagina: esperado.pagina,
      });
    }
  });

  it('mantém a lista oficial de ações por perfil e identifica procedimentos ainda manuais', () => {
    for (const perfil of DEZ_SOMBRAS_MODELOS) {
      expect(perfil.acoes.map(acao => acao.id)).toEqual(ACOES_OFICIAIS[perfil.id]);
    }
    const elefante = DEZ_SOMBRAS_MODELOS.find(perfil => perfil.id === 'elefante-maximo')!;
    expect(elefante.acoes.find(acao => acao.id === 'torrente-agua')).toMatchObject({
      tipoExecucao: 'manual', statusAutomacao: 'executavel', teste: 'resistencia', resistenciaAlvo: 'Fortitude',
    });
    const cervo = DEZ_SOMBRAS_MODELOS.find(perfil => perfil.id === 'cervo-circular')!;
    expect(cervo.acoes.find(acao => acao.id === 'bencao')?.statusAutomacao).toBe('executavel');
    const touro = DEZ_SOMBRAS_MODELOS.find(perfil => perfil.id === 'touro-perfurante')!;
    expect(touro.acoes.find(acao => acao.id === 'investida-perfurante')).toMatchObject({
      dano: '2d12+1d12', categoriaAcao: 'acao_complexa', statusAutomacao: 'executavel',
    });
    expect(touro.acoes.find(acao => acao.id === 'inercia-imparavel')).toMatchObject({
      categoriaAcao: 'acao_simples', somenteProprio: true, statusAutomacao: 'executavel',
    });
    expect(touro.acoes.find(acao => acao.id === 'ruptura')?.statusAutomacao).toBe('manual');
    expect(criarPacoteDezSombras('dono').find(modelo => modelo.subcategoria === 'dez-sombras:touro-perfurante')?.economiaAcoesConfigurada)
      .toMatchObject({ acaoSimples: 1, acaoComplexa: 1, acaoMovimento: 1 });
  });

  it('aplica Robustez ao PV total e deixa Totalidade fora das fichas-base', () => {
    const pacote = criarPacoteDezSombras('dono');
    expect(pacote.find(modelo => modelo.subcategoria === 'dez-sombras:elefante-maximo')?.hpMaximo).toBe(90);
    expect(pacote.find(modelo => modelo.subcategoria === 'dez-sombras:mahoraga')?.hpMaximo).toBe(1000);
    const caes = pacote.filter(modelo => modelo.subcategoria === 'dez-sombras:cao-branco' || modelo.subcategoria === 'dez-sombras:cao-preto');
    expect(caes.map(cao => transformarCaoEmTotalidade(cao))).toEqual([null, null]);
    expect(pacote.some(modelo => modelo.subcategoria === 'dez-sombras:totalidade')).toBe(false);
  });

  it('mantém as cinco habilidades técnicas e seu estado de automação publicado', () => {
    expect(HABILIDADES_TECNICA_DEZ_SOMBRAS.map(({ id, automacao }) => [id, automacao])).toEqual([
      ['estoque-das-sombras', 'parcial'],
      ['ocultacao-sombria', 'manual'],
      ['passo-sombrio', 'manual'],
      ['fuga-do-coelho', 'manual'],
      ['jardim-das-sombras-sobrepostas', 'manual'],
    ]);
  });

  it('mede somente trajetórias retas válidas para a Investida do Touro', () => {
    const escala = { dpi: 70, metersPerCell: 1.5 };
    expect(medirInvestidaRetaEmMetros([{ x: 0, y: 0 }, { x: 0, y: 140 }], escala)).toBe(3);
    expect(medirInvestidaRetaEmMetros([{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }], escala)).toBe(0);
    expect(medirInvestidaRetaEmMetros([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }], escala)).toBe(0);
    expect(dadosAdicionaisInvestidaPerfurante(2.99)).toBe(0);
    expect(dadosAdicionaisInvestidaPerfurante(3)).toBe(1);
    expect(dadosAdicionaisInvestidaPerfurante(6)).toBe(2);
  });
});
