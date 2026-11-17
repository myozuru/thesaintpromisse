/**
 * OpportunityRailButton — botão da rail esquerda (mestre) para conceder
 * Ataques de Oportunidade. Abre um popover lateral com:
 *   - Quem RECEBE o AdO (multi-seleção de personagens)
 *   - Contra QUEM (alvo opcional; vazio = qualquer)
 *   - Tipo: Reação / Ação comum / Qualquer
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Swords, X, Check } from 'lucide-react';
import { useRoleStore } from '@/stores/useRoleStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOpportunityStore, type AdoMode } from '@/stores/useOpportunityStore';
import { RadioIconButton } from './RadioIconButton';

export function OpportunityRailButton() {
  const isMaster = useRoleStore((s) => s.role) !== 'PLAYER';
  const characters = useCharacterStore((s) => s.characters);
  const grants = useOpportunityStore((s) => s.grants);
  const grant = useOpportunityStore((s) => s.grant);
  const revoke = useOpportunityStore((s) => s.revoke);

  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [target, setTarget] = useState<string>('');
  const [mode, setMode] = useState<AdoMode>('reaction');
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const focusCycleRef = useRef(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);

  const hasAnyGrant = useMemo(() => Object.keys(grants).length > 0, [grants]);

  useEffect(() => {
    if (!open) {
      setPopoverPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const panelWidth = Math.min(288, window.innerWidth - 16);
      const preferredLeft = anchor.right + 8;
      const left = preferredLeft + panelWidth <= window.innerWidth - 8
        ? preferredLeft
        : Math.max(8, anchor.left - panelWidth - 8);
      const top = Math.min(Math.max(8, anchor.top), Math.max(8, window.innerHeight - 480));
      setPopoverPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && popoverPosition && !focusCycleRef.current) {
      focusCycleRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (!open && focusCycleRef.current) {
      focusCycleRef.current = false;
      window.requestAnimationFrame(() => {
        triggerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      });
    }
  }, [open, popoverPosition]);

  if (!isMaster) return null;

  const toggleRecipient = (id: string) =>
    setRecipients((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const apply = () => {
    if (recipients.length === 0) return;
    grant(recipients, mode, target || undefined);
    setOpen(false);
    setRecipients([]);
    setTarget('');
  };
  const clearAll = () => {
    for (const id of Object.keys(grants)) revoke(id);
  };

  return (
    <div ref={triggerRef} className="relative">
      <RadioIconButton
        title="Conceder Ataque de Oportunidade"
        label="Oportunidade"
        active={open || hasAnyGrant}
        pressed={open}
        expanded={open}
        controls={open ? 'map-opportunity-popover' : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Swords className="h-[18px] w-[18px]" />
      </RadioIconButton>

      {open && popoverPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          id="map-opportunity-popover"
          role="dialog"
          aria-label="Conceder Ataque de Oportunidade"
          className="fixed z-[100] w-72 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-md border border-border bg-card p-3 shadow-xl text-sm text-foreground"
          style={{ top: popoverPosition.top, left: popoverPosition.left }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              return;
            }

            if (e.key !== 'Tab') return;

            const focusable = Array.from(
              popoverRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
              ) ?? [],
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            const leavingAtBoundary = (e.shiftKey && active === first) || (!e.shiftKey && active === last);

            if (leavingAtBoundary) {
              e.preventDefault();
              setOpen(false);
            }
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-base font-semibold text-amber-200">
              Ataque de Oportunidade
            </div>
            <button
              type="button"
              ref={closeButtonRef}
              aria-label="Fechar Ataque de Oportunidade"
              onClick={() => setOpen(false)}
              className="h-11 w-11 flex items-center justify-center rounded hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-sm uppercase tracking-wider text-muted-foreground mb-1">
            Quem recebe o AdO
          </div>
          <div className="max-h-40 overflow-auto rounded border border-border bg-[#1a1b1f] mb-2">
            {characters.length === 0 && (
              <div className="px-2 py-2 text-muted-foreground text-base">
                Nenhum personagem disponível.
              </div>
            )}
            {characters.map((c) => {
              const checked = recipients.includes(c.id);
              const active = !!grants[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleRecipient(c.id)}
                  className={`w-full min-h-11 flex items-center gap-2 px-2 py-1 text-left text-base hover:bg-secondary ${
                    checked ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <span
                    className={`h-3.5 w-3.5 flex items-center justify-center rounded border ${
                      checked
                        ? 'bg-amber-500/40 border-amber-400 text-amber-50'
                        : 'border-[#3a3b40]'
                    }`}
                  >
                    {checked && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="flex-1 truncate">{c.name}</span>
                  {active && (
                  <span className="text-sm uppercase text-amber-300/80">
                      ativo
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <label htmlFor="opportunity-target" className="block text-sm uppercase tracking-wider text-muted-foreground mb-1">
            Contra quem (alvo)
          </label>
          <select
            id="opportunity-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full h-11 px-2 mb-2 rounded bg-secondary border border-border text-base"
          >
            <option value="">— qualquer um —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="text-sm uppercase tracking-wider text-muted-foreground mb-1">
            Tipo
          </div>
          <div className="flex gap-1 mb-3">
            {(
              [
                ['reaction', 'Reação'],
                ['action', 'Ação'],
                ['either', 'Qualquer'],
              ] as Array<[AdoMode, string]>
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`flex-1 min-h-11 rounded text-base ${
                  mode === m
                    ? 'bg-amber-500/30 text-amber-100 border border-amber-500/60'
                    : 'bg-secondary hover:bg-accent/20 border border-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={apply}
              disabled={recipients.length === 0}
              className="flex-1 min-h-11 rounded bg-amber-500/30 hover:bg-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 text-base font-medium border border-amber-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Conceder ({recipients.length})
            </button>
            {hasAnyGrant && (
              <button
                type="button"
                onClick={clearAll}
                title="Revogar todos os AdO ativos"
                className="min-h-11 px-2 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 text-base border border-rose-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Limpar
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
