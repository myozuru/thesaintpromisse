import { COMBAT_STYLES, getSpecCombatStyles } from '@/lib/combateEstilos';
/**
 * Modal de OPÇÕES de talentos que exigem uma escolha do jogador na compra.
 *
 * Suporta:
 *   - Físico Aperfeiçoado (FAH): 4 opções [A=mov, B=acrob/atletismo, C=empurrar, D=pulo]
 *   - Quebra de Limites (Derivado): 2 atributos diferentes (exclui o de maior cap)
 *   - Estudo Amaldiçoado (Sem Técnica): 2 aptidões diferentes (AU/CL/BAR/DOM/ER)
 *   - Incremento de Atributo: 1 atributo (não repete escolhas anteriores)
 *   - Mestre das Armas: FOR ou DES (+2) + escolha narrativa de armas/grupo crítico
 *   - Mestre Defensivo: FOR ou CON (+2)
 *   - Especialistas (Concussão/Cortes/Perfuração): atributo (+1)
 *   - Resiliência Melhorada: TR (atributo +1, perícia treinada)
 *   - Tempestade de Ideias: atributo +1, perícia treinada, ferramenta
 *   - Mestre da Criação: 2 perícias de Ofício treinadas
 *   - Artesão Amaldiçoado: Ferreiro ou Canalizador
 *   - Aptidão Desenvolvida: 1 Aptidão Amaldiçoada
 *   - Adepto de Combate: 1 Estilo de Combate (narrativo)
 *   - Adepto de Feitiçaria: 1 Mudança de Fundamento (narrativo)
 *
 * Padrão de uso:
 *   const opts = talentNeedsOptions(t.id);
 *   if (opts) abrir <TalentOptionsDialog onConfirm={(choices) => addTalent(..., choices)} />
 *   senão adicionar direto.
 */
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';
import { APTITUDE_KEYS, APTITUDE_LABELS, type AptitudeKey } from '@/types';

export type TalentOptionsKind =
  | 'fisico-aperfeicoado'
  | 'quebra-limites'
  | 'estudo-amaldicoado'
  | 'incremento-atributo'
  | 'mestre-armas'
  | 'mestre-defensivo'
  | 'especialista-concussao'
  | 'especialista-cortes'
  | 'especialista-perfuracao'
  | 'resiliencia-melhorada'
  | 'tempestade-ideias'
  | 'mestre-criacao'
  | 'artesao-amaldicoado'
  | 'aptidao-desenvolvida'
  | 'adepto-combate'
  | 'adepto-feiticaria';

export function talentNeedsOptions(talentId: string): TalentOptionsKind | null {
  if (talentId === 'tal-fisico-aperfeicoado') return 'fisico-aperfeicoado';
  if (talentId === 'tal-quebra-limites') return 'quebra-limites';
  if (talentId === 'tal-estudo-amaldicoado') return 'estudo-amaldicoado';
  if (talentId === 'tal-incremento-atributo') return 'incremento-atributo';
  if (talentId === 'tal-mestre-das-armas') return 'mestre-armas';
  if (talentId === 'tal-mestre-defensivo') return 'mestre-defensivo';
  if (talentId === 'tal-especialista-concussao') return 'especialista-concussao';
  if (talentId === 'tal-especialista-cortes') return 'especialista-cortes';
  if (talentId === 'tal-especialista-perfuracao') return 'especialista-perfuracao';
  if (talentId === 'tal-resiliencia-melhorada') return 'resiliencia-melhorada';
  if (talentId === 'tal-tempestade-ideias') return 'tempestade-ideias';
  if (talentId === 'tal-mestre-criacao') return 'mestre-criacao';
  if (talentId === 'tal-artesao-amaldicoado') return 'artesao-amaldicoado';
  if (talentId === 'tal-aptidao-desenvolvida') return 'aptidao-desenvolvida';
  if (talentId === 'tal-adepto-combate') return 'adepto-combate';
  if (talentId === 'tal-adepto-feiticaria') return 'adepto-feiticaria';
  return null;
}

interface Props {
  character: Character;
  kind: TalentOptionsKind;
  onCancel: () => void;
  /** Choices a serem persistidos em `chosenTalents.choices`. */
  onConfirm: (choices: Record<string, string>) => void;
}

