import { ReacoesAtivasOverlay } from '@/components/omni/ReacoesAtivasOverlay';
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GuardaSincronizadaWatcher, InspiracaoWatcher } from "@/components/fichas/SuporteNivel4Sections";
import { Global3DDiceOverlay } from "@/components/dice-physics/Global3DDiceOverlay";
import { AmizadePromptDialog } from "@/components/fichas/AmizadePromptDialog";
import { NegacaoPromptDialog } from "@/components/fichas/SuporteNegacaoSections";
import { SintonizacaoPromptDialog } from "@/components/fichas/SuporteSintonizacaoSections";
import { OutraChancePromptDialog } from "@/components/fichas/SuporteNivel6Sections";
import { ProtetorPromptDialog } from "@/components/fichas/ProtetorPromptDialog";
import { MobilidadePromptDialog } from "@/components/fichas/SuporteRepertorioMobilidadeSections";
import { DesvendarCDDialog } from "@/components/fichas/SuporteComandoTerrenoSections";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";
import { useDailyOmniRecharge } from "@/hooks/useDailyOmniRecharge";
import { installSafeLocalStorage } from "@/lib/safeLocalStorage";
import { installOmniItemBankSync } from "@/lib/omni/syncItemBank";
import { iniciarWatcherEngine } from "@/lib/omni/watcherEngine";
import { validateCursedAptitudeCatalog } from "@/lib/auraAptitudes";
import { hasWorkspaceCloud } from "@/integrations/supabase/safeClient";
import Index from "@/pages/Index";
import { AuthSync } from "@/components/AuthSync";

function MultiplayerBridge() {
  useMultiplayerSync();
  useDailyOmniRecharge();
  return null;
}

function RuntimeSetup() {
  useEffect(() => {
    installSafeLocalStorage();

    try {
      installOmniItemBankSync();
    } catch (error) {
      console.warn("[boot] Não foi possível sincronizar o banco Omni:", error);
    }

    try {
      iniciarWatcherEngine();
    } catch (error) {
      console.warn("[boot] Não foi possível iniciar o motor de gatilhos:", error);
    }

    try {
      const errors = validateCursedAptitudeCatalog();
      if (errors.length > 0) {
        console.warn(`[CursedAptitudeCatalog] ${errors.length} problema(s) detectado(s).`);
      }
    } catch (error) {
      console.warn("[boot] Não foi possível validar o catálogo:", error);
    }
  }, []);

  return null;
}

export default function TpFichasApp() {
  return (
    <AppErrorBoundary>
      <TooltipProvider>
        <RuntimeSetup />
        <AuthSync />
        {hasWorkspaceCloud ? <MultiplayerBridge /> : null}
        <Toaster />
        <ReacoesAtivasOverlay />
        <Sonner />
        <Index />
        <Global3DDiceOverlay />
        <AmizadePromptDialog />
        <OutraChancePromptDialog />
        <NegacaoPromptDialog />
        <SintonizacaoPromptDialog />
        <ProtetorPromptDialog />
        <MobilidadePromptDialog />
        <DesvendarCDDialog />
        <GuardaSincronizadaWatcher />
        <InspiracaoWatcher />
      </TooltipProvider>
    </AppErrorBoundary>
  );
}
