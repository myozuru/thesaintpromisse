import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { playClickSound, playSuccessSound } from '@/lib/sounds';
import type { SpecAbility, SpecAbilityChoiceValue } from '@/lib/specAbilities';
import { cn } from '@/lib/utils';

interface Props {
  charId: string;
  ability: SpecAbility;
  /** Valor já gravado (caso o jogador esteja só revendo / trocando). */
  current?: SpecAbilityChoiceValue;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal genérico de "escolha permanente" para Habilidades de Especialização
 * que possuem `choiceSchema`. Despacha por `kind`:
 *
 *  - 'spell-level'  → grade de botões de nível (min..max).
 *  - 'spell'        → (placeholder) catálogo de feitiços conhecidos.
 *  - 'skills'       → (placeholder) seleção de N perícias treinadas.
 *  - 'weapons'      → (placeholder) seleção de N armas.
 *  - 'save'         → 4 botões (Fortitude/Reflexos/Astúcia/Vontade).
 *
 * Cada novo `kind` adiciona um branch aqui. O store apenas recebe o valor.
 */
export function SpecAbilityChoiceDialog({ charId, ability, current, open, onClose }: Props) {
  const setSpecAbilityChoice = useCharacterStore(s => s.setSpecAbilityChoice);
  const schema = ability.choiceSchema;

  // Estado local da seleção em construção.
  const [draft, setDraft] = useState<SpecAbilityChoiceValue | null>(current ?? null);

  // Reset ao abrir.
  useEffect(() => {
    if (open) setDraft(current ?? null);
  }, [open, current]);

  if (!schema) return null;

  const confirm = () => {
    if (!draft) return;
    playSuccessSound();
    setSpecAbilityChoice(charId, ability.id, draft);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ability.name}</DialogTitle>
          <DialogDescription className="italic">{ability.flavor}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-foreground/90">{ability.mechanic}</p>

        <div className="mt-2 rounded-md border border-border bg-card/40 p-3">
          {schema.kind === 'spell-level' && (
            <SpellLevelPicker
              min={schema.min}
              max={schema.max}
              label={schema.label ?? 'Escolha o nível de Feitiço'}
              value={draft?.kind === 'spell-level' ? draft.level : undefined}
              onChange={(level) => setDraft({ kind: 'spell-level', level })}
            />
          )}

          {schema.kind === 'save' && (
            <SavePicker
              label={schema.label ?? 'Escolha o Teste de Resistência'}
              options={schema.options ?? ['Fortitude', 'Reflexos', 'Astúcia', 'Vontade']}
              value={draft?.kind === 'save' ? draft.save : undefined}
              onChange={(save) => setDraft({ kind: 'save', save })}
            />
          )}

          {schema.kind === 'save-skill' && (
            <SavePicker
              label={schema.label ?? 'Escolha o Teste de Resistência'}
              options={schema.options}
              value={draft?.kind === 'save-skill' ? draft.save : undefined}
              onChange={(save) => setDraft({ kind: 'save-skill', save })}
            />
          )}

          {schema.kind === 'spell' && (
            <PlaceholderBox label="Catálogo de Feitiços conhecidos" />
          )}
          {schema.kind === 'skills' && (
            <PlaceholderBox
              label={`Selecionar ${schema.count} perícia(s)${
                schema.onlyTrained || schema.mustBeTrained ? ' já Treinada(s)' : ''
              }`}
            />
          )}
          {schema.kind === 'weapons' && (
            <PlaceholderBox label={`Selecionar ${schema.count} arma(s)`} />
          )}
          {schema.kind === 'spell-or-variation' && (
            <PlaceholderBox
              label={`Selecionar ${schema.spellCount} Feitiço(s) OU ${schema.variationCount} Variação(ões) de liberação`}
            />
          )}
          {schema.kind === 'spell-and-ritual-upgrade' && (
            <PlaceholderBox label="Selecionar 1 Feitiço + 1 Melhoria de Ritual compatível" />
          )}
          {schema.kind === 'single-spell' && (
            <PlaceholderBox label="Selecionar 1 Feitiço conhecido" />
          )}
          {schema.kind === 'single-release' && (
            <PlaceholderBox label="Selecionar 1 Liberação Máxima" />
          )}
          {schema.kind === 'spells' && (
            <PlaceholderBox
              label={`Selecionar ${
                schema.countFormula === 'training_bonus'
                  ? 'N (= Bônus de Treinamento)'
                  : schema.countFormula
              } Feitiço(s)`}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { playClickSound(); onClose(); }}>Cancelar</Button>
          <Button onClick={confirm} disabled={!draft}>Confirmar escolha</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SpellLevelPicker({
  min, max, label, value, onChange,
}: {
  min: number; max: number; label: string;
  value?: number; onChange: (n: number) => void;
}) {
  const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {levels.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => { playClickSound(); onChange(n); }}
            className={cn(
              'rounded-md border-2 px-3 py-3 text-base font-bold transition-colors',
              value === n
                ? 'border-primary bg-primary/30 text-primary'
                : 'border-border bg-background/40 text-foreground hover:border-primary/60 hover:bg-primary/10',
            )}
          >
            Nv {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function SavePicker({
  label, options, value, onChange,
}: {
  label: string;
  options: Array<'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade'>;
  value?: 'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade';
  onChange: (s: 'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade') => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { playClickSound(); onChange(opt); }}
            className={cn(
              'rounded-md border-2 px-3 py-2 text-sm font-bold transition-colors',
              value === opt
                ? 'border-primary bg-primary/30 text-primary'
                : 'border-border bg-background/40 text-foreground hover:border-primary/60 hover:bg-primary/10',
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Placeholder visual reutilizado para os `kind`s de escolha cujo modal
 * específico ainda será construído (catálogo de Feitiços, perícias, armas,
 * variações, melhorias de ritual, liberações). A habilidade fica registrada
 * como adquirida; o motor de combate ignora o efeito até a escolha existir.
 */
function PlaceholderBox({ label }: { label: string }) {
  return (
    <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
      <p className="font-bold uppercase tracking-wider">Configuração pendente</p>
      <p className="text-amber-200/90">{label}</p>
      <p className="text-amber-200/70">
        O modal específico desta escolha ainda será construído. A habilidade fica
        registrada como adquirida e o motor de combate vai ignorá-la até esta
        escolha existir.
      </p>
    </div>
  );
}
