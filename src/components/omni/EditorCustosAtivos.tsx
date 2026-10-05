import type { AcaoAtivaConfig, CustoRecursosAtivo } from '@/lib/omni/tipos';
import { Input } from '@/components/ui/input';

export function EditorCustosAtivos({ acao, onChange }: { acao: AcaoAtivaConfig; onChange: (p: Partial<AcaoAtivaConfig>) => void }) {
  const c = acao.custo_recursos;
  const set = (p: Partial<CustoRecursosAtivo>) => onChange({ custo_recursos: { ...c, ...p } });
  return <div className="space-y-2 rounded border p-2">
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={!!c} onChange={e => onChange({ custo_recursos: e.target.checked ? { pe_base: acao.custoPE, max_intensificacoes: '0' } : undefined })} />Custos flexíveis</label>
    {c && <>
      <p className="text-xs text-muted-foreground">Fórmulas sem dados aleatórios. Cargas aqui substituem o contador legado. Custo em PV deixa ao menos 1 PV. Munição vem da arma da ação; usos vêm desta instância do item. Remover condições exige Ação Comum, Bônus, Reação ou Movimento; a opção Livre é recusada.</p>
      <div className="grid grid-cols-2 gap-2">
        {([
          ['pe_base', 'PE base', acao.custoPE], ['pe_por_intensificacao', 'PE por intensificação', '0'],
          ['max_intensificacoes', 'Máximo de intensificações', '0'], ['limite_pe', 'Limite total de PE (opcional)', ''],
          ['dano_por_intensificacao', 'Dano por intensificação', ''], ['custo_pv', 'Custo PV', '0'],
        ] as const).map(([key, label, fallback]) => <label key={key} className="text-xs">{label}<Input aria-label={label} value={c[key] ?? fallback} placeholder={key === 'max_intensificacoes' ? '@USUARIO.treino' : ''} onChange={e => set({ [key]: e.target.value || undefined })} /></label>)}
        <label className="text-xs">Munição consumida<Input aria-label="Munição consumida" type="number" min={0} step={1} value={c.municao ?? 0} onChange={e => set({ municao: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
        <label className="text-xs">Usos do item consumidos<Input aria-label="Usos do item consumidos" type="number" min={0} step={1} value={c.usos_item ?? 0} onChange={e => set({ usos_item: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
        <label className="text-xs">Tipo de ação<select aria-label="Tipo de ação do custo" className="h-9 w-full rounded border bg-background" value={c.tipo_acao ?? acao.acao} onChange={e => set({ tipo_acao: e.target.value as CustoRecursosAtivo['tipo_acao'] })}>
          <option value="comum">Comum</option><option value="bonus">Bônus</option><option value="reacao">Reação</option><option value="movimento">Movimento</option><option value="livre">Livre</option><option value="sustentada">Sustentada por turno</option>
        </select></label>
        {c.tipo_acao === 'sustentada' && <label className="text-xs">PE por turno<Input aria-label="PE por turno" value={c.pe_por_turno ?? ''} onChange={e => set({ pe_por_turno: e.target.value })} /></label>}
        <label className="text-xs">Contador de cargas<Input aria-label="Contador de cargas" value={c.gastar_cargas?.nome ?? ''} onChange={e => set({ gastar_cargas: e.target.value ? { ...c.gastar_cargas, nome: e.target.value, quantidade: c.gastar_cargas?.quantidade ?? '1' } : undefined })} /></label>
        {c.gastar_cargas && <label className="text-xs">Quantidade de cargas<Input aria-label="Quantidade de cargas" value={c.gastar_cargas.quantidade} placeholder="todas ou fórmula" onChange={e => set({ gastar_cargas: { ...c.gastar_cargas!, quantidade: e.target.value } })} /></label>}
      </div>
      {c.tipo_acao === 'sustentada' && <p className="text-xs text-muted-foreground">A ação inicial usa o campo Ação do construtor. Manutenção automática no início do próximo turno; condições duram até encerrar. Dano e movimento não se repetem.</p>}
    </>}
  </div>;
}
