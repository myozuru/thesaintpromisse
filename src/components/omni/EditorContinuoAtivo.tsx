import type { AcaoAtivaConfig } from '@/lib/omni/tipos';
import { Input } from '@/components/ui/input';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from '@/types';

const sel = 'h-9 w-full rounded border border-input bg-background px-2 text-sm';
type Assist = NonNullable<AcaoAtivaConfig['assistencia_dano']>;

const ESCOPOS: { v: Assist['escopo']; r: string }[] = [
  { v: 'corpo_a_corpo', r: 'Ataques corpo a corpo' },
  { v: 'distancia', r: 'Ataques à distância' },
  { v: 'feitico', r: 'Feitiços' },
  { v: 'arma', r: 'Qualquer ataque com arma' },
  { v: 'arma_especifica', r: 'Armas específicas (nome ou grupo)' },
  { v: 'qualquer', r: 'Qualquer ataque' },
];

/** Cura que se repete todo turno + dano extra concedido ao alvo. */
export function EditorContinuoAtivo({ acao, onChange }: { acao: AcaoAtivaConfig; onChange: (p: Partial<AcaoAtivaConfig>) => void }) {
  const a = acao.assistencia_dano;
  const setA = (p: Partial<Assist>) => onChange({ assistencia_dano: { escopo: 'corpo_a_corpo', dano: '', consumo: 'proximo_acerto', ...a, ...p } });
  return <div className="space-y-2 rounded border border-border/50 p-2">
    {acao.tipo_efeito === 'cura' && <div className="grid grid-cols-2 gap-2">
      <label className="text-xs">Quando cura<select aria-label="Quando a cura acontece" className={sel} value={acao.continuo ? 'inicio_turno' : 'imediato'}
        onChange={e => onChange({ continuo: e.target.value === 'inicio_turno' ? { cadencia: 'inicio_turno', rodadas: acao.continuo?.rodadas } : undefined })}>
        <option value="imediato">Uma vez, ao usar</option>
        <option value="inicio_turno">Todo início de turno do alvo (contínua)</option>
      </select></label>
      {acao.continuo && <label className="text-xs">Rodadas (0 = enquanto sustentar)<Input aria-label="Rodadas da cura contínua" type="number" min={0} value={acao.continuo.rodadas ?? 0}
        onChange={e => onChange({ continuo: { cadencia: 'inicio_turno', rodadas: Math.max(0, Math.floor(Number(e.target.value) || 0)) } })} /></label>}
      {acao.continuo && <p className="col-span-2 text-xs text-muted-foreground">O efeito fica no alvo e rola a cura no começo de cada turno dele. Cada carga gasta (ex.: cada espírito) soma mais uma rolagem. Some quando a sustentação acaba ou o alvo se afasta além do alcance dela.</p>}
    </div>}
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" aria-label="Conceder dano extra" checked={!!a} onChange={e => onChange({ assistencia_dano: e.target.checked ? { escopo: 'corpo_a_corpo', dano: '1d4', consumo: 'proximo_acerto' } : undefined })} />
      Conceder dano extra ao alvo (assistência de dano)
    </label>
    {a && <div className="grid grid-cols-3 gap-2">
      <label className="text-xs">Vale para<select aria-label="Ataques que recebem o dano extra" className={sel} value={a.escopo} onChange={e => setA({ escopo: e.target.value as Assist['escopo'] })}>
        {ESCOPOS.map(o => <option key={o.v} value={o.v}>{o.r}</option>)}
      </select></label>
      <label className="text-xs">Dano extra<Input aria-label="Fórmula do dano extra" value={a.dano} placeholder="1d4" onChange={e => setA({ dano: e.target.value })} /></label>
      <label className="text-xs">Tipo<select aria-label="Tipo do dano extra" className={sel} value={a.tipoDano ?? ''} onChange={e => setA({ tipoDano: e.target.value || undefined })}>
        <option value="">Igual ao golpe</option>{DAMAGE_TYPES.map(d => <option key={d} value={d}>{DAMAGE_TYPE_LABELS[d]}</option>)}
      </select></label>
      {a.escopo === 'arma_especifica' && <label className="col-span-3 text-xs">Armas (separe por vírgula)<Input aria-label="Armas que recebem o dano extra" value={a.filtroArma ?? ''} placeholder="Katana, Espada Longa, lâminas" onChange={e => setA({ filtroArma: e.target.value })} /></label>}
      <label className="text-xs">Dura<select aria-label="Duração do dano extra" className={sel} value={a.consumo} onChange={e => setA({ consumo: e.target.value as Assist['consumo'] })}>
        <option value="proximo_acerto">Só no próximo acerto</option>
        <option value="duracao">Em todo acerto enquanto durar</option>
      </select></label>
      <label className="text-xs">Rodadas (0 = enquanto sustentar)<Input aria-label="Rodadas do dano extra" type="number" min={0} value={a.rodadas ?? 0} onChange={e => setA({ rodadas: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
      <p className="col-span-3 text-xs text-muted-foreground">Os dados extras rolam na mesa quando o alvo acerta um ataque compatível. Cada carga gasta multiplica os dados.</p>
    </div>}
  </div>;
}
