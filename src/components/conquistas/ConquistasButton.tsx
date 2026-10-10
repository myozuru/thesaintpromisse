import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiarioQuests } from '@/components/economia/DiarioQuests';

export function ConquistasButton({ charId, nome, master }: { charId: string; nome: string; master: boolean }) {
  const [aberto, setAberto] = useState(false);

  return (
    <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
      <Button size="xs" variant="outline" className="border-accent/50 text-accent" title={`Conquistas de ${nome}`} onClick={() => setAberto(true)}>
        <Trophy aria-hidden />
        Conquistas
      </Button>
      {aberto && <DiarioQuests aberto onClose={() => setAberto(false)} charId={charId} master={master} abaInicial="conquistas" />}
    </span>
  );
}