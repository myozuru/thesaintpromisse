import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cloud, Feather, Shield, Sparkles, Wind, X } from 'lucide-react';
import type { Character } from '@/types';
import { findWeaponModelById, type Weapon } from '@/lib/weapons';
import { buildAttackContext, pickAttackAbility, rollAttack } from '@/lib/combatEngine';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { distanceBetweenChars } from '@/lib/weaponRange';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { findEntitiesInTemplate } from '@/lib/mapAoE';
import { rollDiceCom } from '@/lib/dice';
import { aplicarMovimentoAtivo, validarPlanoMovimento } from '@/lib/omni/movimentosAtivos';
import { aetherisRequiemReady, aetherisRoundUseReady, validAetherisFeatherAllocation, BACULO_AETHERIS_ID, BACULO_AETHERIS_SUSPENSO } from '@/lib/baculoAetheris';
import { getReactionsAvailable } from '@/lib/reactionBudget';
import { useBaculoAetherisCounterattackStore } from '@/lib/baculoAetherisState';
import { saoAliados } from '@/lib/omni/observadores';

interface Props { character: Character; weaponInstanceId: string; weapon?: Weapon; ruptureTargetId: string | null; onRupturePromptClose: () => void }
type Ability = 'trono' | 'requiem';
type AreaState = { ability: Ability; ids: string[] };

const tokenOf = (entities: Record<string, Entity>, id: string) => Object.values(entities).find((e) => e.characterId === id && (e.layer ?? 'tokens') === 'tokens' && !e.hidden);
const hostile = (c: Character, owner: Character) => c.id !== owner.id && !saoAliados(c, owner);
const ally = (c: Character, owner: Character) => c.id !== owner.id && saoAliados(c, owner);

function spend(charId: string, peCost: number, complete: boolean): string | null {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c) return 'Ficha do portador não encontrada';
  const pe = (c.peCurrent ?? 0) + (c.tempPE ?? 0);
  if (pe < peCost) return 'PE insuficiente: requer ' + peCost + ', você possui ' + pe;
  if ((c.actionsCurrent ?? 1) < 1) return complete ? 'Requer Ação Completa (Comum + Bônus disponíveis)' : 'Ação Comum indisponível nesta rodada';
  if (complete && (c.bonusActionsCurrent ?? 1) < 1) return 'Requer Ação Completa (Comum + Bônus disponíveis)';
  const temp = Math.min(peCost, c.tempPE ?? 0);
  store.updateCharacter(charId, {
    tempPE: (c.tempPE ?? 0) - temp,
    peCurrent: Math.max(0, (c.peCurrent ?? 0) - (peCost - temp)),
    actionsCurrent: Math.max(0, (c.actionsCurrent ?? 1) - 1),
    ...(complete ? { bonusActionsCurrent: Math.max(0, (c.bonusActionsCurrent ?? 1) - 1) } : {}),
  });
  return null;
}

