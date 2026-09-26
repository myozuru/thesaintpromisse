import { useState } from 'react';
import { HeartPulse, X } from 'lucide-react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getEnergiaReversaConfig } from '@/lib/auraEffects';
import { playErrorSound, playSuccessSound } from '@/lib/sounds';

interface Props {
  character: Character;
  onClose: () => void;
}

/** Energia Reversa: cura pessoal; com Liberação de ER, também outras criaturas ao toque. */
export function EnergiaReversaDialog({ character: c, onClose }: Props) {
  const cfg = getEnergiaReversaConfig(c);
  const characters = useCharacterStore(s => s.characters);
  const cast = useCharacterStore(s => s.castEnergiaReversaSelf);
  const addLog = useLogStore(s => s.addLog);
  const [per, setPer] = useState(1);
  const [targetId, setTargetId] = useState(c.id);
  const [busy, setBusy] = useState(false);
  if (!cfg) return null;

  const maxByPe = Math.floor((c.peCurrent ?? 0) / 2);
  const limit = Math.max(1, cfg.peLimit);
  const dice = per * 2 + cfg.bonusDiceFromLevel;
  const mod = cfg.keyAttrMod * cfg.modMultiplier;
  const targets = cfg.hasLiberacao ? characters : [c];

  const submit = async () => {
    setBusy(true);
    const r = await cast(c.id, per, targetId);
    setBusy(false);
    const tgt = characters.find(x => x.id === targetId);
    if (r.ok) {
      playSuccessSound();
      addLog('system', `💚 ${c.name} usou Energia Reversa (${per} PER / -${r.peSpent} PE) em ${targetId === c.id ? 'si mesmo' : tgt?.name}: ${dice}d${cfg.dieSize} [${(r.rolls ?? []).join(', ')}] ${mod >= 0 ? '+' : ''}${mod} → +${r.healed} PV`);
      onClose();
    } else {
      playErrorSound();
      addLog('system', `${c.name}: Energia Reversa falhou — ${r.reason ?? '—'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Energia Reversa</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <label className="block text-xs text-muted-foreground">
          Alvo {cfg.hasLiberacao ? '(alcance de toque)' : '(apenas você — precisa de Liberação de ER para curar outros)'}
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            disabled={!cfg.hasLiberacao}
            className="mt-1 w-full rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-sm text-foreground"
          >
            {targets.map(t => (
              <option key={t.id} value={t.id}>
                {t.id === c.id ? `${t.name} (você)` : t.name} — {t.hpCurrent}/{t.hpMax} PV
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted-foreground">
          PER a gastar (máx. {limit} por vez · 1 PER = 2 PE)
          <input
            type="number"
            min={1}
            max={limit}
            value={per}
            onChange={e => setPer(Math.max(1, Math.min(limit, Math.floor(Number(e.target.value) || 1))))}
            className="mt-1 w-full rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-sm text-foreground"
          />
        </label>

        <div className="rounded-md bg-secondary/30 p-2 text-xs text-foreground space-y-0.5">
          <div>Cura: <b>{dice}d{cfg.dieSize} {mod >= 0 ? '+' : ''}{mod}</b> ({cfg.keyAttribute}{cfg.modMultiplier > 1 ? ' ×2' : ''})</div>
          {cfg.bonusDiceFromLevel > 0 && <div className="text-muted-foreground">+{cfg.bonusDiceFromLevel}d{cfg.dieSize} pelo nível do personagem</div>}
          <div>Custo: <b>{per * 2} PE</b> (você tem {c.peCurrent})</div>
          <div className="text-muted-foreground">Em combate, gasta sua Ação Comum.</div>
        </div>

        <button
          onClick={submit}
          disabled={busy || per > maxByPe}
          className="w-full rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {per > maxByPe ? 'PE insuficiente' : busy ? 'Rolando…' : 'Curar'}
        </button>
      </div>
    </div>
  );
}
