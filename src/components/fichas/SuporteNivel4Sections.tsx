/**
 * Suporte Nv 4 — Guarda Sincronizada: seção no painel + watcher global que
 * remove membros que se afastam (> 7,5 m) ou ficam Cego/Surdo.
 */
import { useEffect } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { GUARDA_ID, activateGuarda, computeGuardaPatches, guardaBonus } from '@/lib/suporteNivel4';
import { Shield } from 'lucide-react';

export function GuardaSincronizadaSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  if (!hasSpecAbility(c, GUARDA_ID)) return null;

  const members = c.guardaSincronizada?.members ?? [];
  const names = members.map((id) => characters.find((x) => x.id === id)?.name ?? '?');

  const ativar = () => {
    const { entities, gridConfig } = useMapStore.getState();
    const r = activateGuarda(c, characters, entities, gridConfig);
    if (!r.ok) { addLog('system', `❌ ${c.name}: ${r.reason}`); return; }
    const store = useCharacterStore.getState();
    store.updateCharacter(c.id, { guardaSincronizada: { members: r.members } });
    addLog('system', `🛡️ ${c.name} sintonizou a guarda (Ação Bônus): ${r.members.length} membros, +${guardaBonus(r.members)} de Defesa.`);
  };
  const encerrar = () => {
    useCharacterStore.getState().updateCharacter(c.id, { guardaSincronizada: undefined });
    addLog('system', `🛡️ ${c.name} encerrou a Guarda Sincronizada.`);
  };

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Shield className="h-3.5 w-3.5 text-primary" /> Guarda Sincronizada
      </div>
      {members.length > 0 ? (
        <>
          <p className="text-[11px] text-muted-foreground">
            Ativa: +{guardaBonus(members)} de Defesa para {names.join(', ')}.
          </p>
          <button type="button" onClick={encerrar} className="w-full rounded border border-border px-2 py-1 text-xs hover:bg-secondary/40">
            Encerrar guarda
          </button>
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Ação Bônus: aliados a até 7,5 m (sem Cego/Surdo) entram na guarda. Quem se afastar sai.
          </p>
          <button type="button" onClick={ativar} className="w-full rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90">
            Sintonizar guarda
          </button>
        </>
      )}
    </div>
  );
}

/** Recalcula as guardas quando fichas ou peças mudam. Idempotente. */
export function GuardaSincronizadaWatcher() {
  const characters = useCharacterStore((s) => s.characters);
  const entities = useMapStore((s) => s.entities);
  const gridConfig = useMapStore((s) => s.gridConfig);
  useEffect(() => {
    if (!characters.some((c) => c.guardaSincronizada || c.guardaSincronizadaBonus)) return;
    const patches = computeGuardaPatches(characters, entities, gridConfig);
    if (patches.length === 0) return;
    const store = useCharacterStore.getState();
    for (const p of patches) store.updateCharacter(p.id, p.patch);
  }, [characters, entities, gridConfig]);
  return null;
}
