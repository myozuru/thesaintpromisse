/** Facções/reputação (Mestre edita, jogador consulta) e linha do tempo da campanha. */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuestStore } from '@/stores/useQuestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { nivelReputacao, repEfetiva, limitarRep } from '@/lib/economia/reputacao';
import { registrarEvento } from '@/lib/economia/linhaTempo';

const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function formatarDataMundo(seg: number): string {
  let d = Math.floor(seg / 86400);
  const year = Math.floor(d / 365) + 1; d %= 365;
  let month = 1; while (d >= DIAS_MES[month - 1]) { d -= DIAS_MES[month - 1]; month++; }
  const h = Math.floor((seg % 86400) / 3600), m = Math.floor((seg % 3600) / 60);
  return `${String(d + 1).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function textoAjuste(rep: number) {
  const n = nivelReputacao(rep);
  if (n.ajustePreco == null) return 'lojas recusam negociar';
  if (n.ajustePreco === 0) return 'preços normais';
  return n.ajustePreco < 0 ? `${-n.ajustePreco}% de desconto` : `${n.ajustePreco}% mais caro`;
}

export function EditorFaccoes() {
  const map = useQuestStore((s) => s.faccoes);
  const st = useQuestStore.getState();
  const faccoes = useMemo(() => Object.values(map).filter((f) => !f.deletedAt), [map]);
  const chars = useCharacterStore((s) => s.characters).filter((c) => !c.isNPC && !(c as { isTemporary?: boolean }).isTemporary);
  return (
    <div className="space-y-2 overflow-y-auto text-sm">
      <Button size="sm" onClick={() => st.criarFaccao()}>+ Nova facção</Button>
      {faccoes.map((f) => (
        <div key={f.id} className="space-y-2 rounded border border-border p-2" data-faccao={f.id}>
          <div className="flex items-center gap-2">
            <Input aria-label="Emblema" value={f.emblema} onChange={(e) => st.atualizarFaccao(f.id, { emblema: e.target.value.slice(0, 4) })} className="w-14 text-center" />
            <Input aria-label="Nome da facção" value={f.nome} onChange={(e) => st.atualizarFaccao(f.id, { nome: e.target.value })} className="flex-1" />
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => st.removerFaccao(f.id)}>Excluir</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-32 font-semibold">Grupo</span>
            <Input type="number" aria-label="Reputação do grupo" value={f.repGrupo} onChange={(e) => st.atualizarFaccao(f.id, { repGrupo: limitarRep(Number(e.target.value) || 0) })} className="w-24" />
            <span className="text-xs text-muted-foreground">{nivelReputacao(f.repGrupo).nome} · {textoAjuste(f.repGrupo)}</span>
          </div>
          {chars.map((c) => {
            const v = f.repJogador[c.id] ?? 0;
            return (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate">{c.name}</span>
                <Input type="number" aria-label={`Reputação individual de ${c.name}`} value={v} onChange={(e) => st.atualizarFaccao(f.id, { repJogador: { ...f.repJogador, [c.id]: limitarRep(Number(e.target.value) || 0) } })} className="h-8 w-24" />
                <span className="text-muted-foreground">total {repEfetiva(f, c.id)} · {nivelReputacao(repEfetiva(f, c.id)).nome}</span>
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Reputação vai de −100 a 100 (grupo + individual). Faixas: Venerado ≥60 (−20%), Honrado ≥30 (−10%), Amigável ≥10 (−5%), Neutro, Desconfiado (+10%), Hostil (+25%), Inimigo ≤−60 (loja recusa).</p>
    </div>
  );
}

export function PainelReputacao({ charId }: { charId?: string }) {
  const map = useQuestStore((s) => s.faccoes);
  const faccoes = Object.values(map).filter((f) => !f.deletedAt);
  if (!faccoes.length) return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma facção conhecida ainda.</p>;
  return (
    <div className="space-y-2 text-sm">
      {faccoes.map((f) => {
        const rep = repEfetiva(f, charId);
        return (
          <div key={f.id} className="rounded border border-border p-2">
            <div className="flex items-center gap-2"><span className="text-xl">{f.emblema}</span><b className="flex-1">{f.nome}</b><span className="font-semibold text-primary">{nivelReputacao(rep).nome}</span></div>
            <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(rep + 100) / 2}%` }} /></div>
            <div className="mt-1 text-xs text-muted-foreground">Grupo {f.repGrupo} · você {f.repJogador[charId ?? ''] ?? 0} · {textoAjuste(rep)}</div>
          </div>
        );
      })}
    </div>
  );
}

const ICONE_TL = { quest: '📜', viagem: '🧭', encontro: '⚔️', manual: '✒️' } as const;

export function LinhaDoTempo({ editavel = false }: { editavel?: boolean }) {
  const map = useQuestStore((s) => s.linhaTempo);
  const eventos = useMemo(() => Object.values(map).filter((e) => !e.deletedAt).sort((a, b) => b.segundosMundo - a.segundosMundo || b.updatedAt - a.updatedAt), [map]);
  const [novo, setNovo] = useState('');
  return (
    <div className="space-y-2 overflow-y-auto text-sm">
      {editavel && (
        <div className="flex gap-2">
          <Input aria-label="Novo acontecimento" placeholder="Ex.: O grupo derrotou o Cobrador" value={novo} onChange={(e) => setNovo(e.target.value)} />
          <Button size="sm" disabled={!novo.trim()} onClick={() => { registrarEvento('manual', novo.trim()); setNovo(''); }}>Registrar</Button>
        </div>
      )}
      {!eventos.length && <p className="py-6 text-center text-muted-foreground">Nada registrado ainda.</p>}
      <ol className="relative space-y-2 border-l border-border pl-4">
        {eventos.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[1.4rem] top-0.5">{ICONE_TL[e.tipo]}</span>
            <div className="text-xs text-muted-foreground">{formatarDataMundo(e.segundosMundo)}</div>
            <div className="flex items-start gap-2"><span className="flex-1">{e.texto}</span>
              {editavel && <button type="button" className="text-xs text-destructive" onClick={() => useQuestStore.getState().removerEvento(e.id)}>remover</button>}</div>
          </li>
        ))}
      </ol>
      {editavel && <p className="text-xs text-muted-foreground">Quests, viagens e encontros entram aqui sozinhos e também no Calendário.</p>}
    </div>
  );
}
