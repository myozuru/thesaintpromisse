/**
 * OpportunityRailButton — botão da rail esquerda (mestre) para conceder
 * Ataques de Oportunidade. Abre um popover lateral com:
 *   - Quem RECEBE o AdO (multi-seleção de personagens)
 *   - Contra QUEM (alvo opcional; vazio = qualquer)
 *   - Tipo: Reação / Ação comum / Qualquer
 */
import { useState, useMemo } from 'react';
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

  const hasAnyGrant = useMemo(() => Object.keys(grants).length > 0, [grants]);

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
    <div className="relative">
      <RadioIconButton
        title="Conceder Ataque de Oportunidade"
        active={hasAnyGrant}
        onClick={() => setOpen((v) => !v)}
      >
        <Swords className="h-[18px] w-[18px]" />
      </RadioIconButton>

      {open && (
        <div
          className="absolute left-full top-0 ml-2 w-72 rounded-md border border-border bg-card p-3 shadow-xl z-50 text-[12px] text-foreground"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-semibold text-amber-200">
              Ataque de Oportunidade
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Quem recebe o AdO
          </div>
          <div className="max-h-40 overflow-auto rounded border border-border bg-[#1a1b1f] mb-2">
            {characters.length === 0 && (
              <div className="px-2 py-2 text-muted-foreground text-[11px]">
                Nenhum personagem disponível.
              </div>
            )}
            {characters.map((c) => {
              const checked = recipients.includes(c.id);
              const active = !!grants[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() => toggleRecipient(c.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1 text-left text-[12px] hover:bg-secondary ${
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
                    <span className="text-[9px] uppercase text-amber-300/80">
                      ativo
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Contra quem (alvo)
          </div>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full h-7 px-1 mb-2 rounded bg-secondary border border-border text-[12px]"
          >
            <option value="">— qualquer um —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
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
                onClick={() => setMode(m)}
                className={`flex-1 h-7 rounded text-[11px] ${
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
              onClick={apply}
              disabled={recipients.length === 0}
              className="flex-1 h-7 rounded bg-amber-500/30 hover:bg-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 text-[11px] font-medium border border-amber-500/60"
            >
              Conceder ({recipients.length})
            </button>
            {hasAnyGrant && (
              <button
                onClick={clearAll}
                title="Revogar todos os AdO ativos"
                className="h-7 px-2 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 text-[11px] border border-rose-500/40"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