export function BaculoAetherisPanel({ character, weaponInstanceId, weapon: equippedWeapon, ruptureTargetId, onRupturePromptClose }: Props) {
  const characters = useCharacterStore((s) => s.characters);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const applyDamage = useCharacterStore((s) => s.applyDamage);
  const entities = useMapStore((s) => s.entities);
  const grid = useMapStore((s) => s.gridConfig);
  const requestArea = useMapStore((s) => s.requestAoEPlacement);
  const inCombat = useCombatStore((s) => s.inCombat);
  const combatId = useCombatStore((s) => s.combatId);
  const markRequiem = useCombatStore((s) => s.markAetherisRequiemUse);
  const counterattack = useBaculoAetherisCounterattackStore((s) => s.pending?.wielderId === character.id ? s.pending : null);
  const clearCounterattack = useBaculoAetherisCounterattackStore((s) => s.clearPending);
  const usedRequiem = useCombatStore((s) => s.aetherisRequiemUse[character.id]);
  const aetherisRoundUse = useCombatStore((s) => s.aetherisRoundUse);
  const round = useCombatStore((s) => s.round);
  const addLog = useLogStore((s) => s.addLog);
  const current = characters.find((x) => x.id === character.id) ?? character;
  const sourceToken = tokenOf(entities, current.id);
  const weapon = equippedWeapon ?? findWeaponModelById(BACULO_AETHERIS_ID);
  const [mode, setMode] = useState<'plumas' | Ability | null>(null);
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const [area, setArea] = useState<AreaState | null>(null);
  const [safe, setSafe] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<Record<string, { x: number; y: number }>>({});
  const [busy, setBusy] = useState(false);
  const reachable = useMemo(() => characters.filter((c) => hostile(c, current) && (distanceBetweenChars(current.id, c.id, entities, grid, { casterProfileId: current.profileId, targetProfileId: c.profileId }) ?? Infinity) <= 18.05), [characters, current, entities, grid]);
  const areaChars = area ? area.ids.map((id) => characters.find((c) => c.id === id)).filter((c): c is Character => !!c) : [];
  const allies = areaChars.filter((c) => ally(c, current));
  const affected = areaChars.filter((c) => c.id !== current.id && !safe.includes(c.id));
  const totalPE = (current.peCurrent ?? 0) + (current.tempPE ?? 0);
  const reversaoReason = totalPE < 7 ? 'PE insuficiente: requer 7, você possui ' + totalPE
    : getReactionsAvailable(current) <= 0 ? 'Sem Reação disponível nesta rodada' : null;
  const actionReason = (pe: number, complete: boolean) => {
    if (totalPE < pe) return 'PE insuficiente: requer ' + pe + ', você possui ' + totalPE;
    if ((current.actionsCurrent ?? 1) < 1) return complete ? 'Requer Ação Completa (Comum + Bônus disponíveis)' : 'Ação Comum indisponível nesta rodada';
    if (complete && (current.bonusActionsCurrent ?? 1) < 1) return 'Requer Ação Completa (Comum + Bônus disponíveis)';
    if (!sourceToken) return 'Empunhador precisa ter um token no mapa';
    return null;
  };
  const requiemReady = aetherisRequiemReady(current, usedRequiem, combatId ?? null);
  const requiemReason = usedRequiem === (combatId ?? 'sem-combate') ? 'Réquiem já foi usada 1× nesta cena' : actionReason(18, true);
  const close = () => { setMode(null); setArea(null); setSafe([]); setDestinations({}); };

  const place = async (ability: Ability) => {
    if (!sourceToken) return;
    setBusy(true);
    try {
      const template = await requestArea({ kind: 'circle', sizeMeters: ability === 'trono' ? 3 : 9,
        sourceLabel: ability === 'trono' ? 'Trono das Nuvens · raio 3 m · alcance 18 m' : 'Réquiem dos Céus · raio 9 m',
        color: ability === 'trono' ? '#a78bfa' : '#38bdf8', originWorld: { x: sourceToken.x, y: sourceToken.y }, maxRangeMeters: ability === 'trono' ? 18 : 24 });
      if (!template) return;
      const map = useMapStore.getState().entities;
      const ids = findEntitiesInTemplate(template, map).map((id) => map[id]?.characterId).filter((id): id is string => !!id);
      setArea({ ability, ids: Array.from(new Set(ids)) });
      setSafe([]);
      setDestinations({});
    } finally { setBusy(false); }
  };

  const setAllocationFor = (id: string, delta: number) => setAllocation((prev) => {
    const nextCount = Math.max(0, Math.min(3, (prev[id] ?? 0) + delta));
    const next = { ...prev, [id]: nextCount };
    if (Object.values(next).reduce((sum, n) => sum + n, 0) > 3) return prev;
    return next;
  });

  const fire = async () => {
    if (!weapon || !validAetherisFeatherAllocation(allocation)) return;
    const reason = actionReason(8, false);
    if (reason) { addLog('combat', 'Plumas da Tempestade: ' + reason + '.'); return; }
    const map = useMapStore.getState();
    const fichasAtuais = useCharacterStore.getState().characters;
    const portadorAtual = fichasAtuais.find((c) => c.id === current.id);
    if (!portadorAtual) { addLog('combat', 'Plumas da Tempestade: ficha do portador não encontrada.'); return; }
    for (const id of Object.keys(allocation).filter((key) => allocation[key] > 0)) {
      const alvo = fichasAtuais.find((c) => c.id === id);
      if (!alvo || !hostile(alvo, portadorAtual)) { addLog('combat', 'Plumas da Tempestade: um alvo não está mais disponível. Selecione os alvos novamente.'); return; }
      const d = distanceBetweenChars(portadorAtual.id, id, map.entities, map.gridConfig, { casterProfileId: portadorAtual.profileId, targetProfileId: alvo.profileId });
      if (d === null || d > 18.05) { addLog('combat', 'Plumas da Tempestade: alvo fora do alcance de 18 m.'); return; }
    }
    const costError = spend(current.id, 8, false);
    if (costError) { addLog('combat', 'Plumas da Tempestade: ' + costError + '.'); return; }
    setBusy(true);
    try {
      for (const [id, count] of Object.entries(allocation)) {
        const victim = useCharacterStore.getState().characters.find((c) => c.id === id);
        const attacker = useCharacterStore.getState().characters.find((c) => c.id === current.id) ?? current;
        if (!victim) continue;
        for (let i = 0; i < count; i += 1) {
          const rangedWeapon = { ...weapon, range: 'ranged' as const };
          const ctx = buildAttackContext({ attacker, weapon: rangedWeapon, targetId: id, targetDefense: computeTotalDefense(victim, {}, 'ranged'), alcanceM: 18,
            situation: { twoHanded: true, preferredAbility: pickAttackAbility(attacker, rangedWeapon) },
            trainedRanges: [...(attacker.meleeTrained ? (['melee'] as const) : []), ...(attacker.rangedTrained ? (['ranged', 'thrown'] as const) : [])] });
          const attack = await rollAttack(ctx);
          addLog('combat', 'Plumas da Tempestade: d20 ' + attack.natural + ' contra ' + victim.name + (attack.hit ? ' — acerto.' : ' — erro.'));
          if (!attack.hit) continue;
          const formula = attack.critical ? '12d8' : '6d8';
          const rolled = await rollDiceCom(attacker.id, formula, { label: 'Plumas da Tempestade' });
          await applyDamage(victim.id, rolled.total, 'DCO', { attackerId: attacker.id, source: 'arma', isMelee: false, attack: { critical: attack.critical, criticalFail: false } });
          addLog('combat', formula + ' Cortante = ' + rolled.total + ' contra ' + victim.name + '.');
        }
      }
      if (inCombat) {
        updateCharacter(current.id, { baculoAetherisSafeMoveM: 4.5, baculoAetherisSafeMoveRemainingM: 4.5 });
        addLog('combat', 'Ventos Favoráveis: você pode se mover até 4,5 m sem provocar AdO.');
      }
      close();
    } finally { setBusy(false); }
  };

  const confirmArea = async () => {
    if (!area || busy) return;
    setBusy(true);
    try {
    if (area.ability === 'trono') {
      const reason = actionReason(9, false);
      if (reason) { addLog('combat', 'Trono das Nuvens: ' + reason + '.'); return; }
      const costError = spend(current.id, 9, false);
      if (costError) return;
      const { pedirTRBaculoAetheris } = await import('@/lib/baculoAetherisCombat');
      for (const target of affected) pedirTRBaculoAetheris(current, target, 'Trono das Nuvens', { damageFormula: '5d8', damageType: 'DI', halfOnSuccess: true, conditionOnFailure: 'suspenso', sourceInstanceId: weaponInstanceId });
      addLog('combat', 'Trono das Nuvens: ' + affected.length + ' alvo(s) aguardam TR de Fortitude.');
      close();
      return;
    }
    const reason = actionReason(18, true);
    if (!requiemReady || reason) { addLog('combat', 'Réquiem dos Céus: ' + (requiemReady ? reason : requiemReason) + '.'); return; }
    if (safe.some((id) => !destinations[id])) { addLog('combat', 'Réquiem dos Céus: defina o destino de cada aliado selecionado.'); return; }
    for (const id of safe) {
      const movementError = validarPlanoMovimento(current.id, id, { indice: 0, tipo: 'teleporte', sujeito: 'alvo', metros: 9, destino: destinations[id] });
      if (movementError) { addLog('combat', 'Réquiem dos Céus: destino inválido para ' + (characters.find((c) => c.id === id)?.name ?? 'aliado') + ' — ' + movementError); return; }
    }
    if (spend(current.id, 18, true)) return;
    markRequiem(current.id);
    const { pedirTRBaculoAetheris } = await import('@/lib/baculoAetherisCombat');
    for (const target of affected) {
      const suspended = target.activeConditions?.some((condition) => condition.conditionId === BACULO_AETHERIS_SUSPENSO);
      pedirTRBaculoAetheris(current, target, 'Réquiem dos Céus', {
        damageFormula: '15d10', damageType: 'DS', halfOnSuccess: true, pushMetersOnFailure: 6,
        conditionOnFailure: 'caido', saveModifier: suspended ? -2 : undefined, sourceInstanceId: weaponInstanceId });
    }
    for (const id of safe) {
      const moved = aplicarMovimentoAtivo(current.id, id, { indice: 0, tipo: 'teleporte', sujeito: 'alvo', metros: 9, destino: destinations[id]! });
      if (!/teleportado/i.test(moved)) addLog('combat', 'Transporte do Réquiem não aplicado: ' + moved + '.');
    }
    addLog('combat', 'Réquiem dos Céus: ' + affected.length + ' alvo(s) na área; ' + safe.length + ' aliado(s) em segurança.');
    close();
    } finally {
      setBusy(false);
    }
  };

  const chooseDestination = async (id: string) => {
    const token = tokenOf(useMapStore.getState().entities, id);
    if (!token) return;
    setBusy(true);
    try {
      const template = await requestArea({ kind: 'circle', sizeMeters: 0.15, sourceLabel: 'Destino seguro · até 9 m', color: '#38bdf8', originWorld: { x: token.x, y: token.y }, maxRangeMeters: 9 });
      if (template) setDestinations((prev) => ({ ...prev, [id]: { x: template.x, y: template.y } }));
    } finally { setBusy(false); }
  };
  const ruptureTarget = characters.find((c) => c.id === ruptureTargetId);
  const counterattackTarget = counterattack ? characters.find((c) => c.id === counterattack.attackerId) : undefined;
  const counterattackDistance = counterattackTarget ? distanceBetweenChars(current.id, counterattackTarget.id, entities, grid, { casterProfileId: current.profileId, targetProfileId: counterattackTarget.profileId }) : null;
  const ruptureUseKey = current.id + ':' + (weaponInstanceId || BACULO_AETHERIS_ID) + ':ruptura';
  const ruptureUsed = !aetherisRoundUseReady(aetherisRoundUse[ruptureUseKey], combatId ?? null, round);
  const ruptureReason = ruptureUsed ? 'Ruptura já foi usada nesta rodada'
    : getReactionsAvailable(current) <= 0 ? 'Sem Reação disponível nesta rodada'
      : totalPE < 2 ? 'PE insuficiente: requer 2, você possui ' + totalPE : null;
  const toggleSafe = (id: string) => setSafe((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev);
  const activateRupture = async () => {
    if (!ruptureTargetId) return;
    setBusy(true);
    try {
      const { ativarRupturaBaculoAetheris } = await import('@/lib/baculoAetherisCombat');
      const result = await ativarRupturaBaculoAetheris(current.id, ruptureTargetId, weaponInstanceId);
      if (!result.ok) addLog('combat', 'Ruptura do Firmamento: ' + result.reason + '.');
      else onRupturePromptClose();
    } finally { setBusy(false); }
  };

  return <section className="space-y-3 rounded-xl border border-primary/30 bg-card/70 p-3" aria-label="Ações do Báculo Aetheris">
    <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" aria-hidden="true"/><h3 className="text-sm font-bold">Báculo Aetheris</h3><span className="ml-auto text-xs text-muted-foreground">Ações e reações</span></div>
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" onClick={() => { setAllocation({}); setMode('plumas'); }} disabled={!!actionReason(8, false) || busy} title={actionReason(8, false) ?? undefined} className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-semibold disabled:opacity-50"><Feather className="h-4 w-4 text-primary"/>Plumas da Tempestade<span className="ml-auto text-xs text-muted-foreground">8 PE · Ação</span></button>
      <div className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm" aria-label="Reversão dos Ventos: Reação, 7 PE" aria-disabled={!!reversaoReason} title={reversaoReason ?? 'Reage a ataque à distância contra você ou aliado a até 9 m'}><Shield className="h-4 w-4 text-primary"/><span className="font-semibold">Reversão dos Ventos</span><span className="ml-auto text-xs text-muted-foreground">{reversaoReason ?? '7 PE · Reação'}</span></div>
      <button type="button" onClick={() => { setMode('trono'); void place('trono'); }} disabled={!!actionReason(9, false) || busy} title={actionReason(9, false) ?? undefined} className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-semibold disabled:opacity-50"><Cloud className="h-4 w-4 text-primary"/>Trono das Nuvens<span className="ml-auto text-xs text-muted-foreground">9 PE · Ação</span></button>
      <button type="button" onClick={() => { setMode('requiem'); void place('requiem'); }} disabled={!requiemReady || !!requiemReason || busy} title={requiemReason ?? undefined} className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-semibold disabled:opacity-50"><Wind className="h-4 w-4 text-primary"/>Réquiem dos Céus<span className="ml-auto text-xs text-muted-foreground">18 PE · Completa</span></button>
      <div className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm" aria-label="Ruptura do Firmamento: Reação, 2 PE após crítico"><Sparkles className="h-4 w-4 text-primary"/><span className="font-semibold">Ruptura do Firmamento</span><span className="ml-auto text-xs text-muted-foreground">2 PE · Reação após crítico</span></div>
    </div>
    {usedRequiem === (combatId ?? 'sem-combate') && <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">⚠ Réquiem já foi usada 1× nesta cena</p>}
    {inCombat && (current.baculoAetherisSafeMoveRemainingM ?? 0) > 0 && <p role="status" className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">Ventos Favoráveis: restam até {(current.baculoAetherisSafeMoveRemainingM ?? 0).toFixed(1).replace('.', ',')} m sem provocar AdO.</p>}
    {ruptureTarget && <div role="dialog" aria-labelledby="aetheris-rupture-title" className="space-y-2 rounded-lg border border-primary/50 bg-background p-3">
      <h4 id="aetheris-rupture-title" className="text-sm font-bold">Ruptura do Firmamento</h4><p className="text-xs text-muted-foreground">Contra {ruptureTarget.name}: +10d10 Sônico, empurrão de 6 m e TR de Fortitude para Caído.</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void activateRupture()} disabled={!!ruptureReason || busy} title={ruptureReason ?? 'Gasta 2 PE e 1 Reação'} className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Ativar Ruptura do Firmamento (2 PE • 1 Reação)</button><button type="button" onClick={onRupturePromptClose} className="rounded-md border border-border px-3 py-2 text-sm">Ignorar / Guardar Reação</button></div>
      {ruptureReason && <p role="status" className="text-xs text-muted-foreground">{ruptureReason}</p>}
    </div>}
    {counterattack && counterattackTarget && <div role="dialog" aria-label="Contra-Rajada disponível" className="space-y-2 rounded-lg border border-primary/50 bg-background p-3">
      <h4 className="text-sm font-bold">Contra-Rajada disponível</h4>
      <p className="text-xs text-muted-foreground">O ataque à distância contra {characters.find((c) => c.id === counterattack.protectedId)?.name ?? 'o aliado'} errou após Reversão dos Ventos. Atacante: {counterattackTarget.name} · {counterattackDistance === null ? 'fora do mapa' : counterattackDistance.toFixed(1).replace('.', ',') + ' m'}.</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || counterattackDistance === null || counterattackDistance > 18.05} onClick={() => void (async () => { setBusy(true); try { const { dispararContraRajadaBaculo } = await import('@/lib/baculoAetherisCounterattack'); const result = await dispararContraRajadaBaculo(counterattack); if (!result.ok) addLog('combat', 'Contra-Rajada: ' + result.reason + '.'); clearCounterattack(); } finally { setBusy(false); } })()} title={counterattackDistance === null || counterattackDistance > 18.05 ? 'Atacante fora do alcance de 18 m' : undefined} className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Disparar Contra-Rajada (5d8 Sônico) no Atacante</button><button type="button" onClick={clearCounterattack} className="rounded-md border border-border px-3 py-2 text-sm">Ignorar</button></div>
    </div>}
    <Dialog.Root open={!!mode && !busy} onOpenChange={(open) => { if (!open && !busy) close(); }}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70" />
      <Dialog.Content aria-labelledby="aetheris-modal-title" aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[91] max-h-[85vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-xl">
      <div className="mb-3 flex items-start gap-3"><div className="min-w-0 flex-1"><h3 id="aetheris-modal-title" className="text-base font-bold">{mode === 'plumas' ? 'Plumas da Tempestade' : mode === 'trono' ? 'Trono das Nuvens' : 'Réquiem dos Céus'}</h3><p className="mt-1 text-sm text-muted-foreground">{mode === 'plumas' ? 'Distribua até 3 ataques de 6d8 Cortante entre alvos a até 18 m.' : mode === 'trono' ? 'Posicione o raio de 3 m a até 18 m e confira os alvos.' : 'Posicione o raio de 9 m e escolha até 3 aliados para transporte seguro.'}</p></div><button type="button" onClick={close} aria-label="Fechar" className="rounded p-1"><X className="h-4 w-4"/></button></div>
      {mode === 'plumas' && <div className="space-y-2">{reachable.length === 0 && <p className="text-sm text-muted-foreground">Nenhum inimigo visível a até 18 m.</p>}{reachable.map((c) => { const count = allocation[c.id] ?? 0; const total = Object.values(allocation).reduce((a, n) => a+n, 0); const d = distanceBetweenChars(current.id, c.id, entities, grid, { casterProfileId: current.profileId, targetProfileId: c.profileId }) ?? 0; return <div key={c.id} className="flex items-center gap-3 border-b border-border py-2"><span className="min-w-0 flex-1 truncate text-sm">{c.name} · {d.toFixed(1).replace('.', ',')} m</span><button type="button" aria-label={'Remover pluma de '+c.name} onClick={() => setAllocationFor(c.id,-1)} disabled={count===0} className="h-8 w-8 rounded border border-border disabled:opacity-40">−</button><span className="w-5 text-center tabular-nums">{count}</span><button type="button" aria-label={'Adicionar pluma a '+c.name} onClick={() => setAllocationFor(c.id,1)} disabled={total>=3||count>=3} className="h-8 w-8 rounded border border-border disabled:opacity-40">+</button></div>; })}<div className="flex items-center justify-between border-t border-border pt-3"><span className="text-sm text-muted-foreground">{Object.values(allocation).reduce((a,n)=>a+n,0)}/3 plumas</span><button type="button" onClick={() => void fire()} disabled={!validAetherisFeatherAllocation(allocation)||busy} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Disparar Plumas (8 PE)</button></div></div>}
      {mode !== 'plumas' && !area && <p role="status" className="rounded-md bg-muted px-3 py-3 text-sm text-muted-foreground">{busy?'Abrindo a retícula no mapa…':'Escolha um ponto no mapa para posicionar a área.'}</p>}
      {mode !== 'plumas' && area && <div className="space-y-3"><h4 className="text-sm font-semibold">Alvos afetados</h4>{affected.length?affected.map((c)=><p key={c.id} className="border-b border-border py-1 text-sm">{c.name}</p>):<p className="text-sm text-muted-foreground">Nenhum alvo dentro da área.</p>}
        {area.ability==='requiem' && <div className="space-y-2 border-t border-border pt-3"><h4 className="text-sm font-semibold">Selecione até 3 aliados para acolher no vórtice seguro</h4>{allies.map((c)=><div key={c.id} className="flex items-center gap-3 border-b border-border py-2"><label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={safe.includes(c.id)} onChange={()=>setSafe((prev)=>prev.includes(c.id)?prev.filter((id)=>id!==c.id):prev.length<3?[...prev,c.id]:prev)} disabled={!safe.includes(c.id)&&safe.length>=3}/>{c.name}</label>{safe.includes(c.id)&&<button type="button" onClick={()=>void chooseDestination(c.id)} className="rounded border border-border px-2 py-1 text-xs">{destinations[c.id]?'Destino definido':'Definir destino'}</button>}</div>)}</div>}
        <div className="flex justify-end gap-2 border-t border-border pt-3"><button type="button" onClick={()=>{setArea(null);void place(area.ability);}} disabled={busy} className="rounded-md border border-border px-3 py-2 text-sm">Reposicionar</button><button type="button" onClick={()=>void confirmArea()} disabled={busy||(area.ability==='requiem'&&safe.some((id)=>!destinations[id]))} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Confirmar {area.ability==='trono'?'Trono':'Réquiem'}</button></div>
      </div>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </section>;
}
