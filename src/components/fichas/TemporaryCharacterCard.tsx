/**
 * TemporaryCharacterCard — cartão minimalista para fichas "temporárias" / "lite".
 *
 * Recursos avançados para mestrar fora do sistema:
 *  - Atalhos de dano/cura (item 3): calcula RD geral + por tipo automaticamente.
 *  - Buffs rápidos (item 4): chips com duração que o Mestre empurra ao token;
 *    aparecem como condições visuais (prefixo `__quickbuff__`) para também
 *    serem desenhados no token do mapa via pipeline de condições.
 *  - Override de Modo Livre por ficha (item 5).
 *  - Histórico de HP/PE (item 6).
 *  - Modelos de ficha temporária (item 7).
 *  - Travar campos pelo Mestre (item 8).
 */
import { shownPeMax } from '@/lib/peDisplay';
import { useMemo, useState } from 'react';
import { Character, DAMAGE_TYPES, DAMAGE_TYPE_LABELS, DAMAGE_TYPE_ABBR, DamageType, createEmptyRdByType, ActiveCondition } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { tempTemplateCharacterPatch, useTempTemplateStore } from '@/stores/useTempTemplateStore';
import { useLogStore } from '@/stores/useLogStore';
import { Plus, Minus, Heart, Sparkles, Shield, Footprints, NotebookPen, Dice6, Clock, Lock, Unlock, History, Bookmark, BookmarkPlus, Trash2, Swords, Plus as PlusIcon, Zap, X, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DeleteConfirm } from './DeleteConfirm';

interface Props {
  character: Character;
}

// Prefixo usado para diferenciar "quick buffs" de condições normais.
const QB_PREFIX = '__quickbuff__';

// Presets de buffs rápidos que o Mestre pode empurrar com 1 clique.
const QUICK_BUFF_PRESETS: Array<{ label: string; icon: string; turns: number }> = [
  { label: '+1 Dano', icon: '⚔️', turns: 3 },
  { label: '+2 Dano', icon: '⚔️', turns: 3 },
  { label: '+1 CA', icon: '🛡️', turns: 3 },
  { label: '+2 CA', icon: '🛡️', turns: 3 },
  { label: 'Vantagem FOR', icon: '💪', turns: 1 },
  { label: 'Vantagem DES', icon: '🐾', turns: 1 },
  { label: 'Vantagem CON', icon: '🫀', turns: 1 },
  { label: 'Concentrado', icon: '🧠', turns: 3 },
  { label: 'Inspirado', icon: '✨', turns: 3 },
  { label: 'Marcado', icon: '🎯', turns: 3 },
];

function NumStep({ value, onChange, min, max, className, step = 1, disabled }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}) {
  const clamp = (n: number) => {
    let r = n;
    if (typeof min === 'number') r = Math.max(min, r);
    if (typeof max === 'number') r = Math.min(max, r);
    return r;
  };
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(clamp(value - step))}
        className="h-7 w-7 rounded-md border border-border bg-secondary/40 hover:bg-secondary/70 text-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <Input
        type="number"
        disabled={disabled}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || 0))}
        className="h-7 w-16 text-center font-mono tabular-nums"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(clamp(value + step))}
        className="h-7 w-7 rounded-md border border-border bg-secondary/40 hover:bg-secondary/70 text-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function LockToggle({ locked, canEdit, onToggle }: { locked: boolean; canEdit: boolean; onToggle: () => void }) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={locked ? 'Destravar (player poderá editar)' : 'Travar (só Mestre edita)'}
      className={cn(
        'h-6 w-6 rounded-md flex items-center justify-center border transition',
        locked ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' : 'bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/60',
      )}
    >
      {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
    </button>
  );
}

