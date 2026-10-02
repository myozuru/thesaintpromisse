import type { AcaoAtivaConfig, ReacaoAtivaConfig } from '@/lib/omni/tipos';
import { Input } from '@/components/ui/input';
export const GATILHOS_REACAO = [
  ['quando_inimigo_entrar_alcance', 'Inimigo entra no alcance'],
  ['quando_inimigo_sair_alcance', 'Inimigo sai do alcance'],
  ['quando_alvo_declarar_ataque', 'Ataque declarado contra protegido'],
  ['quando_ataque_errar', 'Ataque erra o protegido'],
  ['quando_inimigo_conjurar', 'Inimigo declara conjuração'],
] as const;
export function EditorReacoesAtivas({ acao, onChange }: { acao: AcaoAtivaConfig; onChange: (p: Partial<AcaoAtivaConfig>) => void }) {
  const r = acao.reacao;
  const set = (p: Partial<ReacaoAtivaConfig>) => onChange({ reacao: { ...r!, ...p } });
  return <div className="rounded border p-2 space-y-2">
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={!!r} onChange={e => onChange(e.target.checked ? {
      reacao: { gatilho: 'quando_alvo_declarar_ataque', alcance_m: 1.5, protegido: 'usuario', alvo: 'origem' }, acao: 'reacao', tipo_alvo: 'unico',
      ...(acao.custo_recursos ? { custo_recursos: { ...acao.custo_recursos, tipo_acao: 'reacao' } } : {}),
    } : { reacao: undefined })} />Oferecer como reação automática</label>
    {r && <>
      <p className="text-xs text-muted-foreground">O evento aguarda sua escolha. A reação usa os custos configurados e afeta um único alvo; reações não abrem outras reações.</p>
      <label className="block text-xs">Gatilho<select aria-label="Gatilho da reação" className="w-full rounded border bg-background p-1" value={r.gatilho} onChange={e => set({ gatilho: e.target.value as ReacaoAtivaConfig['gatilho'] })}>{GATILHOS_REACAO.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
      <label className="block text-xs">Alcance da reação (m)<Input aria-label="Alcance da reação" type="number" min={0.1} step={1.5} value={r.alcance_m} onChange={e => set({ alcance_m: Number(e.target.value) })} /></label>
      <label className="block text-xs">Quem proteger<select aria-label="Protegido da reação" className="w-full rounded border bg-background p-1" value={r.protegido} onChange={e => set({ protegido: e.target.value as ReacaoAtivaConfig['protegido'] })}><option value="usuario">Usuário</option><option value="aliados">Aliados (inclui usuário)</option><option value="todos">Todos</option></select></label>
      <label className="block text-xs">Alvo da reação<select aria-label="Alvo da reação" className="w-full rounded border bg-background p-1" value={r.alvo} onChange={e => set({ alvo: e.target.value as ReacaoAtivaConfig['alvo'] })}><option value="origem">Quem provocou</option><option value="protegido">Protegido pelo evento</option><option value="usuario">Usuário</option></select></label>
      <label className="block text-xs">Bônus de Defesa neste ataque<Input aria-label="Defesa da reação" type="number" min={0} value={r.defesa_bonus ?? 0} onChange={e => set({ defesa_bonus: Number(e.target.value) })} /></label>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={!!r.cancelar_evento} onChange={e => set({ cancelar_evento: e.target.checked })} />Cancelar evento se a reação tiver efeito</label>
    </>}
  </div>;
}
