/**
 * TestesModule — interface do MESTRE para solicitar testes aos jogadores.
 *
 * O mestre escolhe uma ficha PLAYER, define o tipo (atributo / perícia /
 * teste de resistência), o nome do teste, opcionalmente uma CD e uma
 * nota, e dispara. O pedido aparece como overlay full-screen no cliente
 * do jogador (via `TestRequestOverlay`).
 *
 * Também lista pedidos pendentes/resolvidos para acompanhamento.
 */
import { useMemo, useState } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ModuleHeader } from '@/components/ui/module-header';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dice6, Send, Trash2, CheckCircle2, XCircle, Clock, Users } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { DEFAULT_SAVING_THROWS } from '@/types';

type Kind = 'attribute' | 'skill' | 'save';

export function TestesModule() {
  const role = useRoleStore((s) => s.role);
  const characters = useCharacterStore((s) => s.characters);
  const requests = useTestRequestStore((s) => s.requests);
  const enqueue = useTestRequestStore((s) => s.enqueue);
  const dismiss = useTestRequestStore((s) => s.dismiss);
  const clearAll = useTestRequestStore((s) => s.clearAll);

  const players = useMemo(
    () => characters.filter((c) => c.category === 'PLAYER'),
    [characters]
  );

  const [charIds, setCharIds] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>('save');
  const [testName, setTestName] = useState<string>('Vontade');
  const [dc, setDc] = useState<string>('');
  const [hideDc, setHideDc] = useState<boolean>(false);
  const [hideOutcome, setHideOutcome] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');

  const selectedChars = players.filter((c) => charIds.includes(c.id));
  const refChar = selectedChars[0];

  const options = useMemo<string[]>(() => {
    if (!refChar) {
      if (kind === 'save') return DEFAULT_SAVING_THROWS;
      return [];
    }
    if (kind === 'attribute') return refChar.attributes.map((a) => a.name);
    if (kind === 'skill') return refChar.skills.map((s) => s.name);
    return (refChar.savingThrows ?? []).map((s) => s.name);
  }, [refChar, kind]);

  const ensureValidName = (next: string[]) => {
    if (next.length && !next.includes(testName)) setTestName(next[0]);
  };

  const toggleChar = (id: string) =>
    setCharIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () =>
    setCharIds(charIds.length === players.length ? [] : players.map((c) => c.id));

  const handleSend = () => {
    if (selectedChars.length === 0) {
      toast({ title: 'Selecione ao menos uma ficha', variant: 'destructive' });
      return;
    }
    if (!testName) {
      toast({ title: 'Selecione o teste', variant: 'destructive' });
      return;
    }
    const dcNum = dc.trim() ? Number(dc) : undefined;
    if (dc.trim() && (Number.isNaN(dcNum) || dcNum! < 1)) {
      toast({ title: 'CD inválida', variant: 'destructive' });
      return;
    }
    selectedChars.forEach((c) => {
      enqueue({
        charId: c.id,
        charName: c.name,
        kind,
        testName,
        dc: dcNum,
        hideDcFromPlayer: dcNum != null ? hideDc : undefined,
        hideOutcomeFromPlayer: dcNum != null ? hideOutcome : undefined,
        note: note.trim() || undefined,
      });
    });
    toast({
      title: selectedChars.length > 1 ? `Pedidos enviados (${selectedChars.length})` : 'Pedido enviado',
      description: `${testName}${dcNum != null ? ` — CD ${dcNum}` : ''}`,
    });
    setNote('');
    setDc('');
  };

  const sorted = [...requests].sort((a, b) => b.createdAt - a.createdAt);

  if (role !== 'MASTER') {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Apenas o Mestre pode solicitar testes. Aguarde — pedidos aparecem em tela cheia automaticamente.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <ModuleHeader title="Pedidos de Teste" subtitle="Solicite rolagens aos jogadores" icon={Dice6} />

      <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Fichas alvo {selectedChars.length > 0 && `(${selectedChars.length})`}
              </label>
              {players.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={toggleAll}
                >
                  {charIds.length === players.length ? 'Limpar' : 'Selecionar todos'}
                </button>
              )}
            </div>
            <div className="rounded-md border border-border/40 bg-background/40 p-2 max-h-40 overflow-y-auto">
              {players.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-2">Nenhuma ficha PLAYER</div>
              ) : (
                <ul className="space-y-1">
                  {players.map((c) => (
                    <li key={c.id}>
                      <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer text-sm">
                        <Checkbox
                          checked={charIds.includes(c.id)}
                          onCheckedChange={() => toggleChar(c.id)}
                        />
                        <span>{c.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</label>
            <Select
              value={kind}
              onValueChange={(v) => {
                const k = v as Kind;
                setKind(k);
                setTimeout(() => {
                  if (!refChar) return;
                  const next = k === 'attribute' ? refChar.attributes.map(a => a.name)
                    : k === 'skill' ? refChar.skills.map(s => s.name)
                    : (refChar.savingThrows ?? []).map(s => s.name);
                  ensureValidName(next);
                }, 0);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="save">Teste de Resistência</SelectItem>
                <SelectItem value="attribute">Atributo</SelectItem>
                <SelectItem value="skill">Perícia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Teste</label>
            <Select value={testName} onValueChange={setTestName}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {options.length === 0 && (
                  <SelectItem value="__none" disabled>Selecione uma ficha primeiro</SelectItem>
                )}
                {options.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">CD (opcional)</label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="ex.: 15"
              value={dc}
              onChange={(e) => setDc(e.target.value)}
            />
            {dc.trim() && (
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={hideDc} onCheckedChange={(v) => setHideDc(!!v)} />
                  Esconder CD do jogador
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={hideOutcome} onCheckedChange={(v) => setHideOutcome(!!v)} />
                  Esconder resultado (sucesso/falha) do jogador
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Nota (opcional)</label>
          <Input
            placeholder="ex.: você sente algo estranho no ar…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <Button onClick={handleSend} className="w-full gap-2" size="lg">
          <Send className="w-4 h-4" /> Enviar pedido
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Pedidos ({requests.length})
          </h3>
          {requests.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar todos
            </Button>
          )}
        </div>

        {sorted.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border/40 rounded-md">
            Nenhum pedido ainda.
          </div>
        )}

        <ul className="space-y-2">
          {sorted.map((r) => {
            const passed = r.result && r.dc != null ? r.result.total >= r.dc : null;
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-md border border-border/50 bg-card/40 p-3"
              >
                <div className="shrink-0">
                  {r.result ? (
                    passed === true ? <CheckCircle2 className="w-5 h-5 text-neon-green" />
                    : passed === false ? <XCircle className="w-5 h-5 text-neon-red" />
                    : <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Clock className="w-5 h-5 text-muted-foreground animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold">{r.charName}</span>
                    <span className="text-muted-foreground"> — {r.testName}</span>
                    {r.dc != null && <Badge variant="outline" className="ml-2">CD {r.dc}</Badge>}
                  </div>
                  {r.note && <div className="text-xs text-muted-foreground italic truncate">“{r.note}”</div>}
                  {r.result && (
                    <div className="text-xs text-muted-foreground">
                      d20 {r.result.d20} + {r.result.bonus} = <span className="font-bold text-foreground">{r.result.total}</span>
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => dismiss(r.id)} aria-label="Remover">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
