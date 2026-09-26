/**
 * Transmitir Conhecimento (Suporte Nv 2) no painel do Suporte:
 * durante um descanso, concede treinamento temporário em perícias
 * treinadas do Suporte para aliados (limite de aliados: ⌊BT/2⌋ no
 * descanso curto, BT no longo; dura até o próximo descanso do aliado).
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import {
  TRANSMITIR_ID,
  getTransmitirAliados,
  getTransmitirLimite,
  getTransmitirOpcoes,
  podeTransmitir,
  transmitir,
  type TransmitirMode,
} from '@/lib/suporteTransmitir';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { GraduationCap } from 'lucide-react';

export function TransmitirSection({ c }: { c: Character }) {
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const [mode, setMode] = useState<TransmitirMode>('curto');
  const [allyId, setAllyId] = useState('');
  const [skill, setSkill] = useState('');
  if (!hasSpecAbility(c, TRANSMITIR_ID)) return null;

  const limite = getTransmitirLimite(c, mode);
  const usados = getTransmitirAliados(c, mode);
  const opcoes = getTransmitirOpcoes(c);
  const ally = characters.find((x) => x.id === allyId);
  const check = ally && skill ? podeTransmitir(c, ally, skill, mode) : null;

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <GraduationCap className="h-3.5 w-3.5 text-primary" /> Transmitir Conhecimento
        <span className="font-normal text-muted-foreground">durante um descanso · sem custo</span>
      </div>

      <div className="flex gap-1">
        {(['curto', 'longo'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${
              mode === m
                ? 'border-primary bg-primary/20 text-foreground font-bold'
                : 'border-border text-muted-foreground hover:bg-secondary/40'
            }`}
          >
            Descanso {m} (até {getTransmitirLimite(c, m)} aliado{getTransmitirLimite(c, m) === 1 ? '' : 's'})
          </button>
        ))}
      </div>

      <div className="text-[11px] text-muted-foreground">
        Preparados neste descanso: <b className="text-foreground">{usados.length}/{limite}</b>
        {usados.length > 0 && (
          <span> — {usados.map((id) => characters.find((x) => x.id === id)?.name ?? '?').join(', ')}</span>
        )}
      </div>

      <div className="flex gap-2">
        <select
          value={allyId}
          onChange={(e) => setAllyId(e.target.value)}
          className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground"
        >
          <option value="">Aliado…</option>
          {characters
            .filter((x) => x.category === 'PLAYER' && x.id !== c.id)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}{usados.includes(o.id) ? ' · já preparado' : ''}
              </option>
            ))}
        </select>
        <select
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground"
        >
          <option value="">Perícia treinada…</option>
          {opcoes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          disabled={!check?.ok}
          onClick={() => {
            if (!ally) return;
            const r = transmitir(c, ally, skill, mode);
            if (r.ok) {
              addLog('system', `📚 ${c.name} transmitiu conhecimento: ${ally.name} está treinado em ${skill} até o próximo descanso.`);
              setSkill('');
            }
          }}
          className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          Transmitir
        </button>
      </div>
      {check && !check.ok && <div className="text-[11px] text-destructive">{check.reason}</div>}
      <div className="text-[11px] text-muted-foreground">
        O treinamento some no próximo descanso (curto ou longo) do aliado.
      </div>
    </div>
  );
}
