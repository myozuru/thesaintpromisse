/** Aba de Conquistas do Diário: vitrine do jogador e ferramentas do Mestre. */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConquistaStore, listarConquistas, desbloqueioAtivo } from '@/stores/useConquistaStore';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { desbloquearConquista } from '@/lib/conquistas/motor';
import { RARIDADES, RARIDADE_INFO, type ConquistaDef, type RaridadeConquista, type RecompensaConquista } from '@/lib/conquistas/tipos';

const rarStyle = (r: RaridadeConquista) => ({ ['--rar' as string]: `var(--raridade-${r})`, borderColor: `hsl(var(--raridade-${r}))` });
const corTexto = (r: RaridadeConquista) => ({ color: `hsl(var(--raridade-${r}))` });

function rotuloRecompensa(r: RecompensaConquista, currencies: { id: string; name: string }[], entidades: Record<string, { nome: string }>): string {
  switch (r.tipo) {
    case 'dinheiro': return `💰 ${r.valor} ${currencies.find((c) => c.id === r.currencyId)?.name ?? ''}`.trim();
    case 'item': return `🎒 ${r.quantidade}× ${entidades[r.entidadeId]?.nome ?? 'item'}`;
    case 'titulo': return `👑 Título “${r.texto}”`;
    case 'texto': return `📜 ${r.texto}`;
    case 'recuperar_pe': return `⚡ +${r.valor} PE`;
    case 'recuperar_vida': return `💚 +${r.valor} Vida`;
    case 'pvt': return `🛡️ +${r.valor} PVT`;
    case 'reduzir_exaustao': return `✨ −${r.niveis} Exaustão`;
    default: return '🎁 Recompensa';
  }
}

