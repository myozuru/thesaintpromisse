import { responderReacaoAtiva, useReacoesAtivasStore } from '@/lib/omni/reacoesAtivas';
export function ReacoesAtivasOverlay() {
  const j = useReacoesAtivasStore(s => s.janelas[0]);
  if (!j) return null;
  return <div role="dialog" aria-label="Reação OMNI" className="fixed bottom-4 right-4 z-[250] w-80 rounded-lg border border-primary bg-background p-4 shadow-xl space-y-3">
    <p className="font-bold">Janela de reação</p><p className="text-xs">A resolução está pausada. Escolha uma reação ou continue.</p>
    {j.ofertas.map(o => <button key={o.id} disabled={j.busy} className="block w-full rounded border p-2 text-left disabled:opacity-50" onClick={() => responderReacaoAtiva(j.id, o.id)}>{o.nomeUsuario}: {o.cfg.nome}</button>)}
    {j.erro && <p role="alert" className="text-xs text-destructive">{j.erro}</p>}
    <button disabled={j.busy} className="rounded border px-3 py-1" onClick={() => responderReacaoAtiva(j.id)}>Passar e continuar</button>
  </div>;
}
