/**
 * Mural de Quests: quadro de cortiça com cartazes arrastáveis por todos,
 * detalhes da quest, aceitar (jogador) e concluir/falhar/revelar (Mestre).
 */
import { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuestStore, type Quest, type Faccao } from '@/stores/useQuestStore';
import { atendeRepMinima } from '@/lib/economia/reputacao';
import { useBossStore } from '@/stores/useBossStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { toTimelineSeconds } from '@/lib/omni/tempo';
import { ICONES_QUEST, STATUS_LABEL, formatarRestante } from '@/lib/economia/quests';
import { aceitarQuest, concluirQuest, falharQuest } from '@/lib/economia/acoesQuest';
import pergaminho from '@/assets/pergaminho.jpg';

/** Visual de papel real (tinta marrom sobre pergaminho) — intencionalmente fora do tema. */
const papel: React.CSSProperties = {
  backgroundImage: `url(${pergaminho})`, backgroundSize: 'cover', backgroundPosition: 'center',
  color: '#3b2410', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.55))',
};

export function questVisivelNoMural(q: Quest, muralId: string | null, master: boolean, charId?: string, faccoes: Record<string, Faccao> = {}) {
  if (q.deletedAt) return false;
  if (muralId && q.murais.length && !q.murais.includes(muralId)) return false;
  if (master) return true;
  if (!(charId && q.aceitaPor.includes(charId)) && q.faccaoId && !atendeRepMinima(faccoes[q.faccaoId], charId, q.repMinima)) return false;
  return q.status === 'disponivel' || (q.status === 'aceita') || (!!charId && q.aceitaPor.includes(charId));
}

export function MuralQuestsDialog({ aberto, onClose, muralId, charId, master, onEditar }: {
  aberto: boolean; onClose: () => void; muralId: string | null; charId?: string; master: boolean; onEditar?: (id: string) => void;
}) {
  const questsMap = useQuestStore((s) => s.quests);
  const mural = useQuestStore((s) => (muralId ? s.murais[muralId] : undefined));
  const atualizar = useQuestStore((s) => s.atualizarQuest);
  const faccoes = useQuestStore((s) => s.faccoes);
  const quests = useMemo(() => Object.values(questsMap).filter((q) => questVisivelNoMural(q, muralId, master, charId, faccoes)), [questsMap, muralId, master, charId, faccoes]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const quadro = useRef<HTMLDivElement>(null);
  const agora = toTimelineSeconds(useChronosStore());
  const currencies = useMoneyStore((s) => s.currencies);

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
              const moeda = currencies.find((c) => c.id === q.recompensa.currencyId);
              return (
                <button key={q.id} type="button" data-cartaz={q.id} aria-label={`Cartaz ${oculto ? 'misterioso' : q.titulo}`}
                  onPointerDown={(ev) => { ev.preventDefault(); (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId); setDrag({ id: q.id, x: q.poster.x, y: q.poster.y, moved: false }); }}
                  className={`absolute w-[170px] min-h-[200px] px-4 pt-5 pb-4 text-left transition-transform cursor-grab active:cursor-grabbing ${drag?.id === q.id ? 'scale-105 z-20' : 'z-10'} ${q.status !== 'disponivel' && q.status !== 'aceita' ? 'opacity-60 grayscale' : ''}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `rotate(${pos.rot}deg)`, ...papel }}>
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-destructive shadow-md ring-1 ring-black/40" aria-hidden />
                  <div className="text-2xl text-center">{oculto ? '❓' : ICONES_QUEST[q.icone]}</div>
                  <div className="text-sm font-bold uppercase tracking-wide leading-tight line-clamp-2 text-center" style={{ fontFamily: 'Georgia, serif' }}>{oculto ? 'Procura-se ajuda' : q.titulo}</div>
                  {q.descricao && <p className="mt-1 text-xs leading-snug line-clamp-4 italic" style={{ fontFamily: 'Georgia, serif' }}>{q.descricao}</p>}
                  {q.recompensa.valor > 0 && <div className="mt-2 border-t border-dashed pt-1 text-center text-sm font-bold" style={{ borderColor: '#5a3a1a80', fontFamily: 'Georgia, serif' }}>Recompensa: {moeda?.symbol ?? ''} {q.recompensa.valor}</div>}
                  {restante && <div className="text-xs text-center">⌛ {restante}</div>}
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
    <aside className="w-80 shrink-0 overflow-y-auto px-6 pt-8 pb-6 space-y-2 text-sm" style={{ ...papel, fontFamily: 'Georgia, serif' }} data-detalhe-quest>
      <div className="flex items-start gap-2">
        <span className="text-2xl">{oculto ? '❓' : ICONES_QUEST[q.icone]}</span>
        <div className="flex-1"><div className="text-base font-bold uppercase tracking-wide">{oculto ? 'Procura-se ajuda' : q.titulo}</div>
          <div className="text-xs opacity-75">{STATUS_LABEL[q.status]}{restante ? ` · ⌛ ${restante}` : ''}</div></div>
        <button type="button" onClick={onFechar} aria-label="Fechar detalhes" className="opacity-70">✕</button>
      </div>
      {q.descricao && <p className="whitespace-pre-wrap italic leading-relaxed">{q.descricao}</p>}
      {!oculto && q.objetivoReal && <p className="whitespace-pre-wrap border-l-2 pl-2" style={{ borderColor: '#5a3a1a' }}><b>Objetivo:</b> {q.objetivoReal}</p>}
      {(master || (!oculto && aceitou)) && boss && (
        <div className="border-l-2 pl-2" style={{ borderColor: '#5a3a1a' }}><b>Alvo:</b> {boss.nome}
          {master && oculto && <div className="text-xs opacity-75">(só você vê — oculto aos jogadores)</div>}
        </div>
      )}
      <div className="border-t border-dashed pt-2 text-center" style={{ borderColor: '#5a3a1a80' }}>
        <b>Recompensa:</b> {q.recompensa.valor > 0 ? `${moeda?.symbol ?? ''} ${q.recompensa.valor} (dividido igualmente)` : 'sem dinheiro'}
        {q.recompensa.itens.length > 0 && <ul className="list-disc pl-5 text-xs text-left">{q.recompensa.itens.map((id) => <li key={id}>{entidades[id]?.nome ?? 'Item'}</li>)}</ul>}
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
