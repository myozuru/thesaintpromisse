import type { ModificadorCondicionalAtivo, OperadorEstado, PredicadoEstado } from '@/lib/omni/tipos';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ALL_CONDITIONS } from '@/types/conditions';

const sel = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
const tipos: [PredicadoEstado['tipo'], string][] = [['tem_condicao', 'Tem condição'], ['rodadas_condicao', 'Rodadas decorridas da condição'], ['distancia', 'Distância (m)'], ['pv_percentual', 'PV (%)'], ['cargas', 'Cargas']];
const numeros = [['margem_critico_mod', 'Delta da margem crítica'], ['multiplicador_critico_mod', 'Delta do multiplicador crítico'], ['mod_tr_alvo', 'Modificador do TR do alvo']] as const;

export function EditorCondicionaisAtivos({ blocos, onChange }: { blocos: ModificadorCondicionalAtivo[]; onChange: (b: ModificadorCondicionalAtivo[]) => void }) {
  const set = (i: number, patch: Partial<ModificadorCondicionalAtivo>) => onChange(blocos.map((b, j) => j === i ? { ...b, ...patch } : b));
  return <div className="space-y-2">
    <p className="text-xs text-muted-foreground">Bônus condicionais: todas as checagens do bloco devem passar. Blocos ativos somam seus efeitos. Idade desconhecida e distância sem mapa não ativam bônus.</p>
    {blocos.map((b, i) => <div key={b.id} className="border rounded-md p-2 space-y-2" data-testid={`condicional-${i}`}>
      <div className="flex items-center justify-between text-xs"><b>Condicional {i + 1}</b><Button size="sm" variant="ghost" onClick={() => onChange(blocos.filter((_, j) => j !== i))}>Remover bloco</Button></div>
      {(['se_alvo', 'se_usuario'] as const).map(escopo => <div key={escopo} className="space-y-1">
        <p className="text-xs font-semibold">{escopo === 'se_alvo' ? 'Estado do alvo' : 'Estado do usuário'}</p>
        {(b[escopo] ?? []).map((p, k) => {
          const atualizar = (pred: PredicadoEstado) => set(i, { [escopo]: b[escopo]!.map((v, j) => j === k ? pred : v) });
          const label = `${i + 1} ${escopo} ${k + 1}`;
          return <div key={k} className="flex flex-wrap items-center gap-1">
            <select aria-label={`Checagem ${label}`} className={sel} value={p.tipo} onChange={e => {
              const tipo = e.target.value as PredicadoEstado['tipo'];
              atualizar(tipo === 'tem_condicao' ? { tipo, nome: 'caido' } : tipo === 'rodadas_condicao' || tipo === 'cargas' ? { tipo, nome: tipo === 'cargas' ? 'foco' : 'caido', operador: '>=', valor: 1 } : { tipo, operador: '<=', valor: tipo === 'pv_percentual' ? 50 : 1.5 });
            }}>{tipos.map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}</select>
            {'nome' in p && (p.tipo === 'cargas' ? <Input className="w-32" aria-label={`Nome ${label}`} value={p.nome} onChange={e => atualizar({ ...p, nome: e.target.value })} /> :
              <select aria-label={`Condição ${label}`} className={sel} value={p.nome} onChange={e => atualizar({ ...p, nome: e.target.value })}>
                {!ALL_CONDITIONS.some(c => c.id === p.nome) && <option value={p.nome}>{p.nome}</option>}
                {ALL_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>)}
            {'operador' in p && <>
              <select aria-label={`Operador ${label}`} className={sel} value={p.operador} onChange={e => atualizar({ ...p, operador: e.target.value as OperadorEstado })}>{['<', '<=', '==', '!=', '>=', '>'].map(op => <option key={op}>{op}</option>)}</select>
              <Input className="w-24" aria-label={`Valor ${label}`} type="number" step="any" value={p.valor} onChange={e => atualizar({ ...p, valor: Number(e.target.value) })} />
            </>}
            <Button size="sm" variant="ghost" onClick={() => set(i, { [escopo]: b[escopo]!.filter((_, j) => j !== k) })}>Remover checagem</Button>
          </div>;
        })}
        <Button size="sm" variant="outline" onClick={() => set(i, { [escopo]: [...(b[escopo] ?? []), { tipo: 'tem_condicao', nome: 'caido' }] })}>Adicionar checagem de {escopo === 'se_alvo' ? 'alvo' : 'usuário'}</Button>
      </div>)}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {numeros.map(([chave, label]) => <label key={chave}>{label}<Input aria-label={`${label} ${i + 1}`} type="number" step={1} value={b[chave] ?? 0} onChange={e => set(i, { [chave]: Number(e.target.value) })} /></label>)}
        <label>Dano extra<Input aria-label={`Dano extra ${i + 1}`} value={b.dano_extra ?? ''} placeholder="2d6" onChange={e => set(i, { dano_extra: e.target.value })} /></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={!!b.vantagem_acerto} onChange={e => set(i, { vantagem_acerto: e.target.checked })} />Vantagem no acerto</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={!!b.desvantagem_tr_alvo} onChange={e => set(i, { desvantagem_tr_alvo: e.target.checked })} />Desvantagem no TR do alvo</label>
      </div>
      <p className="text-xs text-muted-foreground">Margem −2 facilita o crítico. Multiplicador +1 muda x2 para x3 nos dados. PV (%) não inclui PV temporários.</p>
    </div>)}
    <Button size="sm" variant="outline" onClick={() => onChange([...blocos, { id: crypto.randomUUID(), se_alvo: [{ tipo: 'tem_condicao', nome: 'caido' }] }])}>Adicionar condicional</Button>
  </div>;
}
