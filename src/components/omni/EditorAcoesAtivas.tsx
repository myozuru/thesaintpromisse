/** Editor no-code das ações ativas genéricas de uma entidade OMNI. */
import type { AcaoAtivaConfig, EfeitoSecundarioAtivo, EntidadeOmni, TrNome } from '@/lib/omni/tipos';
import { novaAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { DAMAGE_TYPES } from '@/lib/omni/constantesDoSistema';
import { ALL_CONDITIONS } from '@/types/conditions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const TRS: [TrNome, string][] = [['astucia', 'Astúcia'], ['fortitude', 'Fortitude'], ['integridade', 'Integridade'], ['reflexos', 'Reflexos'], ['vontade', 'Vontade']];

export function EditorAcoesAtivas({ ent, setEnt }: { ent: EntidadeOmni; setEnt: (e: EntidadeOmni) => void }) {
  const lista = ent.acoesAtivas ?? [];
  const set = (i: number, p: Partial<AcaoAtivaConfig>) => {
    const nx = [...lista]; nx[i] = { ...nx[i], ...p }; setEnt({ ...ent, acoesAtivas: nx });
  };
  return (
    <div className="space-y-3" data-testid="omni-acoes-ativas">
      <p className="text-xs text-muted-foreground">
        Ações que o jogador usa no painel de ataque: custo, alcance, teste (TR ou ataque), dano, cargas e efeitos.
        Custos e cargas são pagos antes de rolar.
      </p>
      {lista.map((a, i) => (
        <div key={a.id} className="rounded-md border border-border/60 p-3 space-y-2">
          <div className="flex gap-2">
            <Input value={a.nome} onChange={(e) => set(i, { nome: e.target.value })} placeholder="Nome" />
            <Button size="sm" variant="ghost" onClick={() => setEnt({ ...ent, acoesAtivas: lista.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Ação</Label>
              <select className={sel} value={a.acao} onChange={(e) => set(i, { acao: e.target.value as AcaoAtivaConfig['acao'] })}>
                <option value="comum">Comum</option><option value="bonus">Bônus</option><option value="reacao">Reação</option><option value="livre">Livre</option>
              </select></div>
            <div><Label className="text-xs">Custo PE (fórmula)</Label><Input value={a.custoPE} onChange={(e) => set(i, { custoPE: e.target.value })} /></div>
            <div><Label className="text-xs">Alcance (m, 0 = livre)</Label><Input type="number" step={1.5} value={a.alcanceM} onChange={(e) => set(i, { alcanceM: Math.max(0, parseFloat(e.target.value) || 0) })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Teste</Label>
              <select className={sel} value={a.teste} onChange={(e) => set(i, { teste: e.target.value as AcaoAtivaConfig['teste'] })}>
                <option value="nenhum">Nenhum</option><option value="tr">TR do alvo</option><option value="ataque">Ataque com arma</option>
              </select></div>
            {a.teste === 'tr' && <>
              <div><Label className="text-xs">TR</Label>
                <select className={sel} value={a.tr ?? 'fortitude'} onChange={(e) => set(i, { tr: e.target.value as TrNome })}>
                  {TRS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select></div>
              <div><Label className="text-xs">CD (vazio = Especialização)</Label><Input value={a.cd ?? ''} onChange={(e) => set(i, { cd: e.target.value })} /></div>
            </>}
            {a.teste === 'ataque' && (
              <label className="flex items-center gap-2 text-xs col-span-2 pt-5">
                <input type="checkbox" checked={!!a.incluirArma} onChange={(e) => set(i, { incluirArma: e.target.checked })} /> Somar dano da arma
              </label>
            )}
          </div>
          <div><Label className="text-xs">Cooldown (turnos, 0 = nenhum)</Label><Input type="number" min={0} value={a.cooldownTurnos ?? 0} onChange={(e) => set(i, { cooldownTurnos: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></div>
          {a.teste === 'tr' && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!a.metadeNoSucesso} onChange={(e) => set(i, { metadeNoSucesso: e.target.checked })} /> Metade do dano no sucesso (senão, nada)
            </label>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Dano (ex.: 6d8)</Label><Input value={a.dano ?? ''} onChange={(e) => set(i, { dano: e.target.value })} /></div>
            <div><Label className="text-xs">Tipo de dano</Label>
              <select className={sel} value={a.tipoDano ?? ''} onChange={(e) => set(i, { tipoDano: e.target.value })}>
                <option value="">—</option>{DAMAGE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div><Label className="text-xs">Dados por carga</Label><Input value={a.dadosPorCarga ?? ''} onChange={(e) => set(i, { dadosPorCarga: e.target.value })} placeholder="1d8" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Consumir contador (nome)</Label>
              <Input value={a.consumirContador?.nome ?? ''} onChange={(e) => set(i, { consumirContador: e.target.value ? { nome: e.target.value, minimo: a.consumirContador?.minimo ?? 1 } : undefined })} /></div>
            <div><Label className="text-xs">Mínimo de cargas</Label>
              <Input type="number" min={1} disabled={!a.consumirContador} value={a.consumirContador?.minimo ?? 1} onChange={(e) => a.consumirContador && set(i, { consumirContador: { ...a.consumirContador, minimo: Math.max(1, parseInt(e.target.value, 10) || 1) } })} /></div>
          </div>
          {a.teste === 'ataque' && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Margem de crítico: condição</Label>
                <Input value={a.margemCritico?.condicao ?? ''} placeholder="@ALVO.condicao_rodadas_condenado > 3" onChange={(e) => set(i, { margemCritico: e.target.value ? { condicao: e.target.value, reducao: a.margemCritico?.reducao ?? 2 } : undefined })} /></div>
              <div><Label className="text-xs">Reduz a margem em</Label>
                <Input type="number" min={0} disabled={!a.margemCritico} value={a.margemCritico?.reducao ?? 2} onChange={(e) => a.margemCritico && set(i, { margemCritico: { ...a.margemCritico, reducao: Math.max(0, parseInt(e.target.value, 10) || 0) } })} /></div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Efeitos (se o TR falhar / o ataque acertar)</Label>
            {(a.efeitos ?? []).map((ef, k) => {
              const setEf = (n: EfeitoSecundarioAtivo) => { const e2 = [...(a.efeitos ?? [])]; e2[k] = n; set(i, { efeitos: e2 }); };
              return (
                <div key={k} className="flex gap-2 items-center">
                  <select className={sel + ' w-32'} value={ef.tipo} onChange={(e) => {
                    const t = e.target.value;
                    setEf(t === 'condicao' ? { tipo: 'condicao', condicao: ALL_CONDITIONS[0]?.id ?? '', rodadas: 1 } : { tipo: t as 'puxar' | 'empurrar', metros: 1.5 });
                  }}>
                    <option value="condicao">Condição</option><option value="puxar">Puxar</option><option value="empurrar">Empurrar</option>
                  </select>
                  {ef.tipo === 'condicao' ? <>
                    <select className={sel} value={ef.condicao} onChange={(e) => setEf({ ...ef, condicao: e.target.value })}>
                      {ALL_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Input className="w-24" type="number" min={0} value={ef.rodadas} title="Rodadas (0 = até remover)" onChange={(e) => setEf({ ...ef, rodadas: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                  </> : (
                    <Input className="w-28" type="number" step={1.5} value={ef.metros} title="Metros" onChange={(e) => setEf({ ...ef, metros: Math.max(0, parseFloat(e.target.value) || 0) })} />
                  )}
                  <Button size="sm" variant="ghost" onClick={() => set(i, { efeitos: (a.efeitos ?? []).filter((_, j) => j !== k) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            <Button size="sm" variant="outline" onClick={() => set(i, { efeitos: [...(a.efeitos ?? []), { tipo: 'condicao', condicao: ALL_CONDITIONS[0]?.id ?? '', rodadas: 1 }] })}><Plus className="h-3 w-3 mr-1" />Efeito</Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" data-testid="omni-nova-acao-ativa" onClick={() => setEnt({ ...ent, acoesAtivas: [...lista, novaAcaoAtiva()] })}>
        <Plus className="h-3 w-3 mr-1" />Nova ação ativa
      </Button>
    </div>
  );
}