const TITLES: Record<TalentOptionsKind, string> = {
  'fisico-aperfeicoado': 'Físico Aperfeiçoado — escolha 1 efeito',
  'quebra-limites': 'Quebra de Limites — escolha 2 atributos',
  'estudo-amaldicoado': 'Estudo Amaldiçoado — escolha 2 aptidões',
  'incremento-atributo': 'Incremento de Atributo — escolha 1 atributo',
  'mestre-armas': 'Mestre das Armas — escolha atributo e treino',
  'mestre-defensivo': 'Mestre Defensivo — escolha atributo',
  'especialista-concussao': 'Especialista em Concussão — escolha atributo',
  'especialista-cortes': 'Especialista em Cortes — escolha atributo',
  'especialista-perfuracao': 'Especialista em Perfuração — escolha atributo',
  'resiliencia-melhorada': 'Resiliência Melhorada — escolha 1 TR',
  'tempestade-ideias': 'Tempestade de Ideias — atributo, perícia e ferramenta',
  'mestre-criacao': 'Mestre da Criação — escolha 2 ofícios',
  'artesao-amaldicoado': 'Artesão Amaldiçoado — escolha 1 ofício',
  'aptidao-desenvolvida': 'Aptidão Desenvolvida — escolha 1 aptidão',
  'adepto-combate': 'Adepto de Combate — escolha 1 Estilo',
  'adepto-feiticaria': 'Adepto de Feitiçaria — escolha 1 Mudança',
};

