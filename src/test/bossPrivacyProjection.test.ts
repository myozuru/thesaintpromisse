import { describe, expect, it } from 'vitest';
import { createBoss, projectBossesForPlayers, type Boss } from '@/lib/bosses';

describe('projeção pública de chefes', () => {
  it('remove a ficha invisível e seus marcadores do payload do jogador', () => {
    const visible = { ...createBoss('Maldição Revelada'), visivel: true };
    const hidden = createBoss('Chefe Secreto');
    const projection = projectBossesForPlayers(
      { [visible.id]: visible, [hidden.id]: hidden },
      [
        { id: 'marker-visible', bossId: visible.id, x: 20, y: 30 },
        { id: 'marker-hidden', bossId: hidden.id, x: 80, y: 70 },
      ],
    );

    expect(Object.keys(projection.bosses)).toEqual([visible.id]);
    expect(projection.worldMarkers).toEqual([{ id: 'marker-visible', bossId: visible.id, x: 20, y: 30 }]);
  });

  it('envia somente valores revelados e remove notas, tática e habilidades ocultas', () => {
    const boss = {
      ...createBoss('Maldição Revelada'),
      visivel: true,
      nd: 12,
      defesa: 27,
      pv: 140,
      pvMax: 180,
      rdPorTipo: { DCO: 5, DPS: 9 },
      rdTipoRevelado: { DCO: true, DPS: false },
      fraquezas: ['DPS', 'DCO'] as Boss['fraquezas'],
      itemRevelado: { 'fraq:DPS': true, 'fraq:DCO': false },
      tatica: 'Ataca o conjurador primeiro.',
      segredos: 'Tem medo de fogo.',
      recompensas: 'Um artefato lendário.',
      habilidades: [
        { id: 'revealed', nome: 'Garras', kind: 'ATAQUE' as const, texto: 'Causa 2d8.', revelada: true },
        { id: 'hidden', nome: 'Fase secreta', kind: 'FASE' as const, texto: 'Recupera toda a vida.', revelada: false },
      ],
      revelado: { nd: true, fraquezas: true },
    };

    const { bosses } = projectBossesForPlayers({ [boss.id]: boss }, []);
    const projected = bosses[boss.id];

    expect(projected.nd).toBe(12);
    expect(projected.defesa).toBe(0);
    expect(projected.pv).toBe(0);
    expect(projected.rdPorTipo).toEqual({ DCO: 5 });
    expect(projected.fraquezas).toEqual(['DPS']);
    expect(projected.tatica).toBe('');
    expect(projected.segredos).toBe('');
    expect(projected.recompensas).toBe('');
    expect(projected.habilidades.map((ability) => ability.id)).toEqual(['revealed']);
    expect(JSON.stringify(projected)).not.toContain('Recupera toda a vida');
  });
});
