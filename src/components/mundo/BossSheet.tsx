/**
 * Ficha de Chefe — painel escuro, animado e fluido.
 *
 * Mestre vê tudo e controla o que é revelado; jogadores veem apenas os campos
 * liberados (o resto aparece velado).
 *
 * `BossSheetContent` é reutilizado tanto no diálogo (galeria) quanto no painel
 * lateral do Mapa do Mundo.
 */
import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Eye, EyeOff, Plus, Trash2, Image as ImageIcon, Shield, Heart, Swords, Sparkles, Skull, X, RotateCcw,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS, type DamageType } from '@/types';
import {
  BOSS_ABILITY_LABELS, BOSS_STATES, BOSS_STATE_LABELS, BOSS_TIERS, BOSS_TIER_ACCENT,
  bossHpRatio, canSeeField, type Boss, type BossAbilityKind, type BossRevealField,
} from '@/lib/bosses';
import { useBossStore } from '@/stores/useBossStore';
import { BossPortrait } from './BossPortrait';
import { BossPortraitEditor } from './BossPortraitEditor';

const HIDDEN = '???';

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

interface ContentProps {
  bossId: string;
  isMaster: boolean;
  onClose: () => void;
  /** Painel lateral usa altura total disponível em vez de limite de viewport. */
  inline?: boolean;
}

