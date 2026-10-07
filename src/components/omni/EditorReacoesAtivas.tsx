import type { AcaoAtivaConfig, ReacaoAtivaConfig } from '@/lib/omni/tipos';
import { Input } from '@/components/ui/input';

/** [id, rótulo, grupo, ajuda] — "protegido" = quem sofre/causa o evento; "origem" = o inimigo envolvido. */
export const GATILHOS_REACAO = [
  ['quando_inimigo_entrar_alcance', 'Inimigo entra no alcance', 'Movimento', 'Origem: inimigo que se moveu.'],
  ['quando_inimigo_sair_alcance', 'Inimigo sai do alcance', 'Movimento', 'Origem: inimigo que se moveu.'],
  ['quando_alvo_declarar_ataque', 'Ataque declarado contra protegido', 'Ataque', 'Antes da rolagem. Pode dar Defesa extra ou cancelar.'],
  ['quando_ataque_acertar', 'Ataque acerta o protegido', 'Ataque', 'Depois do acerto, antes do dano.'],
  ['quando_sofrer_critico', 'Protegido sofre acerto crítico', 'Ataque', 'Depois do crítico, antes do dano.'],
  ['quando_ataque_errar', 'Ataque erra o protegido', 'Ataque', 'Depois do erro.'],
  ['quando_sofrer_dano', 'Protegido sofre dano de inimigo', 'Dano', 'Depois do dano. Use "Aliados" para reagir quando um aliado se ferir.'],
  ['quando_causar_dano', 'Protegido causa dano a inimigo', 'Dano', 'Depois do dano. Origem: o inimigo ferido.'],
  ['quando_reduzido_0_pv', 'Protegido cai a 0 PV', 'Dano', 'Origem: quem derrubou.'],
  ['quando_derrubar_inimigo', 'Protegido derruba um inimigo', 'Dano', 'Origem: o inimigo derrubado.'],
  ['quando_alvo_de_tr', 'Inimigo força TR no protegido', 'Testes', 'Antes da rolagem. Pode dar bônus no TR ou anular (sucesso automático).'],
  ['quando_passar_tr', 'Protegido passa num TR de inimigo', 'Testes', 'Depois do resultado.'],
  ['quando_falhar_tr', 'Protegido falha num TR de inimigo', 'Testes', 'Depois do resultado.'],
  ['quando_alvo_de_pericia', 'Inimigo desafia o protegido em perícia', 'Testes', 'Antes da disputa. Pode dar bônus na perícia ou anular.'],
  ['quando_inimigo_conjurar', 'Inimigo declara conjuração', 'Magia', 'Pode cancelar a conjuração.'],
] as const;

const GRUPOS = ['Movimento', 'Ataque', 'Dano', 'Testes', 'Magia'] as const;

export function EditorReacoesAtivas({ acao, onChange }: { acao: AcaoAtivaConfig; onChange: (p: Partial<AcaoAtivaConfig>) => void }) {
  const r = acao.reacao;
  const set = (p: Partial<ReacaoAtivaConfig>) => onChange({ reacao: { ...r!, ...p } });
  const info = r && GATILHOS_REACAO.find(g => g[0] === r.gatilho);
  const grupo = info?.[2];
  return <div className="rounded border p-2 space-y-2">
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={!!r} onChange={e => onChange(e.target.checked ? {
      reacao: { gatilho: 'quando_alvo_declarar_ataque', alcance_m: 1.5, protegido: 'usuario', alvo: 'origem' }, acao: 'reacao', tipo_alvo: 'unico',
      ...(acao.custo_recursos ? { custo_recursos: { ...acao.custo_recursos, tipo_acao: 'reacao' } } : {}),
    } : { reacao: undefined })} />Oferecer como reação automática</label>
    {r && <>
      <p className="text-xs text-muted-foreground">O evento aguarda sua escolha. A reação usa os custos configurados e afeta um único alvo; reações não abrem outras reações.</p>
      <label className="block text-xs">Quando reagir<select aria-label="Gatilho da reação" className="w-full rounded border bg-background p-1" value={r.gatilho} onChange={e => set({ gatilho: e.target.value as ReacaoAtivaConfig['gatilho'] })}>
        {GRUPOS.map(g => <optgroup key={g} label={g}>{GATILHOS_REACAO.filter(x => x[2] === g).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</optgroup>)}
      </select></label>
      {info && <p className="text-xs text-muted-foreground">{info[3]}</p>}
      <label className="block text-xs">Alcance da reação (m)<Input aria-label="Alcance da reação" type="number" min={0.1} step={1.5} value={r.alcance_m} onChange={e => set({ alcance_m: Number(e.target.value) })} /></label>
      <label className="block text-xs">Quem é o protegido<select aria-label="Protegido da reação" className="w-full rounded border bg-background p-1" value={r.protegido} onChange={e => set({ protegido: e.target.value as ReacaoAtivaConfig['protegido'] })}><option value="usuario">Só o usuário</option><option value="aliados">Aliados (inclui usuário)</option><option value="todos">Qualquer um</option></select></label>
      <label className="block text-xs">Alvo da reação<select aria-label="Alvo da reação" className="w-full rounded border bg-background p-1" value={r.alvo} onChange={e => set({ alvo: e.target.value as ReacaoAtivaConfig['alvo'] })}><option value="origem">Inimigo envolvido</option><option value="protegido">Protegido</option><option value="usuario">Usuário</option></select></label>
      {r.gatilho === 'quando_alvo_declarar_ataque' && <label className="block text-xs">Bônus de Defesa neste ataque<Input aria-label="Defesa da reação" type="number" min={0} value={r.defesa_bonus ?? 0} onChange={e => set({ defesa_bonus: Number(e.target.value) })} /></label>}
      {(r.gatilho === 'quando_alvo_de_tr' || r.gatilho === 'quando_alvo_de_pericia') && <label className="block text-xs">Bônus no teste do protegido<Input aria-label="Bônus no teste da reação" type="number" value={r.bonus_teste ?? 0} onChange={e => set({ bonus_teste: Number(e.target.value) })} /></label>}
      {grupo === 'Dano' && <label className="block text-xs">Dano mínimo para disparar<Input aria-label="Dano mínimo da reação" type="number" min={0} value={r.dano_minimo ?? 0} onChange={e => set({ dano_minimo: Number(e.target.value) })} /></label>}
      {['quando_alvo_declarar_ataque', 'quando_inimigo_conjurar', 'quando_alvo_de_tr', 'quando_alvo_de_pericia'].includes(r.gatilho) && <label className="flex gap-2 text-xs"><input type="checkbox" checked={!!r.cancelar_evento} onChange={e => set({ cancelar_evento: e.target.checked })} />Anular o evento se a reação tiver efeito</label>}
    </>}
  </div>;
}
