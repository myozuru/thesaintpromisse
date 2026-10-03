import type { AcaoAtivaConfig, DesfechoTRAtivo, EfeitoSecundarioAtivo } from '@/lib/omni/tipos';
import { ALL_CONDITIONS } from '@/types/conditions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
const graus = [['falha', 'Falha'], ['sucesso', 'Sucesso'], ['falha_critica', 'Falha crítica']] as const;
const formas = 'h-8 rounded border border-input bg-background px-2 text-xs';
export function EditorDesfechosTR({ acao, onChange }: { acao: AcaoAtivaConfig; onChange: (p: Partial<AcaoAtivaConfig>) => void }) {
  const setRamo = (grau: typeof graus[number][0], ramo?: DesfechoTRAtivo) => onChange({ desfechosTR: { ...acao.desfechosTR, [grau]: ramo } });
  return <div className="space-y-2 rounded border p-2">
    <p className="text-xs font-semibold">Desfechos do TR (opcionais)</p>
    <p className="text-xs text-muted-foreground">Falha crítica: natural 1 ou total pelo menos 5 abaixo da CD. Sem grau configurado, vale a regra antiga.</p>
    {graus.map(([id, nome]) => {
      const ramo = acao.desfechosTR?.[id];
      return <fieldset key={id} className="space-y-2 rounded border p-2"><legend className="text-xs">
        <label className="flex items-center gap-2"><input aria-label={`Configurar ${nome}`} type="checkbox" checked={!!ramo} onChange={e => setRamo(id, e.target.checked ? {} : undefined)} />{nome}</label>
      </legend>{ramo && <>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Dano<select aria-label={`Dano em ${nome}`} className={formas + ' block w-full'} value={ramo.dano ?? 'total'} onChange={e => setRamo(id, { ...ramo, dano: e.target.value as DesfechoTRAtivo['dano'] })}>
            <option value="total">Total</option><option value="metade">Metade</option><option value="nenhum">Nenhum</option>
          </select></label>
          <label className="text-xs">Dano extra<Input aria-label={`Dano extra em ${nome}`} value={ramo.dano_extra ?? ''} placeholder="2d6+3" onChange={e => setRamo(id, { ...ramo, dano_extra: e.target.value || undefined })} /></label>
          <label className="text-xs">Multiplicador da duração<Input aria-label={`Multiplicador da duração em ${nome}`} type="number" min={0.1} step={0.5} value={ramo.multiplicador_duracao ?? 1} onChange={e => setRamo(id, { ...ramo, multiplicador_duracao: Number(e.target.value) })} /></label>
          <label className="flex items-center gap-2 pt-5 text-xs"><input aria-label={`Maximizar dano em ${nome}`} type="checkbox" checked={!!ramo.dano_maximizado} onChange={e => setRamo(id, { ...ramo, dano_maximizado: e.target.checked })} />Maximizar os dados</label>
        </div>
        {(ramo.efeitos ?? []).map((ef, k) => {
          const setEf = (n: EfeitoSecundarioAtivo) => { const efeitos = [...(ramo.efeitos ?? [])]; efeitos[k] = n; setRamo(id, { ...ramo, efeitos }); };
          return <div key={k} className="flex gap-1 items-center">
            <select aria-label={`Efeito ${nome} ${k + 1}`} className={formas} value={ef.tipo === 'movimento' ? ef.movimento_tipo : ef.tipo} onChange={e => { const t = e.target.value; setEf(t === 'condicao' ? { tipo: 'condicao', condicao: ALL_CONDITIONS[0]?.id ?? '', rodadas: 1 } : { tipo: 'movimento', movimento_tipo: t as import('@/lib/omni/tipos').TipoMovimentoAtivo, movimento_distancia: '3', movimento_alvo: 'alvo' }); }}>
              <option value="condicao">Condição</option><option value="puxar">Puxar</option><option value="empurrar">Empurrar</option><option value="avancar_ate">Avançar até</option><option value="teleporte">Teleporte</option><option value="trocar_posicao">Trocar posição</option>
            </select>
            {ef.tipo === 'condicao' ? <><select aria-label={`Condição ${nome} ${k + 1}`} className={formas} value={ef.condicao} onChange={e => setEf({ ...ef, condicao: e.target.value })}>{ALL_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Input aria-label={`Duração ${nome} ${k + 1}`} type="number" min={0} value={ef.rodadas} onChange={e => setEf({ ...ef, rodadas: Number(e.target.value) })} /></> : ef.tipo === 'movimento' ? <Input aria-label={`Distância ${nome} ${k + 1}`} value={ef.movimento_distancia} onChange={e => setEf({ ...ef, movimento_distancia: e.target.value })} /> : <Input aria-label={`Distância ${nome} ${k + 1}`} type="number" value={ef.metros} onChange={e => setEf({ tipo: 'movimento', movimento_tipo: ef.tipo, movimento_distancia: e.target.value, movimento_alvo: 'alvo' })} />}
            <Button size="sm" variant="ghost" aria-label={`Remover efeito ${nome} ${k + 1}`} onClick={() => setRamo(id, { ...ramo, efeitos: ramo.efeitos!.filter((_, j) => j !== k) })}><Trash2 className="h-3 w-3" /></Button>
          </div>;
        })}
        <Button size="sm" variant="outline" onClick={() => setRamo(id, { ...ramo, efeitos: [...(ramo.efeitos ?? []), { tipo: 'condicao', condicao: ALL_CONDITIONS[0]?.id ?? '', rodadas: 1 }] })}><Plus className="mr-1 h-3 w-3" />Efeito deste grau</Button>
      </>}</fieldset>;
    })}
  </div>;
}
