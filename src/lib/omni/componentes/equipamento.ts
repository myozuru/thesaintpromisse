import type { Character } from '@/types';
import { findWeaponByName } from '@/lib/weapons';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import type { DadoComposto, DadosComposicao, RegistroComposto } from './avaliar';
import { recursoComposto } from './recursos';

export function dadosEquipamento(c: Character, bag: Record<string, number>): DadosComposicao {
  const n = (k: string) => bag[k] ?? 0;
  function arma(nome?: string | null): RegistroComposto {
    const w = nome ? findWeaponByName(nome) : undefined;
    return { valor: Boolean(w), id: w?.id, propriedades: [
      ...(w?.properties.map(p => p.kind) ?? []),
      ...(w ? [w.range === 'melee' ? 'corpo_a_corpo' : 'distancia'] : []),
    ], campos: { equipada: Boolean(w), grupo: w?.group ?? '', margem_critico: w?.critRange ?? 20,
      alcance: { valor: w?.range === 'melee' ? 1.5 : w?.rangeShort ?? 0,
        campos: { curto: w?.rangeShort ?? 0, longo: w?.rangeLong ?? 0 } } } };
  }
  const selecoes: Record<string, DadoComposto> = {
    arma_principal: arma(c.mainHandWeaponName),
    escudo: { campos: { equipado: Boolean(c.equippedShieldId), proficiente: n('ESCUDO_PROFICIENTE'),
      id: { registros: c.equippedShieldId ? { [c.equippedShieldId]: true } : {} } } },
    inventario: { campos: { slots: recursoComposto(c.slotsCurrent ?? 0, c.slotsMax ?? 0) } },
    desarmado: !c.mainHandWeaponName && !c.offHandWeaponName,
    duas_maos: Boolean(c.mainHandWeaponName && c.mainHandWeaponName === c.offHandWeaponName),
    duas_armas: Boolean(c.mainHandWeaponName && c.offHandWeaponName && c.mainHandWeaponName !== c.offHandWeaponName),
  };
  const itens = useInventoryStore.getState().listByOwner(c.id);
  selecoes.item = { registros: Object.fromEntries(itens.map(i => [i.entity.id, { id: i.entity.id,
    valor: true, campos: { equipado: i.isEquipped, usos: recursoComposto(i.usosRestantes ?? 0, i.usosTotais ?? 0) } }])) };
  selecoes.itens = itens.map(i => ({ id: i.entity.id, campos: { equipados: i.isEquipped } }));
  const money = useMoneyStore.getState();
  const wallets = money.wallets.filter(w => w.members.includes(c.id));
  const defaultId = money.currencies.find(m => m.isDefault)?.id ?? money.currencies[0]?.id;
  const saldoPorMoeda = Object.fromEntries(money.currencies.map(m => [m.id, wallets.reduce((s, w) => s + (w.balances[m.id] ?? 0), 0)]));
  const pessoal = wallets.find(w => w.isPersonal);
  selecoes.carteiras = wallets.map(w => ({ id: w.id, campos: { pessoal: Boolean(w.isPersonal), compartilhadas: !w.isPersonal } }));
  selecoes.carteira = { campos: { pessoal: pessoal ? { id: pessoal.id, valor: 0 } : undefined } };
  selecoes.saldo = { registros: saldoPorMoeda, campos: { total: Object.values(saldoPorMoeda).reduce((a, b) => a + b, 0),
    padrao: defaultId ? saldoPorMoeda[defaultId] ?? 0 : 0,
    pessoal: defaultId ? pessoal?.balances[defaultId] ?? 0 : 0 } };
  selecoes.moeda = { registros: saldoPorMoeda };
  return { selecoes };
}