export function TalentOptionsDialog({ character: c, kind, onCancel, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-accent/40 bg-card shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 sticky top-0 bg-card z-10">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{TITLES[kind]}</h3>
          <button
            onClick={onCancel}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-destructive/30 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {kind === 'fisico-aperfeicoado' && <FisicoAperfeicoadoForm onConfirm={onConfirm} />}
          {kind === 'quebra-limites' && <QuebraLimitesForm character={c} onConfirm={onConfirm} />}
          {kind === 'estudo-amaldicoado' && <EstudoAmaldicoadoForm onConfirm={onConfirm} />}
          {kind === 'incremento-atributo' && <IncrementoAtributoForm character={c} onConfirm={onConfirm} />}
          {kind === 'mestre-armas' && <MestreArmasForm character={c} onConfirm={onConfirm} />}
          {kind === 'mestre-defensivo' && (
            <SingleAttrForm
              character={c}
              allowed={['Força', 'Constituição']}
              delta={2}
              onConfirm={onConfirm}
            />
          )}
          {kind === 'especialista-concussao' && (
            <SingleAttrForm character={c} allowed={['Força', 'Constituição']} delta={1} onConfirm={onConfirm} />
          )}
          {kind === 'especialista-cortes' && (
            <SingleAttrForm character={c} allowed={['Força', 'Destreza']} delta={1} onConfirm={onConfirm} />
          )}
          {kind === 'especialista-perfuracao' && (
            <SingleAttrForm character={c} allowed={['Força', 'Destreza']} delta={1} onConfirm={onConfirm} />
          )}
          {kind === 'resiliencia-melhorada' && <ResilienciaForm character={c} onConfirm={onConfirm} />}
          {kind === 'tempestade-ideias' && <TempestadeIdeiasForm character={c} onConfirm={onConfirm} />}
          {kind === 'mestre-criacao' && <MestreCriacaoForm character={c} onConfirm={onConfirm} />}
          {kind === 'artesao-amaldicoado' && <ArtesaoForm character={c} onConfirm={onConfirm} />}
          {kind === 'aptidao-desenvolvida' && <AptidaoDesenvolvidaForm character={c} onConfirm={onConfirm} />}
          {kind === 'adepto-combate' && (
            <NarrativeChoiceForm
              field="combatStyle"
              options={COMBAT_STYLES.filter((s) => !getSpecCombatStyles(c).includes(s.id)).map((s) => s.name)}
              note="Mesmos estilos do Especialista em Combate, escalando pelo seu nível."
              onConfirm={onConfirm}
            />
          )}
          {kind === 'adepto-feiticaria' && (
            <NarrativeChoiceForm
              field="fundamento"
              options={[
                'Aprimorar Feitiço',
                'Estender Feitiço',
                'Maximizar Feitiço',
                'Aumentar Alcance',
                'Conjuração Sutil',
                'Conjuração Persistente',
              ]}
              note="A redução de -1 PE (uso/cena) fica registrada na ficha; o Mestre aplica."
              onConfirm={onConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Confirm button (compartilhado)
// ============================================================================
function ConfirmButton({
  enabled,
  label,
  onClick,
}: { enabled: boolean; label?: string; onClick: () => void }) {
  return (
    <button
      disabled={!enabled}
      onClick={() => enabled && onClick()}
      className={cn(
        'w-full rounded-md border px-3 py-1.5 text-xs font-bold transition-colors flex items-center justify-center gap-1',
        enabled
          ? 'border-primary bg-primary/30 text-primary hover:bg-primary/50'
          : 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed',
      )}
    >
      <Check className="h-3 w-3" /> {label ?? 'Confirmar'}
    </button>
  );
}

function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  cols = 3,
  disabledFn,
  titleFn,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  cols?: number;
  disabledFn?: (o: T) => boolean;
  titleFn?: (o: T) => string;
}) {
  return (
    <div className={cn('grid gap-1.5', cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
      {options.map((o) => {
        const disabled = disabledFn?.(o) ?? false;
        const selected = value === o;
        return (
          <button
            key={o}
            disabled={disabled}
            title={titleFn?.(o)}
            onClick={() => onChange(o)}
            className={cn(
              'rounded-md border px-2 py-1 text-xs font-bold transition-colors',
              selected
                ? 'border-primary bg-primary/30 text-primary'
                : disabled
                ? 'border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed'
                : 'border-border bg-background hover:border-accent/60',
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Físico Aperfeiçoado
// ============================================================================
function FisicoAperfeicoadoForm({ onConfirm }: { onConfirm: (c: Record<string, string>) => void }) {
  const [option, setOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [skill, setSkill] = useState<'Acrobacia' | 'Atletismo'>('Acrobacia');

  const opts: Array<{ id: 'A' | 'B' | 'C' | 'D'; label: string; auto: boolean }> = [
    { id: 'A', label: 'Deslocamento +4,5m', auto: true },
    { id: 'B', label: '+2 em Acrobacia ou Atletismo (à escolha)', auto: false },
    { id: 'C', label: 'Empurrar/Desarmar: distância +3m', auto: false },
    { id: 'D', label: 'Distância de pulo +50%', auto: false },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => setOption(o.id)}
            className={cn(
              'w-full text-left rounded-md border px-3 py-2 text-xs transition-colors flex items-start gap-2',
              option === o.id
                ? 'border-primary bg-primary/20 text-foreground'
                : 'border-border bg-background hover:border-accent/60',
            )}
          >
            <span className="font-mono font-bold text-primary">[{o.id}]</span>
            <span className="flex-1">{o.label}</span>
            {o.auto && (
              <span className="rounded bg-accent/30 px-1.5 py-0.5 text-xs font-bold text-accent-foreground">
                ⚙ auto
              </span>
            )}
          </button>
        ))}
      </div>

      {option === 'B' && (
        <div className="rounded-md border border-border bg-secondary/30 p-2 space-y-1.5">
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Qual perícia recebe +2?
          </p>
          <div className="flex gap-1.5">
            {(['Acrobacia', 'Atletismo'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSkill(s)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                  skill === s
                    ? 'border-accent bg-accent/30 text-accent-foreground'
                    : 'border-border bg-background hover:border-accent/40',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs italic text-muted-foreground">
        Apenas a opção <strong>[A]</strong> é automatizada (movimento). As outras ficam
        registradas como nota narrativa para o Mestre aplicar manualmente.
      </p>

      <ConfirmButton
        enabled={!!option}
        onClick={() => {
          const choices: Record<string, string> = { fisicoOption: option! };
          if (option === 'B') choices.fisicoSkill = skill;
          onConfirm(choices);
        }}
      />
    </div>
  );
}

// ============================================================================
// Quebra de Limites
// ============================================================================
function QuebraLimitesForm({
  character: c,
  onConfirm,
}: {
  character: Character;
  onConfirm: (c: Record<string, string>) => void;
}) {
  const attrs = c.attributes ?? [];
  const maxCap = attrs.reduce((m, a) => Math.max(m, (a as any).cap ?? (a as any).max ?? 0), 0);
  const excluded = new Set(
    attrs
      .filter((a) => ((a as any).cap ?? (a as any).max ?? 0) === maxCap && maxCap > 0)
      .map((a) => a.name),
  );

  const [a1, setA1] = useState<string | null>(null);
  const [a2, setA2] = useState<string | null>(null);
  const valid = a1 && a2 && a1 !== a2;

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground">
        Escolha <strong>2 atributos diferentes</strong> para receber <strong>+2 valor e +2 limite máximo</strong>.
      </p>
      {excluded.size > 0 && maxCap > 0 && (
        <p className="text-xs italic text-muted-foreground">
          Excluído (maior limite atual): {[...excluded].join(', ')}
        </p>
      )}

      {[1, 2].map((slot) => (
        <div key={slot} className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Atributo #{slot}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {attrs.map((a) => {
              const isExcluded = excluded.has(a.name);
              const isSelected = (slot === 1 ? a1 : a2) === a.name;
              const isOther = (slot === 1 ? a2 : a1) === a.name;
              const disabled = isExcluded || isOther;
              return (
                <button
                  key={a.name}
                  disabled={disabled}
                  onClick={() => (slot === 1 ? setA1(a.name) : setA2(a.name))}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/30 text-primary'
                      : disabled
                      ? 'border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed'
                      : 'border-border bg-background hover:border-accent/60',
                  )}
                  title={
                    isExcluded
                      ? 'Bloqueado: atributo de maior limite'
                      : isOther
                      ? 'Já escolhido no outro slot'
                      : ''
                  }
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <ConfirmButton enabled={!!valid} onClick={() => onConfirm({ attr: a1!, attr2: a2! })} />
    </div>
  );
}

// ============================================================================
// Estudo Amaldiçoado
// ============================================================================
function EstudoAmaldicoadoForm({ onConfirm }: { onConfirm: (c: Record<string, string>) => void }) {
  const [a1, setA1] = useState<AptitudeKey | null>(null);
  const [a2, setA2] = useState<AptitudeKey | null>(null);
  const valid = a1 && a2 && a1 !== a2;

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground">
        Escolha <strong>2 Aptidões Amaldiçoadas diferentes</strong> para receber <strong>+1 nível</strong> em cada.
      </p>

      {[1, 2].map((slot) => (
        <div key={slot} className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Aptidão #{slot}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {APTITUDE_KEYS.map((k) => {
              const isSelected = (slot === 1 ? a1 : a2) === k;
              const isOther = (slot === 1 ? a2 : a1) === k;
              return (
                <button
                  key={k}
                  disabled={isOther}
                  onClick={() => (slot === 1 ? setA1(k) : setA2(k))}
                  title={APTITUDE_LABELS[k].full}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs font-mono font-bold transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/30 text-primary'
                      : isOther
                      ? 'border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed'
                      : 'border-border bg-background hover:border-accent/60',
                  )}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <ConfirmButton
        enabled={!!valid}
        label="Confirmar (+1 / +1)"
        onClick={() => onConfirm({ aptitudes: `${a1},${a2}` })}
      />
    </div>
  );
}

// ============================================================================
// Incremento de Atributo
// ============================================================================
function IncrementoAtributoForm({
  character: c,
  onConfirm,
}: {
  character: Character;
  onConfirm: (c: Record<string, string>) => void;
}) {
  const attrs = c.attributes ?? [];
  const alreadyTaken = new Set<string>(
    (c.chosenTalents ?? [])
      .filter((t) => t.id === 'tal-incremento-atributo' && t.choices?.attr)
      .map((t) => t.choices!.attr as string),
  );
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground">
        Escolha <strong>1 atributo</strong> para receber <strong>+2 valor</strong> e <strong>+2 no Limite Máximo</strong>.
      </p>
      {alreadyTaken.size > 0 && (
        <p className="text-xs italic text-muted-foreground">
          Já incrementado(s): {[...alreadyTaken].join(', ')} — não pode repetir.
        </p>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {attrs.map((a) => {
          const isTaken = alreadyTaken.has(a.name);
          const isSelected = picked === a.name;
          const cap = c.attrCaps?.[a.name] ?? 20;
          const atCap = a.value >= cap;
          const disabled = isTaken || atCap;
          return (
            <button
              key={a.name}
              disabled={disabled}
              onClick={() => setPicked(a.name)}
              title={
                isTaken
                  ? 'Já escolhido em uma compra anterior'
                  : atCap
                  ? `No limite máximo (${cap})`
                  : `${a.value} → ${a.value + 2} (cap ${cap} → ${cap + 2})`
              }
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                isSelected
                  ? 'border-primary bg-primary/30 text-primary'
                  : disabled
                  ? 'border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed'
                  : 'border-border bg-background hover:border-accent/60',
              )}
            >
              {a.name}
              <span className="ml-1 text-xs font-mono opacity-70">{a.value}</span>
            </button>
          );
        })}
      </div>

      <ConfirmButton
        enabled={!!picked}
        label="Confirmar (+2 valor / +2 cap)"
        onClick={() => onConfirm({ attr: picked! })}
      />
    </div>
  );
}

// ============================================================================
// Single attribute form (genérico — Mestre Defensivo, Especialistas)
// ============================================================================
function SingleAttrForm({
  character: c,
  allowed,
  delta,
  onConfirm,
}: {
  character: Character;
  allowed: string[];
  delta: number;
  onConfirm: (c: Record<string, string>) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const attrs = (c.attributes ?? []).filter((a) => allowed.includes(a.name));

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground">
        Escolha <strong>1 atributo</strong> para receber <strong>+{delta}</strong>.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {attrs.map((a) => {
          const cap = c.attrCaps?.[a.name] ?? 20;
          const atCap = a.value + delta > cap;
          const isSelected = picked === a.name;
          return (
            <button
              key={a.name}
              disabled={atCap}
              onClick={() => setPicked(a.name)}
              title={atCap ? `Excede o limite (${cap})` : `${a.value} → ${a.value + delta}`}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-bold transition-colors',
                isSelected
                  ? 'border-primary bg-primary/30 text-primary'
                  : atCap
                  ? 'border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed'
                  : 'border-border bg-background hover:border-accent/60',
              )}
            >
              {a.name}
              <span className="ml-1 text-xs font-mono opacity-70">{a.value}</span>
            </button>
          );
        })}
      </div>
      <ConfirmButton enabled={!!picked} onClick={() => onConfirm({ attr: picked! })} />
    </div>
  );
}

// ============================================================================
// Mestre das Armas
// ============================================================================
function MestreArmasForm({
  character: c,
  onConfirm,
}: {
  character: Character;
  onConfirm: (c: Record<string, string>) => void;
}) {
  const [attr, setAttr] = useState<'Força' | 'Destreza' | null>(null);
  const [path, setPath] = useState<'trained4' | 'criticalGroup' | null>(null);
  const [detail, setDetail] = useState<string>('');
  const valid = attr && path && (path === 'trained4' ? detail.trim().length > 0 : detail.trim().length > 0);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
          1) Atributo (+2)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['Força', 'Destreza'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAttr(a)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-bold transition-colors',
                attr === a ? 'border-primary bg-primary/30 text-primary' : 'border-border bg-background hover:border-accent/60',
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">2) Treino</p>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { id: 'trained4', label: 'Treinado em 4 Armas (anote-as abaixo)' },
            { id: 'criticalGroup', label: 'Efeito de Crítico de 1 Grupo de Arma' },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setPath(o.id as 'trained4' | 'criticalGroup')}
              className={cn(
                'rounded-md border px-3 py-2 text-xs text-left transition-colors',
                path === o.id ? 'border-primary bg-primary/20 text-foreground' : 'border-border bg-background hover:border-accent/60',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {path && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            {path === 'trained4' ? '4 armas (separadas por vírgula)' : 'Grupo de Arma escolhido'}
          </p>
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={path === 'trained4' ? 'Ex.: Espada longa, Adaga, Arco curto, Lança' : 'Ex.: Lâminas Pesadas'}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
        </div>
      )}

      <p className="text-xs italic text-muted-foreground">
        O atributo é aplicado automaticamente. A escolha de armas/grupo fica registrada como nota narrativa.
      </p>

      <ConfirmButton
        enabled={!!valid}
        onClick={() =>
          onConfirm({
            attr: attr!,
            weaponPath: path!,
            weaponDetail: detail.trim(),
          })
        }
      />
    </div>
  );
}

// ============================================================================
// Resiliência Melhorada
// ============================================================================
const SAVE_TO_ATTR: Record<string, string> = {
  Fortitude: 'Força',
  Reflexos: 'Destreza',
  Vontade: 'Sabedoria',
  Astúcia: 'Inteligência',
  Carisma: 'Presença',
};

function ResilienciaForm({
  character: c,
  onConfirm,
}: {
  character: Character;
  onConfirm: (c: Record<string, string>) => void;
}) {
  const saves = ['Fortitude', 'Reflexos', 'Vontade', 'Astúcia', 'Carisma'];
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground">
        Escolha <strong>1 Teste de Resistência</strong> (exceto Integridade). Aumenta a proficiência
        e o atributo base recebe <strong>+1</strong>.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {saves.map((s) => (
          <button
            key={s}
            onClick={() => setPicked(s)}
            className={cn(
              'rounded-md border px-2 py-1.5 text-xs font-bold transition-colors',
              picked === s
                ? 'border-primary bg-primary/30 text-primary'
                : 'border-border bg-background hover:border-accent/60',
            )}
          >
            {s}
            <span className="ml-1 text-xs opacity-70">({SAVE_TO_ATTR[s].slice(0, 3)})</span>
          </button>
        ))}
      </div>
      <p className="text-xs italic text-muted-foreground">
        Atributo correspondente recebe +1 e a perícia equivalente é marcada como Treinada.
      </p>
      <ConfirmButton
        enabled={!!picked}
        onClick={() =>
          onConfirm({
            save: picked!,
            attr: SAVE_TO_ATTR[picked!],
            skill: picked!,
          })
        }
      />
    </div>
  );
}

// ============================================================================
// Tempestade de Ideias
// ============================================================================
function TempestadeIdeiasForm({
  character: c,
  onConfirm,
}: {
  character: Character;
  onConfirm: (c: Record<string, string>) => void;
}) {
  const attrs = c.attributes ?? [];
  const skills = (c.skills ?? []).filter((s) => !s.trained);
  const [attr, setAttr] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [tool, setTool] = useState<string>('');
  const valid = attr && skill && tool.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">1) Atributo (+1)</p>
        <div className="grid grid-cols-3 gap-1.5">
          {attrs.map((a) => (
            <button
              key={a.name}
              onClick={() => setAttr(a.name)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                attr === a.name ? 'border-primary bg-primary/30 text-primary' : 'border-border bg-background hover:border-accent/60',
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">2) Perícia (Treinada)</p>
        <select
          value={skill ?? ''}
          onChange={(e) => setSkill(e.target.value || null)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">— escolher —</option>
          {skills.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">3) Ferramenta</p>
        <input
          value={tool}
          onChange={(e) => setTool(e.target.value)}
          placeholder="Ex.: Kit de Ladrão, Kit de Médico..."
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />
      </div>

      <p className="text-xs italic text-muted-foreground">
        Ferramenta fica registrada como nota narrativa. Tracker de Vantagem em perícia (Treinamento ÷ 2 / curto)
        é gerenciado pelo Mestre.
      </p>

      <ConfirmButton
        enabled={!!valid}
        onClick={() => onConfirm({ attr: attr!, skill: skill!, tool: tool.trim() })}
      />
    </div>
  );
}

// ============================================================================
// Mestre da Criação — 2 perícias de Ofício
// ============================================================================
function MestreCriacaoForm({
  character: c,
  onConfirm,
}: {
  character: Character;
  onConfirm: (c: Record<string, string>) => void;
}) {
  // Identifica perícias de "Ofício"; também aceita treinadas (para ganhar +2 narrativo).
  const oficios = (c.skills ?? []).filter((s) => /ofício|oficio/i.test(s.name));
  const [s1, setS1] = useState<string | null>(null);
  const [s2, setS2] = useState<string | null>(null);
  const valid = s1 && s2 && s1 !== s2;

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground">
        Escolha <strong>2 ofícios diferentes</strong> para receber <strong>+2</strong> (Treinado).
      </p>
      {oficios.length === 0 && (
        <p className="text-xs italic text-amber-400">
          Nenhuma perícia "Ofício" encontrada na ficha.
        </p>
      )}
      {[1, 2].map((slot) => (
        <div key={slot} className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Ofício #{slot}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {oficios.map((s) => {
              const isSel = (slot === 1 ? s1 : s2) === s.name;
              const isOther = (slot === 1 ? s2 : s1) === s.name;
              return (
                <button
                  key={s.id}
                  disabled={isOther}
                  onClick={() => (slot === 1 ? setS1(s.name) : setS2(s.name))}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                    isSel
                      ? 'border-primary bg-primary/30 text-primary'
                      : isOther
                      ? 'border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed'
                      : 'border-border bg-background hover:border-accent/60',
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <ConfirmButton enabled={!!valid} onClick={() => onConfirm({ skill: s1!, skill2: s2! })} />
    </div>
  );
}

// ============================================================================
// Artesão Amaldiçoado
// ============================================================================
function ArtesaoForm({
  character: c,
  onConfirm,
}: {
  character: Character;
  onConfirm: (c: Record<string, string>) => void;
}) {
  // Procura "Ferreiro" ou "Canalizador" entre ofícios; senão, registra como nota.
  const oficios = (c.skills ?? []).filter((s) => /ofício|oficio|ferreiro|canalizador/i.test(s.name));
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground">
        Escolha <strong>Ferreiro</strong> ou <strong>Canalizador</strong> (vira Treinado; se já Treinado, vira Maestria).
      </p>
      {oficios.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {oficios.slice(0, 6).map((s) => (
            <button
              key={s.id}
              onClick={() => setPicked(s.name)}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs font-bold transition-colors',
                picked === s.name
                  ? 'border-primary bg-primary/30 text-primary'
                  : 'border-border bg-background hover:border-accent/60',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(['Ferreiro', 'Canalizador'] as const).map((name) => (
            <button
              key={name}
              onClick={() => setPicked(name)}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs font-bold transition-colors',
                picked === name
                  ? 'border-primary bg-primary/30 text-primary'
                  : 'border-border bg-background hover:border-accent/60',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs italic text-muted-foreground">
        A aba de Criação de Itens é narrativa — habilitada pelo Mestre.
      </p>
      <ConfirmButton enabled={!!picked} onClick={() => onConfirm({ craft: picked!, skill: picked! })} />
    </div>
  );
}

// ============================================================================
// Aptidão Desenvolvida
// ============================================================================
function AptidaoDesenvolvidaForm({
  character: c,
  onConfirm,
}: {
  character: Character;
  onConfirm: (c: Record<string, string>) => void;
}) {
  const [picked, setPicked] = useState<AptitudeKey | null>(null);
  const taken = new Set<string>(
    (c.chosenTalents ?? [])
      .filter((t) => t.id === 'tal-aptidao-desenvolvida' && t.choices?.aptitude)
      .map((t) => t.choices!.aptitude as string),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground">
        Escolha <strong>1 Aptidão Amaldiçoada</strong> para receber <strong>+1 nível</strong>.
      </p>
      {taken.size > 0 && (
        <p className="text-xs italic text-muted-foreground">
          Já desenvolvida(s): {[...taken].join(', ')} — não pode repetir.
        </p>
      )}
      <div className="grid grid-cols-5 gap-1.5">
        {APTITUDE_KEYS.map((k) => {
          const isTaken = taken.has(k);
          const isSel = picked === k;
          return (
            <button
              key={k}
              disabled={isTaken}
              onClick={() => setPicked(k)}
              title={APTITUDE_LABELS[k].full}
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-mono font-bold transition-colors',
                isSel
                  ? 'border-primary bg-primary/30 text-primary'
                  : isTaken
                  ? 'border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed'
                  : 'border-border bg-background hover:border-accent/60',
              )}
            >
              {k}
            </button>
          );
        })}
      </div>
      <ConfirmButton enabled={!!picked} onClick={() => onConfirm({ aptitude: picked! })} />
    </div>
  );
}

// ============================================================================
// Narrative-only choice (Adepto de Combate / Feitiçaria)
// ============================================================================
function NarrativeChoiceForm({
  field,
  options,
  note,
  onConfirm,
}: {
  field: string;
  options: string[];
  note: string;
  onConfirm: (c: Record<string, string>) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => setPicked(o)}
            className={cn(
              'rounded-md border px-3 py-2 text-xs text-left font-bold transition-colors',
              picked === o
                ? 'border-primary bg-primary/30 text-primary'
                : 'border-border bg-background hover:border-accent/60',
            )}
          >
            {o}
          </button>
        ))}
      </div>
      <p className="text-xs italic text-muted-foreground">{note}</p>
      <ConfirmButton enabled={!!picked} onClick={() => onConfirm({ [field]: picked! })} />
    </div>
  );
}
