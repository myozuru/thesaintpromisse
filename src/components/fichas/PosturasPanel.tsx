/** Assumir Postura — aprender, entrar e ver a postura em vigor. */
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { Button } from '@/components/ui/button';
import {
  POSTURAS, getPostura, podeAprender, podeEntrar, patchEntrar, posturaAtiva,
  posturaUsosRestantes, posturaUsosMax, posturasLimite, type PosturaId,
} from '@/lib/posturas';

export function PosturasPanel({ charId, inCombat, round }: { charId: string; inCombat: boolean; round: number }) {
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === charId));
  const update = useCharacterStore((s) => s.updateCharacter);
  const addLog = useLogStore((s) => s.addLog);
  if (!c) return null;
  const known = (c.posturasAprendidas ?? []) as PosturaId[];
  const ativa = posturaAtiva(c);
  const limite = posturasLimite(c.level ?? 1);

  const aprender = (id: PosturaId) => {
    const fresh = useCharacterStore.getState().characters.find((x) => x.id === charId)!;
    if (!podeAprender(fresh, id).ok) return;
    update(charId, { posturasAprendidas: [...(fresh.posturasAprendidas ?? []), id] });
    addLog('combat', `📜 ${c.name} aprendeu a Postura ${getPostura(id)?.name}.`);
  };
  const entrar = (id: PosturaId) => {
    const fresh = useCharacterStore.getState().characters.find((x) => x.id === charId)!;
    const chk = podeEntrar(fresh, id, { inCombat });
    if (!chk.ok) { addLog('combat', `🚫 Postura: ${chk.reason}`); return; }
    update(charId, patchEntrar(fresh, id, round));
    addLog('combat', `🧘 ${c.name} assume a Postura ${getPostura(id)?.name} (Ação Bônus) até o fim da rodada ${round + 9}.`);
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-background/40 p-2 space-y-1.5" data-testid="posturas">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-foreground">Posturas</span>
        <span className="text-[11px] text-muted-foreground">Usos: {posturaUsosRestantes(c)}/{posturaUsosMax(c)}</span>
      </div>
      <div className="text-[11px] text-muted-foreground" data-testid="postura-ativa">
        {ativa
          ? <>Em vigor: <b className="text-primary">{getPostura(ativa)?.name}</b> até a rodada {c.posturaAtiva?.untilRound} — {getPostura(ativa)?.summary}</>
          : 'Nenhuma postura em vigor.'}
      </div>
      {known.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {known.map((id) => {
            const chk = podeEntrar(c, id, { inCombat });
            return (
              <Button key={id} size="sm" variant={ativa === id ? 'default' : 'outline'} disabled={!chk.ok}
                title={chk.reason} onClick={() => entrar(id)}>
                Entrar: {getPostura(id)?.name}
              </Button>
            );
          })}
        </div>
      )}
      {known.length < limite && (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Aprender postura ({known.length}/{limite}):</div>
          <div className="flex flex-wrap gap-1">
            {POSTURAS.map((p) => {
              const chk = podeAprender(c, p.id);
              const ok = chk.ok && p.pronta;
              return (
                <Button key={p.id} size="sm" variant="ghost" disabled={!ok}
                  title={!p.pronta ? 'Em breve' : chk.reason ?? p.summary} onClick={() => aprender(p.id)}>
                  Aprender {p.name}{!p.pronta ? ' (em breve)' : chk.reason?.startsWith('Requer') ? ` (${chk.reason})` : ''}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
