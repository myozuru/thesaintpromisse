/**
 * CombatTrackersCard — UI unificada de trackers consumíveis e ações.
 *
 * Atende:
 *  • Esquivar (DES/longo)
 *  • Provocação Desafiadora (PRE÷2/longo)
 *  • Favorecido pela Sorte (3/longo + recovery em nat20 inimigo)
 *  • Reposição Sanguínea (Vigor Maldito reativo, 1/longo)
 *  • Robustez Aprimorada (reroll Fortitude 1/dia)
 *  • Tempestade de Ideias (vantagem em perícia, training_half/curto)
 *  • Físico Aperfeiçoado (toggle de variant A/B/C/D)
 *  • Investida Aprimorada (botão "Executar" — apenas log narrativo)
 */
import type { Character } from '@/types';
import { useState } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getTalentById, resolveTalentUsageMax } from '@/lib/talents';
import { applyInvestidaModifiers } from '@/lib/combatEngine';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { computeDiscursoMotivador } from '@/lib/talentEffects';
import { DiscursoMotivadorDialog } from './DiscursoMotivadorDialog';
import { toast } from 'sonner';
import { playClickSound, playErrorSound, playSuccessSound } from '@/lib/sounds';
import { Activity, Dice5, Heart, RotateCcw, Sparkles, Target, Zap, Wind, Footprints, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { character: Character; }

interface ConsumableRow {
  talentId: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  actionLabel: string;
  onUse: () => void;
  /** Botão extra: recuperar 1 uso (Sorte). */
  recoverLabel?: string;
  onRecover?: () => void;
}

export function CombatTrackersCard({ character: c }: Props) {
  const consumeTalentUse = useCharacterStore(s => s.consumeTalentUse);
  const recoverTalentUse = useCharacterStore(s => s.recoverTalentUse);
  const setTalentChoice = useCharacterStore(s => s.setTalentChoice);
  const addLog = useLogStore(s => s.addLog);

  const has = (id: string) => (c.chosenTalents ?? []).some(t => t.id === id);
  const choiceOf = (id: string) =>
    (c.chosenTalents ?? []).find(t => t.id === id)?.choices ?? {};

  const tb = getTrainingBonusByLevel(c.level);
  const desAttr = (c.attributes ?? []).find(a => a.name.toUpperCase() === 'DES');
  const preAttr = (c.attributes ?? []).find(a => a.name === 'Presença');
  const desMod = desAttr ? Math.floor(((desAttr.value ?? 10) - 10) / 2) : 0;
  const preMod = preAttr ? Math.floor(((preAttr.value ?? 10) - 10) / 2) : 0;

  const usesOf = (talentId: string): { used: number; max: number } | null => {
    const t = getTalentById(talentId);
    if (!t?.usage) return null;
    const max = resolveTalentUsageMax(t.usage, { trainingBonus: tb, desMod, preMod });
    const used = c.talentUsage?.[talentId] ?? 0;
    return { used, max };
  };

  const useTalent = (talentId: string, narration: string) => {
    const r = consumeTalentUse(c.id, talentId);
    if (!r.ok) {
      playErrorSound();
      toast.error(r.reason ?? 'Sem usos disponíveis.');
      return false;
    }
    playClickSound();
    toast.success(`${narration} (${(r.usesLeft ?? 0)} usos restantes)`);
    addLog('combat', `🎯 ${c.name}: ${narration}.`);
    return true;
  };

  const rows: ConsumableRow[] = [];

  if (has('tal-tecnicas-esquiva')) {
    rows.push({
      talentId: 'tal-tecnicas-esquiva',
      icon: <Wind className="h-3.5 w-3.5" />,
      label: 'Esquivar (Ação Bônus)',
      description: `+${desMod} na Defesa até início do próximo turno.`,
      actionLabel: 'Esquivar',
      onUse: () => useTalent('tal-tecnicas-esquiva',
        `usou Esquivar — Defesa +${desMod} até o início do próximo turno`),
    });
  }
  if (has('tal-provocacao-desafiadora')) {
    rows.push({
      talentId: 'tal-provocacao-desafiadora',
      icon: <Target className="h-3.5 w-3.5" />,
      label: 'Provocar (Ação Livre)',
      description: 'Alvo deve atacar você no próximo turno (TR Vontade resiste).',
      actionLabel: 'Provocar',
      onUse: () => useTalent('tal-provocacao-desafiadora',
        'usou Provocação Desafiadora — alvo deve te atacar no próximo turno (TR Vontade resiste)'),
    });
  }
  if (has('tal-favorecido-pela-sorte')) {
    rows.push({
      talentId: 'tal-favorecido-pela-sorte',
      icon: <Sparkles className="h-3.5 w-3.5" />,
      label: 'Favorecido pela Sorte',
      description: 'Após qualquer rolagem (exceto falha crítica), gaste 1 ponto para re-rolar e ficar com o MAIOR. Pode repetir até esgotar.',
      actionLabel: 'Gastar 1 Sorte',
      onUse: () => useTalent('tal-favorecido-pela-sorte',
        'gastou 1 ponto de Sorte — re-rola a última rolagem e fica com o maior'),
      recoverLabel: 'Inimigo rolou nat 20',
      onRecover: () => {
        recoverTalentUse(c.id, 'tal-favorecido-pela-sorte');
        playSuccessSound();
        toast.success('+1 ponto de Sorte recuperado.');
        addLog('combat', `🍀 ${c.name}: inimigo rolou 20 nat → +1 ponto de Sorte.`);
      },
    });
  }
  if (has('tal-reposicao-sanguinea')) {
    rows.push({
      talentId: 'tal-reposicao-sanguinea',
      icon: <Heart className="h-3.5 w-3.5" />,
      label: 'Reposição Sanguínea (Reação)',
      description: 'Ao tomar dano: ativa Vigor Maldito como Reação (cura +5).',
      actionLabel: 'Ativar reativo',
      onUse: () => useTalent('tal-reposicao-sanguinea',
        'ativou Reposição Sanguínea — Vigor Maldito como Reação (cura +5)'),
    });
  }
  if (has('tal-robustez-aprimorada')) {
    rows.push({
      talentId: 'tal-robustez-aprimorada',
      icon: <RotateCcw className="h-3.5 w-3.5" />,
      label: 'Robustez Aprimorada (Reroll)',
      description: 'Rerole 1 TR de Fortitude e fique com o melhor.',
      actionLabel: 'Rerolar Fortitude',
      onUse: () => useTalent('tal-robustez-aprimorada',
        'rerolou um TR de Fortitude (Robustez Aprimorada)'),
    });
  }
  if (has('tal-tempestade-ideias')) {
    rows.push({
      talentId: 'tal-tempestade-ideias',
      icon: <Dice5 className="h-3.5 w-3.5" />,
      label: 'Tempestade de Ideias',
      description: 'Vantagem na perícia escolhida (1×/Descanso Curto por uso).',
      actionLabel: 'Usar (Vantagem)',
      onUse: () => useTalent('tal-tempestade-ideias',
        'gastou um uso de Tempestade de Ideias — Vantagem na perícia escolhida'),
    });
  }

  const investida = applyInvestidaModifiers(c);
  const hasFisico = has('tal-fisico-aperfeicoado');
  const fisicoTalent = getTalentById('tal-fisico-aperfeicoado');
  const fisicoChoice = choiceOf('tal-fisico-aperfeicoado').variant
    ?? fisicoTalent?.variants?.[0]?.key
    ?? 'A';

  const hasDiscurso = has('tal-discurso-motivador');
  const discursoCalc = hasDiscurso ? computeDiscursoMotivador(c) : null;
  const [discursoOpen, setDiscursoOpen] = useState(false);

  if (rows.length === 0 && !investida && !hasFisico && !hasDiscurso) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-accent" />
        <span className="text-xs font-bold uppercase tracking-wider text-accent">
          Trackers & Ações de Talento
        </span>
      </div>

      {rows.map(row => {
        const u = usesOf(row.talentId);
        if (!u) return null;
        const exhausted = u.used >= u.max;
        return (
          <div
            key={row.talentId}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5"
          >
            <div className="flex items-center gap-1.5 text-xs flex-1 min-w-[180px]">
              <span className="text-accent">{row.icon}</span>
              <div>
                <div className="font-bold">{row.label}</div>
                <div className="text-[10.5px] text-muted-foreground">{row.description}</div>
              </div>
            </div>
            <div className={cn(
              'rounded-full px-2 py-0.5 text-xs font-mono font-bold',
              exhausted
                ? 'border border-hp/40 bg-hp/10 text-hp'
                : 'border border-neon-green/40 bg-neon-green/10 text-neon-green',
            )}>
              {u.max - u.used}/{u.max}
            </div>
            <button
              type="button"
              onClick={row.onUse}
              disabled={exhausted}
              className={cn(
                'text-xs font-bold rounded px-2 py-1 transition',
                exhausted
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {row.actionLabel}
            </button>
            {row.onRecover && (
              <button
                type="button"
                onClick={row.onRecover}
                disabled={u.used === 0}
                className={cn(
                  'text-xs font-bold rounded px-2 py-1 transition border',
                  u.used === 0
                    ? 'border-muted bg-muted/40 text-muted-foreground cursor-not-allowed'
                    : 'border-neon-green/40 bg-neon-green/10 text-neon-green hover:bg-neon-green/20',
                )}
              >
                {row.recoverLabel}
              </button>
            )}
          </div>
        );
      })}

      {/* Investida Aprimorada — ação sem tracker, só log */}
      {investida && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 text-xs flex-1 min-w-[180px]">
            <span className="text-accent"><Footprints className="h-3.5 w-3.5" /></span>
            <div>
              <div className="font-bold">Investida Aprimorada</div>
              <div className="text-[10.5px] text-muted-foreground">
                +{investida.moveBonusMeters}m mov · +{investida.hitBonus} acerto · {investida.onHit}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playClickSound();
              addLog('combat', `🏃 ${c.name}: declarou Investida — +${investida.moveBonusMeters}m mov, +${investida.hitBonus} acerto, no acerto Disputa de Atletismo (falha → Caído).`);
              toast.success('Investida declarada — verifique log.');
            }}
            className="text-xs font-bold rounded px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Executar Investida
          </button>
        </div>
      )}

      {/* Físico Aperfeiçoado — variant toggle */}
      {hasFisico && fisicoTalent?.variants && (
        <div className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span className="font-bold">Físico Aperfeiçoado</span>
            <span className="text-[10.5px] text-muted-foreground">
              · escolha ativa muda passivos
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {fisicoTalent.variants.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => {
                  setTalentChoice(c.id, 'tal-fisico-aperfeicoado', 'variant', v.key);
                  playClickSound();
                  toast.success(`Físico Aperfeiçoado → ${v.label}`);
                  addLog('system', `⚙️ ${c.name}: Físico Aperfeiçoado alterado para "${v.label}".`);
                }}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10.5px] transition',
                  fisicoChoice === v.key
                    ? 'border-primary/60 bg-primary/15 text-primary font-bold'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
                )}
                title={v.description}
              >
                [{v.key}] {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Discurso Motivador — botão de ação que abre dialog multi-select */}
      {hasDiscurso && discursoCalc && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 text-xs flex-1 min-w-[180px]">
            <span className="text-accent"><Megaphone className="h-3.5 w-3.5" /></span>
            <div>
              <div className="font-bold">Discurso Motivador (Ação Completa)</div>
              <div className="text-[10.5px] text-muted-foreground">
                {discursoCalc.eligible
                  ? `+${discursoCalc.tempHP} PV Temp por aliado · 1 buff por criatura por Descanso Longo`
                  : 'Requer Persuasão treinada.'}
                {discursoCalc.eligible && (c.discursoMotivadorUsedOn?.length ?? 0) > 0 && (
                  <span className="ml-1 text-amber-400">
                    · {c.discursoMotivadorUsedOn?.length ?? 0} já buffado(s)
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!discursoCalc.eligible) {
                playErrorSound();
                toast.error('Persuasão treinada é obrigatória.');
                return;
              }
              playClickSound();
              setDiscursoOpen(true);
            }}
            disabled={!discursoCalc.eligible}
            className={cn(
              'text-xs font-bold rounded px-2 py-1 transition',
              discursoCalc.eligible
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            Discursar
          </button>
        </div>
      )}

      {hasDiscurso && (
        <DiscursoMotivadorDialog
          source={c}
          open={discursoOpen}
          onOpenChange={setDiscursoOpen}
        />
      )}
    </div>
  );
}
