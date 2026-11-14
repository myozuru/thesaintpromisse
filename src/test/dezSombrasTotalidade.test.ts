import { describe, expect, it } from 'vitest';
import {
  criarPacoteDezSombras,
  transformarCaoEmTotalidade,
} from '@/lib/controlador/dezSombras';
import { criarFormasDerivadasDezSombras } from '@/lib/controlador/dezSombrasDerivadas';

describe('Dez Sombras: Totalidade como forma derivada separada', () => {
  it('não converte nem remove um dos Cães para criar Totalidade', () => {
    const caes = criarPacoteDezSombras('dono').filter(modelo =>
      modelo.subcategoria === 'dez-sombras:cao-branco' || modelo.subcategoria === 'dez-sombras:cao-preto',
    );

    expect(caes).toHaveLength(2);
    expect(caes.map(cao => transformarCaoEmTotalidade(cao))).toEqual([null, null]);
    expect(caes.map(cao => cao.hpAtual)).toEqual([26, 26]);
  });

  it('registra a Totalidade oficial como ficha separada de 3º Grau aguardando valores e aprovação', () => {
    const totalidade = criarFormasDerivadasDezSombras('dono').find(
      modelo => modelo.subcategoria === 'dez-sombras:totalidade',
    );

    expect(totalidade).toMatchObject({
      grau: 'terceiro',
      formaDerivada: true,
      domado: false,
      aprovacaoMestre: 'pendente',
      requisitosFormaDerivada: ['Cão Branco domado', 'Cão Preto domado', 'ritual de quimera'],
      acoes: [],
    });
    expect(totalidade?.valoresProvisoriosFormaDerivada).toEqual(
      expect.arrayContaining(['PV', 'Defesa', 'deslocamentoM', 'custoInvocacaoPE']),
    );
    expect(totalidade?.referenciaRegra).toContain('p. 69');
  });
});
