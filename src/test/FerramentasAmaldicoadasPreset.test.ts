import { afterEach, describe, expect, it } from 'vitest';
import pacote from '../../public/omni-presets/ferramentas-amaldicoadas.json';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { EXTERNAL_WEAPONS, resolveWeaponDamage } from '@/lib/weapons';
import { armaDoPersonagem } from '@/lib/omni/armaDoPersonagem';
import { useInventoryStore } from '@/stores/useInventoryStore';
import type { EntidadeOmni } from '@/lib/omni/tipos';

describe('Ferramentas Amaldiçoadas OMNI', () => {
  afterEach(() => useInventoryStore.getState().resetAll());

  it('valida o pacote editável com as sete ferramentas solicitadas', () => {
    const parsed = PacoteOmniSchema.safeParse(pacote);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.entidades.map((entity) => entity.nome).sort()).toEqual([
      'Báculo Aetheris',
      'Crepúsculo da Última Lua',
      'Lança Vetorial Rubra',
      'Raijin — O Trovão Carmesim',
      'Ruína Esmeralda',
      'Sagitta — O Juízo do Firmamento',
      'Seraphiel — As Seis Sentenças',
    ].sort());
    for (const entity of parsed.data.entidades) {
      expect(entity.comercio).toMatchObject({ basePrice: 0, isBought: false, categoriasAceitas: [] });
      expect(entity.comercio?.hiddenTags).toContain('ferramenta_amaldicoada');
    }
    const editado = structuredClone(pacote);
    const comercioEditado = {
      ...editado.entidades[0].comercio!,
      categoriasAceitas: ['ferreiro'],
      currencyId: 'moeda-teste',
    } as unknown as NonNullable<EntidadeOmni['comercio']>;
    const entidadeEditada = { ...editado.entidades[0], comercio: comercioEditado };
    expect(PacoteOmniSchema.parse({ ...editado, entidades: [entidadeEditada, ...editado.entidades.slice(1)] }).entidades[0].comercio)
      .toMatchObject({ categoriasAceitas: ['ferreiro'], currencyId: 'moeda-teste' });

    const porId = Object.fromEntries(parsed.data.entidades.map((entity) => [entity.id, entity]));
    expect(porId['preset-baculo-aetheris'].acoesAtivas).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'aa-aetheris-plumas', dano: '8d8' }),
      expect.objectContaining({ id: 'aa-aetheris-requiem', dano: '18d12' }),
      expect.objectContaining({ id: 'aa-aetheris-ruptura', dano: '8d12' }),
    ]));
    expect(porId['preset-seraphiel'].descricao).toContain('O Sexto Julgamento');
    expect(porId['preset-sagitta'].descricao).toContain('Decreto do Zênite');
    expect(porId['preset-lanca-vetorial-rubra'].tags).toContain('feature:lanca-vetorial-rubra');
  });

  it('disponibiliza os modelos de arma para as sete entidades do pacote', () => {
    const specs: Record<string, string> = {
      seraphiel: '2d8',
      sagitta: '5d12',
      raijin: '2d8',
      'ruina-esmeralda': '2d8',
      'crepusculo-ultima-lua': '2d8',
      'lanca-vetorial-rubra': '1d10',
      'baculo-aetheris': '2d8',
    };
    for (const [id, damage] of Object.entries(specs)) {
      const model = EXTERNAL_WEAPONS.find((weapon) => weapon.id === id);
      expect(model, `modelo de arma ${id}`).toBeDefined();
      expect(resolveWeaponDamage(model!)).toBe(damage);
    }

    const expectedModelByEntity: Record<string, string> = {
      'preset-baculo-aetheris': 'baculo-aetheris',
      'preset-sagitta': 'sagitta',
      'preset-raijin': 'raijin',
      'preset-ruina-esmeralda': 'ruina-esmeralda',
      'preset-crepusculo-ultima-lua': 'crepusculo-ultima-lua',
      'preset-seraphiel': 'seraphiel',
      'preset-lanca-vetorial-rubra': 'lanca-vetorial-rubra',
    };
    const entidades = PacoteOmniSchema.parse(pacote).entidades as unknown as EntidadeOmni[];
    for (const entity of entidades) {
      const item = useInventoryStore.getState().add('portador', entity);
      expect(armaDoPersonagem('portador', entity.nome, item.instanceId)?.id)
        .toBe(expectedModelByEntity[entity.id]);
    }
  });

  it('entrega uma cópia editável no inventário do personagem', () => {
    const entity = PacoteOmniSchema.parse(pacote).entidades.find((item) => item.id === 'preset-seraphiel')! as unknown as EntidadeOmni;
    const item = useInventoryStore.getState().add('portador', entity);
    expect(item.entity.nome).toContain('Seraphiel');
    expect(item.entity.comercio).toMatchObject({ basePrice: 0, isBought: false });
    expect(item.instanceId).toBeTruthy();
  });
});
