import { useState } from 'react';
import { EditorSuporteAtivo, ehSuporteAtivo, efeitoSuporteInicial } from './EditorSuporteAtivo';
import { EditorDesfechosTR } from './EditorDesfechosTR';
import { EditorReacoesAtivas } from './EditorReacoesAtivas';
import { EditorCustosAtivos } from './EditorCustosAtivos';
import { EditorCondicionaisAtivos } from './EditorCondicionaisAtivos';
/** Editor no-code das ações ativas genéricas de uma entidade OMNI. */
import type { AcaoAtivaConfig, EfeitoSecundarioAtivo, EntidadeOmni, TrNome } from '@/lib/omni/tipos';
import { novaAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { copiarAcaoAtiva, criarAcaoDePreset, lerPresetsAcoesAtivas, salvarPresetAcaoAtiva, type PresetAcaoAtiva } from '@/lib/omni/presetsAcoesAtivas';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from '@/types';
import { ORDEM_PERICIAS, ORDEM_TR, ROTULOS_PERICIAS, ROTULOS_TR } from '@/lib/omni/constantesDoSistema';
import { resolverTipoDano } from '@/lib/omni/contextoDano';
import { ALL_CONDITIONS } from '@/types/conditions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy, Plus, Save, Trash2 } from 'lucide-react';

const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const TRS: [TrNome, string][] = ORDEM_TR.map((key) => [key.toLocaleLowerCase() as TrNome, ROTULOS_TR[key].replace(/^TR — /, '')]);

export function EditorAcoesAtivas({ ent, setEnt }: { ent: EntidadeOmni; setEnt: (e: EntidadeOmni) => void }) {
  const lista = ent.acoesAtivas ?? [];
  const [presets, setPresets] = useState<PresetAcaoAtiva[]>(() => lerPresetsAcoesAtivas());
  const [presetSelecionado, setPresetSelecionado] = useState('');
  const [nomePreset, setNomePreset] = useState('');
  const set = (i: number, p: Partial<AcaoAtivaConfig>) => {
    const nx = [...lista]; nx[i] = { ...nx[i], ...p }; setEnt({ ...ent, acoesAtivas: nx });
  };
  return (
    <div className="space-y-3" data-testid="omni-acoes-ativas">
      <p className="text-xs text-muted-foreground">
        Ações que o jogador usa no painel de ataque: custo, alcance, teste (TR ou ataque), dano, cargas e efeitos.
        Custos e cargas são pagos antes de rolar.
      </p>
      {lista.length === 0 && (
        <div className="rounded-md border border-dashed border-primary/40 p-4 text-center text-sm text-muted-foreground">
          Nenhuma ação ativa ainda. Clique em <b className="text-primary">Nova ação ativa</b> abaixo para criar a primeira.
        </div>
      )}
      {lista.map((a, i) => (
        <div key={a.id} className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-3 text-sm [&_label]:text-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">⚡ Ação {i + 1} — Identificação</div>
          <div className="flex gap-2">
            <Input aria-label="Nome da ação" className="font-semibold" value={a.nome} onChange={(e) => set(i, { nome: e.target.value })} placeholder="Nome da ação (ex.: Corte da Injustiça)" />
            <Button size="sm" variant="outline" title="Duplicar ação" aria-label={`Duplicar ação ${a.nome}`} onClick={() => setEnt({ ...ent, acoesAtivas: [...lista.slice(0, i + 1), copiarAcaoAtiva(a), ...lista.slice(i + 1)] })}><Copy className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" title="Salvar esta ação como preset" aria-label={`Salvar preset de ${a.nome}`} onClick={() => {
              const nome = nomePreset || a.nome;
              const atualizado = salvarPresetAcaoAtiva(presets, a, nome);
              setPresets(atualizado); setPresetSelecionado(atualizado.at(-1)?.id ?? ''); setNomePreset('');
            }}><Save className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setEnt({ ...ent, acoesAtivas: lista.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="border-t border-border/50 pt-2 text-xs font-bold uppercase tracking-wider text-primary">Execução e alvos</div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Ação</Label>
              <select className={sel} value={a.acao} onChange={(e) => set(i, { acao: e.target.value as AcaoAtivaConfig['acao'] })}>
                <option value="comum">Comum</option><option value="bonus">Bônus</option><option value="reacao">Reação</option><option value="movimento">Movimento</option><option value="livre">Livre</option>
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
          <div className="border-t border-border/50 pt-2 text-xs font-bold uppercase tracking-wider text-primary">Teste</div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Teste</Label>
              <select aria-label="Teste da ação" className={sel} value={a.teste} onChange={(e) => set(i, { teste: e.target.value as AcaoAtivaConfig['teste'] })}>
                <option value="nenhum">Nenhum</option><option value="tr">TR do alvo</option><option value="ataque">Ataque com arma</option><option value="disputa">Disputa de perícias</option>
              </select></div>
            {a.teste === 'ataque' && (
              <label className="flex items-center gap-2 text-xs col-span-2">
                <input aria-label="TR após acerto" type="checkbox" checked={!!a.tr_apos_acerto} onChange={(e) => set(i, { tr_apos_acerto: e.target.checked })} /> Ao acertar, o alvo faz TR contra os efeitos (dano entra sempre)
              </label>
            )}
            {(a.teste === 'tr' || (a.teste === 'ataque' && a.tr_apos_acerto)) && <>
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
          {a.teste === 'disputa' && <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Perícia do usuário<select aria-label="Perícia do usuário" className={sel} value={a.pericia_usuario ?? 'atletismo'} onChange={e => set(i, { pericia_usuario: e.target.value })}>
              {ORDEM_PERICIAS.map(key => <option key={key} value={ROTULOS_PERICIAS[key]}>{ROTULOS_PERICIAS[key]}</option>)}
            </select></label>
            <label className="text-xs">Perícias possíveis do alvo<select aria-label="Perícias possíveis do alvo" className={sel} multiple value={a.pericias_alvo ?? ['atletismo', 'acrobacia']} onChange={e => set(i, { pericias_alvo: Array.from(e.target.selectedOptions, option => option.value) })}>
              {ORDEM_PERICIAS.map(key => <option key={key} value={ROTULOS_PERICIAS[key]}>{ROTULOS_PERICIAS[key]}</option>)}
            </select><span className="text-xs text-muted-foreground">Selecione uma ou mais opções; o alvo usa a perícia de maior bônus. Empate favorece o alvo.</span></label>
          </div>}
          {(a.teste === 'tr' || (a.teste === 'ataque' && a.tr_apos_acerto)) && <EditorDesfechosTR acao={a} onChange={p => set(i, p)} />}
          {a.teste === 'tr' && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!a.metadeNoSucesso} onChange={(e) => set(i, { metadeNoSucesso: e.target.checked })} /> Metade do dano no sucesso por padrão legado (senão, nada)
            </label>
          )}
          <div className="border-t border-border/50 pt-2 text-xs font-bold uppercase tracking-wider text-primary">Dano, cura e cargas</div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs">Tipo de efeito<select aria-label="Tipo de efeito" className={sel} value={a.tipo_efeito ?? 'dano'} onChange={e => set(i, { tipo_efeito: e.target.value as AcaoAtivaConfig['tipo_efeito'], ...(e.target.value === 'cura' ? { teste: 'nenhum', filtro_alvo: 'aliados' } : {}) })}><option value="dano">Dano</option><option value="cura">Cura / recuperação</option><option value="buff">Somente efeitos</option></select></label>
            {a.tipo_efeito === 'cura' && <>
              <label className="text-xs">Valor da recuperação<Input aria-label="Valor da recuperação" value={a.cura ?? ''} placeholder="2d8 + @USUARIO.treino" onChange={e => set(i, { cura: e.target.value })} /></label>
              <label className="text-xs">Recurso<select aria-label="Recurso da recuperação" className={sel} value={a.recurso_cura ?? 'pv'} onChange={e => set(i, { recurso_cura: e.target.value as 'pv' | 'pe' })}><option value="pv">PV</option><option value="pe">PE</option></select></label>
            </>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Dano (ex.: 6d8)</Label><Input aria-label={`Dano de ${a.nome}`} value={a.dano ?? ''} placeholder="@ARMA.DANO + 2d8" onChange={(e) => set(i, { dano: e.target.value })} /><p className="text-xs text-muted-foreground">Fórmula: @ARMA.DANO, @ARMA.DADOS, @ARMA.PASSO, @ARMA.CRITICO_MARGEM</p></div>
            <div><Label className="text-xs" htmlFor={`tipo-dano-${a.id}`}>Tipo de dano</Label>
              <select id={`tipo-dano-${a.id}`} className={sel} value={resolverTipoDano(a.tipoDano) ?? a.tipoDano ?? ''} onChange={(e) => set(i, { tipoDano: e.target.value })}>
                <option value="">—</option>{DAMAGE_TYPES.map((d) => <option key={d} value={d}>{DAMAGE_TYPE_LABELS[d]}</option>)}
                {a.tipoDano && !resolverTipoDano(a.tipoDano) && <option value={a.tipoDano}>{a.tipoDano} (sem equivalência)</option>}
              </select>
              {a.tipoDano && !resolverTipoDano(a.tipoDano) && <p className="text-xs text-amber-600">Escolha um tipo reconhecido para aplicar resistências e imunidades específicas.</p>}
              {a.tipoDano && <p className="text-xs text-muted-foreground">Aplica este tipo também ao dano herdado da arma.</p>}
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
          <EditorReacoesAtivas acao={a} onChange={p => set(i, p)} />
          <EditorCondicionaisAtivos blocos={a.condicionais ?? []} onChange={condicionais => set(i, { condicionais })} />
          <div className="border-t border-border/50 pt-2 text-xs font-bold uppercase tracking-wider text-primary">Efeitos secundários</div>
          <div className="space-y-1">
            <Label className="text-xs">Efeitos padrão (falha do TR ou acerto; graus do TR podem substituir)</Label>
            {(a.efeitos ?? []).map((ef, k) => {
              const setEf = (n: EfeitoSecundarioAtivo) => { const e2 = [...(a.efeitos ?? [])]; e2[k] = n; set(i, { efeitos: e2 }); };
              return (
                <div key={k} className="flex gap-2 items-center">
                  <select aria-label={`Efeito ${i + 1} ${k + 1}`} className={sel + ' w-32'} value={ef.tipo === 'movimento' ? ef.movimento_tipo : ef.tipo} onChange={(e) => {
                    const t = e.target.value;
                    setEf(efeitoSuporteInicial(t) ?? (t === 'condicao' ? { tipo: 'condicao', condicao: ALL_CONDITIONS[0]?.id ?? '', rodadas: 1 } : { tipo: 'movimento', movimento_tipo: t as import('@/lib/omni/tipos').TipoMovimentoAtivo, movimento_distancia: '3', movimento_alvo: 'usuario' }));
                  }}>
                    <option value="condicao">Condição</option><option value="pv_temporarios">PV temporários</option><option value="escudo">Escudo</option><option value="remover_condicao">Remover condição</option><option value="puxar">Puxar</option><option value="empurrar">Empurrar</option><option value="avancar_ate">Avançar até</option><option value="teleporte">Teleporte</option><option value="trocar_posicao">Trocar posição</option>
                  </select>
                  {ehSuporteAtivo(ef) ? <EditorSuporteAtivo efeito={ef} onChange={setEf} rotulo={`${i + 1} ${k + 1}`} /> : ef.tipo === 'condicao' ? <>
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
      <div className="rounded-md border border-border/60 p-3 space-y-2">
        <Label className="text-xs">Biblioteca de ações ativas</Label>
        <div className="flex gap-2">
          <Input aria-label="Nome do preset" value={nomePreset} onChange={e => setNomePreset(e.target.value)} placeholder="Nome do novo preset" />
          <span className="self-center text-xs text-muted-foreground">Use o ícone de salvar na ação que deseja guardar.</span>
        </div>
        <div className="flex gap-2">
          <select aria-label="Preset de ação" className={sel} value={presetSelecionado} onChange={e => setPresetSelecionado(e.target.value)}>
            <option value="">Escolha um preset salvo</option>{presets.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={!presetSelecionado} onClick={() => {
            const preset = presets.find(p => p.id === presetSelecionado);
            if (preset) setEnt({ ...ent, acoesAtivas: [...lista, criarAcaoDePreset(preset)] });
          }}><Plus className="h-3 w-3 mr-1" />Adicionar preset</Button>
        </div>
        <p className="text-xs text-muted-foreground">Os presets ficam salvos neste navegador. Para salvar outra ação, use o botão Salvar preset na própria ação.</p>
      </div>
      <Button size="sm" variant="outline" data-testid="omni-nova-acao-ativa" onClick={() => setEnt({ ...ent, acoesAtivas: [...lista, novaAcaoAtiva()] })}>
        <Plus className="h-3 w-3 mr-1" />Nova ação ativa
      </Button>
    </div>
  );
}