function DialogConceder({ def, jogadores, inicial, onClose }: { def: ConquistaDef; jogadores: { id: string; name: string }[]; inicial: string; onClose: () => void }) {
  const desbloqueios = useConquistaStore((s) => s.desbloqueios);
  const [sel, setSel] = useState<string[]>(inicial ? [inicial] : []);
  const [relato, setRelato] = useState('');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const conceder = () => {
    sel.forEach((id) => desbloquearConquista(id, def.id, { por: 'mestre', relato: relato.trim() || undefined }));
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{def.icone} Conceder “{def.titulo}”</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>Quem recebe?</span>
              <button type="button" className="underline" onClick={() => setSel(sel.length === jogadores.length ? [] : jogadores.map((j) => j.id))}>{sel.length === jogadores.length ? 'Nenhum' : 'Todos'}</button></div>
            <div className="grid max-h-56 gap-1 overflow-auto rounded border border-border p-1">
              {jogadores.map((j) => {
                const ja = desbloqueioAtivo({ desbloqueios }, j.id, def.id);
                return (
                  <label key={j.id} className={`flex items-center gap-2 rounded px-2 py-1.5 ${ja ? 'opacity-50' : 'cursor-pointer hover:bg-muted'}`}>
                    <input type="checkbox" disabled={!!ja} checked={sel.includes(j.id) && !ja} onChange={() => toggle(j.id)} />
                    <span className="flex-1">{j.name}</span>{ja && <span className="text-[10px]">já possui</span>}
                  </label>
                );
              })}
            </div>
          </div>
          <Textarea rows={2} placeholder="Relato do momento (opcional)" value={relato} onChange={(e) => setRelato(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!sel.some((id) => !desbloqueioAtivo({ desbloqueios }, id, def.id))} onClick={conceder}>Conceder ({sel.length})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PainelConquistas({ charId, master }: { charId?: string; master: boolean }) {
  const defsMap = useConquistaStore((s) => s.defs);
  const desbloqueios = useConquistaStore((s) => s.desbloqueios);
  const titulos = useConquistaStore((s) => s.titulos);
  const chars = useCharacterStore((s) => s.characters);
  const jogadores = useMemo(() => chars.filter((c) => c.category === 'PLAYER'), [chars]);
  const [alvo, setAlvo] = useState<string>(charId ?? '');
  const [filtro, setFiltro] = useState<RaridadeConquista | 'todas'>('todas');
  const [editando, setEditando] = useState<ConquistaDef | null>(null);
  const [concedendo, setConcedendo] = useState<ConquistaDef | null>(null);
  const currencies = useMoneyStore((s) => s.currencies);
  const entidades = useOmniEntidadesStore((s) => s.entidades);
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
          <div className="grid gap-3 sm:grid-cols-2">
            {lista.filter((c) => filtro === 'todas' || c.raridade === filtro).map((c) => {
              const d = desbloqueioAtivo(st, atual, c.id);
              const oculta = c.secreta && !d && !master;
              return (
                <div key={c.id} data-conquista={c.id} className={`flex flex-col rounded-lg border-2 bg-card/60 p-3 ${d ? '' : 'border-border'}`} style={d ? rarStyle(c.raridade) : { borderLeftColor: `hsl(var(--raridade-${c.raridade}))`, borderLeftWidth: 4 }}>
                  <div className="flex items-start gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted text-2xl ${d ? '' : 'grayscale opacity-70'}`}>{oculta ? '❔' : c.icone}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block leading-tight">{oculta ? '???' : c.titulo}</b>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={corTexto(c.raridade)}>{RARIDADE_INFO[c.raridade].nome}</span>
                        {master && <span className={`rounded px-1.5 py-px text-[10px] font-medium ${c.secreta ? 'bg-destructive/20 text-destructive' : 'bg-primary/15 text-primary'}`}>{c.secreta ? '🔒 Secreta' : '👁 Pública'}</span>}
                        {d && <span className="rounded bg-primary/20 px-1.5 py-px text-[10px] font-medium text-primary">✓ Obtida</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{oculta ? 'Uma conquista secreta. Continue jogando…' : c.requisito}</p>
                      {d && <p className="text-[11px] text-muted-foreground">Obtida em {new Date(d.em).toLocaleDateString('pt-BR')}{d.relato ? ` — “${d.relato}”` : ''}</p>}
                    </div>
                  </div>
                  {(master || !oculta) && c.recompensas.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.recompensas.map((r, i) => <span key={i} className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px]">{rotuloRecompensa(r, currencies, entidades)}</span>)}
                    </div>
                  )}
                  {master && c.recompensas.length === 0 && <p className="mt-2 text-[11px] italic text-muted-foreground">Sem recompensas</p>}
                  {master && (
                    <div className="mt-auto flex gap-2 pt-3">
                      {d ? <Button size="sm" variant="outline" onClick={() => useConquistaStore.getState().revogar(atual, c.id)}>Revogar</Button>
                        : <Button size="sm" onClick={() => setConcedendo(c)}>Conceder…</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setEditando(c)}>Editar</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {concedendo && <DialogConceder def={concedendo} jogadores={jogadores} inicial={atual} onClose={() => setConcedendo(null)} />}
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
            {(r.tipo === 'recuperar_pe' || r.tipo === 'recuperar_vida' || r.tipo === 'pvt') && <><span>{r.tipo === 'recuperar_pe' ? '⚡ PE' : r.tipo === 'pvt' ? '🛡️ PVT' : '💚 Vida'}</span>
              <Input type="number" min={1} className="h-7 w-20" value={r.valor} onChange={(e) => setR(i, { ...r, valor: Math.max(1, Number(e.target.value) || 1) })} /></>}
            {r.tipo === 'reduzir_exaustao' && <><span>✨ Exaustão −</span><Input type="number" min={1} max={6} className="h-7 w-16" value={r.niveis} onChange={(e) => setR(i, { ...r, niveis: Math.max(1, Number(e.target.value) || 1) })} /></>}
            <Button size="sm" variant="ghost" onClick={() => setF({ ...f, recompensas: f.recompensas.filter((_, j) => j !== i) })}>✕</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'dinheiro', valor: 100, currencyId: currencies[0]?.id ?? '' }] })}>+ Dinheiro</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'item', entidadeId: '', quantidade: 1 }] })}>+ Item</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'titulo', texto: '' }] })}>+ Título</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'texto', texto: '' }] })}>+ Outro</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'recuperar_pe', valor: 3 }] })}>+ PE</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'recuperar_vida', valor: 5 }] })}>+ Vida</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'pvt', valor: 5 }] })}>+ PVT</Button>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, recompensas: [...f.recompensas, { tipo: 'reduzir_exaustao', niveis: 1 }] })}>+ Aliviar exaustão</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Dica: PE, vida, PVT e exaustão combinam com conquistas simples.</p>
      </div>
      <div className="flex justify-between gap-2">
        <Button size="sm" variant="destructive" onClick={() => { useConquistaStore.getState().apagarDef(f.id); onClose(); }}>Apagar</Button>
        <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!f.titulo.trim()} onClick={() => { useConquistaStore.getState().salvarDef(f); onClose(); }}>Salvar</Button></div>
      </div>
    </div>
  );
}
