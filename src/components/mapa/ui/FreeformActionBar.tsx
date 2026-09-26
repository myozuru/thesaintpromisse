/**
 * FreeformActionBar — hotbar minimalista para fichas temporárias / Modo Livre.
 *
 * Fluxo:
 *   1. Escolhe Dano ou Cura.
 *   2. Seleciona o alvo clicando no token do mapa (linha de mira).
 *   3. Dano: rola acerto (d20 + bônus vs Defesa).
 *   4. Rola NdX + mod e aplica no alvo.
 */
import { shownHpMax } from '@/lib/peDisplay';
import { useEffect, useMemo, useState } from 'react';
import { Swords, Heart, X, Dice6, Crosshair, Plus, Minus } from 'lucide-react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { rollD20Com, rollDiceGroups } from '@/lib/dice';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS, createEmptyRdByType } from '@/types';
import type { Character, DamageType } from '@/types';
import { cn } from '@/lib/utils';

const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100];

const PREFS_KEY = 'freeform-attack-prefs-v1';

interface DiceGroup { id: string; n: number; faces: number }

const TR_TYPES = [
  { value: 'Fortitude', label: 'Fortitude' },
  { value: 'Reflexos', label: 'Reflexos' },
  { value: 'Vontade', label: 'Vontade' },
  { value: 'Astúcia', label: 'Astúcia' },
  { value: 'Integridade', label: 'Integridade' },
];

/** Normaliza valores antigos salvos em minúsculo/sem acento. */
const normalizeTrType = (v: unknown): string => {
  const s = String(v ?? '').toLowerCase();
  const hit = TR_TYPES.find(
    (t) => t.value.toLowerCase() === s || t.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === s,
  );
  return hit?.value ?? 'Reflexos';
};


interface Prefs {
  attackBonus: number;
  recent: { n: number; faces: number }[][];
  hitMode: 'acerto' | 'tr';
  cd: number;
  trType: string;
}

const uid = () => Math.random().toString(36).slice(2, 9);

/** Chave isolada por ficha — cada personagem guarda seus próprios atalhos. */
const prefsKeyFor = (charId: string) => `${PREFS_KEY}:${charId}`;

const emptyPrefs = (): Prefs => ({
  attackBonus: 0,
  recent: [],
  hitMode: 'acerto',
  cd: 10,
  trType: 'Reflexos',
});

function loadPrefs(charId: string): Prefs {
  try {
    const raw = localStorage.getItem(prefsKeyFor(charId));
    if (!raw) return emptyPrefs();
    const p = JSON.parse(raw);
    return {
      attackBonus: Number(p?.attackBonus) || 0,
      recent: Array.isArray(p?.recent) ? p.recent.slice(0, 6) : [],
      hitMode: p?.hitMode === 'tr' ? 'tr' : 'acerto',
      cd: Number(p?.cd) || 10,
      trType: normalizeTrType(p?.trType),
    };
  } catch {
    return emptyPrefs();
  }
}

function savePrefs(charId: string, p: Partial<Prefs>) {
  try {
    const cur = loadPrefs(charId);
    localStorage.setItem(prefsKeyFor(charId), JSON.stringify({ ...cur, ...p }));
  } catch {
    /* noop */
  }
}


const groupsLabel = (gs: { n: number; faces: number }[]) =>
  gs.map((g) => `${Math.max(1, g.n)}d${g.faces}`).join(' + ');

interface Props {
  character: Character;
}

/**
 * Conteúdo do painel (sem o botão flutuante) — reaproveitado pela hotbar
 * do turno no botão "Ataque".
 */
