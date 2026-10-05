import { useMemo, useState } from 'react';
import { BookOpen, X, Plus, Lock, ChevronDown, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';
import {
  GENERAL_TALENTS,
  ORIGIN_TALENTS,
  evaluateTalentRequirements,
  type Talent,
} from '@/lib/talents';
import {
  getSpecAbilitiesFor,
  evaluateSpecAbilityRequirements,
  ACTIVATION_LABEL as SPEC_ACTIVATION_LABEL,
  type SpecAbility,
} from '@/lib/specAbilities';
import { CURSED_APTITUDES } from '@/lib/aptitudes';

type TabKey = 'class' | 'talent' | 'aptitude';

export type CatalogPick =
  | { kind: 'talent'; talent: Talent }
  | { kind: 'spec_ability'; ability: SpecAbility };

interface Props {
  character: Character;
  onClose: () => void;
  /** Compat: callback antigo recebia só Talent. Mantido para chamadas legadas. */
  onPick?: (t: Talent) => void;
  /** Novo callback unificado (Habilidade da Classe ou Talento). */
  onPickAny?: (pick: CatalogPick) => void;
  /** Filtra abas visíveis (default: todas). */
  allowedTabs?: TabKey[];
  /** Aba inicial (default 'class' se permitida, senão 'talent'). */
  initialTab?: TabKey;
}

const TALENT_ACTIVATION_LABEL: Record<Talent['activation'], string> = {
  passive: 'Passiva',
  reaction: 'Reação',
  bonus: 'Ação Bônus',
  action: 'Ação Comum',
  free: 'Ação Livre',
  toggle: 'Toggle',
  trigger: 'Trigger',
  choice: 'Escolha',
};

export function TalentCatalogModal({
  character: c,
  onClose,
  onPick,
  onPickAny,
  allowedTabs = ['class', 'talent'],
  initialTab,
}: Props) {
  const defaultTab: TabKey =
    initialTab && allowedTabs.includes(initialTab)
      ? initialTab
      : (allowedTabs[0] ?? 'talent');
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [talentSubTab, setTalentSubTab] = useState<'general' | 'origin'>('general');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Habilidades da Classe — pool da spec do personagem
  const classAbilities = useMemo<SpecAbility[]>(() => {
    return [...getSpecAbilitiesFor(c.specialization)].sort(
      (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
    );
  }, [c.specialization]);

  const talents = useMemo<Talent[]>(() => {
    const base = talentSubTab === 'general' ? GENERAL_TALENTS : ORIGIN_TALENTS;
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [talentSubTab]);

  const counts = {
    class: classAbilities.length,
    talent: GENERAL_TALENTS.length + ORIGIN_TALENTS.length,
    aptitude: CURSED_APTITUDES.length,
  };

  const handlePickTalent = (t: Talent) => {
    onPickAny?.({ kind: 'talent', talent: t });
    onPick?.(t);
  };
  const handlePickAbility = (a: SpecAbility) => {
    onPickAny?.({ kind: 'spec_ability', ability: a });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-accent/40 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BookOpen className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Catálogo de Habilidades & Talentos
          </h2>
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-destructive/30 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Abas principais */}
        <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
          {allowedTabs.includes('class') && (
            <TabButton
              active={tab === 'class'}
              onClick={() => setTab('class')}
              icon={<Wand2 className="h-3 w-3" />}
              label={`Habilidades de ${c.specialization}`}
              count={counts.class}
              tone="primary"
            />
          )}
          {allowedTabs.includes('talent') && (
            <TabButton
              active={tab === 'talent'}
              onClick={() => setTab('talent')}
              icon={<BookOpen className="h-3 w-3" />}
              label="Talentos"
              count={counts.talent}
              tone="accent"
            />
          )}
          {allowedTabs.includes('aptitude') && (
            <TabButton
              active={tab === 'aptitude'}
              onClick={() => setTab('aptitude')}
              icon={<Sparkles className="h-3 w-3" />}
              label="Aptidões"
              count={counts.aptitude}
              tone="muted"
            />
          )}
        </div>

        {/* Sub-abas (só aparecem na aba Talentos) */}
        {tab === 'talent' && (
          <div className="flex gap-1 border-b border-border px-4 py-1.5">
            {(['general', 'origin'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTalentSubTab(t)}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-xs font-bold transition-colors',
                  talentSubTab === t
                    ? 'border-accent bg-accent/30 text-accent-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-accent/40',
                )}
              >
                {t === 'general' ? 'Gerais' : 'Origem'}
                <span className="ml-1 opacity-60">
                  ({t === 'general' ? GENERAL_TALENTS.length : ORIGIN_TALENTS.length})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'class' && (
            <ClassAbilitiesList
              character={c}
              abilities={classAbilities}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              onPick={handlePickAbility}
            />
          )}
          {tab === 'talent' && (
            <TalentsList
              character={c}
              talents={talents}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              onPick={handlePickTalent}
            />
          )}
          {tab === 'aptitude' && (
            <p className="text-sm text-muted-foreground italic text-center py-12">
              Aba em construção. Aptidões Amaldiçoadas serão adicionadas em breve.
            </p>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Itens com pré-requisitos não atendidos ficam bloqueados. Itens repetíveis (↻) podem ser escolhidos múltiplas vezes.
        </div>
      </div>
    </div>
  );
}

// ===== Sub-componentes =====================================================

interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: 'primary' | 'accent' | 'muted';
}

function TabButton({ active, onClick, icon, label, count, tone }: TabBtnProps) {
  const activeCls =
    tone === 'primary'
      ? 'border-primary bg-primary/30 text-primary'
      : tone === 'accent'
      ? 'border-accent bg-accent/30 text-accent-foreground'
      : 'border-muted-foreground/40 bg-muted/30 text-foreground';
  const hoverCls =
    tone === 'primary'
      ? 'hover:border-primary/40'
      : tone === 'accent'
      ? 'hover:border-accent/40'
      : 'hover:border-muted-foreground/40';
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md border px-2 py-1 text-xs font-bold transition-colors flex items-center gap-1.5',
        active ? activeCls : `border-border bg-background text-muted-foreground ${hoverCls}`,
      )}
    >
      {icon}
      {label}
      <span className="opacity-60">({count})</span>
    </button>
  );
}

// ----- Habilidades da Classe -----

interface ClassListProps {
  character: Character;
  abilities: SpecAbility[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onPick: (a: SpecAbility) => void;
}

function ClassAbilitiesList({
  character: c,
  abilities,
  expandedId,
  setExpandedId,
  onPick,
}: ClassListProps) {
  if (abilities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic text-center py-12">
        Nenhuma habilidade catalogada para <strong>{c.specialization}</strong> ainda.
      </p>
    );
  }
  // Filtra por tier <= nível e ordena por tier crescente, depois nome.
  const sortFn = (a: SpecAbility, b: SpecAbility) =>
    a.tier - b.tier || a.name.localeCompare(b.name);
  const visible = abilities.filter(a => a.tier <= c.level).sort(sortFn);
  const future = abilities.filter(a => a.tier > c.level).sort(sortFn);

  return (
    <ul className="space-y-2">
      {visible.map(a => {
        const isOpen = expandedId === a.id;
        const ev = evaluateSpecAbilityRequirements(a, c);
        const blocked = !ev.ok;
        return (
          <li
            key={a.id}
            className={cn(
              'rounded-lg border bg-secondary/30 overflow-hidden transition-colors',
              blocked
                ? 'border-destructive/30 opacity-70'
                : 'border-border hover:border-primary/40',
            )}
          >
            <div className="flex items-start gap-2 p-2">
              <span className="rounded bg-primary/30 px-1.5 py-0.5 text-xs font-mono font-bold text-primary mt-0.5">
                T{a.tier}
              </span>
              <span className="rounded border border-accent/40 bg-accent/20 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent-foreground mt-0.5">
                {SPEC_ACTIVATION_LABEL[a.activation]}
              </span>
              {a.allowMultiplePurchases && (
                <span className="rounded bg-muted/40 px-1.5 py-0.5 text-xs font-bold text-muted-foreground mt-0.5">
                  ↻
                </span>
              )}
              <button
                onClick={() => setExpandedId(isOpen ? null : a.id)}
                className="flex-1 text-left text-sm font-bold text-foreground hover:text-primary transition-colors"
              >
                {a.name}
                <ChevronDown
                  className={cn(
                    'inline ml-1 h-3.5 w-3.5 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              <button
                onClick={() => !blocked && onPick(a)}
                disabled={blocked}
                title={blocked ? `Requer: ${ev.missing.join(', ')}` : 'Escolher esta habilidade'}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-bold transition-colors flex items-center gap-1',
                  blocked
                    ? 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed'
                    : 'border-primary bg-primary/20 text-primary hover:bg-primary/40',
                )}
              >
                {blocked ? <Lock className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {blocked ? 'Bloqueado' : 'Escolher'}
              </button>
            </div>
            {(blocked || a.prerequisitesText) && (
              <div className="px-3 pb-1.5 -mt-1 text-xs italic flex flex-wrap gap-x-2">
                {blocked && (
                  <span className="text-destructive">⚠ {ev.missing.join(' · ')}</span>
                )}
                {a.prerequisitesText && (
                  <span className="text-muted-foreground">📜 {a.prerequisitesText}</span>
                )}
              </div>
            )}
            {isOpen && (
              <div className="border-t border-border bg-background/40 px-3 py-2 space-y-1.5">
                <p className="text-xs italic text-muted-foreground">{a.flavor}</p>
                <p className="text-xs text-foreground leading-relaxed">{a.mechanic}</p>
                <details className="rounded-md border border-border/60 bg-card/60 mt-1.5">
                  <summary className="cursor-pointer select-none px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    ⚙ Detalhes técnicos (Mestre)
                  </summary>
                  <div className="border-t border-border/60 p-2 grid gap-0.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Gatilho:</span> {a.triggerText}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lógica:</span>{' '}
                      <span className="font-mono">{a.logicText}</span>
                    </div>
                    {a.peCost != null && a.peCost > 0 && (
                      <div>
                        <span className="text-muted-foreground">PE:</span>{' '}
                        <span className="font-mono">{a.peCost}</span>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </li>
        );
      })}
      {future.length > 0 && (
        <li className="rounded-lg border border-dashed border-border/60 bg-background/20 px-3 py-2 text-xs text-muted-foreground italic">
          🔒 {future.length} habilidade(s) bloqueada(s) por nível
          (próximo desbloqueio: Nv {future[0].tier}).
        </li>
      )}
    </ul>
  );
}

// ----- Talentos -----

interface TalentsListProps {
  character: Character;
  talents: Talent[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onPick: (t: Talent) => void;
}

function TalentsList({
  character: c,
  talents,
  expandedId,
  setExpandedId,
  onPick,
}: TalentsListProps) {
  if (talents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic text-center py-8">
        Nenhum talento cadastrado nesta categoria ainda.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {talents.map(t => {
        const isOpen = expandedId === t.id;
        const evalResult = evaluateTalentRequirements(t, c);
        const blocked = !evalResult.ok;
        return (
          <li
            key={t.id}
            className={cn(
              'rounded-lg border bg-secondary/30 overflow-hidden transition-colors',
              blocked
                ? 'border-destructive/30 opacity-70'
                : 'border-border hover:border-accent/40',
            )}
          >
            <div className="flex items-start gap-2 p-2">
              <span className="rounded border border-accent/40 bg-accent/20 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent-foreground mt-0.5">
                {TALENT_ACTIVATION_LABEL[t.activation]}
              </span>
              {t.minLevel != null && (
                <span className="rounded bg-primary/30 px-1.5 py-0.5 text-xs font-mono font-bold text-primary mt-0.5">
                  Nv {t.minLevel}+
                </span>
              )}
              {t.repeatable && (
                <span className="rounded bg-muted/40 px-1.5 py-0.5 text-xs font-bold text-muted-foreground mt-0.5">
                  ↻
                </span>
              )}
              <button
                onClick={() => setExpandedId(isOpen ? null : t.id)}
                className="flex-1 text-left text-sm font-bold text-foreground hover:text-accent-foreground transition-colors"
              >
                {t.name}
                <ChevronDown
                  className={cn(
                    'inline ml-1 h-3.5 w-3.5 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              <button
                onClick={() => !blocked && onPick(t)}
                disabled={blocked}
                title={blocked ? `Requer: ${evalResult.missing.join(', ')}` : 'Escolher este talento'}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-bold transition-colors flex items-center gap-1',
                  blocked
                    ? 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed'
                    : 'border-accent bg-accent/20 text-accent-foreground hover:bg-accent/40',
                )}
              >
                {blocked ? <Lock className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {blocked ? 'Bloqueado' : 'Escolher'}
              </button>
            </div>
            {(blocked || t.requirementsText) && (
              <div className="px-3 pb-1.5 -mt-1 text-xs italic flex flex-wrap gap-x-2">
                {blocked && (
                  <span className="text-destructive">⚠ {evalResult.missing.join(' · ')}</span>
                )}
                {t.requirementsText && (
                  <span className="text-muted-foreground">📜 {t.requirementsText}</span>
                )}
              </div>
            )}
            {isOpen && (
              <div className="border-t border-border bg-background/40 px-3 py-2 space-y-1.5">
                <p className="text-xs italic text-muted-foreground">{t.flavor}</p>
                <p className="text-xs text-foreground leading-relaxed">{t.mechanic}</p>
                <details className="rounded-md border border-border/60 bg-card/60 mt-1.5">
                  <summary className="cursor-pointer select-none px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    ⚙ Detalhes técnicos (Mestre)
                  </summary>
                  <div className="border-t border-border/60 p-2 grid gap-0.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Gatilho:</span> {t.triggerText}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lógica:</span>{' '}
                      <span className="font-mono">{t.logicText}</span>
                    </div>
                    {t.peCost != null && t.peCost > 0 && (
                      <div>
                        <span className="text-muted-foreground">PE:</span>{' '}
                        <span className="font-mono">{t.peCost}</span>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
