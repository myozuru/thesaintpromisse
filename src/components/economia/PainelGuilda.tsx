/** Aba Guilda do Diário: fundar, gerenciar membros e ver renome. */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuestStore } from '@/stores/useQuestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { guildaDe, limitarRenome, nivelGuilda } from '@/lib/economia/guilda';

const EMBLEMAS = ['⚔️', '🛡️', '🦅', '🐺', '🐉', '🌙', '🔥', '💀'];

export function PainelGuilda({ charId, master }: { charId?: string; master: boolean }) {
  const guildas = useQuestStore((s) => s.guildas) ?? {};
  const chars = useCharacterStore((s) => s.characters);
  const st = useQuestStore.getState();
  const [nome, setNome] = useState('');
  const [emblema, setEmblema] = useState('⚔️');
  const jogadores = chars.filter((c) => c.profileId && !c.temporary);
  const nomeDe = (id: string) => chars.find((c) => c.id === id)?.name ?? '?';
  const emGuilda = (id: string) => !!guildaDe(guildas, id);
  const lista = master ? Object.values(guildas).filter((g) => !g.deletedAt) : [guildaDe(guildas, charId)].filter(Boolean);

  return (
    <div className="space-y-3 text-sm">
      {!master && charId && !guildaDe(guildas, charId) && (
        <div className="space-y-2 rounded border border-border p-2" data-fundar-guilda>
          <b>Fundar guilda</b>
          <Input aria-label="Nome da guilda" placeholder="Ex.: Bando do Falcão" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div className="flex flex-wrap gap-1">{EMBLEMAS.map((e) => (
            <button key={e} type="button" onClick={() => setEmblema(e)} className={`rounded border px-2 py-1 text-lg ${emblema === e ? 'border-primary bg-primary/10' : 'border-border'}`}>{e}</button>
          ))}</div>
          <Button size="sm" disabled={!nome.trim()} onClick={() => { st.criarGuilda(nome, emblema, charId, []); setNome(''); }}>Fundar</Button>
        </div>
      )}
      {!lista.length && (master || !charId) && <p className="py-6 text-center text-muted-foreground">Nenhuma guilda criada.</p>}
      {lista.map((g) => {
        if (!g) return null;
        const nv = nivelGuilda(g.renome);
        const souLider = g.liderId === charId;
        const pode = master || g.membros.includes(charId ?? '');
        return (
          <div key={g.id} className="space-y-2 rounded border border-border p-2" data-guilda={g.id}>
            <div className="flex items-center gap-2"><span className="text-2xl">{g.emblema}</span><b className="flex-1">{g.nome}</b><span className="font-semibold text-primary">{nv.nome}</span></div>
            <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${nv.proximo ? Math.min(100, (g.renome / nv.proximo) * 100) : 100}%` }} /></div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Renome {g.renome}{nv.proximo ? ` / ${nv.proximo}` : ''}
              {master && <Input type="number" aria-label="Renome da guilda" value={g.renome} onChange={(e) => st.atualizarGuilda(g.id, { renome: limitarRenome(Number(e.target.value) || 0) })} className="h-7 w-20" />}
            </div>
            <div className="text-xs"><b>Membros:</b> {g.membros.map((id) => `${nomeDe(id)}${id === g.liderId ? ' 👑' : ''}`).join(', ')}</div>
            {pode && (
              <div className="space-y-1">
                <div className="text-xs font-semibold">Convidar / remover (clique)</div>
                <div className="flex flex-wrap gap-1">
                  {jogadores.filter((c) => g.membros.includes(c.id) || !emGuilda(c.id)).map((c) => {
                    const dentro = g.membros.includes(c.id);
                    const travado = c.id === g.liderId || (!master && !souLider && dentro && c.id !== charId);
                    return (
                      <button key={c.id} type="button" disabled={travado}
                        onClick={() => st.atualizarGuilda(g.id, { membros: dentro ? g.membros.filter((x) => x !== c.id) : [...g.membros, c.id] })}
                        className={`rounded border px-2 py-0.5 text-xs disabled:opacity-60 ${dentro ? 'border-primary bg-primary/10' : 'border-border'}`}>
                        {dentro ? '☑' : '☐'} {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {(master || souLider) && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => st.atualizarGuilda(g.id, { deletedAt: Date.now() })}>Dissolver guilda</Button>}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Quests aceitas pela guilda incluem todos os membros. Concluir dá renome (+10 ou a reputação da quest, o que for maior); falhar tira metade.</p>
    </div>
  );
}
