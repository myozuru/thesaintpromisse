import { useState, useEffect } from 'react';
import { playFichaCreateSound, playCategoryToggleSound, playDiceSound } from '@/lib/sounds';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useLogStore } from '@/stores/useLogStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { CharacterCategory, Character } from '@/types';
import { CharacterCard, getAttrModifier } from './CharacterCard';
import { TemporaryCharacterCard } from './TemporaryCharacterCard';
import { CharacterWizard } from './CharacterWizard';
import { ReactionPromptOverlay } from './ReactionPromptOverlay';
import { MercadoLauncher } from './MercadoLauncher';
import { rollD20Com } from '@/lib/dice';
import { applyLutadorProgression } from '@/lib/lutadorProgression';
import { initOriginPools } from '@/lib/originLevelEngine';
import { Plus, ChevronDown, Wand2, ScrollText, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { ModuleHeader } from '@/components/ui/module-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { CombatBar } from '@/components/combat/CombatBar';

const CATEGORIES_FULL: { id: CharacterCategory; label: string; color: string }[] = [
  { id: 'PLAYER', label: 'Players', color: 'text-neon-green' },
  { id: 'INIMIGO', label: 'Inimigos', color: 'text-neon-red' },
  { id: 'NPC', label: 'NPCs', color: 'text-neon-yellow' },
];

export function FichasModule() {
  const role = useRoleStore((s) => s.role);
  const isPlayer = role === 'PLAYER';
  const CATEGORIES = isPlayer
    ? CATEGORIES_FULL.filter((c) => c.id === 'PLAYER')
    : CATEGORIES_FULL;
  const { characters: allCharacters, addCharacter, addTemporaryCharacter, resetActions, isNameTaken } = useCharacterStore();
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  // Player só vê fichas PLAYER criadas por players (ou legadas sem createdBy).
  // Fichas temporárias são privadas por perfil: cada player só vê as próprias.
  // Mestre vê tudo (inclusive fichas criadas por players).
  const characters = isPlayer
    ? allCharacters.filter((c) => {
        if (c.category !== 'PLAYER' || c.createdBy === 'MASTER' || c.hiddenFromPlayers) return false;
        if (c.temporary) return !!activeProfileId && c.profileId === activeProfileId;
        return !c.profileId || c.profileId === activeProfileId;
      })
    : allCharacters;
  const combat = useCombatStore();
  const chronosDay = useChronosStore((s) => s.day);
  const chronosMonth = useChronosStore((s) => s.month);
  const chronosYear = useChronosStore((s) => s.year);
  const chronosHours = useChronosStore((s) => s.hours);
  const tickDailyReset = useCharacterStore((s) => s.tickDailyReset);
  const tickHunger = useCharacterStore((s) => s.tickHunger);
  const addLog = useLogStore((s) => s.addLog);
  const [newName, setNewName] = useState('');
  const nameDuplicate = newName.trim().length > 0 && isNameTaken(newName);
  const [newCategory, setNewCategory] = useState<CharacterCategory>('PLAYER');
  const [openTabs, setOpenTabs] = useState<Record<string, boolean>>({ PLAYER: true, INIMIGO: false, NPC: false });
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch] = useState('');
  const searchLower = search.trim().toLowerCase();
  const visibleCharacters = searchLower
    ? characters.filter((c) => c.name.toLowerCase().includes(searchLower))
    : characters;

  // Auto-reset de usos com escopo `daily` sempre que o dia do Chronos mudar.
  useEffect(() => {
    const key = `${chronosYear}-${String(chronosMonth).padStart(2, '0')}-${String(chronosDay).padStart(2, '0')}`;
    tickDailyReset(key);
  }, [chronosDay, chronosMonth, chronosYear, tickDailyReset]);

  // Sistema de Fome: a cada hora absoluta do Chronos, descontar 1 barrinha.
  // Calcula uma "hora absoluta" monotônica para todo o calendário.
  useEffect(() => {
    const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const yearsHours = Math.max(0, chronosYear - 1) * 365 * 24;
    const monthsHours = DAYS_IN_MONTH.slice(0, Math.max(0, chronosMonth - 1)).reduce((a, b) => a + b, 0) * 24;
    const daysHours = Math.max(0, chronosDay - 1) * 24;
    const hourKey = yearsHours + monthsHours + daysHours + chronosHours;
    tickHunger(hourKey);
  }, [chronosHours, chronosDay, chronosMonth, chronosYear, tickHunger]);


  // Limite de 1 ficha PRINCIPAL por perfil de player. Fichas temporárias são ilimitadas.
  const playerCharCount = allCharacters.filter(
    (c) => c.category === 'PLAYER' && c.createdBy !== 'MASTER' && !c.temporary
      && (!c.profileId || c.profileId === activeProfileId),
  ).length;
  const playerLimitReached = isPlayer && playerCharCount >= 1;

  const handleWizardComplete = (char: Character) => {
    if (isNameTaken(char.name)) {
      toast({
        title: 'Nome já em uso',
        description: `Já existe uma ficha chamada "${char.name}". Escolha outro nome.`,
        variant: 'destructive',
      });
      return;
    }
    if (isPlayer && playerLimitReached) {
      setShowWizard(false);
      return;
    }
    const activeProfileId = useProfileStore.getState().activeProfileId;
    const charToCreate = isPlayer
      ? { ...char, category: 'PLAYER' as CharacterCategory, createdBy: 'PLAYER' as const, ...(activeProfileId ? { profileId: activeProfileId } : {}) }
      : { ...char, createdBy: 'MASTER' as const };
    let finalChar = charToCreate;
    try {
      const isFeiticeiro = charToCreate.characterClass === 'Feiticeiro';
      const lut = isFeiticeiro ? applyLutadorProgression(charToCreate, charToCreate.level ?? 1, charToCreate.specialization, 0) : { patch: {}, newTrackers: [] };
      const originPools = initOriginPools(charToCreate);
      finalChar = {
        ...charToCreate,
        ...lut.patch,
        ...originPools,
        pendingLevelChoices: [
          ...((charToCreate.pendingLevelChoices ?? []) as any[]),
          ...lut.newTrackers,
        ],
      };
    } catch { /* noop */ }
    useCharacterStore.setState((state) => ({ characters: [...state.characters, finalChar] }));
    addLog('system', `🧙 Ficha criada via assistente: ${finalChar.name}`);
    setShowWizard(false);
    setOpenTabs((prev) => ({ ...prev, [finalChar.category]: true }));
  };

  const handleCreate = () => {
    console.log('[handleCreate] click', { newName, isPlayer, playerLimitReached, playerCharCount, role });
    if (!newName.trim()) { console.warn('[handleCreate] aborted: empty name'); return; }
    if (isPlayer && playerLimitReached) { console.warn('[handleCreate] aborted: player limit'); return; }
    if (isNameTaken(newName)) {
      toast({
        title: 'Nome já em uso',
        description: `Já existe uma ficha chamada "${newName.trim()}".`,
        variant: 'destructive',
      });
      return;
    }
    const cat = isPlayer ? 'PLAYER' : newCategory;
    try {
      playFichaCreateSound();
    } catch (e) { console.error('[handleCreate] sound error', e); }
    try {
      addCharacter(newName.trim(), cat, isPlayer ? 'PLAYER' : 'MASTER');
      console.log('[handleCreate] addCharacter OK');
    } catch (e) {
      console.error('[handleCreate] addCharacter THREW:', e);
    }
    setNewName('');
    setOpenTabs((prev) => ({ ...prev, [cat]: true }));
  };

  const handleCreateTemp = () => {
    const raw = newName.trim() || (isPlayer ? 'Ficha Rápida' : 'Ficha Temporária');
    // Fichas temporárias não têm limite por player (só a ficha principal tem).
    if (isNameTaken(raw)) {
      toast({
        title: 'Nome já em uso',
        description: `Já existe uma ficha chamada "${raw}".`,
        variant: 'destructive',
      });
      return;
    }
    try { playFichaCreateSound(); } catch { /* noop */ }
    const profileId = isPlayer ? useProfileStore.getState().activeProfileId ?? undefined : undefined;
    const newId = addTemporaryCharacter(raw, isPlayer ? 'PLAYER' : 'MASTER', profileId);
    if (newId) {
      addLog('system', `⏱️ Ficha temporária criada: ${raw}`);
      setNewName('');
      setOpenTabs((prev) => ({ ...prev, PLAYER: true }));
    }
  };

  const toggleTab = (id: string) => { playCategoryToggleSound(); setOpenTabs((prev) => ({ ...prev, [id]: !prev[id] })); };

  // Handlers de combate foram movidos para <CombatBar /> (componente compartilhado).


  return (
    <div className="space-y-4">
      {/* Fase 9 — Overlay global de prompts de reação (Anuladora/Absorção/Redirecionadora) */}
      <ReactionPromptOverlay />
      <ModuleHeader
        icon={ScrollText}
        title="Fichas"
        subtitle={`${characters.length} ${characters.length === 1 ? 'personagem' : 'personagens'}`}
        description={isPlayer ? 'Sua ficha de jogador.' : 'Painel do Mestre — todas as fichas e combate.'}
        actions={
          isPlayer && characters[0] ? (
            <MercadoLauncher characterId={characters[0].id} />
          ) : !isPlayer && allCharacters[0] ? (
            <MercadoLauncher characterId={allCharacters[0].id} />
          ) : undefined
        }
      />
      {/* Combat bar (Mestre apenas) — extraído para componente compartilhado com o Mapa */}
      {!isPlayer && <CombatBar />}

      {/* Quick create bar */}
      <div className="flex flex-col gap-2">
        {isPlayer && playerLimitReached && (
          <div className="rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground text-center">
            Você já possui sua ficha principal. Ainda pode criar fichas temporárias à vontade.
          </div>
        )}
        <div className="flex items-center gap-2">
          {isPlayer ? (
            <>
              <Button
                variant="mystic"
                onClick={() => setShowWizard(true)}
                disabled={playerLimitReached}
                title={playerLimitReached ? 'Exclua sua ficha principal para criar outra' : 'Criar ficha passo a passo'}
              >
                <Wand2 className="h-4 w-4" /> Assistente de criação de ficha
              </Button>
              <Button
                variant="outline"
                onClick={handleCreateTemp}
                title="Ficha temporária (sem ficha pronta — você controla HP/PE/RD manualmente)"
              >
                <Clock className="h-4 w-4" /> Ficha temporária
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1 flex flex-col gap-0.5">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Nome do Personagem"
                  className={cn(nameDuplicate && 'border-destructive focus-visible:ring-destructive/60')}
                />
                {nameDuplicate && (
                  <span className="text-[10px] text-destructive pl-1">Nome já em uso.</span>
                )}
              </div>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as CharacterCategory)}
                className="h-10 rounded-md border border-border bg-background/60 px-3 text-sm text-foreground hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <Button size="icon" onClick={handleCreate} disabled={!newName.trim() || nameDuplicate} title="Criar ficha">
                <Plus className="h-5 w-5" />
              </Button>
              <Button variant="mystic" onClick={() => setShowWizard(true)} title="Criar ficha passo a passo">
                <Wand2 className="h-4 w-4" /> Assistente
              </Button>
              <Button
                variant="outline"
                onClick={handleCreateTemp}
                disabled={nameDuplicate}
                title="Ficha temporária — só HP/PE/RD/anotações (sem aptidões/feitiços)"
              >
                <Clock className="h-4 w-4" /> Ficha temporária
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      {showWizard && (
        <CharacterWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />
      )}

      {/* Player: ficha principal + temporárias */}
      {isPlayer ? (
        characters.length > 0 ? (
          <div className="flex flex-col gap-4">
            {characters.map((c) => (
              c.temporary
                ? <TemporaryCharacterCard key={c.id} character={c} />
                : <CharacterCard key={c.id} character={c} />
            ))}
          </div>
        ) : (
          <div className="card-enigmatic flex items-center justify-center rounded-xl border border-border p-12">
            <p className="text-muted-foreground text-sm">Crie sua ficha para começar.</p>
          </div>
        )
      ) : (
        <>
          {/* Barra de busca de fichas (Mestre) */}
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar ficha por nome..."
            containerClassName="max-w-md"
          />

          {/* Category collapsible tabs (Mestre) */}
          {CATEGORIES.map((cat) => {
            const chars = visibleCharacters.filter((c) => c.category === cat.id);
            const isOpen = openTabs[cat.id] ?? false;
            return (
              <section key={cat.id} className="card-enigmatic rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleTab(cat.id)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-secondary/30 transition-all duration-300"
                >
                  <span
                    className={cn('text-sm font-bold uppercase tracking-[0.12em]', cat.color)}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {cat.label}
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">{chars.length}</Badge>
                  <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform duration-500', isOpen && 'rotate-180')} />
                </button>
                <div
                  className="grid transition-[grid-template-rows,opacity] duration-500 ease-in-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0 }}
                >
                  <div className="overflow-hidden">
                    {chars.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground italic">Nenhum personagem nesta categoria.</p>
                    ) : (
                      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start p-4 border-t border-border/50">
                        {chars.map((c) => (
                          c.temporary
                            ? <TemporaryCharacterCard key={c.id} character={c} />
                            : <CharacterCard key={c.id} character={c} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}

          {characters.length === 0 && (
            <div className="card-enigmatic flex items-center justify-center rounded-xl border border-border p-12">
              <p className="text-muted-foreground text-sm">Crie um personagem para começar.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
