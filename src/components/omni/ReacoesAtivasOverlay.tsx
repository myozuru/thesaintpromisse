import { useRoleStore } from '@/stores/useRoleStore';
import { continuarSemReacoesPendentes, podeVerOfertaReacao, passarOfertaRemota, responderOfertaRemota, responderReacaoAtiva, useReacoesAtivasStore } from '@/lib/omni/reacoesAtivas';
import { useProfileStore } from '@/stores/useProfileStore';
export function ReacoesAtivasOverlay() {
  const j = useReacoesAtivasStore(s => s.janelas[0]);
  const remotas = useReacoesAtivasStore(s => s.ofertasRemotas);
  useRoleStore(s => s.role);
  const perfilId = useProfileStore(s => s.activeProfileId);
  if (!j && remotas.length === 0) return null;
  const ofertasLocais = j?.ofertas.filter(o => podeVerOfertaReacao(o, perfilId)) ?? [];
  return <>
    {j && <div role="dialog" aria-label="Reação OMNI" className="fixed bottom-4 right-4 z-[250] w-80 rounded-lg border border-primary bg-background p-4 shadow-xl space-y-3">
      <p className="font-bold">Janela de reação</p>
      <p className="text-xs">{ofertasLocais.length ? 'A resolução está pausada. Escolha uma reação ou continue.' : 'Aguardando a resposta do controlador da ficha (jogador ou mestre).'}</p>
      {ofertasLocais.map(o => <button key={o.id} disabled={j.busy} className="block w-full rounded border p-2 text-left disabled:opacity-50" onClick={() => responderReacaoAtiva(j.id, o.id)}>{o.nomeUsuario}: {o.cfg.nome}</button>)}
      {!!ofertasLocais.length && !!j.pendentes.length && <button disabled={j.busy} className="rounded border px-3 py-1" onClick={() => continuarSemReacoesPendentes(j.id)}>Continuar sem reações pendentes</button>}
      {j.erro && <p role="alert" className="text-xs text-destructive">{j.erro}</p>}
      <button disabled={j.busy} className="rounded border px-3 py-1" onClick={() => ofertasLocais.length ? responderReacaoAtiva(j.id) : continuarSemReacoesPendentes(j.id)}>Passar e continuar</button>
    </div>}
    {remotas.map(r => <div key={r.janelaId} role="dialog" aria-label="Reação OMNI" className="fixed bottom-4 left-4 z-[250] w-80 rounded-lg border border-primary bg-background p-4 shadow-xl space-y-3">
      <p className="font-bold">Reação disponível</p><p className="text-xs">Ação pausada enquanto você decide.</p>
      {r.ofertas.map(o => <button key={o.id} disabled={r.busy} className="block w-full rounded border p-2 text-left disabled:opacity-50" onClick={() => responderOfertaRemota(r.janelaId, o.id, r.perfilId, r.clienteOrigem)}>{o.nomeUsuario}: {o.cfg.nome}</button>)}
      {r.erro && <p role="alert" className="text-xs text-destructive">{r.erro}</p>}
      <button disabled={r.busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => responderOfertaRemota(r.janelaId, undefined, r.perfilId, r.clienteOrigem)}>Passar</button>
    </div>)}
  </>;
}
