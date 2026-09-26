/**
 * CombatBar — barra de combate compartilhada (Fichas + Mapa).
 *
 * Extraída de FichasModule para que a mesma iniciativa apareça em ambas as abas.
 * Visível apenas para o Mestre (role !== 'PLAYER').
 *
 * Estado vem de useCombatStore + useCharacterStore (fonte única de verdade).
 */
import { Swords, SkipForward, X, Users, Move } from 'lucide-react';
import { useProfileStore } from '@/stores/useProfileStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { rollD20Com } from '@/lib/dice';
import { playDiceSound } from '@/lib/sounds';
import { getAttrModifier } from '@/components/fichas/CharacterCard';
import { Button } from '@/components/ui/button';
import { TurnTimer } from './TurnTimer';
import { cn } from '@/lib/utils';

interface Props {
  /** Largura do container — útil quando colocado em painéis estreitos. */
  className?: string;
  /**
   * 'bar' (default): barra larga clássica do Mestre (usada em Fichas).
   * 'master': painel compacto do Mestre no canto direito (Mapa).
   * 'player': mini-lista para players.
   */
  variant?: 'bar' | 'master' | 'player';
}

export function CombatBar({ className, variant = 'bar' }: Props) {
  const role = useRoleStore((s) => s.role);
  const isPlayer = role === 'PLAYER';
  const allCharacters = useCharacterStore((s) => s.characters);
  const resetActions = useCharacterStore((s) => s.resetActions);
  const combat = useCombatStore();
  const addLog = useLogStore((s) => s.addLog);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);

  if ((variant === 'bar' || variant === 'master') && isPlayer) return null;


  if (variant === 'player') {
    if (!combat.inCombat) return null;
    const activeEntry = combat.initiativeOrder[combat.currentTurnIndex];
    const activeChar = activeEntry
      ? allCharacters.find((c) => c.id === activeEntry.charId)
      : null;
    // O turno é "meu" se o personagem ativo está vinculado ao meu perfil,
    // ou (legado) se ele é PC sem perfil e eu sou o único PC sem perfil.
    const playerChars = allCharacters.filter((c) => c.category === 'PLAYER');
    const legacyPcs = playerChars.filter((c) => !c.profileId);
    void legacyPcs;
    const isMyTurn = !!activeChar && !!activeProfileId && activeChar.profileId === activeProfileId;
    const endTurn = () => {
      const { endOfRound } = combat.nextTurn();
      if (endOfRound) resetActions();
      addLog('initiative', `⏭️ ${activeChar?.name ?? 'Player'} finalizou o turno.`);
    };

    return (
      <div className={cn('pointer-events-none', className)}>
        <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/70 backdrop-blur-md px-2 py-2 shadow-md min-w-[160px] pointer-events-auto">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono px-1 flex items-center gap-1">
            <span>Rodada {combat.round}</span>
            {combat.freeformMode && (
              <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[9px] font-bold border border-amber-500/40">
                MODO LIVRE
              </span>
            )}
          </div>
          <TurnTimer layout="mini" className="px-1" />
          {combat.initiativeOrder.map((entry, idx) => {
            const isActive = idx === combat.currentTurnIndex;
            return (
              <div
                key={entry.charId}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                  isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground/80',
                )}
              >
                <span className="w-4 text-[10px] font-mono opacity-60">{idx + 1}.</span>
                <span className="truncate flex-1">{entry.charName}</span>
                <span className="text-[11px] font-mono font-bold tabular-nums opacity-80">{entry.total}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
              </div>
            );
          })}
          {isMyTurn && (
            <button
              onClick={endTurn}
              className="mt-1 h-7 rounded-md bg-amber-500/20 hover:bg-amber-500/40 text-amber-100 text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <SkipForward className="h-3.5 w-3.5" /> Finalizar turno
            </button>
          )}
        </div>
      </div>
    );
  }

  const participantsCount = combat.participantIds.length;

  const handleStartCombat = async () => {
    const participants = allCharacters.filter((c) => combat.participantIds.includes(c.id));
    if (participants.length === 0) return;
    playDiceSound();
    const entries = [] as { charId: string; charName: string; roll: number; bonus: number; total: number }[];
    for (const c of participants) {
      const d20 = await rollD20Com(c.id);
      const dexAttr = c.attributes.find((a) => a.name.toLowerCase() === 'destreza');
      const dexMod = dexAttr ? getAttrModifier(dexAttr.value) : 0;
      const bonus = c.initiativeBonus + dexMod;
      entries.push({ charId: c.id, charName: c.name, roll: d20, bonus, total: d20 + bonus });
    }
    combat.startCombat(entries);
    resetActions();
    addLog(
      'initiative',
      `⚔️ Combate iniciado! Ordem de iniciativa:\n${entries
        .sort((a, b) => b.total - a.total)
        .map((e, i) => `${i + 1}. ${e.charName}: d20(${e.roll}) + ${e.bonus} = ${e.total}`)
        .join('\n')}`,
    );
  };

  const handleNextTurn = () => {
    const { endOfRound } = combat.nextTurn();
    if (endOfRound) {
      resetActions();
      addLog('initiative', `🔄 Rodada ${combat.round} encerrada! Ações resetadas. Rodada ${combat.round} iniciada.`);
    }
    const current = combat.initiativeOrder[combat.currentTurnIndex];
    if (current) {
      addLog('initiative', `▶️ Turno de ${current.charName}`);
      const currentChar = allCharacters.find((c) => c.id === current.charId);
      if (currentChar?.category === 'INIMIGO') {
        const players = allCharacters.filter((c) => c.category === 'PLAYER');
        for (const pc of players) {
          import('@/lib/auraEffects').then(({ getEnemyTurnAuraPrompts }) => {
            const prompts = getEnemyTurnAuraPrompts(pc);
            for (const p of prompts) {
              addLog(
                'system',
                `✨ ${p.auraName} de ${p.ownerName} → se ${current.charName} estiver em ${p.radiusM}m, faça TR de ${p.saveType}. Em falha: ${p.onFailText}`,
              );
            }
          });
        }
      }
    }
  };

  const handleEndCombat = () => {
    const participantNames = combat.initiativeOrder.map((e) => e.charName).join(', ');
    combat.endCombat();
    resetActions();
    addLog(
      'initiative',
      `🏁 Combate encerrado! Cena resetada para: ${participantNames || '—'}. Usos /cena, escudo, hpSacrificed e Kokusen zerados.`,
    );
  };

  const toggleParticipant = (charId: string) => combat.toggleParticipant(charId);

  if (variant === 'master') {
   return (
    <div className={cn('pointer-events-auto', className)}>
      {!combat.inCombat ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/80 backdrop-blur-md px-2.5 py-2 shadow-md min-w-[200px] max-w-[240px]">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            <Users className="h-3 w-3 text-primary" />
            <span className="flex-1">Participantes</span>
            <span className="font-bold text-primary">{participantsCount}</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-[180px] overflow-y-auto">
            {allCharacters.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">Nenhuma ficha.</span>
            ) : (
              allCharacters.map((c) => {
                const active = combat.participantIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleParticipant(c.id)}
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-all truncate max-w-full',
                      active
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-secondary/20 border-border text-muted-foreground hover:bg-secondary/40',
                    )}
                    title={c.name}
                  >
                    {c.name}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="mystic"
              size="sm"
              onClick={handleStartCombat}
              disabled={participantsCount === 0}
              className="h-7 text-xs flex-1"
            >
              <Swords className="h-3.5 w-3.5" /> Iniciar
            </Button>
            <button
              type="button"
              onClick={() => combat.setFreeformMode(!combat.freeformMode)}
              title={combat.freeformMode ? 'Modo Livre ativo — desligar' : 'Ativar Modo Livre (sem cap de movimento, sem hotbar)'}
              className={cn(
                'h-7 px-2 rounded-md border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1',
                combat.freeformMode
                  ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                  : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50',
              )}
            >
              <Move className="h-3 w-3" /> Livre
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-lg border border-primary/40 bg-background/80 backdrop-blur-md px-2 py-2 shadow-md min-w-[200px]">
          <div className="flex items-center gap-1.5 px-1">
            <Swords className="h-3 w-3 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono flex-1">
              Rodada <span className="text-primary font-bold">{combat.round}</span>
            </span>
            <button
              onClick={handleEndCombat}
              className="text-destructive/70 hover:text-destructive transition-colors"
              title="Encerrar combate"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <TurnTimer layout="compact" className="px-1" />
          {combat.initiativeOrder.map((entry, idx) => {
            const isActive = idx === combat.currentTurnIndex;
            return (
              <div
                key={entry.charId}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                  isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground/80',
                )}
              >
                <span className="w-4 text-[10px] font-mono opacity-60">{idx + 1}.</span>
                <span className="truncate flex-1">{entry.charName}</span>
                <span className="text-[11px] font-mono font-bold tabular-nums opacity-80">{entry.total}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
              </div>
            );
          })}
          <Button
            variant="mystic"
            size="sm"
            onClick={handleNextTurn}
            className="h-7 text-xs mt-1"
          >
            <SkipForward className="h-3.5 w-3.5" /> Próximo Turno
          </Button>
        </div>
      )}
    </div>
   );
  }

  // variant === 'bar' — barra larga clássica (Fichas)
  return (
    <div className={cn('card-enigmatic rounded-2xl border border-border overflow-hidden', className)}>
      {!combat.inCombat ? (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Participantes do próximo combate
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              {participantsCount} selecionado(s)
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allCharacters.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhuma ficha disponível.</span>
            ) : (
              allCharacters.map((c) => {
                const active = combat.participantIds.includes(c.id);
                const catColor =
                  c.category === 'PLAYER' ? 'neon-green' : c.category === 'INIMIGO' ? 'neon-red' : 'neon-yellow';
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleParticipant(c.id)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                      active
                        ? `bg-primary/15 border-primary text-primary shadow-sm shadow-primary/20`
                        : `bg-secondary/20 border-border text-muted-foreground hover:bg-secondary/40 hover:text-${catColor}`,
                    )}
                    title={active ? 'Remover do combate' : 'Adicionar ao combate'}
                  >
                    {c.name}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="mystic"
              size="lg"
              onClick={handleStartCombat}
              disabled={participantsCount === 0}
            >
              <Swords className="h-5 w-5" /> Iniciar Combate (Rolar Iniciativa)
            </Button>
            <button
              type="button"
              onClick={() => combat.setFreeformMode(!combat.freeformMode)}
              title="Modo Livre: o combate roda normal (iniciativa/turnos), mas o mapa não limita movimento e a hotbar do player some. Use para mestrar dano/ações por fora."
              className={cn(
                'h-11 px-4 rounded-lg border-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all',
                combat.freeformMode
                  ? 'border-amber-500 bg-amber-500/20 text-amber-200 shadow-md shadow-amber-500/20'
                  : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50',
              )}
            >
              <Move className="h-4 w-4" />
              {combat.freeformMode ? 'Modo Livre ativo' : 'Ativar Modo Livre'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border-b border-primary/20">
            <span className="text-base font-bold text-primary flex items-center gap-2">
              <Swords className="h-5 w-5" /> Combate
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-muted-foreground bg-secondary/50 rounded-lg px-3 py-1 border border-border">
                Rodada <span className="text-primary font-bold">{combat.round}</span>
              </span>
              <Button variant="destructive" size="sm" onClick={handleEndCombat}>
                <X className="h-3 w-3" /> Encerrar
              </Button>
            </div>
          </div>

          <div className="px-4 py-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {combat.initiativeOrder.map((entry, idx) => {
                const isActive = idx === combat.currentTurnIndex;
                const char = allCharacters.find((ch) => ch.id === entry.charId);
                const catColor =
                  char?.category === 'PLAYER'
                    ? 'neon-green'
                    : char?.category === 'INIMIGO'
                      ? 'neon-red'
                      : 'neon-yellow';
                return (
                  <div
                    key={entry.charId}
                    className={cn(
                      'relative rounded-xl px-4 py-2.5 text-sm font-bold border-2 transition-all duration-300 min-w-[100px] text-center',
                      isActive
                        ? `bg-primary/20 text-primary border-primary shadow-lg shadow-primary/30 ring-2 ring-primary/30 scale-105`
                        : `bg-secondary/30 text-muted-foreground border-border/50 hover:bg-secondary/50`,
                    )}
                  >
                    {isActive && (
                      <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary animate-pulse shadow-lg shadow-primary/50" />
                    )}
                    <div className="text-sm font-bold">{entry.charName}</div>
                    <div
                      className={cn(
                        'text-lg font-mono font-black',
                        isActive ? 'text-primary' : `text-${catColor}`,
                      )}
                    >
                      {entry.total}
                    </div>
                    <div className="text-xs text-muted-foreground opacity-70">
                      d20({entry.roll}) +{entry.bonus}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 bg-primary/5 rounded-xl px-4 py-2.5 border border-primary/20">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-foreground font-bold flex-1">
                Turno de {combat.initiativeOrder[combat.currentTurnIndex]?.charName}
              </span>
              <Button variant="mystic" size="sm" onClick={handleNextTurn}>
                <SkipForward className="h-4 w-4" /> Próximo Turno
              </Button>
            </div>

            <TurnTimer layout="full" className="bg-primary/5 rounded-xl px-4 py-2.5 border border-primary/20" />
          </div>
        </div>
      )}
    </div>
  );
}
