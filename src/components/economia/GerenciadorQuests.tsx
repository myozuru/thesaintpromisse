/** Mestre: cria/edita quests de mural e murais (peças do mapa). */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useQuestStore, type Quest } from '@/stores/useQuestStore';
import { useBossStore } from '@/stores/useBossStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useMapStore } from '@/stores/useMapStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { toTimelineSeconds } from '@/lib/omni/tempo';
import { EditorFaccoes, LinhaDoTempo } from './FaccoesTempo';
import { ICONES_QUEST, STATUS_LABEL, formatarRestante, prazoEmSegundos, type IconeQuest } from '@/lib/economia/quests';

export function GerenciadorQuests({ aberto, onClose, inicialId }: { aberto: boolean; onClose: () => void; inicialId?: string | null }) {
  const questsMap = useQuestStore((s) => s.quests);
  const muraisMap = useQuestStore((s) => s.murais);
  const st = useQuestStore.getState();
  const quests = useMemo(() => Object.values(questsMap).filter((q) => !q.deletedAt).sort((a, b) => b.createdAt - a.createdAt), [questsMap]);
  const murais = useMemo(() => Object.values(muraisMap).filter((m) => !m.deletedAt), [muraisMap]);
  const [sel, setSel] = useState<string | null>(inicialId ?? null);
  const [aba, setAba] = useState<'quests' | 'murais' | 'faccoes' | 'tempo'>('quests');
  const entities = useMapStore((s) => s.entities);
  const pecas = Object.values(entities).filter((e) => !e.groundItem && e.label);
  const q = sel ? questsMap[sel] : undefined;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>📜 Quests de Mural</DialogTitle></DialogHeader>
        <div className="flex gap-2 border-b border-border pb-2">
          <Button size="sm" variant={aba === 'quests' ? 'default' : 'ghost'} onClick={() => setAba('quests')}>Quests</Button>
          <Button size="sm" variant={aba === 'murais' ? 'default' : 'ghost'} onClick={() => setAba('murais')}>Murais no mapa</Button>
          <Button size="sm" variant={aba === 'faccoes' ? 'default' : 'ghost'} onClick={() => setAba('faccoes')}>Facções</Button>
          <Button size="sm" variant={aba === 'tempo' ? 'default' : 'ghost'} onClick={() => setAba('tempo')}>Linha do tempo</Button>
        </div>
        {aba === 'faccoes' ? <EditorFaccoes /> : aba === 'tempo' ? <LinhaDoTempo editavel /> : aba === 'murais' ? (
          <div className="space-y-2 overflow-y-auto">
            <Button size="sm" onClick={() => st.criarMural('Mural da cidade')}>+ Novo mural</Button>
            {murais.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded border border-border p-2">
                <Input aria-label="Nome do mural" value={m.nome} onChange={(e) => st.atualizarMural(m.id, { nome: e.target.value })} className="max-w-xs" />
                <select aria-label="Peça do mural" value={m.entityId ?? ''} onChange={(e) => st.atualizarMural(m.id, { entityId: e.target.value || null })} className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">— escolha a peça do mapa —</option>
                  {pecas.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => st.removerMural(m.id)}>Excluir</Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Jogadores abrem o mural clicando na peça a até 1,5 m.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-hidden min-h-0 flex-1">
            <div className="w-60 shrink-0 space-y-1 overflow-y-auto border-r border-border pr-2">
              <Button size="sm" className="w-full" onClick={() => setSel(st.criarQuest().id)}>+ Nova quest</Button>
              {quests.map((x) => (
                <button key={x.id} type="button" onClick={() => setSel(x.id)} className={`w-full rounded border p-2 text-left text-sm ${sel === x.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  {ICONES_QUEST[x.icone]} {x.titulo}<div className="text-xs text-muted-foreground">{STATUS_LABEL[x.status]}</div>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              {q ? <EditorQuest q={q} murais={murais} onRemover={() => { st.removerQuest(q.id); setSel(null); }} /> : <p className="py-12 text-center text-sm text-muted-foreground">Selecione ou crie uma quest.</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditorQuest({ q, murais, onRemover }: { q: Quest; murais: { id: string; nome: string }[]; onRemover: () => void }) {
  const up = (p: Partial<Quest>) => useQuestStore.getState().atualizarQuest(q.id, p);
  const bossesMap = useBossStore((s) => s.bosses);
  const bosses = Object.values(bossesMap);
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const itens = Object.values(entidades).filter((e) => e.categoria === 'item' || e.categoria === 'arma');
  const currencies = useMoneyStore((s) => s.currencies);
  const faccoesMap = useQuestStore((s) => s.faccoes);
  const faccoes = Object.values(faccoesMap).filter((f) => !f.deletedAt);
  const agora = toTimelineSeconds(useChronosStore());
  const [dias, setDias] = useState(3), [horas, setHoras] = useState(0);
  const [itemAdd, setItemAdd] = useState('');
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div><Label>Título</Label><Input value={q.titulo} onChange={(e) => up({ titulo: e.target.value })} /></div>
        <Button size="sm" variant="ghost" className="self-end text-destructive" onClick={onRemover}>Excluir</Button>
      </div>
      <div><Label>Ícone do cartaz</Label>
        <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Ícone">
          {(Object.keys(ICONES_QUEST) as IconeQuest[]).map((k) => (
            <button key={k} type="button" aria-pressed={q.icone === k} aria-label={k} onClick={() => up({ icone: k })}
              className={`h-9 w-9 rounded border text-lg ${q.icone === k ? 'border-primary bg-primary/15' : 'border-border'}`}>{ICONES_QUEST[k]}</button>
          ))}
        </div>
      </div>
      <div><Label>Texto do cartaz (o que todos leem)</Label><Textarea rows={3} value={q.descricao} onChange={(e) => up({ descricao: e.target.value })} /></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={q.mascarada} onChange={(e) => up({ mascarada: e.target.checked })} /> Cartaz misterioso “?” (só texto e recompensa)</label>
      <div><Label>Objetivo real {q.mascarada ? '(oculto até você revelar; pode ficar vazio para ser só um “?”)' : ''}</Label>
        <Textarea rows={2} value={q.objetivoReal} onChange={(e) => up({ objetivoReal: e.target.value })} />
        {q.mascarada && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={q.revelada} onChange={(e) => up({ revelada: e.target.checked })} /> Objetivo revelado aos jogadores</label>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Alvo</Label>
          <select aria-label="Tipo de alvo" value={q.alvo.tipo} onChange={(e) => up({ alvo: { ...q.alvo, tipo: e.target.value as Quest['alvo']['tipo'] } })} className="h-9 w-full rounded-md border border-input bg-background px-2">
            <option value="nenhum">Nenhum</option><option value="boss">Chefe</option><option value="item">Item do OMNI</option><option value="evento">Evento</option>
          </select>
        </div>
        {q.alvo.tipo === 'boss' && <div><Label>Chefe</Label>
          <select aria-label="Chefe" value={q.alvo.bossId ?? ''} onChange={(e) => up({ alvo: { ...q.alvo, bossId: e.target.value } })} className="h-9 w-full rounded-md border border-input bg-background px-2">
            <option value="">—</option>{bosses.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select></div>}
        {q.alvo.tipo === 'item' && <div><Label>Item procurado</Label>
          <select aria-label="Item alvo" value={q.alvo.entidadeId ?? ''} onChange={(e) => up({ alvo: { ...q.alvo, entidadeId: e.target.value } })} className="h-9 w-full rounded-md border border-input bg-background px-2">
            <option value="">—</option>{itens.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select></div>}
      </div>
      {q.alvo.tipo === 'boss' && <p className="text-xs text-muted-foreground">O chefe fica escondido no Mapa do Mundo até aceitarem a quest; então aparece com o que você já deixou visível na ficha dele.</p>}
      <div className="rounded border border-border p-2 space-y-2">
        <b>Recompensa</b>
        <div className="flex gap-2">
          <Input type="number" min={0} aria-label="Valor da recompensa" value={q.recompensa.valor} onChange={(e) => up({ recompensa: { ...q.recompensa, valor: Math.max(0, Number(e.target.value) || 0) } })} className="max-w-32" />
          <select aria-label="Moeda da recompensa" value={q.recompensa.currencyId} onChange={(e) => up({ recompensa: { ...q.recompensa, currencyId: e.target.value } })} className="h-9 rounded-md border border-input bg-background px-2">
            {currencies.map((c) => <option key={c.id} value={c.id}>{c.symbol} {c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <select aria-label="Item de recompensa" value={itemAdd} onChange={(e) => setItemAdd(e.target.value)} className="h-9 flex-1 rounded-md border border-input bg-background px-2">
            <option value="">— adicionar item do OMNI —</option>{itens.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
          <Button size="sm" disabled={!itemAdd} onClick={() => { up({ recompensa: { ...q.recompensa, itens: [...q.recompensa.itens, itemAdd] } }); setItemAdd(''); }}>Adicionar</Button>
        </div>
        {q.recompensa.itens.map((id, i) => <div key={`${id}-${i}`} className="flex items-center gap-2 text-xs">• {entidades[id]?.nome ?? 'Item removido'}
          <button type="button" className="text-destructive" onClick={() => up({ recompensa: { ...q.recompensa, itens: q.recompensa.itens.filter((_, j) => j !== i) } })}>remover</button></div>)}
        <p className="text-xs text-muted-foreground">O dinheiro é dividido igualmente; os itens caem no chão perto de um jogador ao concluir.</p>
      </div>
      <div className="rounded border border-border p-2 space-y-2">
        <b>Facção e reputação</b>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs">Facção
            <select aria-label="Facção da quest" value={q.faccaoId ?? ''} onChange={(e) => up({ faccaoId: e.target.value || null })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— nenhuma —</option>{faccoes.map((f) => <option key={f.id} value={f.id}>{f.emblema} {f.nome}</option>)}
            </select></label>
          <label className="text-xs">Reputação ao concluir<Input type="number" aria-label="Reputação ao concluir" value={q.repRecompensa ?? 0} onChange={(e) => up({ repRecompensa: Number(e.target.value) || 0 })} /></label>
          <label className="text-xs">Exclusiva: rep. mínima<Input type="number" aria-label="Reputação mínima" placeholder="livre" value={q.repMinima ?? ''} onChange={(e) => up({ repMinima: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        </div>
        <p className="text-xs text-muted-foreground">Concluir dá a reputação ao grupo e a cada participante; falhar tira metade. Com mínimo, só quem tem essa reputação (grupo + própria) vê o cartaz.</p>
      </div>
      <div className="rounded border border-border p-2 space-y-2">
        <b>Prazo (tempo do mundo)</b>
        <div className="text-xs text-muted-foreground">{q.prazoFim == null ? 'Sem prazo.' : formatarRestante(q.prazoFim, agora)}</div>
        <div className="flex items-end gap-2">
          <label className="text-xs">Dias<Input type="number" min={0} aria-label="Dias de prazo" value={dias} onChange={(e) => setDias(Number(e.target.value) || 0)} className="w-20" /></label>
          <label className="text-xs">Horas<Input type="number" min={0} aria-label="Horas de prazo" value={horas} onChange={(e) => setHoras(Number(e.target.value) || 0)} className="w-20" /></label>
          <Button size="sm" onClick={() => up({ prazoFim: agora + prazoEmSegundos(dias, horas) })}>Definir a partir de agora</Button>
          <Button size="sm" variant="ghost" onClick={() => up({ prazoFim: null })}>Sem prazo</Button>
        </div>
      </div>
      <div><Label>Aparece nos murais (nenhum marcado = todos)</Label>
        <div className="mt-1 flex flex-wrap gap-2">{murais.map((m) => (
          <label key={m.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={q.murais.includes(m.id)} onChange={(e) => up({ murais: e.target.checked ? [...q.murais, m.id] : q.murais.filter((x) => x !== m.id) })} />{m.nome}</label>
        ))}</div></div>
      <div className="flex items-center gap-2 text-xs"><span>Status:</span>
        <select aria-label="Status" value={q.status} onChange={(e) => up({ status: e.target.value as Quest['status'] })} className="h-8 rounded-md border border-input bg-background px-2">
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  );
}