export function TemporaryCharacterCard({ character: c }: Props) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const removeCharacter = useCharacterStore((s) => s.removeCharacter);
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const addLog = useLogStore((s) => s.addLog);
  const tempTemplates = useTempTemplateStore((s) => s.templates);
  const addTemplate = useTempTemplateStore((s) => s.addFromCharacter);
  const removeTemplate = useTempTemplateStore((s) => s.remove);

  const rdByType = c.rdByType ?? createEmptyRdByType();
  const locks = c.lockedFields ?? {};
  const canEditHp = isMaster || !locks.hp;
  const canEditPe = isMaster || !locks.pe;
  const canEditRd = isMaster || !locks.rd;

  // ─── State local: atalhos de dano/cura ─────────────────────────────────
  const [dmgAmount, setDmgAmount] = useState<number>(0);
  const [dmgType, setDmgType] = useState<DamageType | ''>('');
  const [dmgKind, setDmgKind] = useState<'dano' | 'cura' | 'pe-gasto' | 'pe-recup'>('dano');
  const [reason, setReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [newTplLabel, setNewTplLabel] = useState('');

  const setField = <K extends keyof Character>(k: K, v: Character[K]) =>
    updateCharacter(c.id, { [k]: v } as Partial<Character>);

  const setRd = (type: DamageType, v: number) =>
    updateCharacter(c.id, {
      rdByType: { ...createEmptyRdByType(), ...rdByType, [type]: Math.max(0, v) },
    } as Partial<Character>);

  const setAttrValue = (name: string, v: number) => {
    const next = c.attributes.map((a) => (a.name === name ? { ...a, value: v } : a));
    updateCharacter(c.id, { attributes: next });
  };
  const setSkillBonus = (id: string, v: number) => {
    const next = c.skills.map((s) => (s.id === id ? { ...s, externalBonus: v } : s));
    updateCharacter(c.id, { skills: next });
  };
  const setSaveValue = (id: string, v: number) => {
    const next = (c.savingThrows ?? []).map((s) => (s.id === id ? { ...s, value: v } : s));
    updateCharacter(c.id, { savingThrows: next });
  };

  const toggleLock = (k: 'hp' | 'pe' | 'rd') => {
    const next = { ...locks, [k]: !locks[k] };
    updateCharacter(c.id, { lockedFields: next } as Partial<Character>);
  };

  // ─── Histórico ────────────────────────────────────────────────────────
  const pushHistory = (resource: 'HP' | 'PE', delta: number, why?: string) => {
    const hist = (c.resourceHistory ?? []).slice(-29);
    hist.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      resource,
      delta,
      reason: why,
      by: isMaster ? 'MASTER' : 'PLAYER',
    });
    updateCharacter(c.id, { resourceHistory: hist } as Partial<Character>);
  };

  // ─── Atalhos de dano/cura/PE ──────────────────────────────────────────
  const applyShortcut = () => {
    const amt = Math.max(0, Math.floor(dmgAmount || 0));
    if (amt <= 0) return;

    if (dmgKind === 'cura') {
      const next = Math.min(c.hpMax, c.hpCurrent + amt);
      const real = next - c.hpCurrent;
      updateCharacter(c.id, { hpCurrent: next });
      pushHistory('HP', +real, reason || 'cura');
      addLog('combat', `💚 ${c.name} curou ${real} HP${reason ? ` (${reason})` : ''}.`);
    } else if (dmgKind === 'pe-recup') {
      const next = Math.min(c.peMax, c.peCurrent + amt);
      const real = next - c.peCurrent;
      updateCharacter(c.id, { peCurrent: next });
      pushHistory('PE', +real, reason || 'recuperação');
      addLog('combat', `✨ ${c.name} recuperou ${real} PE${reason ? ` (${reason})` : ''}.`);
    } else if (dmgKind === 'pe-gasto') {
      const next = Math.max(0, c.peCurrent - amt);
      const real = c.peCurrent - next;
      updateCharacter(c.id, { peCurrent: next });
      pushHistory('PE', -real, reason || 'gasto');
      addLog('combat', `🔻 ${c.name} gastou ${real} PE${reason ? ` (${reason})` : ''}.`);
    } else {
      // Dano: aplica RD geral + RD por tipo, soma.
      const rdGeral = c.rd ?? 0;
      const rdTipo = dmgType ? (rdByType[dmgType] ?? 0) : 0;
      const reduzido = Math.max(0, amt - rdGeral - rdTipo);
      const next = Math.max(0, c.hpCurrent - reduzido);
      const real = c.hpCurrent - next;
      updateCharacter(c.id, { hpCurrent: next });
      const tipoTxt = dmgType ? ` ${DAMAGE_TYPE_LABELS[dmgType]}` : '';
      const breakdown = (rdGeral + rdTipo) > 0
        ? ` (${amt} − ${rdGeral + rdTipo} RD = ${reduzido})`
        : '';
      pushHistory('HP', -real, reason || `dano${tipoTxt}`);
      addLog('combat', `💥 ${c.name} sofreu ${real} de dano${tipoTxt}${breakdown}${reason ? ` — ${reason}` : ''}.`);
    }
    setDmgAmount(0);
    setReason('');
  };

  // ─── Quick Buffs (chips) ──────────────────────────────────────────────
  const activeBuffs: ActiveCondition[] = (c.activeConditions ?? []).filter((cd) =>
    (cd.conditionId ?? '').startsWith(QB_PREFIX),
  );

  const pushQuickBuff = (label: string, icon: string, turns: number) => {
    const buff: ActiveCondition = {
      id: crypto.randomUUID(),
      conditionId: `${QB_PREFIX}${label.toLowerCase().replace(/\s+/g, '_')}`,
      name: label,
      icon,
      remainingTurns: turns,
      remainingRounds: 0,
      sourceCharName: isMaster ? 'Mestre' : c.name,
      durationMode: 'ate_acabar',
    } as any;
    const next = [...(c.activeConditions ?? []), buff];
    updateCharacter(c.id, { activeConditions: next });
    addLog('combat', `✨ ${c.name} recebeu buff "${icon} ${label}" (${turns} turno${turns === 1 ? '' : 's'}).`);
  };

  const removeQuickBuff = (id: string) => {
    const next = (c.activeConditions ?? []).filter((cd) => cd.id !== id);
    updateCharacter(c.id, { activeConditions: next });
  };

  // ─── Modelos / Templates ──────────────────────────────────────────────
  const saveAsTemplate = () => {
    const id = addTemplate(newTplLabel.trim() || c.name, c);
    if (id) {
      addLog('system', `📑 Modelo de ficha temporária salvo: ${newTplLabel.trim() || c.name}`);
      setNewTplLabel('');
    }
  };
  const applyTemplate = (tplId: string) => {
    const tpl = tempTemplates.find((t) => t.id === tplId);
    if (!tpl) return;
    updateCharacter(c.id, tempTemplateCharacterPatch(c, tpl));
    addLog('system', `📑 Modelo "${tpl.label}" aplicado em ${c.name}.`);
  };

  const activeRdTypes = useMemo(
    () => DAMAGE_TYPES.filter((t) => (rdByType[t] ?? 0) > 0),
    [rdByType],
  );

  const ffOv = c.freeformOverride;

  return (
    <div className="card-enigmatic rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex-wrap">
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider border-amber-500/60 text-amber-300 bg-amber-500/10">
          <Clock className="h-3 w-3 mr-1" /> Temporária
        </Badge>
        {ffOv && (
          <Badge variant="outline" className={cn(
            'font-mono text-[10px] uppercase tracking-wider',
            ffOv === 'on' ? 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10' : 'border-rose-500/60 text-rose-300 bg-rose-500/10',
          )}>
            {ffOv === 'on' ? 'Livre: ON' : 'Livre: OFF'}
          </Badge>
        )}
        <Input
          value={c.name}
          onChange={(e) => setField('name', e.target.value)}
          className="h-8 text-base font-bold flex-1 min-w-[140px] bg-transparent border-transparent hover:border-border focus-visible:border-primary"
          style={{ fontFamily: "'Cinzel', serif" }}
        />
        {isMaster && (
          <>
            {/* Item 5 — Modo livre por ficha */}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-[10px] uppercase tracking-wider" title="Modo Livre por ficha">
                  <Zap className="h-3 w-3 mr-1" /> Modo
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pb-1">Override Modo Livre</div>
                {(['auto', 'on', 'off'] as const).map((opt) => (
                  <Button
                    key={opt}
                    size="sm"
                    variant={ (opt === 'auto' ? !ffOv : ffOv === opt) ? 'default' : 'outline'}
                    className="w-full justify-start text-xs"
                    onClick={() => updateCharacter(c.id, { freeformOverride: opt === 'auto' ? undefined : opt } as Partial<Character>)}
                  >
                    {opt === 'auto' ? 'Seguir global' : opt === 'on' ? 'Forçar Livre (ON)' : 'Forçar Normal (OFF)'}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
            {/* Item 7 — Modelos */}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-[10px] uppercase tracking-wider" title="Modelos de ficha temporária">
                  <Bookmark className="h-3 w-3 mr-1" /> Modelos
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Salvar atual como modelo</div>
                <div className="flex gap-1">
                  <Input value={newTplLabel} onChange={(e) => setNewTplLabel(e.target.value)} placeholder={`Ex: ${c.name} v1`} className="h-7 text-xs" />
                  <Button size="sm" onClick={saveAsTemplate} className="h-7 px-2"><BookmarkPlus className="h-3 w-3" /></Button>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2">Aplicar modelo</div>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {tempTemplates.length === 0 && <div className="text-xs text-muted-foreground italic px-1">Nenhum modelo salvo.</div>}
                  {tempTemplates.map((t) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="flex-1 h-7 justify-start text-xs" onClick={() => applyTemplate(t.id)}>
                        {t.label}
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{t.data.hpMax}/{t.data.peMax}</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-400" onClick={() => removeTemplate(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <DeleteConfirm
              label={`Excluir ${c.name}`}
              onConfirm={() => removeCharacter(c.id)}
            />
          </>
        )}
      </div>

      {/* Quick Buffs Bar (item 4) */}
      <div className="px-4 py-2 border-b border-border bg-secondary/5 flex items-center gap-2 flex-wrap">
        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Buffs ativos</span>
        {activeBuffs.length === 0 && <span className="text-[10px] text-muted-foreground italic">nenhum</span>}
        {activeBuffs.map((b) => (
          <span
            key={b.id}
            className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/40 px-2 py-0.5 text-[11px]"
            title={`${b.name} — ${b.remainingTurns === -1 ? '∞' : b.remainingTurns} turno(s)`}
          >
            <span>{b.icon}</span>
            <span className="font-medium">{b.name}</span>
            <span className="font-mono text-muted-foreground">{b.remainingTurns === -1 ? '∞' : `${b.remainingTurns}t`}</span>
            {(isMaster || b.sourceCharName === c.name) && (
              <button
                type="button"
                onClick={() => removeQuickBuff(b.id)}
                className="ml-0.5 h-3.5 w-3.5 rounded-full hover:bg-rose-500/30 flex items-center justify-center"
                title="Remover"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        {isMaster && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] ml-auto">
                <PlusIcon className="h-3 w-3 mr-1" /> Empurrar buff
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">Presets</div>
              <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto">
                {QUICK_BUFF_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    size="sm"
                    variant="outline"
                    className="h-7 justify-start text-xs"
                    onClick={() => pushQuickBuff(p.label, p.icon, p.turns)}
                  >
                    <span className="mr-1">{p.icon}</span>{p.label}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{p.turns}t</span>
                  </Button>
                ))}
              </div>
              <CustomBuffForm onAdd={pushQuickBuff} />
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HP / PE / Movimento */}
        <section className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-rose-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vida</span>
              <span className="ml-auto font-mono text-sm tabular-nums">
                <span className="text-rose-300">{c.hpCurrent}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-foreground">{c.hpMax}</span>
              </span>
              <LockToggle locked={!!locks.hp} canEdit={isMaster} onToggle={() => toggleLock('hp')} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground w-10">Atual</span>
              <NumStep disabled={!canEditHp} value={c.hpCurrent} onChange={(v) => { setField('hpCurrent', v); pushHistory('HP', v - c.hpCurrent, 'ajuste manual'); }} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase text-muted-foreground w-10">Máx</span>
              <NumStep disabled={!canEditHp} value={c.hpMax} onChange={(v) => setField('hpMax', Math.max(0, v))} min={0} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">PE</span>
              <span className="ml-auto font-mono text-sm tabular-nums">
                <span className="text-sky-300">{c.peCurrent}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-foreground">{shownPeMax(c)}</span>
              </span>
              <LockToggle locked={!!locks.pe} canEdit={isMaster} onToggle={() => toggleLock('pe')} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground w-10">Atual</span>
              <NumStep disabled={!canEditPe} value={c.peCurrent} onChange={(v) => { setField('peCurrent', v); pushHistory('PE', v - c.peCurrent, 'ajuste manual'); }} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase text-muted-foreground w-10">Máx</span>
              <NumStep disabled={!canEditPe} value={c.peMax} onChange={(v) => setField('peMax', Math.max(0, v))} min={0} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Footprints className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deslocamento</span>
              <span className="ml-auto text-[10px] text-muted-foreground">m / turno</span>
            </div>
            <NumStep value={c.movement} onChange={(v) => setField('movement', Math.max(0, v))} min={0} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-secondary/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-sky-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CA</span>
              </div>
              <NumStep value={c.ca ?? 10} onChange={(v) => setField('ca', Math.max(0, v))} min={0} />
            </div>
            <div className="rounded-xl border border-border bg-secondary/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Crosshair className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CD</span>
              </div>
              <NumStep value={c.baseDC ?? 10} onChange={(v) => setField('baseDC', Math.max(0, v))} min={0} />
            </div>
          </div>
        </section>

        {/* RDs + Atalhos de dano */}
        <section className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RD Geral</span>
              <span className="ml-auto text-[10px] text-muted-foreground">aplica a todo dano</span>
              <LockToggle locked={!!locks.rd} canEdit={isMaster} onToggle={() => toggleLock('rd')} />
            </div>
            <NumStep disabled={!canEditRd} value={c.rd ?? 0} onChange={(v) => setField('rd', Math.max(0, v))} min={0} />
          </div>

          <div className="rounded-xl border border-border bg-secondary/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RD por Tipo</span>
              {activeRdTypes.length > 0 && (
                <span className="ml-auto text-[10px] font-mono text-violet-300">{activeRdTypes.length} ativas</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {DAMAGE_TYPES.map((t) => {
                const v = rdByType[t] ?? 0;
                return (
                  <label key={t} className={cn('flex flex-col items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5', v > 0 && 'border-violet-500/60 bg-violet-500/10')} title={`${DAMAGE_TYPE_LABELS[t]} (${DAMAGE_TYPE_ABBR[t]})`}>
                    <span className="text-xs font-medium leading-tight text-center text-muted-foreground truncate w-full">{DAMAGE_TYPE_LABELS[t]}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 -mt-0.5">{DAMAGE_TYPE_ABBR[t]}</span>
                    <Input
                      type="number"
                      disabled={!canEditRd}
                      value={v}
                      onChange={(e) => setRd(t, parseInt(e.target.value, 10) || 0)}
                      className="h-7 w-full text-center text-sm font-mono tabular-nums p-0"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Item 3 — Atalho de dano/cura */}
          <div className="rounded-xl border border-border bg-secondary/10 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-rose-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aplicar</span>
              <span className="ml-auto text-[10px] text-muted-foreground">RD calculada</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(['dano', 'cura', 'pe-gasto', 'pe-recup'] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={dmgKind === k ? 'default' : 'outline'}
                  className="h-7 text-[11px]"
                  onClick={() => setDmgKind(k)}
                >
                  {k === 'dano' ? '💥 Dano' : k === 'cura' ? '💚 Cura' : k === 'pe-gasto' ? '🔻 PE−' : '✨ PE+'}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <NumStep value={dmgAmount} onChange={setDmgAmount} min={0} />
              {dmgKind === 'dano' && (
                <select
                  value={dmgType}
                  onChange={(e) => setDmgType(e.target.value as DamageType | '')}
                  className="h-7 flex-1 rounded-md border border-border bg-background/60 px-2 text-xs"
                >
                  <option value="">Tipo (geral)</option>
                  {DAMAGE_TYPES.map((t) => (
                    <option key={t} value={t}>{DAMAGE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              )}
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className="h-7 text-xs"
            />
            <Button size="sm" onClick={applyShortcut} className="w-full h-7 text-xs" disabled={dmgAmount <= 0}>
              Aplicar
            </Button>
          </div>
        </section>
      </div>

      {/* Atributos / TRs / Perícias */}
      <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <section className="rounded-xl border border-border bg-secondary/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Dice6 className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Atributos</span>
          </div>
          <div className="space-y-1">
            {c.attributes.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{a.name}</span>
                <Input
                  type="number"
                  value={a.value ?? 10}
                  onChange={(e) => setAttrValue(a.name, parseInt(e.target.value, 10) || 0)}
                  className="h-7 w-16 text-center font-mono tabular-nums"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-secondary/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Dice6 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TRs</span>
            <span className="ml-auto text-[10px] text-muted-foreground">bônus base</span>
          </div>
          <div className="space-y-1">
            {(c.savingThrows ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{s.name}</span>
                <Input
                  type="number"
                  value={s.value ?? 0}
                  onChange={(e) => setSaveValue(s.id, parseInt(e.target.value, 10) || 0)}
                  className="h-7 w-16 text-center font-mono tabular-nums"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-secondary/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Dice6 className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Perícias</span>
            <span className="ml-auto text-[10px] text-muted-foreground">bônus extra</span>
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {c.skills.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{s.name}</span>
                <Input
                  type="number"
                  value={(s as any).externalBonus ?? 0}
                  onChange={(e) => setSkillBonus(s.id, parseInt(e.target.value, 10) || 0)}
                  className="h-7 w-16 text-center font-mono tabular-nums"
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Histórico de HP/PE (item 6) */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-border bg-secondary/10">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/30 transition"
          >
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Histórico HP/PE</span>
            <Badge variant="outline" className="font-mono text-[10px] ml-1">{(c.resourceHistory ?? []).length}</Badge>
            <span className="ml-auto text-[10px] text-muted-foreground">{showHistory ? 'ocultar' : 'mostrar'}</span>
          </button>
          {showHistory && (
            <div className="px-3 pb-3 space-y-1 max-h-44 overflow-y-auto">
              {(c.resourceHistory ?? []).length === 0 && (
                <div className="text-[11px] text-muted-foreground italic px-1">Nenhuma alteração registrada.</div>
              )}
              {(c.resourceHistory ?? []).slice().reverse().map((h) => {
                const d = new Date(h.at);
                const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                const sign = h.delta > 0 ? '+' : '';
                const color = h.delta < 0 ? 'text-rose-300' : 'text-emerald-300';
                return (
                  <div key={h.id} className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-muted-foreground w-10">{time}</span>
                    <span className={cn('w-14 tabular-nums font-bold', color)}>{sign}{h.delta} {h.resource}</span>
                    <span className="text-muted-foreground truncate flex-1">{h.reason ?? '—'}</span>
                    <span className="text-[10px] text-muted-foreground">{h.by === 'MASTER' ? 'Mestre' : 'Player'}</span>
                  </div>
                );
              })}
              {(c.resourceHistory ?? []).length > 0 && isMaster && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] w-full"
                  onClick={() => updateCharacter(c.id, { resourceHistory: [] } as Partial<Character>)}
                >
                  Limpar histórico
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Anotações */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-border bg-secondary/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <NotebookPen className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Anotações</span>
          </div>
          <Textarea
            value={c.notes ?? ''}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Buffs, condições, instruções do Mestre, equipamento improvisado…"
            className="min-h-[80px] text-sm bg-background/40"
          />
        </div>
      </div>
    </div>
  );
}

function CustomBuffForm({ onAdd }: { onAdd: (label: string, icon: string, turns: number) => void }) {
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('✨');
  const [turns, setTurns] = useState(3);
  return (
    <div className="border-t border-border/60 pt-2 mt-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Buff customizado</div>
      <div className="flex gap-1">
        <Input value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 2) || '✨')} className="h-7 w-12 text-center text-sm" />
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome do buff" className="h-7 flex-1 text-xs" />
        <Input type="number" value={turns} onChange={(e) => setTurns(parseInt(e.target.value, 10) || 1)} min={1} max={99} className="h-7 w-14 text-center font-mono text-xs" />
        <Button
          size="sm"
          className="h-7 px-2"
          disabled={!label.trim()}
          onClick={() => { onAdd(label.trim(), icon, Math.max(1, turns)); setLabel(''); }}
        >
          <PlusIcon className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
