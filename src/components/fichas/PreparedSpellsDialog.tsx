import { useState, useMemo } from 'react';
import { X, BookMarked, Check } from 'lucide-react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playClickSound, playSuccessSound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

interface PreparedSpellsDialogProps {
  character: Character;
  onClose: () => void;
}

/**
 * Painel pós-Descanso Longo da Habilidade "Preparação de Técnicas"
 * (tec-preparacao-de-tecnicas / Memorização Imediata).
 *
 * Exibido enquanto `character.pendingPreparedSpellSlots > 0`. O jogador deve
 * marcar exatamente esse número de feitiços (do próprio personagem) que terão
 * a flag `isPrepared` ativada. No próximo cast, cada um custa metade de PE
 * (arredondado para cima) e a flag é removida.
 *
 * Limites de nível por marco de personagem (briefing):
 *   Nv5  → até Magia Nv2
 *   Nv12 → até Magia Nv3
 *   Nv16 → até Magia Nv4
 *   Nv20 → até Magia Nv5
 */
export function PreparedSpellsDialog({ character: c, onClose }: PreparedSpellsDialogProps) {
  const markPreparedSpells = useCharacterStore((s) => s.markPreparedSpells);
  const addLog = useLogStore((s) => s.addLog);

  const slots = c.pendingPreparedSpellSlots ?? 0;

  // Mapa de níveis de feitiço numerados (Magia Nv1..5) → número.
  const spellLevelOrder: Record<string, number> = useMemo(
    () => ({
      'Magia Nv1': 1,
      'Magia Nv2': 2,
      'Magia Nv3': 3,
      'Magia Nv4': 4,
      'Magia Nv5': 5,
    }),
    [],
  );

  // Cap de nível pelo nível do personagem.
  const maxSpellLevel = useMemo(() => {
    const lv = c.level;
    if (lv >= 20) return 5;
    if (lv >= 16) return 4;
    if (lv >= 12) return 3;
    if (lv >= 5) return 2;
    return 1;
  }, [c.level]);

  const eligibleSpells = useMemo(
    () =>
      c.spells.filter((sp) => {
        const lvNum = spellLevelOrder[sp.spellLevel as string];
        if (lvNum == null) return true; // feitiços sem nível numérico (ex.: cantrips) sempre permitidos
        return lvNum <= maxSpellLevel;
      }),
    [c.spells, maxSpellLevel, spellLevelOrder],
  );

  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    playClickSound();
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= slots) return prev; // não excede o limite
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (selected.length !== slots) return;
    markPreparedSpells(c.id, selected);
    playSuccessSound();
    const names = selected
      .map((id) => c.spells.find((sp) => sp.id === id)?.name ?? '?')
      .join(', ');
    addLog('system', `📖 ${c.name}: Memorização Imediata — feitiços preparados: ${names}.`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl shadow-primary/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <h2
            className="text-lg font-bold text-primary tracking-wide flex items-center gap-2"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <BookMarked className="h-5 w-5" /> Memorização Imediata — {c.name}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-border bg-background/40 p-3 text-sm space-y-1">
            <p className="text-foreground">
              Selecione <span className="font-bold text-primary">{slots}</span> feitiço(s) para marcar
              como preparado(s). No próximo cast de cada um, o custo de PE será reduzido pela metade
              (arredondado para cima) e a marca será consumida.
            </p>
            <p className="text-xs text-muted-foreground">
              Limite por nível de personagem: até Magia Nv{maxSpellLevel}.
            </p>
          </div>

          <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
            {eligibleSpells.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum feitiço elegível para preparar.
              </p>
            ) : (
              eligibleSpells.map((sp) => {
                const isSel = selected.includes(sp.id);
                const disabled = !isSel && selected.length >= slots;
                return (
                  <button
                    key={sp.id}
                    onClick={() => toggle(sp.id)}
                    disabled={disabled}
                    className={cn(
                      'w-full text-left rounded-lg border px-3 py-2 transition-all flex items-center gap-2',
                      isSel
                        ? 'bg-primary/15 border-primary text-foreground shadow-sm shadow-primary/20'
                        : 'bg-background/40 border-border text-muted-foreground hover:bg-background/60 hover:text-foreground',
                      disabled && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <div
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                        isSel ? 'bg-primary border-primary' : 'border-border',
                      )}
                    >
                      {isSel && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{sp.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {sp.spellLevel} · {sp.costPE} PE → após preparar:{' '}
                        <span className="text-foreground font-mono">
                          {Math.ceil(sp.costPE / 2)} PE
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {selected.length}/{slots} selecionado(s)
            </span>
            <button
              onClick={handleConfirm}
              disabled={selected.length !== slots}
              className="ml-auto h-10 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-4 text-sm font-bold text-primary-foreground hover:from-primary/90 hover:to-primary/70 transition-all glow-primary disabled:opacity-40 flex items-center gap-2"
            >
              <Check className="h-4 w-4" /> Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
