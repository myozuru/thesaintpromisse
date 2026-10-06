/**
 * Mural de Quests: quadro de cortiça com cartazes arrastáveis por todos,
 * detalhes da quest, aceitar (jogador) e concluir/falhar/revelar (Mestre).
 */
import { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuestStore, type Quest } from '@/stores/useQuestStore';
import { useBossStore } from '@/stores/useBossStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { toTimelineSeconds } from '@/lib/omni/tempo';
import { ICONES_QUEST, STATUS_LABEL, formatarRestante } from '@/lib/economia/quests';
import { aceitarQuest, concluirQuest, falharQuest } from '@/lib/economia/acoesQuest';
import { BOSS_REVEAL_LABELS } from '@/lib/bosses';

export function questVisivelNoMural(q: Quest, muralId: string | null, master: boolean, charId?: string) {
  if (q.deletedAt) return false;
  if (muralId && q.murais.length && !q.murais.includes(muralId)) return false;
  if (master) return true;
  return q.status === 'disponivel' || (q.status === 'aceita') || (!!charId && q.aceitaPor.includes(charId));
}

export function MuralQuestsDialog({ aberto, onClose, muralId, charId, master, onEditar }: {
  aberto: boolean; onClose: () => void; muralId: string | null; charId?: string; master: boolean; onEditar?: (id: string) => void;
}) {
  const questsMap = useQuestStore((s) => s.quests);
  const mural = useQuestStore((s) => (muralId ? s.murais[muralId] : undefined));
  const atualizar = useQuestStore((s) => s.atualizarQuest);
  const quests = useMemo(() => Object.values(questsMap).filter((q) => questVisivelNoMural(q, muralId, master, charId)), [questsMap, muralId, master, charId]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const quadro = useRef<HTMLDivElement>(null);
  const agora = toTimelineSeconds(useChronosStore());

  const posDe = (ev: React.PointerEvent) => {
    const r = quadro.current!.getBoundingClientRect();
    return { x: Math.min(88, Math.max(0, ((ev.clientX - r.left) / r.width) * 100 - 6)), y: Math.min(80, Math.max(0, ((ev.clientY - r.top) / r.height) * 100 - 8)) };
  };
  const questAberta = aberta ? questsMap[aberta] : undefined;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>📌 {mural?.nome ?? 'Mural de Quests'}</DialogTitle></DialogHeader>
        <div className="flex gap-3 overflow-hidden min-h-0 flex-1">
          <div ref={quadro} data-mural-quadro
            className="relative flex-1 min-h-[460px] rounded-lg border-4 border-border bg-muted shadow-inner overflow-hidden select-none"
            style={{ backgroundImage: 'radial-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px)', backgroundSize: '9px 9px' }}
            onPointerMove={(ev) => { if (drag) { const p = posDe(ev); setDrag({ ...drag, ...p, moved: true }); } }}
            onPointerUp={() => {
              if (!drag) return;
              if (drag.moved) atualizar(drag.id, { poster: { x: drag.x, y: drag.y, rot: Math.round((Math.random() * 10 - 5) * 10) / 10 } });
              else setAberta(drag.id);
              setDrag(null);
            }}>
            {quests.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Nenhum cartaz neste mural.</p>}
            {quests.map((q) => {
              const pos = drag?.id === q.id ? { x: drag.x, y: drag.y, rot: 0 } : q.poster;
              const oculto = q.mascarada && !q.revelada;
              const restante = formatarRestante(q.prazoFim, agora);
              return (
                <button key={q.id} type="button" data-cartaz={q.id} aria-label={`Cartaz ${oculto ? 'misterioso' : q.titulo}`}
                  onPointerDown={(ev) => { ev.preventDefault(); (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId); setDrag({ id: q.id, x: q.poster.x, y: q.poster.y, moved: false }); }}
                  className={`absolute w-[150px] rounded-sm border border-border bg-card p-2 text-left shadow-lg transition-transform cursor-grab active:cursor-grabbing ${drag?.id === q.id ? 'scale-105 z-20' : 'z-10'} ${q.status !== 'disponivel' && q.status !== 'aceita' ? 'opacity-60' : ''}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `rotate(${pos.rot}deg)` }}>
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-destructive shadow" aria-hidden />
                  <div className="text-2xl text-center">{oculto ? '❓' : ICONES_QUEST[q.icone]}</div>
                  <div className="text-sm font-semibold leading-tight line-clamp-2 text-center">{oculto ? '???' : q.titulo}</div>
                  {q.recompensa.valor > 0 && <div className="text-xs text-center text-primary font-mono mt-1">{q.recompensa.valor} {q.recompensa.currencyId}</div>}
                  {restante && <div className="text-xs text-center text-muted-foreground">⌛ {restante}</div>}
                  {q.status !== 'disponivel' && <div className="text-xs text-center font-semibold">{STATUS_LABEL[q.status]}</div>}
                </button>
              );
            })}
          </div>
          {questAberta && <DetalheQuest q={questAberta} charId={charId} master={master} agora={agora} onEditar={onEditar} onFechar={() => setAberta(null)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetalheQuest({ q, charId, master, agora, onEditar, onFechar }: { q: Quest; charId?: string; master: boolean; agora: number; onEditar?: (id: string) => void; onFechar: () => void }) {
  const boss = useBossStore((s) => (q.alvo.bossId ? s.bosses[q.alvo.bossId] : undefined));
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const moeda = useMoneyStore((s) => s.currencies.find((c) => c.id === q.recompensa.currencyId));
  const chars = useCharacterStore((s) => s.characters);
  const atualizar = useQuestStore((s) => s.atualizarQuest);
  const [erro, setErro] = useState<string | null>(null);
  const oculto = q.mascarada && !q.revelada;
  const aceitou = !!charId && q.aceitaPor.includes(charId);
  const tentar = (fn: () => void) => { try { fn(); setErro(null); } catch (e) { setErro(e instanceof Error ? e.message : 'Erro'); } };
  const restante = formatarRestante(q.prazoFim, agora);
  return (
    <aside className="w-80 shrink-0 overflow-y-auto rounded-lg border border-border bg-card p-3 space-y-2 text-sm" data-detalhe-quest>
      <div className="flex items-start gap-2">
        <span className="text-2xl">{oculto ? '❓' : ICONES_QUEST[q.icone]}</span>
        <div className="flex-1"><div className="font-semibold">{oculto ? 'Objetivo desconhecido' : q.titulo}</div>
          <div className="text-xs text-muted-foreground">{STATUS_LABEL[q.status]}{restante ? ` · ⌛ ${restante}` : ''}</div></div>
        <button type="button" onClick={onFechar} aria-label="Fechar detalhes" className="text-muted-foreground">✕</button>
      </div>
      {q.descricao && <p className="whitespace-pre-wrap">{q.descricao}</p>}
      {!oculto && q.objetivoReal && <p className="whitespace-pre-wrap rounded border border-primary/30 bg-primary/5 p-2"><b>Objetivo:</b> {q.objetivoReal}</p>}
      {(master || (!oculto && aceitou)) && boss && (
        <div className="rounded border border-border p-2"><b>Alvo:</b> {boss.nome}
          {master && <div className="text-xs text-muted-foreground">Revela ao aceitar: {q.revelarBoss.map((f) => BOSS_REVEAL_LABELS[f]).join(', ') || 'nada'}</div>}
        </div>
      )}
      <div className="rounded border border-border p-2">
        <b>Recompensa:</b> {q.recompensa.valor > 0 ? `${moeda?.symbol ?? ''}${q.recompensa.valor} (dividido igualmente)` : 'sem dinheiro'}
        {q.recompensa.itens.length > 0 && <ul className="list-disc pl-5 text-xs">{q.recompensa.itens.map((id) => <li key={id}>{entidades[id]?.nome ?? 'Item'}</li>)}</ul>}
      </div>
      {q.aceitaPor.length > 0 && <div className="text-xs text-muted-foreground">Aceita por: {q.aceitaPor.map((id) => chars.find((c) => c.id === id)?.name ?? '?').join(', ')}</div>}
      {erro && <p className="text-xs text-destructive" role="alert">{erro}</p>}
      {!master && charId && !aceitou && (q.status === 'disponivel' || q.status === 'aceita') && (
        <Button size="sm" className="w-full" onClick={() => tentar(() => aceitarQuest(q.id, charId))}>Aceitar quest</Button>
      )}
      {!master && aceitou && <p className="text-xs text-primary">Você aceitou esta quest.</p>}
      {master && (
        <div className="space-y-1.5 border-t border-border pt-2">
          {onEditar && <Button size="sm" variant="outline" className="w-full" onClick={() => onEditar(q.id)}>Editar</Button>}
          {q.mascarada && <Button size="sm" variant="outline" className="w-full" onClick={() => atualizar(q.id, { revelada: !q.revelada })}>{q.revelada ? 'Ocultar objetivo (voltar a ❓)' : 'Revelar objetivo real'}</Button>}
          {q.status === 'aceita' && <Button size="sm" className="w-full" onClick={() => tentar(() => concluirQuest(q.id))}>🏆 Concluíram a missão</Button>}
          {(q.status === 'aceita' || q.status === 'disponivel') && <Button size="sm" variant="ghost" className="w-full text-destructive" onClick={() => tentar(() => falharQuest(q.id))}>Falharam</Button>}
          {(q.status === 'falhou' || q.status === 'expirada') && <Button size="sm" variant="ghost" className="w-full" onClick={() => atualizar(q.id, { status: q.aceitaPor.length ? 'aceita' : 'disponivel' })}>Reabrir</Button>}
        </div>
      )}
    </aside>
  );
}
