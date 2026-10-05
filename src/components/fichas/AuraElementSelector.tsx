/**
 * Fase 10 — Polimento: Seletor persistente de elemento para Aura Elemental e
 * Afinidade Ampliada. Grava em `auraAptitudeUsage[<aptId>:element]` via
 * `setAuraElement` no store. O agregador `aggregateAuraEffects` lê esse valor
 * para aplicar RD/dano elemental ao tipo correto.
 */
import { Flame } from 'lucide-react';
import type { Character, DamageType } from '@/types';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playClickSound } from '@/lib/sounds';

const ELEMENTAL_TYPES: DamageType[] = DAMAGE_TYPES.filter(
  t => t !== 'DCO' && t !== 'DP' && t !== 'DI' && t !== 'DAL' && t !== 'DPS',
);

interface Props {
  character: Character;
}

export function AuraElementSelector({ character: c }: Props) {
  const setAuraElement = useCharacterStore(s => s.setAuraElement);
  const addLog = useLogStore(s => s.addLog);
  const chosen = c.chosenAuraAptitudes ?? [];
  const usage = (c.auraAptitudeUsage ?? {}) as Record<string, unknown>;

  const targets: { id: string; label: string }[] = [];
  if (chosen.includes('aura_elemental')) targets.push({ id: 'aura_elemental', label: 'Aura Elemental' });
  if (chosen.includes('afinidade_ampliada')) targets.push({ id: 'afinidade_ampliada', label: 'Afinidade Ampliada' });

  if (targets.length === 0) return null;

  // Filtra apenas os que ainda NÃO escolheram. Uma vez escolhido, não há volta.
  const pending = targets.filter(t => {
    const current = (usage[`${t.id}:element`] as string | undefined) ?? '';
    return !current;
  });

  if (pending.length === 0) return null;

  const handle = (aptId: string, value: string) => {
    if (!value) return; // ignora seleção vazia — escolha é definitiva
    const elem = value as DamageType;
    setAuraElement(c.id, aptId, elem);
    playClickSound();
    const aptName = targets.find(t => t.id === aptId)?.label ?? aptId;
    addLog(
      'system',
      `${c.name}: elemento de ${aptName} definido como ${DAMAGE_TYPE_LABELS[elem]}. (Escolha definitiva)`,
    );
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
      <div className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-1">
        <Flame className="h-3 w-3" /> Elemento da aura
      </div>
      <div className="space-y-1.5">
        {pending.map(t => (
          <div key={t.id} className="flex items-center gap-2">
            <span className="text-xs text-foreground flex-1">{t.label}</span>
            <select
              defaultValue=""
              onChange={(e) => handle(t.id, e.target.value)}
              className="text-xs bg-secondary/40 border border-border rounded px-1.5 py-1 text-foreground"
            >
              <option value="">— escolher —</option>
              {ELEMENTAL_TYPES.map(et => (
                <option key={et} value={et}>{DAMAGE_TYPE_LABELS[et]} ({et})</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground italic px-1">
        ⚠ A escolha do elemento é definitiva e não pode ser revertida.
      </div>
    </div>
  );
}
