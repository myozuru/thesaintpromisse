/** Diário do jogador: quests aceitas (prazo, recompensa, anotações), reputação e linha do tempo. */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useQuestStore } from '@/stores/useQuestStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { toTimelineSeconds } from '@/lib/omni/tempo';
import { ICONES_QUEST, STATUS_LABEL, formatarRestante } from '@/lib/economia/quests';
import { LinhaDoTempo, PainelReputacao } from './FaccoesTempo';
import { PainelGuilda } from './PainelGuilda';
import { PainelConquistas } from '@/components/conquistas/PainelConquistas';

export function DiarioQuests({ aberto, onClose, charId, master }: { aberto: boolean; onClose: () => void; charId?: string; master: boolean }) {
  const questsMap = useQuestStore((s) => s.quests);
  const notas = useQuestStore((s) => s.notas);
  const faccoes = useQuestStore((s) => s.faccoes);
  const currencies = useMoneyStore((s) => s.currencies);
  const agora = toTimelineSeconds(useChronosStore());
  const [aba, setAba] = useState<'quests' | 'guilda' | 'rep' | 'tempo' | 'conquistas'>('quests');
  const [verAntigas, setVerAntigas] = useState(false);
  const minhas = useMemo(() => Object.values(questsMap)
    .filter((q) => !q.deletedAt && (master ? q.aceitaPor.length > 0 : !!charId && q.aceitaPor.includes(charId)))
    .filter((q) => verAntigas || q.status === 'aceita')
    .sort((a, b) => (a.prazoFim ?? Infinity) - (b.prazoFim ?? Infinity)), [questsMap, charId, master, verAntigas]);

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>📖 Diário de Quests</DialogTitle></DialogHeader>
        <div className="flex gap-2 border-b border-border pb-2">
          <Button size="sm" variant={aba === 'quests' ? 'default' : 'ghost'} onClick={() => setAba('quests')}>Quests</Button>
          <Button size="sm" variant={aba === 'conquistas' ? <PainelConquistas charId={charId} master={master} /> : aba === 'guilda' ? 'default' : 'ghost'} onClick={() => setAba('guilda')}>Guilda</Button>
          <Button size="sm" variant={aba === 'rep' ? 'default' : 'ghost'} onClick={() => setAba('rep')}>Reputação</Button>
          <Button size="sm" variant={aba === 'tempo' ? 'default' : 'ghost'} onClick={() => setAba('tempo')}>Linha do tempo</Button>
          <Button size="sm" variant={aba === 'conquistas' ? 'default' : 'ghost'} onClick={() => setAba('conquistas')}>🏆 Conquistas</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {aba === 'conquistas' ? <PainelConquistas charId={charId} master={master} /> : aba === 'guilda' ? <PainelGuilda charId={charId} master={master} /> : aba === 'rep' ? <PainelReputacao charId={charId} /> : aba === 'tempo' ? <LinhaDoTempo /> : (
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={verAntigas} onChange={(e) => setVerAntigas(e.target.checked)} /> Mostrar concluídas, falhas e expiradas</label>
              {!minhas.length && <p className="py-6 text-center text-muted-foreground">Nenhuma quest aceita. Procure um mural!</p>}
              {minhas.map((q) => {
                const oculto = q.mascarada && !q.revelada && !master;
                const restante = formatarRestante(q.prazoFim, agora);
                const moeda = currencies.find((c) => c.id === q.recompensa.currencyId);
                const f = q.faccaoId ? faccoes[q.faccaoId] : undefined;
                const nota = charId ? notas[`${charId}:${q.id}`]?.texto ?? '' : '';
                return (
                  <div key={q.id} className="space-y-1 rounded border border-border p-2" data-diario-quest={q.id}>
                    <div className="flex items-center gap-2"><span className="text-xl">{oculto ? '❓' : ICONES_QUEST[q.icone]}</span>
                      <b className="flex-1">{oculto ? 'Contrato misterioso' : q.titulo}</b>
                      <span className="text-xs text-muted-foreground">{STATUS_LABEL[q.status]}</span></div>
                    {q.descricao && <p className="whitespace-pre-wrap text-xs">{q.descricao}</p>}
                    {!oculto && q.objetivoReal && <p className="text-xs"><b>Objetivo:</b> {q.objetivoReal}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {restante && <span>⌛ {restante}</span>}
                      {q.recompensa.valor > 0 && <span>💰 {moeda?.symbol ?? ''} {q.recompensa.valor}</span>}
                      {f && !!q.repRecompensa && <span>{f.emblema} +{q.repRecompensa} reputação</span>}
                    </div>
                    {charId && !master && (
                      <Textarea rows={2} aria-label="Anotações da quest" placeholder="Suas anotações…" value={nota}
                        onChange={(e) => useQuestStore.getState().setNota(charId, q.id, e.target.value)} className="text-xs" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
