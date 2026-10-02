import { EditorCustosAtivos } from './EditorCustosAtivos';
import { EditorCondicionaisAtivos } from './EditorCondicionaisAtivos';
/** Editor no-code das ações ativas genéricas de uma entidade OMNI. */
import type { AcaoAtivaConfig, EfeitoSecundarioAtivo, EntidadeOmni, TrNome } from '@/lib/omni/tipos';
import { novaAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from '@/types';
import { resolverTipoDano } from '@/lib/omni/contextoDano';
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
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Tipo de alvo</Label>
              <select aria-label="Tipo de alvo" className={sel} value={a.tipo_alvo ?? 'unico'} onChange={e => set(i, { tipo_alvo: e.target.value as AcaoAtivaConfig['tipo_alvo'], ...(e.target.value === 'area' && !a.area ? { area: { forma: 'cone' as const, tamanho_m: 6 } } : {}) })}>
                <option value="unico">Único</option><option value="multiplo">Múltiplo</option><option value="area">Área</option><option value="proprio">Próprio</option>
              </select></div>
            <div><Label className="text-xs">Filtro de alvos</Label>
              <select aria-label="Filtro de alvos" className={sel} value={a.filtro_alvo ?? (a.tipo_alvo === 'proprio' ? 'todos' : 'todos_exceto_si')} onChange={e => set(i, { filtro_alvo: e.target.value as AcaoAtivaConfig['filtro_alvo'] })}>
                <option value="inimigos">Inimigos</option><option value="aliados">Aliados</option><option value="todos">Todos</option><option value="todos_exceto_si">Todos exceto si</option>
              </select></div>
          </div>
          {a.tipo_alvo === 'multiplo' && <div><Label className="text-xs">Máximo de alvos (fórmula)</Label><Input aria-label="Máximo de alvos" value={a.max_alvos ?? '1'} placeholder="@USUARIO.treino" onChange={e => set(i, { max_alvos: e.target.value })} /></div>}
          {a.tipo_alvo === 'area' && <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Forma da área</Label><select aria-label="Forma da área" className={sel} value={a.area?.forma ?? 'cone'} onChange={e => set(i, { area: { tamanho_m: a.area?.tamanho_m ?? 6, ...a.area, forma: e.target.value as NonNullable<AcaoAtivaConfig['area']>['forma'] } })}>
              <option value="cone">Cone</option><option value="linha">Linha</option><option value="raio_em_si">Raio em si</option><option value="raio_no_ponto">Raio no ponto</option>
            </select></div>
            <div><Label className="text-xs">Raio / comprimento (m)</Label><Input aria-label="Tamanho da área" type="number" min={0.1} step={1.5} value={a.area?.tamanho_m ?? 6} onChange={e => set(i, { area: { forma: 'cone', ...a.area, tamanho_m: Number(e.target.value) } })} /></div>
            {(a.area?.forma === 'linha') && <div><Label className="text-xs">Largura (m)</Label><Input aria-label="Largura da linha" type="number" min={0.1} step={1.5} value={a.area?.largura_m ?? 1.5} onChange={e => set(i, { area: { forma: 'linha', tamanho_m: 6, ...a.area, largura_m: Number(e.target.value) } })} /></div>}
          </div>}
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
          {a.teste === 'tr' && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!a.metadeNoSucesso} onChange={(e) => set(i, { metadeNoSucesso: e.target.checked })} /> Metade do dano no sucesso (senão, nada)
            </label>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Dano (ex.: 6d8)</Label><Input value={a.dano ?? ''} onChange={(e) => set(i, { dano: e.target.value })} /></div>
            <div><Label className="text-xs" htmlFor={`tipo-dano-${a.id}`}>Tipo de dano</Label>
              <select id={`tipo-dano-${a.id}`} className={sel} value={resolverTipoDano(a.tipoDano) ?? a.tipoDano ?? ''} onChange={(e) => set(i, { tipoDano: e.target.value })}>
                <option value="">—</option>{DAMAGE_TYPES.map((d) => <option key={d} value={d}>{DAMAGE_TYPE_LABELS[d]}</option>)}
                {a.tipoDano && !resolverTipoDano(a.tipoDano) && <option value={a.tipoDano}>{a.tipoDano} (sem equivalência)</option>}
              </select>
              {a.tipoDano && !resolverTipoDano(a.tipoDano) && <p className="text-xs text-amber-600">Escolha um tipo reconhecido para aplicar resistências e imunidades específicas.</p>}
            </div>
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
                <Input value={a.margemCritico?.condicao ?? ''} placeholder="@ALVO.condicao_idade_rodadas_condenado >= 3" onChange={(e) => set(i, { margemCritico: e.target.value ? { condicao: e.target.value, reducao: a.margemCritico?.reducao ?? 2 } : undefined })} /></div>
              <div><Label className="text-xs">Reduz a margem em</Label>
                <Input type="number" min={0} disabled={!a.margemCritico} value={a.margemCritico?.reducao ?? 2} onChange={(e) => a.margemCritico && set(i, { margemCritico: { ...a.margemCritico, reducao: Math.max(0, parseInt(e.target.value, 10) || 0) } })} /></div>
            </div>
          )}
          <EditorCustosAtivos acao={a} onChange={p => set(i, p)} />
          {a.teste === 'ataque' && <label className="text-xs">Modificador de acerto<Input aria-label="Modificador de acerto" type="number" value={a.mod_acerto ?? 0} onChange={e => set(i, { mod_acerto: Number(e.target.value) })} /></label>}
          <EditorCondicionaisAtivos blocos={a.condicionais ?? []} onChange={condicionais => set(i, { condicionais })} />
          <div className="space-y-1">
            <Label className="text-xs">Efeitos (se o TR falhar / o ataque acertar)</Label>
            {(a.efeitos ?? []).map((ef, k) => {
              const setEf = (n: EfeitoSecundarioAtivo) => { const e2 = [...(a.efeitos ?? [])]; e2[k] = n; set(i, { efeitos: e2 }); };
              return (
                <div key={k} className="flex gap-2 items-center">
                  <select aria-label={`Efeito ${i + 1} ${k + 1}`} className={sel + ' w-32'} value={ef.tipo === 'movimento' ? ef.movimento_tipo : ef.tipo} onChange={(e) => {
                    const t = e.target.value;
                    setEf(t === 'condicao' ? { tipo: 'condicao', condicao: ALL_CONDITIONS[0]?.id ?? '', rodadas: 1 } : { tipo: 'movimento', movimento_tipo: t as import('@/lib/omni/tipos').TipoMovimentoAtivo, movimento_distancia: '3', movimento_alvo: 'usuario' });
                  }}>
                    <option value="condicao">Condição</option><option value="puxar">Puxar</option><option value="empurrar">Empurrar</option><option value="avancar_ate">Avançar até</option><option value="teleporte">Teleporte</option><option value="trocar_posicao">Trocar posição</option>
                  </select>
                  {ef.tipo === 'condicao' ? <>
                    <select className={sel} value={ef.condicao} onChange={(e) => setEf({ ...ef, condicao: e.target.value })}>
                      {ALL_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Input className="w-24" type="number" min={0} value={ef.rodadas} title="Rodadas (0 = até remover)" onChange={(e) => setEf({ ...ef, rodadas: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                  </> : ef.tipo === 'movimento' ? <>
                    <Input className="w-40" aria-label={`Distância do movimento ${i + 1} ${k + 1}`} value={ef.movimento_distancia} placeholder="3 * @USUARIO.foco" onChange={e => setEf({ ...ef, movimento_distancia: e.target.value })} />
                    {ef.movimento_tipo === 'teleporte' && <select className={sel} aria-label={`Quem teleporta ${i + 1} ${k + 1}`} value={ef.movimento_alvo ?? 'usuario'} onChange={e => setEf({ ...ef, movimento_alvo: e.target.value as 'usuario' | 'alvo' })}><option value="usuario">Usuário</option><option value="alvo">Alvo</option></select>}
                  </> : (
                    <Input className="w-40" aria-label={`Distância do movimento ${i + 1} ${k + 1}`} value={String(ef.metros)} title="Metros ou fórmula" onChange={e => setEf({ tipo: 'movimento', movimento_tipo: ef.tipo, movimento_distancia: e.target.value })} />
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
