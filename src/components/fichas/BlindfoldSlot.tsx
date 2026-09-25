/**
 * 👓 Slot de Venda — cobertura ocular passiva.
 *
 * Quando equipado, dispara o gatilho Omni `aoVendar`; ao remover, dispara
 * `aoDescobrir`. O conteúdo do slot é livre (string descritiva — venda,
 * óculos escuros, etc.). Reproduz a mecânica do Seis Olhos.
 *
 * 🆕 Regra de combate: a 1ª alternância (vendar OU descobrir) na rodada é
 * Ação Livre. A 2ª+ vira Ação Bônus — pede confirmação ao jogador.
 * O contador `blindfoldTogglesThisRound` é resetado em `aoFinalizarRodadaCombate`
 * e ao iniciar/encerrar combate.
 */
import { useState } from 'react';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

interface Props {
  character: Character;
}

export function BlindfoldSlot({ character }: Props) {
  const setBlindfold = useCharacterStore((s) => s.setBlindfold);
  const inCombat = useCombatStore((s) => s.inCombat);
  const [draft, setDraft] = useState('Venda');
  const [pending, setPending] = useState<{ slot: string | null; willEquip: boolean } | null>(null);
  const equipado = !!character.blindfoldSlot;
  const toggles = character.blindfoldTogglesThisRound ?? 0;
  const nextIsCommonAction = inCombat && toggles >= 1;

  const tryToggle = (slot: string | null) => {
    const willEquip = !!slot;
    const isToggle = equipado !== willEquip;
    if (isToggle && nextIsCommonAction) {
      setPending({ slot, willEquip });
      return;
    }
    setBlindfold(character.id, slot);
  };

  const confirmPending = () => {
    if (pending) setBlindfold(character.id, pending.slot);
    setPending(null);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`w-full h-8 rounded-lg border px-3 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              equipado
                ? 'border-purple-400/40 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25'
                : 'border-muted-foreground/30 bg-muted/20 text-muted-foreground hover:bg-muted/40'
            }`}
            title={equipado ? `Vendado: ${character.blindfoldSlot}` : 'Sem cobertura ocular'}
          >
            {equipado ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {equipado ? `Vendado: ${character.blindfoldSlot}` : 'Slot Venda — vazio'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-2">
          <div className="text-xs font-semibold">Slot de Venda</div>
          <div className="text-[11px] text-muted-foreground">
            Descreva a cobertura. Equipar/remover dispara <code>aoVendar</code> /{' '}
            <code>aoDescobrir</code> no Omni.
          </div>
          {inCombat && (
            <div
              className={`text-[10.5px] rounded-md px-2 py-1 border ${
                nextIsCommonAction
                  ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                  : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              {nextIsCommonAction ? (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Já alternou {toggles}×: próximo uso = <strong>Ação Bônus</strong>.
                </span>
              ) : (
                <>1ª alternância na rodada = <strong>Ação Livre</strong>.</>
              )}
            </div>
          )}
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex.: Venda, Óculos escuros…"
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => tryToggle(draft.trim() || 'Venda')}
              disabled={equipado && character.blindfoldSlot === (draft.trim() || 'Venda')}
            >
              Vendar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={() => tryToggle(null)}
              disabled={!equipado}
            >
              Descobrir
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Esta ação consumirá uma Ação Bônus
            </AlertDialogTitle>
            <AlertDialogDescription>
              {character.name} já alternou o slot de venda {toggles}× nesta rodada. A 1ª
              vez é Ação Livre; a partir da 2ª, vira <strong>Ação Bônus</strong>.
              <br />
              Deseja prosseguir e {pending?.willEquip ? 'vendar' : 'descobrir'} mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>
              Sim, gastar Ação Bônus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
