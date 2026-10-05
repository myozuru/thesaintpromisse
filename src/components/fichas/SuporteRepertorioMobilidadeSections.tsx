/**
 * Suporte Nv 2 (5º par): Expandir Repertório e Mobilidade Avançada.
 */
import { useState } from 'react';
import { BookOpen, Footprints } from 'lucide-react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { getMobilidadeBonus } from '@/lib/movementBudget';
import {
  MOBILIDADE_ID,
  REPERTORIO_BONUS,
  REPERTORIO_ID,
  aceitarMobilidade,
  closeMobilidadeEverywhere,
  definirBonusRepertorio,
  getMobilidadeReacaoMeters,
  getRepertorioOpcoes,
  getRepertorioPendentes,
  getRepertorioSlots,
  resetarRepertorio,
  treinarRepertorio,
  useMobilidadePromptStore,
} from '@/lib/suporteRepertorioMobilidade';

const selCls = 'flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground';
const btnCls = 'rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50';

export function RepertorioSection({ c }: { c: Character }) {
  const addLog = useLogStore((s) => s.addLog);
  const [skill, setSkill] = useState('');
  const [bonus, setBonus] = useState('');
  if (!hasSpecAbility(c, REPERTORIO_ID)) return null;
  const pend = getRepertorioPendentes(c);
  const chosen = c.repertorioSkills ?? [];

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <BookOpen className="h-3.5 w-3.5 text-primary" /> Expandir Repertório
        <span className="font-normal text-muted-foreground">{chosen.length}/{getRepertorioSlots(c)} perícias</span>
      </div>
      {chosen.length > 0 && <div className="text-xs text-foreground">Treinadas: <b>{chosen.join(', ')}</b></div>}
      {pend > 0 && (
        <div className="flex gap-2">
          <select value={skill} onChange={(e) => setSkill(e.target.value)} className={selCls}>
            <option value="">Treinar perícia… ({pend} restante{pend > 1 ? 's' : ''})</option>
            {getRepertorioOpcoes(c).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button
            disabled={!skill}
            className={btnCls}
            onClick={() => {
              if (treinarRepertorio(c, skill).ok) {
                addLog('system', `📚 ${c.name} ficou treinado em ${skill} (Expandir Repertório).`);
                setSkill('');
              }
            }}
          >
            Treinar
          </button>
        </div>
      )}
      {c.repertorioBonusSkill ? (
        <div className="text-xs text-foreground">+{REPERTORIO_BONUS} em <b>{c.repertorioBonusSkill}</b></div>
      ) : (
        <div className="flex gap-2">
          <select value={bonus} onChange={(e) => setBonus(e.target.value)} className={selCls}>
            <option value="">+{REPERTORIO_BONUS} em qual perícia?</option>
            {(c.skills ?? []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          <button
            disabled={!bonus}
            className={btnCls}
            onClick={() => {
              if (definirBonusRepertorio(c, bonus).ok) addLog('system', `📚 ${c.name} recebeu +${REPERTORIO_BONUS} em ${bonus} (Expandir Repertório).`);
            }}
          >
            Confirmar
          </button>
        </div>
      )}
      {(chosen.length > 0 || c.repertorioBonusSkill) && (
        <button onClick={() => resetarRepertorio(c)} className="text-xs text-muted-foreground underline hover:text-foreground">
          Refazer escolhas
        </button>
      )}
    </div>
  );
}

export function MobilidadeSection({ c }: { c: Character }) {
  if (!hasSpecAbility(c, MOBILIDADE_ID)) return null;
  const reacao = c.mobilidadeReacaoM ?? 0;
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2 space-y-1">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Footprints className="h-3.5 w-3.5 text-primary" /> Mobilidade Avançada
        <span className="font-normal text-muted-foreground">+{getMobilidadeBonus(c)} m de movimento</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Quando um aliado cair a 0 PV, você recebe a pergunta para reagir e mover {getMobilidadeReacaoMeters(c).toFixed(1)} m na direção dele.
      </div>
      {reacao > 0 && (
        <div className="text-xs text-primary">Reação ativa: arraste sua peça no mapa (até {reacao.toFixed(1)} m) na direção do aliado.</div>
      )}
    </div>
  );
}

export function MobilidadePromptDialog() {
  const offers = useMobilidadePromptStore((s) => s.offers);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const offer = offers[0];
  if (!offer) return null;
  const sup = characters.find((x) => x.id === offer.supporterId);
  const fallen = characters.find((x) => x.id === offer.fallenId);
  if (!sup || !fallen) return null;
  const meters = getMobilidadeReacaoMeters(sup);

  const aceitar = () => {
    const used = useCombatStore.getState().movementUsedByChar[sup.id] ?? 0;
    const r = aceitarMobilidade(sup.id, used);
    addLog(
      'combat',
      r.ok
        ? `🏃 ${sup.name} reage (Mobilidade Avançada) e pode mover ${r.meters.toFixed(1)} m na direção de ${fallen.name}.`
        : `🏃 ${sup.name} tentou reagir, mas está ${r.reason}.`,
    );
    closeMobilidadeEverywhere(sup.id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Footprints className="h-4 w-4 text-primary" /> Mobilidade Avançada — {sup.name}
        </div>
        <p className="text-sm text-foreground">
          <b>{fallen.name}</b> caiu nas portas da morte! Usar sua reação para mover até <b>{meters.toFixed(1)} m</b> na direção dele?
        </p>
        <p className="text-xs text-muted-foreground">Gasta 1 reação. Depois arraste sua peça no mapa; o movimento vale até o início do seu próximo turno.</p>
        <div className="flex gap-2">
          <button onClick={() => closeMobilidadeEverywhere(sup.id)} className="flex-1 rounded-md border border-border py-2 text-sm text-foreground hover:bg-secondary/40">
            Não
          </button>
          <button onClick={aceitar} className="flex-1 rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            Reagir
          </button>
        </div>
      </div>
    </div>
  );
}
