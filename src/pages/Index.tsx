import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { Header, getTabsForRole } from "@/components/Header";
import { AuthScreen } from "@/components/AuthScreen";
import { useRoleStore } from "@/stores/useRoleStore";
import { LogPanel } from "@/components/LogPanel";
import { DataHub } from "@/components/fab/DataHub";
import { GlobalClockTicker } from "@/components/chronos/GlobalClockTicker";
import { JjkSwirl } from "@/components/JjkSwirl";
import { TestRequestOverlay } from "@/components/fichas/TestRequestOverlay";
import { ReactionPromptOverlay } from "@/components/fichas/ReactionPromptOverlay";
import { TestRequestPanel } from "@/components/testes/TestRequestPanel";
import { Dice6, ZoomIn, ZoomOut } from "lucide-react";
import { playOpeningSound, playTabSound } from "@/lib/sounds";
import { useLogStore } from "@/stores/useLogStore";
import { useMapStore } from "@/stores/useMapStore";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TabId } from "@/components/Header";
import { DiarioQuests } from '@/components/economia/DiarioQuests';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { findMyCharacter } from '@/lib/myCharacter';

const ZOOM_SCALES = [55, 65, 75, 85, 100, 115] as const;
const ZOOM_LABELS = ["55%", "65%", "75%", "85%", "100%", "115%"];

// Lazy-load every module so the initial page is light and each module is parsed
// only on first access. Once mounted, we keep them alive (see render below) so
// returning to a tab is instant.
const FichasModule = lazyWithReload(() => import("@/components/fichas/FichasModule").then(m => ({ default: m.FichasModule })));
const InvocacoesModule = lazyWithReload(() => import("@/components/invocacoes/InvocacoesModule").then(m => ({ default: m.InvocacoesModule })));
const ChronosModule = lazyWithReload(() => import("@/components/chronos/ChronosModule").then(m => ({ default: m.ChronosModule })));
const ItensModule = lazyWithReload(() => import("@/components/itens/ItensModule").then(m => ({ default: m.ItensModule })));
const BausModule = lazyWithReload(() => import("@/components/baus/BausModule").then(m => ({ default: m.BausModule })));
const CalendarioModule = lazyWithReload(() => import("@/components/calendario/CalendarioModule").then(m => ({ default: m.CalendarioModule })));
const SistemaModule = lazyWithReload(() => import("@/components/sistema/SistemaModule").then(m => ({ default: m.SistemaModule })));
const GuiaModule = lazyWithReload(() => import("@/components/guia/GuiaModule").then(m => ({ default: m.GuiaModule })));
const SpellProposalsModule = lazyWithReload(() => import("@/components/fichas/SpellProposalsModule").then(m => ({ default: m.SpellProposalsModule })));
const MoneyModule = lazyWithReload(() => import("@/components/money/MoneyModule").then(m => ({ default: m.MoneyModule })));
const CardapiosModule = lazyWithReload(() => import("@/components/cardapios/CardapiosModule").then(m => ({ default: m.CardapiosModule })));
const OmniModule = lazyWithReload(() => import("@/components/omni/OmniModule").then(m => ({ default: m.OmniModule })));
const CatalogoModule = lazyWithReload(() => import("@/components/catalogo/CatalogoModule").then(m => ({ default: m.CatalogoModule })));
const MapaModule = lazyWithReload(() => import("@/components/mundo/MapaHub").then(m => ({ default: m.MapaHub })));
const GrimorioModule = lazyWithReload(() => import("@/components/grimorio/GrimorioModule").then(m => ({ default: m.GrimorioModule })));

const MODULES: Partial<Record<TabId, React.ComponentType>> = {
  relogio: ChronosModule,
  fichas: FichasModule,
  invocacoes: InvocacoesModule,
  "feiticos-players": SpellProposalsModule,
  itens: ItensModule,
  baus: BausModule,
  money: MoneyModule,
  cardapios: CardapiosModule,
  calendario: CalendarioModule,
  omni: OmniModule,
  catalogo: CatalogoModule,
  mapa: MapaModule,
  grimorio: GrimorioModule,
  sistema: SistemaModule,
  guia: GuiaModule,
};

const TABS: TabId[] = ["relogio", "fichas", "invocacoes", "feiticos-players", "itens", "baus", "money", "cardapios", "calendario", "omni", "catalogo", "mapa", "grimorio", "sistema", "guia"];

