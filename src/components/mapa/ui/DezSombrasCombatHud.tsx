import { Moon, Sparkles, Swords, X } from 'lucide-react';
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import type { Character } from '@/types';
import { ControladorInvocacoesSection } from '@/components/fichas/ControladorInvocacoesSection';
import { RituaisDezSombrasSection } from '@/components/fichas/RituaisDezSombrasSection';
import { possuiTecnicaDezSombras } from '@/lib/controlador/dezSombras';
import { findMyCharacter } from '@/lib/myCharacter';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';
import { ShikigamiOwnerPanel } from './ShikigamiOwnerPanel';
import '@/components/invocacoes/invocations.css';
import './dezSombrasCombatHud.css';

type AbaCombate = 'invocar' | 'campo' | 'rituais';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function personagemTemDezSombras(character: Character | undefined): character is Character {
  return Boolean(character && (
    possuiTecnicaDezSombras(character.tecnicaAmaldicoada) ||
    character.invocacoesConhecidas?.some(invocacao => invocacao.pacoteRegras === 'dez-sombras')
  ));
}

export function DezSombrasCombatHud({ open, onOpenChange }: Props) {
  const role = useRoleStore(state => state.role);
  const activeProfileId = useProfileStore(state => state.activeProfileId);
  const characters = useCharacterStore(state => state.characters);
  const selectedEntity = useMapStore(state => state.selectedIds.length === 1
    ? state.entities[state.selectedIds[0]]
    : undefined);
  const entities = useMapStore(state => state.entities);
  const sourceTokenId = useShikigamiHudStore(state => state.sourceTokenId);
  const [pinnedCharacterId, setPinnedCharacterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AbaCombate>('invocar');
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);

  const playerCharacter = role === 'PLAYER'
    ? findMyCharacter(characters, activeProfileId) ?? undefined
    : undefined;
  const ritualOwner = selectedEntity?.ritualId
    ? characters.find(character => character.rituaisDezSombras?.some(ritual => ritual.id === selectedEntity.ritualId))
    : undefined;
  const linkedCharacterId = selectedEntity?.ownerCharId ?? selectedEntity?.characterId;
  const selectedCharacter = linkedCharacterId
    ? characters.find(character => character.id === linkedCharacterId)
    : undefined;
  const mapCandidate = ritualOwner ?? selectedCharacter;
  const candidate = role === 'PLAYER' ? playerCharacter : mapCandidate;
  const character = role === 'PLAYER'
    ? playerCharacter
    : open && pinnedCharacterId
      ? characters.find(item => item.id === pinnedCharacterId)
      : candidate;
  const canUseHud = personagemTemDezSombras(open ? character : candidate);

  const activeTokens = useMemo(() => {
    if (!character) return [];
    return Object.values(entities).filter(entity => {
      if (entity.ownerCharId !== character.id || !entity.invocationId || entity.invocationSubordinate) return false;
      if (entity.invocationState === 'derrotada' || entity.invocationState === 'dissipada') return false;
      return character.invocacoesConhecidas?.some(invocacao =>
        invocacao.id === entity.invocationId && invocacao.pacoteRegras === 'dez-sombras',
      ) ?? false;
    });
  }, [character, entities]);

  const selectedMapToken = selectedEntity?.invocationId && selectedEntity.ownerCharId === character?.id &&
    activeTokens.some(token => token.id === selectedEntity.id)
    ? selectedEntity
    : undefined;
  const activeToken = activeTokens.find(token => token.id === activeTokenId) ?? selectedMapToken ?? activeTokens[0];
  const pendingRitualCount = character?.rituaisDezSombras?.filter(ritual =>
    ritual.estado === 'solicitado' || ritual.estado === 'em_andamento',
  ).length ?? 0;

  useEffect(() => {
    if (selectedMapToken) setActiveTokenId(selectedMapToken.id);
    else if (!activeTokens.some(token => token.id === activeTokenId)) setActiveTokenId(activeTokens[0]?.id ?? null);
  }, [selectedMapToken?.id, activeTokens, activeTokenId]);

  useEffect(() => {
    if (!open) setPinnedCharacterId(null);
    else if (!personagemTemDezSombras(character)) onOpenChange(false);
  }, [open, character, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (useShikigamiHudStore.getState().interaction) {
        useShikigamiHudStore.getState().cancelInteraction();
      } else {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [open, onOpenChange]);

  if (!role || !canUseHud || !candidate && !open || !character) return null;

  const stopMapEvent = (event: SyntheticEvent) => event.stopPropagation();
  const openHud = () => {
    if (role === 'MASTER' && candidate) setPinnedCharacterId(candidate.id);
    setActiveTab(selectedMapToken ? 'campo' : 'invocar');
    if (selectedMapToken) setActiveTokenId(selectedMapToken.id);
    onOpenChange(true);
  };
  const closeHud = () => onOpenChange(false);
  const selectToken = (tokenId: string) => {
    setActiveTokenId(tokenId);
    useShikigamiHudStore.getState().setSourceTokenId(tokenId);
    useMapStore.getState().setSelected([tokenId]);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="dez-sombras-hud-trigger"
        onClick={event => { event.stopPropagation(); openHud(); }}
        onPointerDown={stopMapEvent}
        onPointerUp={stopMapEvent}
        onDoubleClick={stopMapEvent}
        onContextMenu={stopMapEvent}
        aria-expanded="false"
        aria-controls="dez-sombras-combat-hud"
        data-testid="dez-sombras-hud-trigger"
      >
        <Moon aria-hidden="true" size={17} />
        <span>Dez Sombras</span>
        {activeTokens.length > 0 && <span className="dez-sombras-hud-trigger-count">{activeTokens.length}</span>}
      </button>
    );
  }

  return (
    <aside
      id="dez-sombras-combat-hud"
      className="dez-sombras-combat-hud"
      aria-label={`HUD de combate das Dez Sombras de ${character.name}`}
      data-testid="dez-sombras-combat-hud"
      onPointerDown={stopMapEvent}
      onPointerMove={stopMapEvent}
      onPointerUp={stopMapEvent}
      onClick={stopMapEvent}
      onDoubleClick={stopMapEvent}
      onContextMenu={stopMapEvent}
      onWheel={event => {
        if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
      }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          if (useShikigamiHudStore.getState().interaction) {
            useShikigamiHudStore.getState().cancelInteraction();
          } else {
            closeHud();
          }
        }
      }}
    >
      <header className="dez-sombras-combat-hud__header">
        <div className="dez-sombras-combat-hud__identity">
          <span className="dez-sombras-combat-hud__mark" aria-hidden="true"><Moon size={17} /></span>
          <div className="dez-sombras-combat-hud__heading">
            <h2>Dez Sombras</h2>
            <p>{character.name}{role === 'MASTER' ? ' · Mestre' : ''}</p>
          </div>
        </div>
        <button type="button" className="dez-sombras-combat-hud__close" onClick={closeHud} aria-label="Fechar HUD das Dez Sombras" title="Fechar HUD">
          <X aria-hidden="true" size={17} />
        </button>
      </header>

      <nav className="dez-sombras-combat-hud__nav" aria-label="Seções do HUD das Dez Sombras">
        <button type="button" aria-pressed={activeTab === 'invocar'} onClick={() => setActiveTab('invocar')}>
          <Sparkles aria-hidden="true" size={14} /> Invocar
        </button>
        <button type="button" aria-label={`Em campo: ${activeTokens.length}`} aria-pressed={activeTab === 'campo'} onClick={() => setActiveTab('campo')}>
          <Swords aria-hidden="true" size={14} />
          <span className="dez-sombras-combat-hud__nav-label-wide">Em campo</span>
          <span className="dez-sombras-combat-hud__nav-label-compact">Ativas</span>
          <span className="dez-sombras-combat-hud__nav-count">{activeTokens.length}</span>
        </button>
        <button type="button" aria-pressed={activeTab === 'rituais'} onClick={() => setActiveTab('rituais')}>
          <Moon aria-hidden="true" size={14} /> Rituais {pendingRitualCount > 0 && <span className="dez-sombras-combat-hud__nav-count">{pendingRitualCount}</span>}
        </button>
      </nav>

      <div className="dez-sombras-combat-hud__content" key={`${character.id}:${activeTab}`}>
        {activeTab === 'invocar' && (
          <div className="invocations-workspace dez-sombras-combat-hud__invocations">
            <ControladorInvocacoesSection
              character={character}
              view="owned"
              canViewCatalog={false}
              scopeToTenShadows
            />
          </div>
        )}

        {activeTab === 'campo' && (
          <section className="dez-sombras-combat-hud__field" aria-label="Invocações ativas e habilidades">
            {activeTokens.length === 0 ? (
              <div className="dez-sombras-combat-hud__empty">
                <Swords aria-hidden="true" size={20} />
                <h3>Nenhuma sombra em campo</h3>
                <p>As habilidades de combate aparecem aqui quando uma sombra for invocada. Você também pode consultar as ações nas fichas disponíveis em Invocar.</p>
                <button type="button" onClick={() => setActiveTab('invocar')}>Ir para Invocar</button>
              </div>
            ) : (
              <>
                <div className="dez-sombras-combat-hud__token-list" aria-label="Escolher shikigami ativo">
                  {activeTokens.map(token => {
                    const model = character.invocacoesConhecidas?.find(invocacao => invocacao.id === token.invocationId);
                    const label = token.label || model?.apelido?.trim() || model?.nome || 'Shikigami';
                    const selected = activeToken?.id === token.id;
                    return (
                      <button key={token.id} type="button" aria-pressed={selected} onClick={() => selectToken(token.id)} title={`Abrir habilidades de ${label}`}>
                        <span>{label}</span>
                        <small>PV {token.hp ?? '—'}/{token.hpMax ?? model?.hpMaximo ?? '—'}</small>
                      </button>
                    );
                  })}
                </div>
                {activeToken && (
                  <div className="dez-sombras-combat-hud__abilities">
                    <h3>Habilidades e comandos</h3>
                    {role === 'PLAYER' && activeToken.masterControlled ? (
                      <p className="dez-sombras-combat-hud__master-control" role="status">Esta sombra está sob controle do Mestre. Você poderá comandá-la quando o Mestre liberar o controle.</p>
                    ) : sourceTokenId !== activeToken.id ? (
                      <p className="dez-sombras-combat-hud__source-hint" role="status">Selecione este token no mapa para carregar os comandos de combate.</p>
                    ) : (
                      <ShikigamiOwnerPanel key={activeToken.id} tokenId={activeToken.id} />
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeTab === 'rituais' && (
          <div className="invocations-workspace dez-sombras-combat-hud__rituals">
            <RituaisDezSombrasSection character={character} />
          </div>
        )}
      </div>
    </aside>
  );
}
