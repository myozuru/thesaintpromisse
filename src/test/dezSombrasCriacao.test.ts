import { describe, expect, it } from 'vitest';
import { applyOriginEffects } from '@/lib/originEngine';
import { criarInvocacoesIniciaisDezSombras } from '@/lib/controlador/dezSombrasCriacao';

describe('pacote inicial das Dez Sombras', () => {
  it('entrega automaticamente as fichas-base e derivadas ao Controlador com a técnica herdada', () => {
    const fichas = criarInvocacoesIniciaisDezSombras('personagem-zenin', true, 'Dez Sombras');
    expect(fichas).toHaveLength(15);

    const fichasBase = fichas!.filter(ficha => !ficha.formaDerivada);
    const derivadas = fichas!.filter(ficha => ficha.formaDerivada);
    expect(fichasBase).toHaveLength(11); // 10 entradas oficiais, com os Cães em fichas separadas
    expect(derivadas).toHaveLength(4);
    expect(new Set(fichas!.map(ficha => ficha.subcategoria)).size).toBe(fichas!.length);

    expect(fichasBase.filter(ficha => ficha.domado === true).map(ficha => ficha.subcategoria).sort()).toEqual([
      'dez-sombras:cao-branco',
      'dez-sombras:cao-preto',
    ]);
    expect(fichasBase.filter(ficha => ficha.domado === false)).toHaveLength(9);
    expect(derivadas.every(ficha => ficha.domado === false && ficha.aprovacaoMestre === 'pendente')).toBe(true);
  });

  it('não entrega o pacote a outras especializações nem a Controladores sem Dez Sombras', () => {
    expect(criarInvocacoesIniciaisDezSombras('outro', false, 'Dez Sombras')).toBeUndefined();
    expect(criarInvocacoesIniciaisDezSombras('outro', true, 'Manipulação de Sangue')).toEqual([]);
  });

  it('conecta a escolha herdada de Zenin à entrega automática', () => {
    const efeitos = applyOriginEffects('Herdado', 1, {
      clan: 'Zenin',
      inheritedTechnique: 'Dez Sombras',
    });
    expect(efeitos.automation.tecnicaAmaldicoada).toBe('Dez Sombras');
    expect(criarInvocacoesIniciaisDezSombras(
      'personagem-zenin', true, efeitos.automation.tecnicaAmaldicoada,
    )).toHaveLength(15);
  });
});