export default function Index() {
  const role = useRoleStore((s) => s.role);
  const characters = useCharacterStore((s) => s.characters);
  const profileId = useProfileStore((s) => s.activeProfileId);
  const myCharacter = findMyCharacter(characters, profileId);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("fichas");
  const [hubOpen, setHubOpen] = useState(false);
  const [testsOpen, setTestsOpen] = useState(false);
  const [displayedTab, setDisplayedTab] = useState<TabId>("fichas");
  const [transitioning, setTransitioning] = useState(false);
  // Track every tab the user has ever opened — we keep them mounted (just
  // hidden) so returning to them is instant and avoids re-mount cost.
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(["fichas"]));
  const [zoomIndex, setZoomIndex] = useState(4);
  const panelCollapsed = useLogStore((s) => s.panelCollapsed);
  const setPanelCollapsed = useLogStore((s) => s.setPanelCollapsed);
  const invocationLogPreference = useRef<{ wasCollapsed: boolean; collapsedForInvocations: boolean } | null>(null);
  const isMobile = useIsMobile();
  const zoomScale = ZOOM_SCALES[zoomIndex] / 100;
  const immersive = useMapStore((s) => s.immersive);
  const mapaImmersive = immersive && activeTab === 'mapa';
  const workspaceLeftInset = mapaImmersive
    ? '0px'
    : isMobile
      ? (panelCollapsed ? '2.5rem' : '0.5rem')
      : (panelCollapsed ? '2.5rem' : '16rem');
  const workspaceStyle = {
    width: '100%',
    paddingTop: mapaImmersive ? 0 : '4rem',
    paddingLeft: workspaceLeftInset,
    paddingRight: mapaImmersive ? 0 : '1rem',
    paddingBottom: mapaImmersive ? 0 : (panelCollapsed ? '5rem' : '6rem'),
    '--workspace-left-inset': workspaceLeftInset,
  } as CSSProperties;

  // Auto-collapse log panel on mobile
  useEffect(() => {
    if (isMobile && !panelCollapsed) {
      setPanelCollapsed(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (activeTab === "invocacoes") {
      if (!invocationLogPreference.current) {
        const shouldCollapse = !panelCollapsed;
        invocationLogPreference.current = { wasCollapsed: panelCollapsed, collapsedForInvocations: shouldCollapse };
        if (shouldCollapse) setPanelCollapsed(true);
      } else if (invocationLogPreference.current.collapsedForInvocations && !panelCollapsed) {
        // An explicit user expansion while Invocations is open becomes the saved preference.
        invocationLogPreference.current = { wasCollapsed: false, collapsedForInvocations: false };
      }
      return;
    }

    const preference = invocationLogPreference.current;
    if (!preference) return;
    invocationLogPreference.current = null;
    if (preference.collapsedForInvocations && panelCollapsed) {
      setPanelCollapsed(isMobile ? true : preference.wasCollapsed);
    }
  }, [activeTab, isMobile, panelCollapsed, setPanelCollapsed]);

  // If player role and current tab is restricted, redirect to fichas.
  useEffect(() => {
    if (!role) return;
    const allowed = new Set<TabId>(getTabsForRole(role));
    if (!allowed.has(activeTab)) {
      setActiveTab('fichas');
      setDisplayedTab('fichas');
    }
  }, [role, activeTab]);

  const zoomUp = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_SCALES.length - 1));
  const zoomDown = () => setZoomIndex((i) => Math.max(i - 1, 0));

  useEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = `${ZOOM_SCALES[zoomIndex]}%`;
    return () => {
      root.style.fontSize = previousFontSize;
    };
  }, [zoomIndex]);

  const [showSplash, setShowSplash] = useState(true);
  const [flashActive, setFlashActive] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const handleSplashClick = () => {
    if (flashActive) return;
    playOpeningSound();
    setFlashActive(true);
    setTimeout(() => setFadingOut(true), 260);
    setTimeout(() => setShowSplash(false), 850);
  };

  const handleTabChange = (tab: TabId) => {
    if (tab === activeTab) return;
    const tabIndex = TABS.indexOf(tab);
    playTabSound(tabIndex);
    setTransitioning(true);
    // Mount the new tab immediately (in the hidden tree) so its parse/render
    // work happens during the fade, not after — avoids the visible freeze.
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    // Longer fade-out so the mount work hides under the transition,
    // then a generous fade-in for a gradual reveal.
    setTimeout(() => {
      setDisplayedTab(tab);
      setActiveTab(tab);
      setTimeout(() => setTransitioning(false), 60);
    }, 320);
  };

  useEffect(() => {
    const navegar = (event: Event) => {
      const tab = (event as CustomEvent<TabId>).detail;
      if (role && getTabsForRole(role).includes(tab)) handleTabChange(tab);
    };
    window.addEventListener('app:navigate', navegar);
    return () => window.removeEventListener('app:navigate', navegar);
  }, [activeTab, role]);

  if (showSplash) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-background flex items-center justify-center overflow-hidden cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background splash-screen"
        role="button"
        tabIndex={0}
        aria-label="Entrar em The Saint Promisse"
        aria-describedby="splash-instructions"
        onClick={handleSplashClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleSplashClick();
          }
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <JjkSwirl
            size={600}
            animated={false}
            className="splash-swirl"
            style={{ opacity: 0.1 }}
            
          />
        </div>

        {flashActive && (
          <div
            className="absolute inset-0 z-50 pointer-events-none splash-flash"
            style={{
              background:
                "radial-gradient(circle at center, var(--splash-flash-start), var(--splash-flash-middle), transparent 70%)",
            }}
          />
        )}

        <div
          className="splash-content text-center z-10"
          style={{
            opacity: fadingOut ? 0 : 1,
            transform: fadingOut ? "scale(0.985) translateY(-6px)" : "scale(1)",
          }}
        >
          <h1
            className="mx-auto w-[calc(100vw-2rem)] text-[clamp(2rem,5vw,3.75rem)] leading-[1.2] text-primary tracking-[0.04em] md:tracking-[0.06em] text-balance splash-title"
            style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              textShadow:
                "0 0 20px hsla(270, 100%, 50%, 0.8), 0 0 60px hsla(270, 100%, 50%, 0.4), 0 0 100px hsla(270, 100%, 50%, 0.2)",
            }}
          >
            The Saint Promisse
          </h1>
          <p
            className="mt-3 text-[clamp(1.125rem,2vw,1.375rem)] leading-[1.5] text-muted-foreground splash-subtitle"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic" }}
          >
            Seja Bem-Vindo
          </p>
          {!flashActive && (
            <p id="splash-instructions" className="mx-auto mt-8 max-w-[calc(100vw-3rem)] px-4 text-sm font-medium leading-[1.6] text-muted-foreground text-pretty md:text-base splash-invitation" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
              Clique em qualquer lugar para entrar
              <span className="sr-only"> Pressione Enter ou Espaço para entrar.</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!role) {
    return <AuthScreen />;
  }

  return (
    <div className="atlas-shell min-h-screen bg-background relative overflow-x-hidden animate-fade-in w-full">
        {!mapaImmersive && (
          <div className="atlas-atmosphere fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
            <JjkSwirl size={1400} style={{ opacity: 0.12 }} />
          </div>
        )}

        <GlobalClockTicker />

        <Header immersive={mapaImmersive} activeTab={activeTab} onTabChange={handleTabChange} testsOpen={testsOpen} onToggleTests={() => setTestsOpen((open) => !open)} onOpenDiary={() => setDiaryOpen(true)} />
        {diaryOpen && <DiarioQuests aberto onClose={() => setDiaryOpen(false)} charId={myCharacter?.id} master={role === 'MASTER'} />}

        <main
          className="atlas-immersive-shell atlas-workspace relative z-10 transition-[padding] duration-300"
          style={workspaceStyle}
        >
          <div
            className={mapaImmersive ? '' : 'px-2 py-3 sm:px-3 sm:py-4'}
            style={{
              opacity: transitioning ? 0 : 1,
               transform: transitioning ? 'translateY(6px)' : 'none',
              transition:
                'opacity 320ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
               willChange: transitioning ? 'opacity, transform' : 'auto',
            }}
          >
            <Suspense
              fallback={(
                <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground" role="status" aria-live="polite">
                  Carregando módulo…
                </div>
              )}
            >
              {(Array.from(mountedTabs) as TabId[]).map((id) => {
                const Module = MODULES[id];
                const isActive = id === displayedTab;
                if (!Module) return null;
                return (
                  <div key={id} hidden={!isActive} aria-hidden={!isActive}>
                    <Module />
                  </div>
                );
              })}
            </Suspense>
          </div>
        </main>

        <LogPanel immersive={mapaImmersive} />

        {activeTab !== 'mapa' && (
          <div
            aria-hidden={mapaImmersive || undefined}
            inert={mapaImmersive}
            className={`atlas-immersive-shell fixed bottom-4 sm:bottom-6 right-20 sm:right-24 z-50 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-lg transition-all duration-300 ease-in-out ${mapaImmersive ? 'translate-y-3 opacity-0 invisible pointer-events-none' : 'translate-y-0 opacity-100 visible'}`}
          >
            <button
              aria-label="Diminuir zoom"
              onClick={zoomDown}
              disabled={zoomIndex === 0}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span aria-live="polite" aria-atomic="true" className="w-10 text-center text-sm font-mono text-muted-foreground">
              {ZOOM_LABELS[zoomIndex]}
            </span>
            <button
              aria-label="Aumentar zoom"
              onClick={zoomUp}
              disabled={zoomIndex === ZOOM_SCALES.length - 1}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        )}

        <button
          aria-label={hubOpen ? "Fechar painel de dados" : "Abrir painel de dados"}
          aria-expanded={hubOpen}
          aria-hidden={mapaImmersive || undefined}
          inert={mapaImmersive}
          onClick={() => setHubOpen(!hubOpen)}
          className={`atlas-immersive-shell fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg glow-primary-strong hover:scale-110 transition-all duration-300 ease-in-out ${mapaImmersive ? 'translate-y-3 opacity-0 invisible pointer-events-none' : 'translate-y-0 opacity-100 visible'}`}
        >
          <Dice6 className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        <DataHub open={hubOpen} onClose={() => setHubOpen(false)} />
        {role === 'MASTER' && <TestRequestPanel open={testsOpen} onClose={() => setTestsOpen(false)} />}
        <TestRequestOverlay />
        <ReactionPromptOverlay />

    </div>
  );
}