export function BossSheetContent({ bossId, isMaster, onClose, inline = false }: ContentProps) {
  const boss = useBossStore((s) => s.bosses[bossId]);
  const update = useBossStore((s) => s.update);
  const toggleReveal = useBossStore((s) => s.toggleReveal);
  const addAbility = useBossStore((s) => s.addAbility);
  const updateAbility = useBossStore((s) => s.updateAbility);
  const removeAbility = useBossStore((s) => s.removeAbility);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'geral' | 'combate' | 'habilidades' | 'mestre'>('geral');
  const [editingPortrait, setEditingPortrait] = useState(false);

  const abilities = useMemo(() => {
    if (!boss) return [];
    return isMaster ? boss.habilidades : boss.habilidades.filter((a) => a.revelada);
  }, [boss, isMaster]);

  if (!boss) return null;

  const hp = bossHpRatio(boss);
  const tierAccent = BOSS_TIER_ACCENT[boss.patamar];
  const see = (field: BossRevealField) => canSeeField(boss, field, isMaster);

  const RevealToggle = ({ field }: { field: BossRevealField }) =>
    isMaster ? (
      <button
        type="button"
        onClick={() => toggleReveal(boss.id, field)}
        title={boss.revelado[field] ? 'Visível para jogadores' : 'Oculto dos jogadores'}
        className={cn(
          'ml-1 inline-flex h-5 w-5 items-center justify-center rounded transition-all duration-200 hover:scale-110',
          boss.revelado[field] ? 'text-accent' : 'text-muted-foreground/50',
        )}
      >
        {boss.revelado[field] ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>
    ) : null;

  const pickPortrait = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update(boss.id, {
      retrato: String(reader.result),
      retratoZoom: 1,
      retratoX: 50,
      retratoY: 50,
    });
    reader.readAsDataURL(file);
  };

  const toggleDamage = (list: DamageType[], type: DamageType, key: 'fraquezas' | 'resistencias') => {
    const next = list.includes(type) ? list.filter((t) => t !== type) : [...list, type];
    update(boss.id, { [key]: next } as Partial<Boss>);
  };

  return (
    <div className="flex h-full min-h-0 flex-col text-sm [&_input]:text-sm [&_select]:text-sm [&_textarea]:text-sm">
      {/* Cabeçalho com retrato e barra de vida */}
      <div className="relative shrink-0">
        <div className="absolute inset-0 gradient-mystic opacity-20" aria-hidden />
        <div className="relative flex items-start gap-4 p-5">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            className="relative shrink-0"
          >
            <button
              type="button"
              disabled={!isMaster || !boss.retrato}
              onClick={() => setEditingPortrait(true)}
              title={isMaster && boss.retrato ? 'Ajustar foto' : undefined}
              className={cn(
                'block overflow-hidden rounded-full border-2 border-accent/60 shadow-[0_0_28px_-6px_hsl(var(--primary)/0.9)]',
                inline ? 'h-20 w-20' : 'h-24 w-24',
                isMaster && boss.retrato && 'cursor-move transition-transform hover:scale-105',
              )}
            >
              {boss.retrato && see('retrato') ? (
                <BossPortrait boss={boss} alt={boss.nome} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-secondary/60">
                  <Skull className="h-9 w-9 text-muted-foreground" />
                </div>
              )}
            </button>
            {isMaster && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title="Trocar retrato"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:scale-110 hover:text-foreground"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => pickPortrait(e.target.files?.[0])}
                />
                <div className="absolute -left-1 -top-1">
                  <RevealToggle field="retrato" />
                </div>
              </>
            )}
          </motion.div>

          <div className="min-w-0 flex-1">
            {isMaster ? (
              <>
                <Input
                  value={boss.nome}
                  onChange={(e) => update(boss.id, { nome: e.target.value })}
                  className="h-11 border-transparent bg-transparent px-0 text-2xl font-bold focus-visible:border-border"
                  style={{ fontFamily: "'Cinzel Decorative', serif" }}
                />
                <Input
                  value={boss.titulo ?? ''}
                  onChange={(e) => update(boss.id, { titulo: e.target.value })}
                  placeholder="Epíteto / título"
                  className="h-9 border-transparent bg-transparent px-0 text-sm italic text-muted-foreground focus-visible:border-border"
                />
              </>
            ) : (
              <>
                <h2 className="truncate text-2xl font-bold text-gradient-mystic" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
                  {boss.nome}
                </h2>
                {boss.titulo && <p className="text-sm italic text-muted-foreground">{boss.titulo}</p>}
              </>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded-full border px-2.5 py-1 text-sm font-semibold', tierAccent)}>
                {see('patamar') ? boss.patamar : HIDDEN}
              </span>
              <RevealToggle field="patamar" />
              <span className="rounded-full border border-border/70 bg-secondary/50 px-2.5 py-1 text-sm text-muted-foreground">
                ND {see('nd') ? boss.nd : HIDDEN}
              </span>
              <RevealToggle field="nd" />
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-sm text-primary">
                {see('estado') ? BOSS_STATE_LABELS[boss.estado] : HIDDEN}
              </span>
              <RevealToggle field="estado" />
            </div>

            {/* Barra de vida fluida */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-hp" /> Vitalidade</span>
                <span>
                  {see('pv') ? boss.pv : HIDDEN} / {see('pvMax') ? boss.pvMax : HIDDEN}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
                <motion.div
                  className="h-full rounded-full bg-hp shadow-[0_0_12px_hsl(var(--hp)/0.8)]"
                  initial={false}
                  animate={{ width: `${(see('pv') && see('pvMax') ? hp : 1) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                />
              </div>
        {isMaster && boss.retrato && (
          <div className="relative grid gap-3 border-t border-border/50 px-5 py-3 pr-14">
            <PortraitControl
              label="Tamanho"
              value={boss.retratoZoom ?? 1}
              min={1}
              max={3}
              onChange={(retratoZoom) => update(boss.id, { retratoZoom })}
            />
            <PortraitControl
              label="Horizontal"
              value={boss.retratoX ?? 50}
              min={0}
              max={100}
              onChange={(retratoX) => update(boss.id, { retratoX })}
            />
            <PortraitControl
              label="Vertical"
              value={boss.retratoY ?? 50}
              min={0}
              max={100}
              onChange={(retratoY) => update(boss.id, { retratoY })}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Restaurar enquadramento"
              aria-label="Restaurar enquadramento da foto"
              onClick={() => update(boss.id, { retratoZoom: 1, retratoX: 50, retratoY: 50 })}
              className="absolute right-4 top-3 h-8 w-8"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="ornament-divider h-px w-full" aria-hidden />
      </div>
      {editingPortrait && boss.retrato && (
        <BossPortraitEditor
          boss={boss}
          onCancel={() => setEditingPortrait(false)}
          onApply={(crop) => {
            update(boss.id, crop);
            setEditingPortrait(false);
          }}
        />
      )}

      {/* Abas */}
      <div className="flex shrink-0 gap-1 px-4 pt-3">
        {(() => {
          const tabs: { id: typeof tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
            { id: 'geral', label: 'Geral', Icon: Sparkles },
            { id: 'combate', label: 'Combate', Icon: Shield },
            { id: 'habilidades', label: 'Habilidades', Icon: Swords },
          ];
          if (isMaster) tabs.push({ id: 'mestre', label: 'Mestre', Icon: EyeOff });
          return tabs;
        })().map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
               'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all duration-200',
              tab === id
                ? 'bg-primary/15 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {tab === id && (
              <motion.span layoutId={inline ? 'boss-tab-inline' : 'boss-tab'} className="absolute inset-x-2 -bottom-px h-px bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div className={cn('overflow-y-auto px-5 pb-5 pt-3 scrollbar-thin', inline ? 'min-h-0 flex-1' : 'max-h-[52vh]')}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} {...fade} transition={{ duration: 0.18 }} className="space-y-4">
            {tab === 'geral' && (
              <>
                <Field label="Descrição" reveal={<RevealToggle field="descricao" />}>
                  {isMaster ? (
                    <Textarea
                      value={boss.descricao}
                      onChange={(e) => update(boss.id, { descricao: e.target.value })}
                      placeholder="Aparência, comportamento, lenda…"
                      className="min-h-[90px] text-sm leading-relaxed"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {see('descricao') ? boss.descricao || '—' : HIDDEN}
                    </p>
                  )}
                </Field>

                <div className={cn('grid gap-3', inline ? 'grid-cols-1' : 'sm:grid-cols-3')}>
                  <Field label="Tamanho" reveal={<RevealToggle field="tamanho" />}>
                    {isMaster ? (
                      <Input value={boss.tamanho} onChange={(e) => update(boss.id, { tamanho: e.target.value })} className="h-10 text-sm" />
                    ) : (
                      <p className="text-sm text-muted-foreground">{see('tamanho') ? boss.tamanho || '—' : HIDDEN}</p>
                    )}
                  </Field>
                  <Field label="Tipo" reveal={<RevealToggle field="tipo" />}>
                    {isMaster ? (
                      <Input value={boss.tipo} onChange={(e) => update(boss.id, { tipo: e.target.value })} className="h-10 text-sm" />
                    ) : (
                      <p className="text-sm text-muted-foreground">{see('tipo') ? boss.tipo || '—' : HIDDEN}</p>
                    )}
                  </Field>
                  <Field label="Patamar" reveal={<RevealToggle field="patamar" />}>
                    {isMaster ? (
                      <select
                        value={boss.patamar}
                        onChange={(e) => update(boss.id, { patamar: e.target.value as Boss['patamar'] })}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      >
                        {BOSS_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <p className="text-sm text-muted-foreground">{see('patamar') ? boss.patamar : HIDDEN}</p>
                    )}
                  </Field>
                </div>

                {isMaster ? (
                  <div className={cn('grid gap-3', inline ? 'grid-cols-1' : 'sm:grid-cols-2')}>
                    <Field label="Estado" reveal={<RevealToggle field="estado" />}>
                      <select
                        value={boss.estado}
                        onChange={(e) => update(boss.id, { estado: e.target.value as Boss['estado'] })}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      >
                        {BOSS_STATES.map((s) => <option key={s} value={s}>{BOSS_STATE_LABELS[s]}</option>)}
                      </select>
                    </Field>
                    <Field label="ND" reveal={<RevealToggle field="nd" />}>
                      <Input
                        type="number"
                        value={boss.nd}
                        onChange={(e) => update(boss.id, { nd: Number(e.target.value) || 0 })}
                        className="h-10 text-sm"
                      />
                    </Field>
                  </div>
                ) : (
                  <div className={cn('grid gap-3', inline ? 'grid-cols-1' : 'sm:grid-cols-2')}>
                    <Field label="Estado">
                      <p className="text-sm text-muted-foreground">{see('estado') ? BOSS_STATE_LABELS[boss.estado] : HIDDEN}</p>
                    </Field>
                    <Field label="ND">
                      <p className="text-sm text-muted-foreground">{see('nd') ? boss.nd : HIDDEN}</p>
                    </Field>
                  </div>
                )}
              </>
            )}

            {tab === 'combate' && (
              <>
                <div className={cn('grid gap-3', inline ? 'grid-cols-2' : 'sm:grid-cols-4')}>
                  <Stat label="PV" value={see('pv') ? boss.pv : HIDDEN} editable={isMaster}
                    onChange={(v) => update(boss.id, { pv: v })} reveal={<RevealToggle field="pv" />} />
                  <Stat label="PV máx." value={see('pvMax') ? boss.pvMax : HIDDEN} editable={isMaster}
                    onChange={(v) => update(boss.id, { pvMax: v })} reveal={<RevealToggle field="pvMax" />} />
                  <Stat label="Defesa" value={see('defesa') ? boss.defesa : HIDDEN} editable={isMaster}
                    onChange={(v) => update(boss.id, { defesa: v })} reveal={<RevealToggle field="defesa" />} />
                  <Stat label="RD geral" value={see('rd') ? boss.rdGeral : HIDDEN} editable={isMaster}
                    onChange={(v) => update(boss.id, { rdGeral: v })} reveal={<RevealToggle field="rd" />} />
                </div>

                <Field label="Fraquezas" reveal={<RevealToggle field="fraquezas" />}>
                  <DamagePicker
                    selected={boss.fraquezas}
                    readOnly={!isMaster}
                    hidden={!see('fraquezas')}
                    tone="weak"
                    onToggle={(t) => toggleDamage(boss.fraquezas, t, 'fraquezas')}
                  />
                </Field>

                <Field label="Resistências" reveal={<RevealToggle field="resistencias" />}>
                  <DamagePicker
                    selected={boss.resistencias}
                    readOnly={!isMaster}
                    hidden={!see('resistencias')}
                    tone="strong"
                    onToggle={(t) => toggleDamage(boss.resistencias, t, 'resistencias')}
                  />
                </Field>

                {isMaster && (
                  <Field label="Tática do Mestre">
                    <Textarea
                      value={boss.tatica}
                      onChange={(e) => update(boss.id, { tatica: e.target.value })}
                      placeholder="Como o chefe age em combate…"
                      className="min-h-[70px] text-sm leading-relaxed"
                    />
                  </Field>
                )}
              </>
            )}

            {tab === 'habilidades' && (
              <div className="space-y-2">
                {isMaster && (
                  <Button size="sm" variant="secondary" onClick={() => addAbility(boss.id)} className="h-9 text-sm">
                    <Plus className="mr-1 h-3 w-3" /> Nova habilidade
                  </Button>
                )}
                {abilities.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma habilidade revelada.</p>
                )}
                <AnimatePresence initial={false}>
                  {abilities.map((ab) => (
                    <motion.div
                      key={ab.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-lg border border-border/70 bg-secondary/30 p-3 transition-colors hover:border-accent/50"
                    >
                      <div className="flex items-center gap-2">
                        {isMaster ? (
                          <>
                            <Input
                              value={ab.nome}
                              onChange={(e) => updateAbility(boss.id, ab.id, { nome: e.target.value })}
                              className="h-9 flex-1 text-sm font-semibold"
                            />
                            <select
                              value={ab.kind}
                              onChange={(e) => updateAbility(boss.id, ab.id, { kind: e.target.value as BossAbilityKind })}
                              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                            >
                              {Object.entries(BOSS_ABILITY_LABELS).map(([k, l]) => (
                                <option key={k} value={k}>{l}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => updateAbility(boss.id, ab.id, { revelada: !ab.revelada })}
                              className={cn('rounded p-1 transition-colors', ab.revelada ? 'text-accent' : 'text-muted-foreground/60')}
                              title={ab.revelada ? 'Visível para jogadores' : 'Oculta'}
                            >
                              {ab.revelada ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAbility(boss.id, ab.id)}
                              className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-semibold text-foreground">{ab.nome}</span>
                            <span className="rounded-full border border-border/70 px-2.5 py-1 text-sm text-muted-foreground">
                              {BOSS_ABILITY_LABELS[ab.kind]}
                            </span>
                          </>
                        )}
                      </div>
                      {isMaster ? (
                        <Textarea
                          value={ab.texto}
                          onChange={(e) => updateAbility(boss.id, ab.id, { texto: e.target.value })}
                          placeholder="Efeito da habilidade…"
                          className="mt-2 min-h-[72px] text-sm leading-relaxed"
                        />
                      ) : (
                        ab.texto && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{ab.texto}</p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {tab === 'mestre' && isMaster && (
              <>
                <Field label="Notas privadas">
                  <Textarea
                    value={boss.segredos}
                    onChange={(e) => update(boss.id, { segredos: e.target.value })}
                    placeholder="Segredos, gatilhos de fase, fraqueza oculta…"
                    className="min-h-[90px] text-sm leading-relaxed"
                  />
                </Field>
                <Field label="Recompensas">
                  <Textarea
                    value={boss.recompensas}
                    onChange={(e) => update(boss.id, { recompensas: e.target.value })}
                    className="min-h-[70px] text-sm leading-relaxed"
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={boss.visivel}
                    onChange={(e) => update(boss.id, { visivel: e.target.checked })}
                  />
                  Ficha visível para os jogadores
                </label>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function PortraitControl({
  label, value, min, max, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid min-w-0 grid-cols-[6.5rem_1fr] items-center gap-3 text-sm font-semibold uppercase text-muted-foreground">
      <span>{label}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={max === 3 ? 0.05 : 1}
        onValueChange={([next]) => onChange(next ?? value)}
        aria-label={label}
      />
    </label>
  );
}

interface Props {
  bossId: string | null;
  isMaster: boolean;
  onClose: () => void;
}

export function BossSheet({ bossId, isMaster, onClose }: Props) {
  return (
    <Dialog open={!!bossId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-3xl border-border/60 bg-card/95 p-0 backdrop-blur-xl overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {bossId && <BossSheetContent bossId={bossId} isMaster={isMaster} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, reveal, children }: { label: string; reveal?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center text-sm font-semibold uppercase text-muted-foreground">
        {label}
        {reveal}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label, value, editable, onChange, reveal,
}: {
  label: string;
  value: number | string;
  editable: boolean;
  onChange: (v: number) => void;
  reveal?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/30 p-2 text-center transition-transform duration-200 hover:-translate-y-px">
      <div className="flex items-center justify-center text-sm font-semibold uppercase text-muted-foreground">
        {label}
        {reveal}
      </div>
      {editable ? (
        <Input
          type="number"
          value={typeof value === 'number' ? value : 0}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="mt-1 h-9 border-transparent bg-transparent text-center text-base font-bold focus-visible:border-border"
        />
      ) : (
        <div className="mt-1 text-base font-bold text-foreground">{value}</div>
      )}
    </div>
  );
}

function DamagePicker({
  selected, readOnly, hidden, tone, onToggle,
}: {
  selected: DamageType[];
  readOnly: boolean;
  hidden: boolean;
  tone: 'weak' | 'strong';
  onToggle: (t: DamageType) => void;
}) {
  if (hidden) return <p className="text-sm text-muted-foreground">{HIDDEN}</p>;
  const list = readOnly ? selected : DAMAGE_TYPES;
  if (readOnly && selected.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((t) => {
        const on = selected.includes(t);
        return (
          <button
            key={t}
            type="button"
            disabled={readOnly}
            onClick={() => onToggle(t)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-sm transition-all duration-200',
              on && (tone === 'weak'
                ? 'border-hp/60 bg-hp/15 text-hp'
                : 'border-accent/60 bg-accent/15 text-accent'),

              !on && 'border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground',
              !readOnly && 'hover:scale-105',
            )}
          >
            {DAMAGE_TYPE_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}
