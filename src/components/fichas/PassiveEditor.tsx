import { useState } from 'react';
import { Passive, DAMAGE_TYPES, DAMAGE_TYPE_ABBR, DAMAGE_TYPE_LABELS, type DamageType } from '@/types';
import { SPELL_LEVELS, type SpellLevel } from '@/types/conditions';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface Props {
  initial?: Passive;
  onSubmit: (p: Passive) => void;
  onCancel: () => void;
  submitLabel?: string;
}

/**
 * Editor reutilizável de Passiva. Usado pelo Mestre na contraproposta.
 * Mantém o mesmo conjunto de campos do form do CharacterCard / wizard.
 */
export function PassiveEditor({ initial, onSubmit, onCancel, submitLabel = 'Salvar' }: Props) {
  const [form, setForm] = useState<{ name: string; description: string; spellLevel: SpellLevel; bonusHP: number; bonusPE: number; bonusESC: number; bonusSlots: number; bonusRD: number; bonusCA: number; bonusRdByType: Partial<Record<DamageType, number>> }>(() => ({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    spellLevel: (initial?.spellLevel ?? '1') as SpellLevel,
    bonusHP: initial?.bonusHP ?? 0,
    bonusPE: initial?.bonusPE ?? 0,
    bonusESC: initial?.bonusESC ?? 0,
    bonusSlots: initial?.bonusSlots ?? 0,
    bonusRD: initial?.bonusRD ?? 0,
    bonusCA: initial?.bonusCA ?? 0,
    bonusRdByType: initial?.bonusRdByType ? { ...initial.bonusRdByType } : {},
  }));
  const [showRdPicker, setShowRdPicker] = useState(false);

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const cleanRd: Partial<Record<DamageType, number>> = {};
    DAMAGE_TYPES.forEach((t) => {
      if ((form.bonusRdByType[t] || 0) !== 0) cleanRd[t] = form.bonusRdByType[t];
    });
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      name: form.name,
      description: form.description,
      spellLevel: form.spellLevel,
      bonusHP: form.bonusHP,
      bonusPE: form.bonusPE,
      bonusESC: form.bonusESC,
      bonusSlots: form.bonusSlots,
      bonusRD: form.bonusRD,
      bonusCA: form.bonusCA,
      bonusRdByType: Object.keys(cleanRd).length > 0 ? cleanRd : undefined,
    });
  };

  const bonusFields = [
    { key: 'bonusHP' as const, label: '❤️ HP', color: 'text-hp border-hp/30 focus:border-hp' },
    { key: 'bonusPE' as const, label: '⚡ PE', color: 'text-pe border-pe/30 focus:border-pe' },
    { key: 'bonusESC' as const, label: '🛡 ESC', color: 'text-shield border-shield/30 focus:border-shield' },
    { key: 'bonusCA' as const, label: '🛡 CA', color: 'text-primary border-primary/30 focus:border-primary' },
    { key: 'bonusSlots' as const, label: '📦 Slots', color: 'text-muted-foreground border-border' },
  ];

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-card/80 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Star className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-primary uppercase tracking-wider">Editar Passiva</span>
      </div>
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Nome da passiva"
        className="h-9 w-full rounded-xl border border-primary/30 bg-background/50 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
        autoFocus
      />
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Descrição detalhada do efeito..."
        rows={3}
        className="w-full rounded-xl border border-primary/30 bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-y"
      />
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">🔮 Nível de feitiço</label>
        <select
          value={form.spellLevel}
          onChange={(e) => setForm({ ...form, spellLevel: e.target.value as SpellLevel })}
          className="h-8 w-32 rounded-lg border border-primary/30 bg-background/50 px-2 text-center text-sm font-mono font-bold text-primary focus:border-primary focus:outline-none"
        >
          {SPELL_LEVELS.map((lv) => (
            <option key={lv} value={lv}>{lv}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2 rounded-xl border border-pe/20 bg-pe/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-pe">🔰 RD</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.bonusRD || ''}
              onChange={(e) => {
                const raw = e.target.value;
                setForm({ ...form, bonusRD: raw === '' || raw === '-' ? 0 : parseInt(raw) || 0 });
              }}
              placeholder="0"
              className="h-8 w-20 rounded-lg border border-pe/30 bg-background/60 px-2 text-center text-sm font-mono font-bold text-pe focus:border-pe focus:outline-none"
            />
          </div>
          <button type="button" onClick={() => setShowRdPicker(!showRdPicker)} className="text-xs font-medium text-pe hover:text-pe/80">
            RD por tipo {showRdPicker ? '▲' : '▼'}
          </button>
        </div>
        {showRdPicker && (
          <div className="grid grid-cols-3 gap-1.5">
            {DAMAGE_TYPES.map((t) => (
              <div key={t} className="space-y-0.5">
                <label className="text-xs font-bold text-pe uppercase" title={DAMAGE_TYPE_LABELS[t]}>{DAMAGE_TYPE_ABBR[t]}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.bonusRdByType[t] || ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setForm({
                      ...form,
                      bonusRdByType: {
                        ...form.bonusRdByType,
                        [t]: raw === '' || raw === '-' ? 0 : parseInt(raw) || 0,
                      },
                    });
                  }}
                  placeholder="0"
                  className="h-7 w-full rounded-lg border border-pe/30 bg-background/60 px-1 text-center text-xs font-mono font-bold text-pe focus:border-pe focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {bonusFields.map(({ key, label, color }) => (
          <div key={key} className="space-y-1">
            <label className={cn('text-xs font-medium', color.split(' ')[0])}>{label}</label>
            <input
              type="text"
              inputMode="numeric"
              value={form[key] || ''}
              onChange={(e) => {
                const raw = e.target.value;
                setForm({ ...form, [key]: raw === '' || raw === '-' ? 0 : parseInt(raw) || 0 });
              }}
              className={cn('h-8 w-full rounded-lg border bg-background/50 px-2 text-center text-sm font-mono font-bold focus:outline-none', color)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleSubmit} className="h-9 flex-1 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 shadow-md shadow-primary/20">
          {submitLabel}
        </button>
        <button onClick={onCancel} className="h-9 rounded-xl bg-secondary px-4 text-sm text-secondary-foreground hover:bg-secondary/80">
          Cancelar
        </button>
      </div>
    </div>
  );
}