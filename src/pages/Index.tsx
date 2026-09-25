import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Header, getTabsForRole } from "@/components/Header";
import { RoleSelect } from "@/components/RoleSelect";
import { useRoleStore } from "@/stores/useRoleStore";
import { LogPanel } from "@/components/LogPanel";
import { DataHub } from "@/components/fab/DataHub";
import { GlobalClockTicker } from "@/components/chronos/GlobalClockTicker";
import { JjkSwirl } from "@/components/JjkSwirl";
import { TestRequestOverlay } from "@/components/fichas/TestRequestOverlay";
import { Dice6, ZoomIn, ZoomOut } from "lucide-react";
import { playOpeningSound, playTabSound } from "@/lib/sounds";
import { useLogStore } from "@/stores/useLogStore";
import { useMapStore } from "@/stores/useMapStore";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TabId } from "@/components/Header";

const ZOOM_SCALES = [55, 65, 75, 85, 100, 115] as const;
const ZOOM_LABELS = ["55%", "65%", "75%", "85%", "100%", "115%"];

// Lazy-load every module so the initial page is light and each module is parsed
// only on first access. Once mounted, we keep them alive (see render below) so
// returning to a tab is instant.
const FichasModule = lazy(() => import("@/components/fichas/FichasModule").then(m => ({ default: m.FichasModule })));
const ChronosModule = lazy(() => import("@/components/chronos/ChronosModule").then(m => ({ default: m.ChronosModule })));
const ItensModule = lazy(() => import("@/components/itens/ItensModule").then(m => ({ default: m.ItensModule })));
const BausModule = lazy(() => import("@/components/baus/BausModule").then(m => ({ default: m.BausModule })));
const CalendarioModule = lazy(() => import("@/components/calendario/CalendarioModule").then(m => ({ default: m.CalendarioModule })));
const SistemaModule = lazy(() => import("@/components/sistema/SistemaModule").then(m => ({ default: m.SistemaModule })));
const GuiaModule = lazy(() => import("@/components/guia/GuiaModule").then(m => ({ default: m.GuiaModule })));
const SpellProposalsModule = lazy(() => import("@/components/fichas/SpellProposalsModule").then(m => ({ default: m.SpellProposalsModule })));
const MoneyModule = lazy(() => import("@/components/money/MoneyModule").then(m => ({ default: m.MoneyModule })));
const CardapiosModule = lazy(() => import("@/components/cardapios/CardapiosModule").then(m => ({ default: m.CardapiosModule })));
const OmniModule = lazy(() => import("@/components/omni/OmniModule").then(m => ({ default: m.OmniModule })));
const CatalogoModule = lazy(() => import("@/components/catalogo/CatalogoModule").then(m => ({ default: m.CatalogoModule })));
const TestesModule = lazy(() => import("@/components/testes/TestesModule").then(m => ({ default: m.TestesModule })));
const MapaModule = lazy(() => import("@/components/mapa/MapaModule").then(m => ({ default: m.MapaModule })));
const GrimorioModule = lazy(() => import("@/components/grimorio/GrimorioModule").then(m => ({ default: m.GrimorioModule })));

