import type { EfeitoSecundarioAtivo } from '@/lib/omni/tipos';
import { ALL_CONDITIONS } from '@/types/conditions';
import { Input } from '@/components/ui/input';

export type EfeitoSuporteAtivo = Extract<EfeitoSecundarioAtivo, { tipo: 'remover_condicao' | 'escudo' | 'pv_temporarios' }>;
export function efeitoSuporteInicial(tipo: string): EfeitoSuporteAtivo | undefined {
  if (tipo === 'remover_condicao') return { tipo, condicao: 'todas' };
  if (tipo === 'escudo' || tipo === 'pv_temporarios') return { tipo, valor: '5', rodadas: 1 };
}
export function ehSuporteAtivo(ef: EfeitoSecundarioAtivo): ef is EfeitoSuporteAtivo {
  return ef.tipo === 'remover_condicao' || ef.tipo === 'escudo' || ef.tipo === 'pv_temporarios';
}
export function EditorSuporteAtivo({ efeito, onChange, rotulo }: { efeito: EfeitoSuporteAtivo; onChange: (e: EfeitoSecundarioAtivo) => void; rotulo: string }) {
  if (efeito.tipo === 'remover_condicao') return <select aria-label={`Remover condição ${rotulo}`} className="h-9 rounded border border-input bg-background px-2 text-sm" value={efeito.condicao} onChange={e => onChange({ ...efeito, condicao: e.target.value })}>
    <option value="todas">Todas as condições</option>
    {ALL_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
  </select>;
  return <>
    <label className="text-xs">Valor<Input aria-label={`Valor da proteção ${rotulo}`} value={efeito.valor} placeholder="2d8 + @USUARIO.treino" onChange={e => onChange({ ...efeito, valor: e.target.value })} /></label>
    <label className="text-xs">Rodadas (0 = até remover)<Input aria-label={`Duração da proteção ${rotulo}`} type="number" min={0} step={1} value={efeito.rodadas} onChange={e => onChange({ ...efeito, rodadas: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
  </>;
}
