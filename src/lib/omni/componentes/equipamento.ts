import type { Character } from '@/types';
import { armaDoPersonagem, armaEstaEmpunhada } from '../armaDoPersonagem';
import { weaponMaxRangeMeters } from '@/lib/weaponRange';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import type { DadoComposto, DadosComposicao, RegistroComposto } from './avaliar';
import { recursoComposto } from './recursos';

export function dadosEquipamento(c: Character, bag: Record<string, number>): DadosComposicao {
  const n = (k: string) => bag[k] ?? 0;
  function arma(nome?: string | null): RegistroComposto {
    const w = nome ? armaDoPersonagem(c.id, nome) : undefined;
    return { valor: Boolean(w), id: w?.id, propriedades: [
      ...(w?.properties.map(p => p.kind) ?? []),
      ...(w ? [w.range === 'melee' ? 'corpo_a_corpo' : 'distancia'] : []),
    ], campos: { equipada: Boolean(w), grupo: w?.group ?? '', margem_critico: w?.critRange ?? 20,
      alcance: { valor: w ? (w.range === 'melee' ? weaponMaxRangeMeters(w) ?? 0 : w.rangeShort ?? 0) : 0,
        campos: { curto: w?.rangeShort ?? 0, longo: w?.rangeLong ?? 0 } } } };
  }
  const selecoes: Record<string, DadoComposto> = {
    arma_principal: arma(c.mainHandWeaponName),
    escudo: { registros: c.equippedShieldId ? { [c.equippedShieldId]: { campos: { equipado: true, proficiente: n('ESCUDO_PROFICIENTE') } } } : {},
      padrao: { campos: { equipado: false, proficiente: false } }, campos: { equipado: Boolean(c.equippedShieldId), proficiente: n('ESCUDO_PROFICIENTE'),
      id: { registros: c.equippedShieldId ? { [c.equippedShieldId]: true } : {} } } },
    inventario: { campos: { slots: recursoComposto(c.slotsCurrent ?? 0, c.slotsMax ?? 0) } },
    desarmado: !c.mainHandWeaponName && !c.offHandWeaponName,
    duas_maos: Boolean(c.mainHandWeaponName && c.mainHandWeaponName === c.offHandWeaponName),
    duas_armas: Boolean(c.mainHandWeaponName && c.offHandWeaponName && c.mainHandWeaponName !== c.offHandWeaponName),
  };
  const itens = useInventoryStore.getState().listByOwner(c.id);
  const catalogo = useOmniEntidadesStore.getState().entidades;
  const porArma = new Map<string, typeof itens[number]>();
  for (const i of itens) {
    const ent = catalogo[i.entity.id] ?? i.entity;
    if (ent.categoria !== 'arma') continue;
    const nome = ent.replica ? i.replicaArma : ent.nome;
    if (!nome || !armaEstaEmpunhada(c, nome) || (ent.replica && !i.materializada)) continue;
    const key = nome.trim().toLowerCase();
    const anterior = porArma.get(key);
    if (!anterior || (!anterior.isEquipped && i.isEquipped)) porArma.set(key, i);
  }
  const nasMaos = new Set([...porArma.values()].map(i => i.instanceId));
  const equipado = (i: typeof itens[number]) => (catalogo[i.entity.id] ?? i.entity).categoria === 'arma' ? nasMaos.has(i.instanceId) : Boolean(i.isEquipped);
  // Preferir o exemplar equipado quando várias cópias têm o mesmo template.
  const porTemplate = [...itens].sort((a, b) => Number(equipado(a)) - Number(equipado(b)));
  selecoes.item = { padrao: { valor: false, existe: false, campos: { equipado: false } }, registros: Object.fromEntries(porTemplate.map(i => [i.entity.id, { id: i.entity.id,
    valor: true, campos: { equipado: equipado(i), usos: recursoComposto(i.usosRestantes ?? 0, i.usosTotais ?? 0) } }])) };
  selecoes.itens = itens.map(i => ({ id: i.entity.id, campos: { equipados: equipado(i) } }));
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