const MODULES: Record<TabId, React.ComponentType> = {
  relogio: ChronosModule,
  fichas: FichasModule,
  testes: TestesModule,
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

const TABS: TabId[] = ["relogio", "fichas", "testes", "feiticos-players", "itens", "baus", "money", "cardapios", "calendario", "omni", "catalogo", "mapa", "grimorio", "sistema", "guia"];

export default function Index() {
  const role = useRoleStore((s) => s.role);
  const [activeTab, setActiveTab] = useState<TabId>("fichas");
  const [hubOpen, setHubOpen] = useState(false);
  const [displayedTab, setDisplayedTab] = useState<TabId>("fichas");
  const [transitioning, setTransitioning] = useState(false);
  // Track every tab the user has ever opened — we keep them mounted (just
  // hidden) so returning to them is instant and avoids re-mount cost.
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(["fichas"]));
  const [zoomIndex, setZoomIndex] = useState(4);
  const panelCollapsed = useLogStore((s) => s.panelCollapsed);
  const setPanelCollapsed = useLogStore((s) => s.setPanelCollapsed);
  const isMobile = useIsMobile();
  const zoomScale = ZOOM_SCALES[zoomIndex] / 100;
  const immersive = useMapStore((s) => s.immersive);
  const mapaImmersive = immersive && activeTab === 'mapa';

  // Auto-collapse log panel on mobile
  useEffect(() => {
    if (isMobile && !panelCollapsed) {
      setPanelCollapsed(true);
    }
  }, [isMobile]);

  // If player role and current tab is restricted, redirect to fichas.
  // 'testes' não aparece como aba mas é acessível ao mestre pelo botão R.
  useEffect(() => {
    if (!role) return;
    const allowed = new Set<TabId>(getTabsForRole(role));
    if (role === 'MASTER') allowed.add('testes');
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
    setTimeout(() => setFadingOut(true), 800);
    setTimeout(() => setShowSplash(false), 2000);
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

  if (showSplash) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-background flex items-center justify-center overflow-hidden cursor-pointer select-none"
        onClick={handleSplashClick}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <JjkSwirl
            size={600}
            className="transition-all ease-out"
            style={{ transitionDuration: '3000ms', opacity: 0.1, transform: "scale(1) rotate(0deg)" }}
            
          />
        </div>

        {flashActive && (
          <div
            className="absolute inset-0 z-50 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at center, hsla(270, 100%, 50%, 0.9), hsla(270, 100%, 50%, 0.5), transparent 70%)",
              animation: "splash-flash 1.2s ease-out forwards",
            }}
          />
        )}

        <div
          className="text-center z-10 transition-all ease-out"
          style={{
            transitionDuration: '1500ms',
            opacity: fadingOut ? 0 : 1,
            transform: fadingOut ? "scale(1.2)" : "scale(1)",
          }}
        >
          <h1
            className="text-4xl md:text-6xl text-primary tracking-[0.2em] neon-flicker"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              textShadow:
                "0 0 20px hsla(270, 100%, 50%, 0.8), 0 0 60px hsla(270, 100%, 50%, 0.4), 0 0 100px hsla(270, 100%, 50%, 0.2)",
            }}
          >
            The Promisse
          </h1>
          <p
            className="mt-3 text-muted-foreground text-lg"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}
          >
            Seja Bem-Vindo
          </p>
          {!flashActive && (
            <p className="mt-8 text-xs text-muted-foreground animate-pulse">Clique em qualquer lugar para entrar</p>
          )}
        </div>
      </div>
    );
  }

  if (!role) {
    return <RoleSelect />;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden animate-fade-in w-full">
        {!mapaImmersive && (
          <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
            <JjkSwirl size={1400} style={{ opacity: 0.18 }} />
          </div>
        )}

        <GlobalClockTicker />

        {!mapaImmersive && <Header activeTab={activeTab} onTabChange={handleTabChange} />}

        <main
          className="relative z-10 transition-[padding] duration-300"
          style={{
            width: '100%',
            paddingTop: mapaImmersive ? 0 : '3.5rem',
            paddingLeft: mapaImmersive ? 0 : (isMobile ? '0.5rem' : (panelCollapsed ? '3rem' : '17rem')),
            paddingRight: mapaImmersive ? 0 : '1rem',
            paddingBottom: mapaImmersive ? 0 : (panelCollapsed ? '5rem' : '6rem'),
          }}
        >
          <div
            className={mapaImmersive ? '' : 'px-2 py-3 sm:px-3 sm:py-4'}
            style={{
              opacity: transitioning ? 0 : 1,
              transform: transitioning ? 'translateY(6px)' : 'translateY(0)',
              transition:
                'opacity 320ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'opacity, transform',
            }}
          >
            <Suspense fallback={null}>
              {(Array.from(mountedTabs) as TabId[]).map((id) => {
                const Module = MODULES[id];
                const isActive = id === displayedTab;
                return (
                  <div key={id} hidden={!isActive} aria-hidden={!isActive}>
                    <Module />
                  </div>
                );
              })}
            </Suspense>
          </div>
        </main>

        {!mapaImmersive && <LogPanel />}

      {!mapaImmersive && (
        <div className="fixed bottom-4 sm:bottom-6 right-20 sm:right-24 z-50 flex items-center gap-1 rounded-full bg-card border border-border shadow-lg px-2 py-1">
          <button
            onClick={zoomDown}
            disabled={zoomIndex === 0}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs font-mono text-muted-foreground w-8 text-center">
            {ZOOM_LABELS[zoomIndex]}
          </span>
          <button
            onClick={zoomUp}
            disabled={zoomIndex === ZOOM_SCALES.length - 1}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      )}

      {!mapaImmersive && (
        <button
          onClick={() => setHubOpen(!hubOpen)}
          className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg glow-primary-strong hover:scale-110 transition-all duration-300"
        >
          <Dice6 className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}

        <DataHub open={hubOpen} onClose={() => setHubOpen(false)} />
        <TestRequestOverlay />

    </div>
  );
}
