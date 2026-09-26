import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { applyApoiar } from '@/lib/suporteAbilities';
import { useAmizadePromptStore } from '@/lib/suporteNivel2';
import { Heart } from 'lucide-react';

/** Pergunta, ao fim do turno do Suporte, se quer Apoiar o Amigo (ação livre). */
export function AmizadePromptDialog() {
  const prompt = useAmizadePromptStore((s) => s.prompt);
  const close = useAmizadePromptStore((s) => s.close);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  if (!prompt) return null;
  const sup = characters.find((x) => x.id === prompt.supporterId);
  const friend = characters.find((x) => x.id === prompt.friendId);
  if (!sup || !friend) return null;

  const confirm = async () => {
    await applyApoiar(sup, friend);
    addLog('combat', `💞 ${sup.name} termina o turno ao lado de ${friend.name} e o Apoia (ação livre — Amizade Inquebrável).`);
    close();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Heart className="h-4 w-4 text-primary" /> Amizade Inquebrável
        </div>
        <p className="text-sm text-foreground">
          {sup.name} terminou o turno ao lado de <b>{friend.name}</b>. Apoiar como ação livre?
        </p>
        <p className="text-xs text-muted-foreground">Vantagem no próximo teste de perícia, até o início do próximo turno de {sup.name}.</p>
        <div className="flex gap-2">
          <button onClick={close} className="flex-1 rounded-md border border-border py-2 text-sm text-foreground hover:bg-secondary/40">Não</button>
          <button onClick={confirm} className="flex-1 rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Apoiar</button>
        </div>
      </div>
    </div>
  );
}
