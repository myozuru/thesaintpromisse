import { useEffect, useState } from 'react';
import { useRoleStore } from '@/stores/useRoleStore';
import { continuarSemReacoesPendentes, podeVerOfertaReacao, passarOfertaRemota, responderOfertaRemota, responderReacaoAtiva, useReacoesAtivasStore } from '@/lib/omni/reacoesAtivas';
import { useProfileStore } from '@/stores/useProfileStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { SpellApplyDialog } from '@/components/fichas/SpellApplyDialog';
import type { Spell } from '@/types';
import { declararReacaoManual, concluirReacaoManual, type EventoReacaoAtiva } from '@/lib/omni/reacoesAtivas';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { cn } from '@/lib/utils';

interface ReacaoManualEmCurso {
  janelaId: string;
  spell: Spell;
  sourceCharId: string;
  alvoId: string;
  remoto?: { perfilId: string; clienteOrigem: string };
}

function TempoReacao({ expiresAt }: { expiresAt?: number }) {
  const [seconds, setSeconds] = useState(() => expiresAt === undefined ? 0 : Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
  useEffect(() => {
    if (expiresAt === undefined) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  if (expiresAt === undefined) return null;
  return <p className="text-xs font-semibold tabular-nums text-amber-600">Tempo para reagir: {seconds}s</p>;
}

export function ReacoesAtivasOverlay() {
  const j = useReacoesAtivasStore(s => s.janelas[0]);
  const remotas = useReacoesAtivasStore(s => s.ofertasRemotas);
  const role = useRoleStore(s => s.role);
  const perfilId = useProfileStore(s => s.activeProfileId);
  const characters = useCharacterStore(s => s.characters);
  // A bandeja 3D de dados ocupa o canto inferior direito; a janela de reação
  // precisa mudar de lado enquanto ela estiver aberta para continuar clicável.
  const bandejaAberta = useDice3DStore(s => s.enabled && s.visible && s.current?.layout !== 'test-request');
  const [reacaoManual, setReacaoManual] = useState<ReacaoManualEmCurso | null>(null);
  useEffect(() => {
    if (!reacaoManual) return;
    const janelaAtiva = reacaoManual.remoto
      ? remotas.some(r => r.janelaId === reacaoManual.janelaId)
      : j?.id === reacaoManual.janelaId;
    if (!janelaAtiva) setReacaoManual(null);
  }, [j?.id, remotas, reacaoManual]);
  if (!j && remotas.length === 0) return null;
  const ofertasLocais = j?.ofertas.filter(o => podeVerOfertaReacao(o, perfilId)) ?? [];
  const alvoDaMagia = (spell: Spell, evento: EventoReacaoAtiva, sourceCharId: string) => {
    if (spell.spellType === 'damage' || spell.spellType === 'condition') return evento.origemId;
    return evento.protegidoId ?? sourceCharId;
  };
  const iniciarReacaoManual = (janelaId: string, evento: EventoReacaoAtiva, fichaId: string, spell: Spell, remoto?: ReacaoManualEmCurso['remoto']) => {
    if (spell.actionType !== 'reaction' || !declararReacaoManual(janelaId, remoto)) return;
    setReacaoManual({ janelaId, spell, sourceCharId: fichaId, alvoId: alvoDaMagia(spell, evento, fichaId), remoto });
  };
  const opcoesFeitico = (janelaId: string, evento: EventoReacaoAtiva, remoto?: ReacaoManualEmCurso['remoto']) => {
    if (role !== 'MASTER') return null;
    const fichas = characters.filter(c => c.category !== 'PLAYER' && (c.spells ?? []).some(spell => spell.actionType === 'reaction'));
    if (!fichas.length) return null;
    return <section className="max-h-48 space-y-2 overflow-y-auto border-t pt-2" aria-label="Reações das fichas do Mestre">
      <p className="text-xs font-semibold">Reações das fichas do Mestre</p>
      {fichas.map(ficha => <div key={ficha.id} className="space-y-1">
        <p className="text-xs text-muted-foreground">{ficha.name}{ficha.id === evento.protegidoId ? ' · alvo da ação' : ''}</p>
        {(ficha.spells ?? []).filter(spell => spell.actionType === 'reaction').map(spell => <button key={`${ficha.id}:${spell.id}`} disabled={!!reacaoManual || (!!j?.busy && !remoto)} className="block w-full rounded border p-2 text-left text-sm disabled:opacity-50" onClick={() => iniciarReacaoManual(janelaId, evento, ficha.id, spell, remoto)}>
          {spell.name} <span className="text-xs text-muted-foreground">· {spell.costPE} PE</span>
        </button>)}
      </div>)}
    </section>;
  };
  const concluir = () => {
    if (!reacaoManual) return;
    concluirReacaoManual(reacaoManual.janelaId, reacaoManual.remoto);
    setReacaoManual(null);
  };
  return <>
    {j && <div role="dialog" aria-label="Reação OMNI" className={cn('fixed bottom-4 z-[10000] w-80 rounded-lg border border-primary bg-background p-4 shadow-xl space-y-3', bandejaAberta ? 'left-4' : 'right-4')}>
      <p className="font-bold">Janela de reação</p>
      <p className="text-xs">{ofertasLocais.length ? 'O cronômetro de combate está pausado. Escolha uma reação ou passe.' : 'Aguardando a resposta do controlador da ficha (jogador ou mestre).'}</p>
      {j.expiresAt === undefined && <p className="text-xs text-muted-foreground">Sem prazo automático. O Mestre pode passar para continuar.</p>}
      <TempoReacao expiresAt={j.expiresAt} />
      {opcoesFeitico(j.id, j.evento)}
      {ofertasLocais.map(o => <button key={o.id} disabled={j.busy} className="block w-full rounded border p-2 text-left disabled:opacity-50" onClick={() => responderReacaoAtiva(j.id, o.id)}>
        {o.fonte === 'invocacao'
          ? o.nomeUsuario + ': ' + o.acaoNome + ' · ' + o.config.custoPE + ' PE · alvo ' + o.alvoNome
          : o.nomeUsuario + ': ' + o.cfg.nome}
      </button>)}
      {!!ofertasLocais.length && !!j.pendentes.length && <button disabled={j.busy} className="rounded border px-3 py-1" onClick={() => continuarSemReacoesPendentes(j.id)}>Continuar sem reações pendentes</button>}
      {j.erro && <p role="alert" className="text-xs text-destructive">{j.erro}</p>}
      <button disabled={j.busy} className="rounded border px-3 py-1" onClick={() => ofertasLocais.length ? responderReacaoAtiva(j.id) : continuarSemReacoesPendentes(j.id)}>Passar e continuar</button>
    </div>}
    {remotas.map(r => <div key={r.janelaId} role="dialog" aria-label="Reação OMNI" className={cn('fixed bottom-4 z-[10000] w-80 rounded-lg border border-primary bg-background p-4 shadow-xl space-y-3', bandejaAberta ? 'left-[21rem]' : 'left-4')}>
      <p className="font-bold">Reação disponível</p><p className="text-xs">O cronômetro de combate está pausado enquanto você decide.</p>
      {r.expiresAt === undefined && <p className="text-xs text-muted-foreground">Sem prazo automático; o Mestre também pode resolver esta reação.</p>}
      <TempoReacao expiresAt={r.expiresAt} />
      {opcoesFeitico(r.janelaId, r.evento, { perfilId: r.perfilId, clienteOrigem: r.clienteOrigem })}
      {r.ofertas.map(o => <button key={o.id} disabled={r.busy} className="block w-full rounded border p-2 text-left disabled:opacity-50" onClick={() => responderOfertaRemota(r.janelaId, o.id, r.perfilId, r.clienteOrigem)}>
        {o.fonte === 'invocacao'
          ? o.nomeUsuario + ': ' + o.acaoNome + ' · ' + o.config.custoPE + ' PE · alvo ' + o.alvoNome
          : o.nomeUsuario + ': ' + o.cfg.nome}
      </button>)}
      {r.erro && <p role="alert" className="text-xs text-destructive">{r.erro}</p>}
      <button disabled={r.busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => responderOfertaRemota(r.janelaId, undefined, r.perfilId, r.clienteOrigem)}>Passar</button>
    </div>)}
    {reacaoManual && <SpellApplyDialog key={`${reacaoManual.janelaId}:${reacaoManual.spell.id}`} spell={reacaoManual.spell} sourceCharId={reacaoManual.sourceCharId} initialTargetIds={[reacaoManual.alvoId]} onClose={concluir} />}
  </>;
}