export function FreeformAttackForm({
  character,
  onClose,
}: Props & { onClose?: () => void }) {
  const characters = useCharacterStore((s) => s.characters);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const applyDamage = useCharacterStore((s) => s.applyDamage);
  const addLog = useLogStore((s) => s.addLog);
  const entities = useMapStore((s) => s.entities);
  const mapSelection = useMapStore((s) => s.selectedIds);

  const initialPrefs = useMemo(() => loadPrefs(character.id), [character.id]);

  const [mode, setMode] = useState<'dano' | 'cura'>('dano');
  const [groups, setGroups] = useState<DiceGroup[]>([{ id: uid(), n: 1, faces: 6 }]);
  const [recent, setRecent] = useState(initialPrefs.recent);
  const [mod, setMod] = useState(0);
  const [dmgType, setDmgType] = useState<DamageType | ''>('');
  const [targetId, setTargetId] = useState<string>('');
  const [picking, setPicking] = useState(false);
  const [attackBonus, setAttackBonus] = useState(initialPrefs.attackBonus);
  const [hitMode, setHitMode] = useState<'acerto' | 'tr'>(initialPrefs.hitMode);
  const [cd, setCd] = useState(initialPrefs.cd);
  const [trType, setTrType] = useState(initialPrefs.trType);
  const [rolling, setRolling] = useState(false);
  const [attack, setAttack] = useState<{ nat: number; total: number; hit: boolean } | null>(null);
  const [dmgResult, setDmgResult] = useState<{ rolls: number[]; total: number } | null>(null);
  const [applied, setApplied] = useState(false);
  /** tag do pedido de TR enviado ao alvo (aguardando rolagem do jogador). */
  const [trReqId, setTrReqId] = useState<string | null>(null);
  const [trTag, setTrTag] = useState<string | null>(null);
  /** Resultado capturado — persiste mesmo se o pedido for dispensado/limpo. */
  const [trOutcome, setTrOutcome] = useState<{ total: number; passed: boolean } | null>(null);

  const trRequests = useTestRequestStore((s) => s.requests);
  const trRequest = useMemo(
    () =>
      trTag || trReqId
        ? trRequests.find((r) => (trTag && r.sourceTag === trTag) || (trReqId && r.id === trReqId)) ?? null
        : null,
    [trRequests, trTag, trReqId],
  );

  /** Captura o resultado assim que o alvo rolar (sobrevive ao dismiss). */
  useEffect(() => {
    const res = trRequest?.result;
    if (!res) return;
    setTrOutcome({ total: res.total, passed: res.total >= (trRequest?.dc ?? cd) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trRequest?.result?.rolledAt, trRequest?.dc]);

  /** null = ainda não rolou; true = passou (½ dano); false = falhou (dano cheio). */
  const trPassed = trOutcome ? trOutcome.passed : null;





  const findEntityForChar = (charId?: string, profileId?: string) => {
    if (!charId) return null;
    const list = Object.values(entities);
    const direct = list.find((en: any) => en?.characterId === charId);
    if (direct) return direct as any;
    if (!profileId) return null;
    return (
      (list.find(
        (en: any) => en && (en.avatarProfileId === profileId || en.ownerProfileId === profileId),
      ) as any) ?? null
    );
  };

  const casterEntity = useMemo(
    () => findEntityForChar(character.id, character.profileId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, character],
  );

  const target = characters.find((c) => c.id === targetId) ?? null;

  const reset = () => {
    setAttack(null);
    setDmgResult(null);
    setApplied(false);
    setTrReqId(null);
    setTrTag(null);
    setTrOutcome(null);
  };

  /** Envia o pedido de TR para a ficha alvo (o jogador dono rola no cliente dele). */
  const requestSave = () => {
    if (!target) return;
    const tag = `freeform:${character.id}:${target.id}:${Date.now()}`;
    const store = useTestRequestStore.getState();
    store.enqueue({
      charId: target.id,
      charName: target.name,
      kind: 'save',
      testName: trType,
      dc: cd,
      note: `${character.name} — TR contra efeito (sucesso = metade do dano)`,
      sourceTag: tag,
    });
    const list = useTestRequestStore.getState().requests;
    const created = list[list.length - 1];
    setTrReqId(created?.id ?? null);
    setTrTag(tag);
    setTrOutcome(null);
    setDmgResult(null);
    setApplied(false);
    addLog('combat', `📜 ${character.name} solicitou TR de ${trType} (CD ${cd}) a ${target.name}.`);
  };

  /** Linha de mira enquanto escolhe alvo. */
  useEffect(() => {
    const setAim = useMapStore.getState().setSingleTargetAim;
    if (!picking || !casterEntity) {
      setAim(null);
      return;
    }
    setAim({
      originWorld: { x: casterEntity.x, y: casterEntity.y },
      color: mode === 'cura' ? '#4ade80' : '#f87171',
      label: mode === 'cura' ? 'Cura' : 'Ataque',
      onCancel: () => setPicking(false),
    });
    return () => setAim(null);
  }, [picking, casterEntity, mode]);

  /** Clique num token define o alvo. */
  useEffect(() => {
    if (!picking) return;
    if (mapSelection.length !== 1) return;
    const ent: any = entities[mapSelection[0]];
    if (!ent) return;
    let cid: string | null = ent.characterId ?? null;
    if (!cid) {
      const prof = ent.avatarProfileId ?? ent.ownerProfileId ?? null;
      if (prof) cid = characters.find((c) => c.profileId === prof)?.id ?? null;
    }
    if (!cid) return;
    if (mode === 'dano' && cid === character.id) return;
    setTargetId(cid);
    setPicking(false);
    reset();
  }, [picking, mapSelection, entities, characters, character.id, mode]);

  const notation = groupsLabel(groups);

  const setGroup = (id: string, patch: Partial<DiceGroup>) => {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    setDmgResult(null);
  };

  const rollAttack = async () => {
    if (!target || rolling) return;
    setRolling(true);
    try {
      const nat = await rollD20Com(character.id, attackBonus || undefined);
      const total = nat + attackBonus;
      const def = computeTotalDefense(target);
      const hit = nat !== 1 && (nat === 20 || total >= def);
      setAttack({ nat, total, hit });
      setDmgResult(null);
      savePrefs(character.id, { attackBonus, recent });
      addLog(
        'combat',
        `🎯 ${character.name} → ${target.name}: d20 ${nat}${attackBonus ? ` ${attackBonus > 0 ? '+' : ''}${attackBonus}` : ''} = ${total} → ${hit ? 'ACERTO' : 'ERRO'}.`,
      );
    } finally {
      setRolling(false);
    }
  };


  const applyToTarget = (t: Character, amount: number) => {
    if (mode === 'cura') {
      const next = Math.min(t.hpMax, t.hpCurrent + amount);
      const real = next - t.hpCurrent;
      updateCharacter(t.id, { hpCurrent: next });
      addLog('combat', `💚 ${t.name} curou ${real} HP (${character.name}).`);
      return;
    }
    if (t.temporary) {
      const rdByType = { ...createEmptyRdByType(), ...(t.rdByType ?? {}) };
      const rdGeral = t.rd ?? 0;
      const rdTipo = dmgType ? rdByType[dmgType] ?? 0 : 0;
      const reduzido = Math.max(0, amount - rdGeral - rdTipo);
      const next = Math.max(0, t.hpCurrent - reduzido);
      const real = t.hpCurrent - next;
      updateCharacter(t.id, { hpCurrent: next });
      const rdTxt = rdGeral + rdTipo > 0 ? ` (${amount} − ${rdGeral + rdTipo} RD = ${reduzido})` : '';
      addLog('combat', `💥 ${t.name} sofreu ${real} de dano${rdTxt} de ${character.name}.`);
    } else {
      applyDamage(t.id, amount, (dmgType || 'DCO') as DamageType, { attackerId: character.id });
    }
  };

  const rollDamage = async () => {
    if (rolling || !target) return;
    setRolling(true);
    try {
      // Rola TODOS os grupos de dados juntos, numa única jogada na bandeja 3D.
      const res = await rollDiceGroups(
        groups.map((g) => ({ count: Math.max(1, g.n), sides: g.faces })),
        { bonus: mod || undefined, label: notation },
      );
      const rolls = res.rolls;
      const final = Math.max(0, res.total + mod);
      setDmgResult({ rolls, total: final });
      setApplied(false);
      // guarda o conjunto de dados como opção rápida
      const combo = groups.map((g) => ({ n: Math.max(1, g.n), faces: g.faces }));
      const key = groupsLabel(combo);
      const nextRecent = [combo, ...recent.filter((r) => groupsLabel(r) !== key)].slice(0, 6);
      setRecent(nextRecent);
      savePrefs(character.id, { attackBonus, recent: nextRecent });
      const trTxt =
        mode === 'dano' && hitMode === 'tr'
          ? ` [TR ${TR_TYPES.find((t) => t.value === trType)?.label ?? trType} CD ${cd}]`
          : '';
      addLog(
        'combat',
        `${mode === 'cura' ? '💚' : '🎲'} ${character.name}${trTxt} ${notation}${mod ? (mod > 0 ? `+${mod}` : mod) : ''} → ${rolls.join(' + ')}${mod ? ` ${mod > 0 ? '+' : '-'} ${Math.abs(mod)}` : ''} = ${final}.`,
      );

    } finally {
      setRolling(false);
    }
  };

  const applyResult = () => {
    if (!target || !dmgResult || applied) return;
    const isTr = mode === 'dano' && hitMode === 'tr';
    const halved = isTr && trPassed === true;
    const amount = halved ? Math.floor(dmgResult.total / 2) : dmgResult.total;
    if (isTr) {
      addLog(
        'combat',
        halved
          ? `🛡️ ${target.name} passou no TR de ${trType} (CD ${cd}) → metade do dano: ${dmgResult.total} ÷ 2 = ${amount}.`
          : `💢 ${target.name} ${trPassed === false ? 'falhou no' : 'não rolou o'} TR de ${trType} (CD ${cd}) → dano inteiro: ${amount}.`,
      );
    }
    applyToTarget(target, amount);
    setApplied(true);
  };


  const canRollDice =
    mode === 'cura' ? !!target : !!target && (hitMode === 'tr' || !!attack?.hit);

  const inputCls =
    'h-8 w-full rounded-md border border-border bg-background px-2 text-sm font-mono text-foreground';

  return (
    <div className="rounded-xl border border-primary/50 bg-background/95 backdrop-blur-md shadow-2xl px-3 py-3 w-[320px] space-y-2.5">
      <div className="flex items-center gap-1">
        {(['dano', 'cura'] as const).map((m) => (
          <button
            key={m}
                onClick={() => { setMode(m); setTargetId(''); reset(); }}
                className={cn(
                  'h-8 flex-1 rounded-md border flex items-center justify-center transition-colors',
                  mode === m
                    ? 'bg-primary/20 border-primary/60 text-primary'
                    : 'bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/60',
                )}
                title={m === 'dano' ? 'Dano' : 'Cura'}
              >
                {m === 'dano' ? <Swords className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
              </button>
            ))}
        {onClose && (
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md text-muted-foreground hover:text-destructive flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        )}
          </div>

          {/* Alvo por clique no mapa */}
          <button
            onClick={() => { setPicking((v) => !v); setTargetId(''); reset(); }}
            className={cn(
              'w-full h-9 rounded-md border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors',
              picking
                ? 'border-primary bg-primary/20 text-primary animate-pulse'
                : target
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60',
            )}
          >
            <Crosshair className="h-3.5 w-3.5" />
            {picking ? 'Clique no token…' : target ? `${target.name} · ${target.hpCurrent}/${shownHpMax(target)}` : 'Selecionar alvo'}
          </button>

          {/* Tipo de ataque: Acerto x TR */}
          {mode === 'dano' && target && (
            <div className="flex items-center gap-1">
              {(['acerto', 'tr'] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    setHitMode(h);
                    setAttack(null);
                    setDmgResult(null);
                    setApplied(false);
                    savePrefs(character.id, { hitMode: h });
                  }}
                  className={cn(
                    'h-8 flex-1 rounded-md border text-xs font-bold transition-colors',
                    hitMode === h
                      ? 'bg-primary/20 border-primary/60 text-primary'
                      : 'bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/60',
                  )}
                >
                  {h === 'acerto' ? 'Acerto' : 'TR'}
                </button>
              ))}
            </div>
          )}

          {/* Acerto */}
          {mode === 'dano' && target && hitMode === 'acerto' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={attackBonus}
                onChange={(e) => {
                  const v = parseInt(e.target.value || '0', 10) || 0;
                  setAttackBonus(v);
                  setAttack(null);
                  savePrefs(character.id, { attackBonus: v });
                }}
                className={cn(inputCls, 'w-16 text-center')}
                title="Bônus de acerto"
              />
              <button
                onClick={rollAttack}
                disabled={rolling}
                className="flex-1 h-8 rounded-md bg-primary/20 border border-primary/50 text-primary text-xs font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors"
              >
                Rolar acerto
              </button>
              {attack && (
                <span
                  className={cn(
                    'text-xs font-bold px-1.5',
                    attack.hit ? 'text-emerald-400' : 'text-destructive',
                  )}
                >
                  {attack.hit ? 'Acerto' : 'Erro'}
                </span>
              )}
            </div>
          )}

          {/* TR — CD e tipo de teste */}
          {mode === 'dano' && target && hitMode === 'tr' && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={cd}
                onChange={(e) => {
                  const v = parseInt(e.target.value || '0', 10) || 0;
                  setCd(v);
                  savePrefs(character.id, { cd: v });
                }}
                className={cn(inputCls, 'w-16 text-center')}
                title="CD do teste de resistência"
                placeholder="CD"
              />
              <select
                value={trType}
                onChange={(e) => {
                  setTrType(e.target.value);
                  setTrReqId(null);
                  setTrTag(null);
                  setTrOutcome(null);
                  savePrefs(character.id, { trType: e.target.value });
                }}
                className={cn(inputCls, 'flex-1 text-xs')}
                title="Tipo de TR"
              >
                {TR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* TR — solicitar o teste ao alvo e acompanhar o resultado */}
          {mode === 'dano' && target && hitMode === 'tr' && (
            <div className="space-y-1.5">
              <button
                onClick={requestSave}
                className="w-full h-8 rounded-md border border-primary/50 bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 transition-colors"
              >
                {trReqId ? 'Solicitar novamente' : `Solicitar teste de ${trType}`}
              </button>
              {trReqId && (
                <div
                  className={cn(
                    'text-[11px] text-center font-bold rounded-md py-1 border',
                    trPassed === null
                      ? 'border-border bg-secondary/30 text-muted-foreground animate-pulse'
                      : trPassed
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-destructive/50 bg-destructive/10 text-destructive',
                  )}
                >
                  {trPassed === null
                    ? 'Aguardando rolagem do alvo…'
                    : trPassed
                      ? `Passou (${trOutcome?.total}) → metade do dano`
                      : `Falhou (${trOutcome?.total}) → dano inteiro`}
                </div>
              )}
            </div>
          )}





          {/* Dados — só depois do acerto (ou direto na cura) */}
          {canRollDice && (
            <>
              {recent.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recent.map((r) => (
                    <button
                      key={groupsLabel(r)}
                      onClick={() => {
                        setGroups(r.map((g) => ({ id: uid(), n: g.n, faces: g.faces })));
                        setDmgResult(null);
                      }}
                      className="h-6 px-2 rounded-md border border-border bg-secondary/30 text-[11px] font-mono text-muted-foreground hover:bg-secondary/60 transition-colors"
                    >
                      {groupsLabel(r)}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={g.n}
                      onChange={(e) => setGroup(g.id, { n: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                      className={cn(inputCls, 'w-14 text-center')}
                    />
                    <select
                      value={g.faces}
                      onChange={(e) => setGroup(g.id, { faces: parseInt(e.target.value, 10) })}
                      className={cn(inputCls, 'w-20')}
                    >
                      {DIE_SIZES.map((d) => (
                        <option key={d} value={d}>d{d}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { setGroups((gs) => gs.filter((x) => x.id !== g.id)); setDmgResult(null); }}
                      disabled={groups.length <= 1}
                      className="h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-destructive disabled:opacity-30 flex items-center justify-center"
                      title="Remover dado"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { setGroups((gs) => [...gs, { id: uid(), n: 1, faces: 6 }]); setDmgResult(null); }}
                      className="h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-primary flex items-center justify-center"
                      title="Adicionar dado"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={mod}
                  onChange={(e) => { setMod(parseInt(e.target.value || '0', 10) || 0); setDmgResult(null); }}
                  className={cn(inputCls, 'w-16 text-center')}
                  title="Modificador"
                />
                {mode === 'dano' && (
                  <select
                    value={dmgType}
                    onChange={(e) => setDmgType(e.target.value as DamageType | '')}
                    className={cn(inputCls, 'flex-1 text-xs')}
                  >
                    <option value="">—</option>
                    {DAMAGE_TYPES.map((t) => (
                      <option key={t} value={t}>{DAMAGE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                )}
              </div>

              <button
                onClick={rollDamage}
                disabled={rolling}
                className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <Dice6 className="h-4 w-4" /> {notation}{mod ? (mod > 0 ? `+${mod}` : mod) : ''}
              </button>
            </>
          )}


      {dmgResult && (
        <div className="space-y-1.5">
          <div className="text-xs font-mono text-center text-foreground">
            {dmgResult.rolls.join(' + ')}
            {mod ? ` ${mod > 0 ? '+' : '-'} ${Math.abs(mod)}` : ''} = <b>{dmgResult.total}</b>
          </div>
          <button
            onClick={applyResult}
            disabled={applied || !target}
            className={cn(
              'w-full h-9 rounded-md text-sm font-bold transition-colors disabled:opacity-40',
              mode === 'cura'
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-destructive/20 border border-destructive/50 text-destructive hover:bg-destructive/30',
            )}
          >
            {applied
              ? mode === 'cura' ? 'Cura aplicada' : 'Dano aplicado'
              : mode === 'cura'
                ? 'Aplicar cura'
                : hitMode === 'tr' && trPassed === true
                  ? `Aplicar metade (${Math.floor(dmgResult.total / 2)})`
                  : 'Aplicar dano'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Hotbar flutuante (Modo Livre / fichas temporárias). */
export function FreeformActionBar({ character }: Props) {
  const [openPanel, setOpenPanel] = useState(false);
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
      {openPanel && <FreeformAttackForm character={character} onClose={() => setOpenPanel(false)} />}
      <button
        onClick={() => setOpenPanel((v) => !v)}
        className="h-11 px-4 rounded-xl border border-primary/50 bg-background/90 backdrop-blur-md shadow-xl text-sm font-bold text-primary flex items-center gap-2 hover:bg-primary/15 transition-colors"
      >
        <Dice6 className="h-4 w-4" /> Ação
      </button>
    </div>
  );
}
