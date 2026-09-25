import { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { playClickSound, playSuccessSound } from '@/lib/sounds';

interface PendingLock {
  /** Texto curto do contexto, ex.: "Corpo a Corpo", "CD", "TR de Reflexos" */
  context: string;
  /** Nome do atributo que será vinculado, ex.: "Força" */
  attrName: string;
  /** Callback executado quando o usuário confirma. */
  onConfirm: () => void;
}

/**
 * Hook de confirmação de vínculo de atributo (irreversível).
 *
 * Uso:
 *   const { request, dialog } = useAttributeLockConfirm();
 *   ...
 *   request({ context: 'CD', attrName: 'Inteligência', onConfirm: () => updateCharacter(...) });
 *   ...
 *   {dialog}
 */
export function useAttributeLockConfirm() {
  const [pending, setPending] = useState<PendingLock | null>(null);

  const request = useCallback((p: PendingLock) => {
    playClickSound();
    setPending(p);
  }, []);

  const close = useCallback(() => setPending(null), []);

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    pending.onConfirm();
    playSuccessSound();
    setPending(null);
  }, [pending]);

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(v) => { if (!v) close(); }}>
      <AlertDialogContent className="border-primary/40 bg-card/95 backdrop-blur">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-cinzel text-primary">
            <AlertTriangle className="h-4 w-4" />
            Confirmar Vínculo de Atributo
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-destructive">
                Atenção: esta escolha é permanente. Após confirmar, você NÃO poderá trocar o atributo vinculado a esta jogada.
              </p>
              <p className="text-muted-foreground">Você está prestes a vincular:</p>
              <div className="rounded-md border border-primary/30 bg-primary/10 p-2 font-mono text-foreground">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pending?.context}</span>
                  <span className="text-primary font-bold">{pending?.attrName}</span>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => playClickSound()}>
            Revisar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Confirmar e travar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { request, dialog };
}
