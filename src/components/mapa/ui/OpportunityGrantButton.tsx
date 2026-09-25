/**
 * OpportunityGrantButton — botão (mestre) para conceder AdO aos tokens
 * selecionados. Pequeno popover com modo (Reação / Ação Comum / Qualquer)
 * e restrição opcional a um alvo (charId).
 */
import { useState, useMemo } from 'react';
import { Swords, X } from 'lucide-react';
import { useMapStore } from '@/stores/useMapStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useOpportunityStore, type AdoMode } from '@/stores/useOpportunityStore';
import { useCharacterStore } from '@/stores/useCharacterStore';

export function OpportunityGrantButton() {
  const selectedIds = useMapStore((s) => s.selectedIds);
  const entities = useMapStore((s) => s.entities);
  const isMaster = useRoleStore((s) => s.role) !== 'PLAYER';
  const grants = useOpportunityStore((s) => s.grants);
  const grant = useOpportunityStore((s) => s.grant);
  const revoke = useOpportunityStore((s) => s.revoke);
  const characters = useCharacterStore((s) => s.characters);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AdoMode>('reaction');
  const [restrictTo, setRestrictTo] = useState<string>('');

  const selectedCharIds = useMemo(() => {
    return selectedIds
      .map((id) => entities[id]?.characterId)
      .filter((x): x is string => !!x);
  }, [selectedIds, entities]);

  if (!isMaster) return null;
  if (selectedCharIds.length === 0) return null;

  const allHaveGrant = selectedCharIds.every((id) => grants[id]);

  const apply = () => {
    grant(selectedCharIds, mode, restrictTo || undefined);
    setOpen(false);
  };
  const removeAll = () => {
    for (const id of selectedCharIds) revoke(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={allHaveGrant ? 'AdO ativo — clique para gerenciar' : 'Conceder Ataque de Oportunidade'}
        className={`h-7 px-2 flex items-center gap-1 rounded text-[11px] font-medium transition ${
          allHaveGrant
            ? 'bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border border-amber-500/60'
            : 'bg-[#1f2025] hover:bg-[#26272c] text-zinc-300 border border-[#2a2b30]'
        }`}
      >
        <Swords className="h-3.5 w-3.5" />
        AdO
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 rounded-md border border-[#2a2b30] bg-[#16171a] p-2 shadow-xl z-50 text-[12px] text-zinc-200">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
            Tipo de reação
          </div>
          <div className="flex gap-1 mb-2">
            {([
              ['reaction', 'Reação'],
              ['action', 'Ação comum'],
              ['either', 'Qualquer'],
            ] as Array<[AdoMode, string]>).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 h-7 rounded text-[11px] ${
                  mode === m
                    ? 'bg-amber-500/30 text-amber-100 border border-amber-500/60'
                    : 'bg-[#1f2025] hover:bg-[#26272c] border border-[#2a2b30]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
            Restringir a alvo (opcional)
          </div>
          <select
            value={restrictTo}
            onChange={(e) => setRestrictTo(e.target.value)}
            className="w-full h-7 px-1 mb-2 rounded bg-[#1f2025] border border-[#2a2b30] text-[12px]"
          >
            <option value="">— qualquer um —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              onClick={apply}
              className="flex-1 h-7 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 text-[11px] font-medium border border-amber-500/60"
            >
              Conceder ({selectedCharIds.length})
            </button>
            {allHaveGrant && (
              <button
                onClick={removeAll}
                title="Remover concessão"
                className="h-7 w-7 flex items-center justify-center rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border border-rose-500/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
