/** Aba de Conquistas do Diário: vitrine do jogador e ferramentas do Mestre. */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConquistaStore, listarConquistas, desbloqueioAtivo } from '@/stores/useConquistaStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { desbloquearConquista } from '@/lib/conquistas/motor';
import { RARIDADES, RARIDADE_INFO, type ConquistaDef, type RaridadeConquista, type RecompensaConquista } from '@/lib/conquistas/tipos';

const rarStyle = (r: RaridadeConquista) => ({ ['--rar' as string]: `var(--raridade-${r})`, borderColor: `hsl(var(--raridade-${r}))` });
const corTexto = (r: RaridadeConquista) => ({ color: `hsl(var(--raridade-${r}))` });

export function PainelConquistas({ charId, master }: { charId?: string; master: boolean }) {
  const defsMap = useConquistaStore((s) => s.defs);
  const desbloqueios = useConquistaStore((s) => s.desbloqueios);
  const titulos = useConquistaStore((s) => s.titulos);
  const chars = useCharacterStore((s) => s.characters);
  const jogadores = useMemo(() => chars.filter((c) => c.category === 'PLAYER'), [chars]);
  const [alvo, setAlvo] = useState<string>(charId ?? '');
  const [filtro, setFiltro] = useState<RaridadeConquista | 'todas'>('todas');
  const [editando, setEditando] = useState<ConquistaDef | null>(null);
  const atual = master ? alvo || jogadores[0]?.id || '' : charId ?? '';
  const lista = listarConquistas(defsMap);
  const st = { desbloqueios };
  const obtidas = lista.filter((c) => desbloqueioAtivo(st, atual, c.id));
  const pontos = obtidas.reduce((n, c) => n + RARIDADE_INFO[c.raridade].pontos, 0);
  const pct = lista.length ? Math.round((obtidas.length / lista.length) * 100) : 0;
  const titulosDisp = obtidas.flatMap((c) => c.recompensas.filter((r) => r.tipo === 'titulo').map((r) => (r as { texto: string }).texto));

  if (editando) return <EditorConquista def={editando} onClose={() => setEditando(null)} />;

  return (
    <div className="space-y-3 text-sm" data-painel-conquistas>
      {master && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Personagem" className="rounded border border-border bg-background px-2 py-1" value={atual} onChange={(e) => setAlvo(e.target.value)}>
            {jogadores.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => setEditando({ id: `custom-${crypto.randomUUID().slice(0, 8)}`, titulo: '', descricao: '', requisito: '', icone: '🏆', raridade: 'comum', secreta: false, gatilho: 'manual', recompensas: [], updatedAt: 0 })}>+ Nova conquista</Button>
        </div>
      )}
      {!atual ? <p className="py-6 text-center text-muted-foreground">Nenhuma ficha vinculada.</p> : (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground"><span>{obtidas.length}/{lista.length} conquistas · {pontos} pontos</span><span>{pct}%</span></div>
            <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
          {titulosDisp.length > 0 && (
            <label className="flex items-center gap-2 text-xs">Título equipado:
              <select className="rounded border border-border bg-background px-2 py-1" value={titulos[atual]?.texto ?? ''} onChange={(e) => useConquistaStore.getState().equiparTitulo(atual, e.target.value)}>
                <option value="">— nenhum —</option>
                {titulosDisp.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-1">
            {(['todas', ...RARIDADES] as const).map((r) => (
              <Button key={r} size="sm" variant={filtro === r ? 'default' : 'ghost'} onClick={() => setFiltro(r)}>{r === 'todas' ? 'Todas' : RARIDADE_INFO[r].nome}</Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {lista.filter((c) => filtro === 'todas' || c.raridade === filtro).map((c) => {
              const d = desbloqueioAtivo(st, atual, c.id);
              const oculta = c.secreta && !d && !master;
              return (
                <div key={c.id} data-conquista={c.id} className={`rounded-md border-2 p-2 ${d ? '' : 'opacity-60'}`} style={d ? rarStyle(c.raridade) : undefined}>
                  <div className="flex items-start gap-2">
                    <span className={`text-2xl ${d ? '' : 'grayscale'}`}>{oculta ? '❔' : c.icone}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block leading-tight">{oculta ? '???' : c.titulo}</b>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={corTexto(c.raridade)}>{RARIDADE_INFO[c.raridade].nome}{c.secreta ? ' · secreta' : ''}</span>
                      <p className="text-xs text-muted-foreground">{oculta ? 'Uma conquista secreta. Continue jogando…' : c.requisito}</p>
                      {d && <p className="text-[11px] text-muted-foreground">Obtida em {new Date(d.em).toLocaleDateString('pt-BR')}{d.relato ? ` — “${d.relato}”` : ''}</p>}
                    </div>
                  </div>
                  {master && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d ? <Button size="sm" variant="outline" onClick={() => useConquistaStore.getState().revogar(atual, c.id)}>Revogar</Button>
                        : <Button size="sm" onClick={() => { const relato = window.prompt('Relato do momento (opcional):') ?? undefined; desbloquearConquista(atual, c.id, { por: 'mestre', relato: relato || undefined }); }}>Conceder</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setEditando(c)}>Editar</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function EditorConquista({ def, onClose }: { def: ConquistaDef; onClose: () => void }) {
  const [f, setF] = useState<ConquistaDef>(def);
  const currencies = useMoneyStore((s) => s.currencies);
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const itens = useMemo(() => Object.values(entidades).sort((a, b) => a.nome.localeCompare(b.nome)), [entidades]);
  const setR = (i: number, r: RecompensaConquista) => setF({ ...f, recompensas: f.recompensas.map((x, j) => (j === i ? r : x)) });
  const sel = 'rounded border border-border bg-background px-2 py-1 text-xs';
  return (
    <div className="space-y-2 text-sm" data-editor-conquista>
      <div className="flex gap-2"><Input className="w-16" value={f.icone} onChange={(e) => setF({ ...f, icone: e.target.value })} aria-label="Ícone" />
        <Input placeholder="Título" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} aria-label="Título" /></div>
      <Textarea rows={2} placeholder="Como conseguir" value={f.requisito} onChange={(e) => setF({ ...f, requisito: e.target.value, descricao: e.target.value })} aria-label="Como conseguir" />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label>Raridade <select className={sel} value={f.raridade} onChange={(e) => setF({ ...f, raridade: e.target.value as RaridadeConquista })}>{RARIDADES.map((r) => <option key={r} value={r}>{RARIDADE_INFO[r].nome}</option>)}</select></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={f.secreta} onChange={(e) => setF({ ...f, secreta: e.target.checked })} /> Secreta</label>
        <label>Gatilho <select className={sel} value={f.gatilho} onChange={(e) => setF({ ...f, gatilho: e.target.value as ConquistaDef['gatilho'] })}>
          <option value="manual">Mestre concede</option><option value="primeiro_combate">Primeiro combate</option>
          <option value="loja_comida">Abrir loja de comida</option><option value="portas_da_morte">Cair nas Portas da Morte</option>
        </select></label>
      </div>
      <div className="space-y-1 rounded border border-border p-2">
        <b className="text-xs">Recompensas automáticas</b>
        {f.recompensas.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
            {r.tipo === 'dinheiro' && <><span>💰</span><Input type="number" className="h-7 w-24" value={r.valor} onChange={(e) => setR(i, { ...r, valor: Number(e.target.value) || 0 })} />
              <select className={sel} value={r.currencyId} onChange={(e) => setR(i, { ...r, currencyId: e.target.value })}>{currencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></>}
            {r.tipo === 'item' && <><span>🎒</span><select className={sel} value={r.entidadeId} onChange={(e) => setR(i, { ...r, entidadeId: e.target.value })}><option value="">— escolha —</option>{itens.map((it) => <option key={it.id} value={it.id}>{it.nome}</option>)}</select>
              <Input type="number" min={1} className="h-7 w-16" value={r.quantidade} onChange={(e) => setR(i, { ...r, quantidade: Math.max(1, Number(e.target.value) || 1) })} /></>}
            {(r.tipo === 'titulo' || r.tipo === 'texto') && <><span>{r.tipo === 'titulo' ? '👑' : '📜'}</span><Input className="h-7 flex-1" placeholder={r.tipo === 'titulo' ? 'Título/alcunha' : 'Prêmio narrativo'} value={r.texto} onChange={(e) => setR(i, { ...r, texto: e.target.value })} /></>}
            <Button size="sm" variant="ghost" onClick={() => setF({ ...f, recompensas: f.recompensas.filter((_, j) => j !== i) })}>✕</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'dinheiro', valor: 100, currencyId: currencies[0]?.id ?? '' }] })}>+ Dinheiro</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'item', entidadeId: '', quantidade: 1 }] })}>+ Item</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'titulo', texto: '' }] })}>+ Título</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'texto', texto: '' }] })}>+ Outro</Button>
        </div>
      </div>
      <div className="flex justify-between gap-2">
        <Button size="sm" variant="destructive" onClick={() => { useConquistaStore.getState().apagarDef(f.id); onClose(); }}>Apagar</Button>
        <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!f.titulo.trim()} onClick={() => { useConquistaStore.getState().salvarDef(f); onClose(); }}>Salvar</Button></div>
      </div>
    </div>
  );
}
