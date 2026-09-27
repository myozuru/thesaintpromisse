/**
 * TestRequestOverlay — overlay full-screen exibido ao PLAYER quando o
 * Mestre solicita um teste para alguma ficha. Mostra um botão grande
 * "Rolar d20" que executa a rolagem com bônus apropriado, registra log
 * e fecha o overlay.
 *
 * Para o MESTRE (que não possui a ficha alvo neste cliente) aparece um
 * painel compacto no canto inferior direito com status:
 *   - "Aguardando rolagem…" enquanto o jogador não rolou
 *   - resultado + sucesso/falha (respeitando flags hideDc/hideOutcome)
 */
import { useEffect, useMemo, useState } from 'react';
import { useTestRequestStore, type TestRequest } from '@/stores/useTestRequestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollD20Com } from '@/lib/dice';
import { getAttrModifier } from '@/components/fichas/CharacterCard';
import { getTrainingBonus, getLevelSkillBonus } from '@/types';
import { hasRecompensaNote, recompensaPEPatch } from '@/lib/suportePreAnaliseRecompensa';
import { consumeAdvantageFor, consumeFlatBonusFor, peekAdvantageFor, type RollContext } from '@/lib/omni/rollAdvantage';
import { consumeAutoOutcomeFor, peekAutoOutcomeFor, type OutcomeContext } from '@/lib/omni/autoOutcome';
import { Dice6, X, Check, Loader2, Hourglass, ShieldQuestion, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playDiceSound, playSuccessSound, playErrorSound } from '@/lib/sounds';
import type { Character } from '@/types';
import { canViewerRollTestRequest, isPlayerOwnedTestRequest } from '@/lib/testRequestAudience';

function computeBonus(c: Character, req: TestRequest): { bonus: number; breakdown: string } {
  const level = c.level || 1;
  if (req.kind === 'attribute') {
    const attr = c.attributes.find((a) => a.name === req.testName);
    if (!attr) return { bonus: 0, breakdown: 'sem atributo' };
    const mod = getAttrModifier(attr.value);
    return { bonus: mod, breakdown: `mod ${req.testName} ${mod >= 0 ? '+' : ''}${mod}` };
  }
  if (req.kind === 'skill') {
    const sk = c.skills.find((s) => s.name === req.testName);
    if (!sk) return { bonus: 0, breakdown: 'sem perícia' };
    const linked = sk.linkedAttribute
      ? c.attributes.find((a) => a.name === sk.linkedAttribute)
      : undefined;
    const attrMod = linked ? getAttrModifier(linked.value) : 0;
    const train = getTrainingBonus(level, sk.trained, sk.mastery);
    const half = getLevelSkillBonus(level);
    const ext = sk.externalBonus ?? 0;
    const insp = c.inspiracaoBonus ?? 0;
    const bonus = attrMod + train + half + ext + insp;
    const parts = [
      `½nv +${half}`,
      linked ? `${sk.linkedAttribute} ${attrMod >= 0 ? '+' : ''}${attrMod}` : null,
      train ? `treino +${train}` : null,
      ext ? `ext ${ext >= 0 ? '+' : ''}${ext}` : null,
      insp ? `inspirado +${insp}` : null,
    ].filter(Boolean);
    return { bonus, breakdown: parts.join(' · ') };
  }
  // save
  const st = c.savingThrows?.find((s) => s.name === req.testName);
  if (!st) return { bonus: 0, breakdown: 'sem TR' };
  const linked = st.linkedAttribute
    ? c.attributes.find((a) => a.name === st.linkedAttribute)
    : undefined;
  const attrMod = linked ? getAttrModifier(linked.value) : 0;
  const train = getTrainingBonus(level, st.trained, st.mastery);
  const ext = st.externalBonus ?? 0;
  const base = st.value ?? 0;
  const bonus = base + attrMod + train + ext;
  const parts = [
    base ? `base +${base}` : null,
    linked ? `${st.linkedAttribute} ${attrMod >= 0 ? '+' : ''}${attrMod}` : null,
    train ? `treino +${train}` : null,
    ext ? `ext ${ext >= 0 ? '+' : ''}${ext}` : null,
  ].filter(Boolean);
  return { bonus, breakdown: parts.join(' · ') || 'sem mods' };
}

function buildRollContext(req: TestRequest): RollContext {
  if (req.kind === 'attribute') return { kind: 'attribute', name: req.testName };
  if (req.kind === 'skill') return { kind: 'skill', name: req.testName };
  return { kind: 'save', name: req.testName };
}

// ──────────────────────────────────────────────────────────────────────
// Painel de status do MESTRE (canto): aguardando / resultado
// ──────────────────────────────────────────────────────────────────────
function MasterWatchPanel() {
  const requests = useTestRequestStore((s) => s.requests);
  const dismiss = useTestRequestStore((s) => s.dismiss);
  const characters = useCharacterStore((s) => s.characters);

  // Master acompanha pedidos cujo alvo é uma ficha vinculada a um jogador.
  const watching = useMemo(
    () => requests.filter((r) => {
      const c = characters.find((x) => x.id === r.charId);
      return isPlayerOwnedTestRequest(r, c);
    }),
    [requests, characters]
  );

  if (watching.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[180] w-[min(22rem,calc(100vw-2rem))] space-y-2">
      {watching.slice(-3).map((r) => {
        const passed = r.result
          ? (r.result.forced
              ? r.result.forced.kind === 'success'
              : (r.dc != null ? r.result.total >= r.dc : null))
          : null;
        const showOutcome = r.dc != null;
        return (
          <div
            key={r.id}
            className={`pointer-events-auto relative overflow-hidden rounded-md border bg-card/95 p-4 shadow-[0_18px_45px_-20px_hsl(var(--background))] backdrop-blur-xl animate-in slide-in-from-right fade-in duration-300 before:absolute before:inset-y-3 before:left-0 before:w-0.5 ${
              r.result
                ? passed === true
                  ? 'border-neon-green/45 before:bg-neon-green'
                  : passed === false
                    ? 'border-neon-red/45 before:bg-neon-red'
                    : 'border-primary/45 before:bg-primary'
                : 'border-accent/30 before:bg-accent'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="shrink-0 mt-0.5">
                {r.result ? (
                  passed === true
                    ? <Check className="w-5 h-5 text-neon-green" />
                    : passed === false
                      ? <X className="w-5 h-5 text-neon-red" />
                      : <Dice6 className="w-5 h-5 text-primary" />
                ) : (
                  <Hourglass className="w-5 h-5 text-primary animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-accent/75">{r.charName}</div>
                <div className="truncate font-display text-sm font-bold">
                  {r.testName}{r.dc != null && <span className="font-body text-muted-foreground"> · CD {r.dc}</span>}
                </div>
                {!r.result && (
                  <div className="mt-2 flex items-center gap-2 rounded-sm bg-secondary/55 px-2 py-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin text-accent" /> Aguardando o jogador
                  </div>
                )}
                {r.result && (
                  <div className="mt-1">
                    <div className="text-2xl font-bold text-foreground leading-none">
                      {r.result.total}
                      {r.result.advantageMode && r.result.advantageMode !== 'normal' && (
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          ({r.result.advantageMode === 'advantage' ? 'V' : 'D'} {r.result.rolls?.join(',')})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      d20 {r.result.d20} {r.result.bonus >= 0 ? '+' : ''}{r.result.bonus}
                    </div>
                    {r.result.forced && (
                      <div className="text-[10px] text-accent font-semibold mt-0.5">
                        {r.result.forced.kind === 'success' ? '✨ Sucesso garantido' : '💀 Falha garantida'}
                      </div>
                    )}
                    {showOutcome && (
                      <div className={`text-xs font-bold mt-0.5 ${
                        (r.result.forced ? r.result.forced.kind === 'success' : passed) ? 'text-neon-green' : 'text-neon-red'
                      }`}>
                        {(r.result.forced ? r.result.forced.kind === 'success' : passed) ? '✅ SUCESSO' : '❌ FALHA'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={() => dismiss(r.id)}
                variant="ghost"
                size="icon-sm"
                aria-label="Dispensar"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TestRequestOverlay() {
  const role = useRoleStore((s) => s.role);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const requests = useTestRequestStore((s) => s.requests);
  const setResult = useTestRequestStore((s) => s.setResult);
  const dismiss = useTestRequestStore((s) => s.dismiss);
  const ackResult = useTestRequestStore((s) => s.ackResult);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);

  const isMaster = role === 'MASTER';

  // Somente o perfil vinculado à ficha recebe o botão de rolagem.
  // Fichas sem perfil e NPCs permanecem sob controle do Mestre.
  const pending = useMemo(
    () => requests.filter((r) => {
      // Pedido que o jogador já viu e fechou some da tela DELE, mas continua
      // visível para o mestre até ele dispensar.
      if (!isMaster && r.playerAckedAt) return false;
      const c = characters.find((x) => x.id === r.charId);
      return canViewerRollTestRequest(r, c, role, activeProfileId);
    }),
    [requests, characters, isMaster, role, activeProfileId]
  );
  // Prioriza pedidos sem resultado; senão mostra o último resolvido (até ser dispensado).
  const current = pending.find((r) => !r.result) ?? pending[pending.length - 1];

  // Mantém o pedido aberto enquanto a bandeja 3D resolve a rolagem.
  const [rolling, setRolling] = useState(false);
  // Reseta animação quando muda o pedido atual.
  useEffect(() => {
    setRolling(false);
  }, [current?.id]);

  // Conceder Outra Chance (Suporte Nv 6): ao receber o aceite, o cliente dono
  // da ficha rola de novo e fica com o MELHOR total.
  useEffect(() => {
    const onApply = (e: Event) => {
      const { requestId, rollerId } = (e as CustomEvent).detail ?? {};
      if (!requestId || !rollerId) return;
      const state = useTestRequestStore.getState();
      const req = state.requests.find((r) => r.id === requestId);
      if (!req?.result || req.charId !== rollerId) return;
      const chars = useCharacterStore.getState().characters;
      const rollerChar = chars.find((x) => x.id === rollerId);
      if (!rollerChar) return;
      // Só o cliente dono da ficha rerola (mesma regra de posse do overlay).
      const mine = canViewerRollTestRequest(req, rollerChar, role, activeProfileId);
      if (!mine) return;
      void (async () => {
        const prev = req.result!;
        const newD20 = await rollD20Com(rollerId);
        const newTotal = newD20 + prev.bonus;
        const best = newTotal > prev.total
          ? { d20: newD20, total: newTotal }
          : { d20: prev.d20, total: prev.total };
        state.setResult(requestId, {
          ...prev,
          d20: best.d20,
          total: best.total,
          rolls: [...(prev.rolls ?? [prev.d20]), newD20],
        });
        const dcTxt = req.dc != null ? ` vs CD ${req.dc} → ${best.total >= req.dc ? '✅ SUCESSO' : '❌ FALHA'}` : '';
        useLogStore.getState().addLog(
          'combat',
          `🔁 ${rollerChar.name} — Outra Chance (${req.testName}): nova rolagem d20 ${newD20} (antes ${prev.d20}) → melhor total ${best.total}${dcTxt}`,
        );
      })();
    };
    window.addEventListener('outra-chance:apply', onApply);
    return () => window.removeEventListener('outra-chance:apply', onApply);
  }, [role, activeProfileId]);


  if (!current) {
    return isMaster ? <MasterWatchPanel /> : null;
  }

  const char = characters.find((c) => c.id === current.charId);
  const { bonus, breakdown } = current.bonusOverride != null
    ? { bonus: current.bonusOverride, breakdown: current.bonusBreakdownOverride || 'override' }
    : char
      ? computeBonus(char, current)
      : { bonus: 0, breakdown: '?' };

  const showDc = current.dc != null && (isMaster || !current.hideDcFromPlayer);
  const showOutcome = current.dc != null && (isMaster || !current.hideOutcomeFromPlayer);

  const kindLabel =
    current.kind === 'attribute' ? 'Teste de Atributo'
    : current.kind === 'skill' ? 'Teste de Perícia'
    : 'Teste de Resistência';

  const handleRoll = async () => {
    if (!char || rolling) return;
    setRolling(true);
    playDiceSound();

    // 1) Sucesso/falha garantida (Omni) tem prioridade — pula a rolagem.
    const ctx = buildRollContext(current);
    const outCtx: OutcomeContext =
      current.kind === 'save' ? { kind: 'save', name: current.testName }
      : current.kind === 'skill' ? { kind: 'skill', name: current.testName }
      : { kind: 'attribute', name: current.testName };
    const auto = consumeAutoOutcomeFor(char.id, outCtx);

    let d20: number;
    let rolls: number[];
    let advNet: 'normal' | 'advantage' | 'disadvantage' = 'normal';

    if (auto.outcome) {
      // Forja um d20 cosmético: 20 (ou 1) — não passa por rollD20Com
      // pra evitar consumo indevido de rerolls.
      d20 = auto.outcome === 'success' ? 20 : 1;
      rolls = [d20];
    } else {
      // 2) Vantagem/desvantagem normal.
      const adv = consumeAdvantageFor(char.id, ctx);
      advNet = adv.net;
      if (adv.net === 'normal') {
        d20 = await rollD20Com(char.id, undefined, { label: `${current.testName} — ${char.name}`, layout: 'test-request' });
        rolls = [d20];
      } else {
        const a = await rollD20Com(char.id, undefined, { label: `${current.testName} — vantagem`, layout: 'test-request' });
        const b = await rollD20Com(char.id, undefined, { label: `${current.testName} — vantagem`, layout: 'test-request' });
        rolls = [a, b];
        d20 = adv.net === 'advantage' ? Math.max(a, b) : Math.min(a, b);
      }
    }

    // Bônus fixos (ex: Apoio Focado do Suporte) somam no total e são consumidos.
    const flat = consumeFlatBonusFor(char.id, ctx);
    const totalBonus = bonus + flat.bonus;

    let total = d20 + totalBonus;
    // Quando o resultado é FORÇADO e há CD, ajusta `total` pra garantir
    // o veredito visual (sucesso ≥ CD, falha < CD).
    if (auto.outcome && current.dc != null) {
      if (auto.outcome === 'success' && total < current.dc) total = current.dc;
      if (auto.outcome === 'failure' && total >= current.dc) total = current.dc - 1;
    }

    // A própria física já cria o suspense; revela logo após o dado parar.
    setTimeout(() => {
      setRolling(false);
      setResult(current.id, {
        d20,
        bonus: totalBonus,
        total,
        rolledAt: Date.now(),
        advantageMode: advNet,
        rolls,
        forced: auto.outcome ? { kind: auto.outcome, note: auto.note } : undefined,
      });
      const passedFinal = current.dc != null
        ? (auto.outcome ? auto.outcome === 'success' : total >= current.dc)
        : null;
      if (showOutcome && passedFinal != null) {
        if (passedFinal) playSuccessSound();
        else playErrorSound();
      }
      const advTxt = advNet !== 'normal'
        ? ` [${advNet === 'advantage' ? 'Vantagem' : 'Desvantagem'} 2d20(${rolls.join(',')})→${d20}]`
        : '';
      const flatTxt = flat.bonus ? ` ${flat.notes.join(' ')}` : '';
      const forcedTxt = auto.outcome
        ? ` [${auto.outcome === 'success' ? '✨ SUCESSO GARANTIDO' : '💀 FALHA GARANTIDA'}${auto.note ? ` · ${auto.note}` : ''}]`
        : '';
      const dcTxt = current.dc != null
        ? ` vs CD ${current.dc} → ${passedFinal ? '✅ SUCESSO' : '❌ FALHA'}`
        : '';
      addLog(
        'combat',
        `🎲 ${char.name} — ${kindLabel} (${current.testName}): d20 ${d20}${advTxt} ${totalBonus >= 0 ? '+' : ''}${totalBonus} = ${total}${flatTxt}${forcedTxt}${dcTxt}`
      );
      // Recompensa pelo Sucesso: rolagem sob Comando reduzido → +2 PE.
      // Com CD conhecida exige sucesso; sem CD (CD oculta) o Mestre confirma
      // o sucesso narrativamente, então o PE é concedido na rolagem.
      if ((passedFinal === true || current.dc == null) && flat.bonus && hasRecompensaNote(flat.notes)) {
        const fresh = useCharacterStore.getState().characters.find((x) => x.id === char.id);
        if (fresh) {
          const patch = recompensaPEPatch(fresh);
          useCharacterStore.getState().updateCharacter(fresh.id, patch);
          addLog('combat', `🏆 ${fresh.name} — Recompensa pelo Sucesso: +2 PE${(patch.tempPE ?? 0) > (fresh.tempPE ?? 0) ? ' (excedente como PE temporário)' : ''}.`);
        }
      }
      // Conceder Outra Chance (Suporte Nv 6): falha com CD conhecida dispara a oferta.
      if (passedFinal === false && !auto.outcome && current.dc != null && char.category === 'PLAYER') {
        void (async () => {
          const [{ findOutraChanceSupporter, sendOutraChanceOffer }, { useMapStore }] = await Promise.all([
            import('@/lib/suporteNivel6'),
            import('@/stores/useMapStore'),
          ]);
          const { entities, gridConfig } = useMapStore.getState();
          const all = useCharacterStore.getState().characters;
          const supporter = findOutraChanceSupporter(char.id, all, entities, gridConfig);
          if (!supporter) return;
          await sendOutraChanceOffer({
            supporterId: supporter.id,
            rollerId: char.id,
            requestId: current.id,
            testName: current.testName,
            total,
            dc: current.dc as number,
          });
        })();
      }
    }, auto.outcome ? 500 : 200);
  };

  const advPreview = char ? peekAdvantageFor(char.id, buildRollContext(current)) : 'normal';
  const autoPreview = char
    ? (() => {
        const oc: OutcomeContext =
          current.kind === 'save' ? { kind: 'save', name: current.testName }
          : current.kind === 'skill' ? { kind: 'skill', name: current.testName }
          : { kind: 'attribute', name: current.testName };
        return peekAutoOutcomeFor(char.id, oc);
      })()
    : null;

  return (
    <>
      {isMaster && <MasterWatchPanel />}
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 p-3 backdrop-blur-md animate-in fade-in duration-200 sm:p-6">
        <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-lg border border-border/90 bg-card/95 shadow-[0_35px_90px_-30px_hsl(var(--background))] before:pointer-events-none before:absolute before:inset-x-20 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent before:to-transparent">
          {(isMaster || current.result) && (
            <Button
              onClick={() => (isMaster ? dismiss(current.id) : ackResult(current.id))}
              variant="ghost"
              size="icon-sm"
              className="absolute right-3 top-3 z-10"
              aria-label="Dispensar"
            >
              <X className="w-5 h-5" />
            </Button>
          )}

          <div className="border-b border-border/70 bg-secondary/30 px-5 pb-5 pt-6 text-center sm:px-8">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent"><ShieldQuestion className="h-5 w-5" /></div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent/75">{kindLabel}</div>
            <h2 className="mt-1 font-display text-2xl font-black uppercase text-foreground sm:text-3xl">{current.testName}</h2>
            <div className="mt-1 text-sm text-muted-foreground">Desafio para <span className="font-semibold text-foreground">{current.charName}</span></div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {showDc && (
              <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1 text-sm font-bold text-accent">CD {current.dc}</div>
              </div>
            )}
            {!showDc && current.dc != null && !isMaster && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-1 text-xs italic text-muted-foreground">
                CD oculta
              </div>
            )}
            {advPreview === 'advantage' && (
              <div className="rounded-md border border-neon-green/30 bg-neon-green/10 px-3 py-1 text-xs font-bold text-neon-green">
                Vantagem
              </div>
            )}
            {advPreview === 'disadvantage' && (
              <div className="rounded-md border border-neon-red/30 bg-neon-red/10 px-3 py-1 text-xs font-bold text-neon-red">
                Desvantagem
              </div>
            )}
            {autoPreview === 'success' && (
              <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                Sucesso garantido
              </div>
            )}
            {autoPreview === 'failure' && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
                Falha garantida
              </div>
            )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {current.note && <div className="mb-4 flex gap-3 rounded-md border border-accent/20 bg-accent/5 p-3 text-sm italic text-muted-foreground"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>“{current.note}”</span></div>}

          {!char && (
            <div className="mb-4 text-center text-sm text-destructive">
              Ficha não encontrada neste cliente.
            </div>
          )}

          {/* A bandeja 3D global ocupa este espaço enquanto a física resolve o teste. */}
          {rolling && (
            <div className="h-[min(390px,48dvh)] rounded-md border border-accent/20 bg-background/45 animate-in fade-in duration-200" aria-label="Bandeja de dados 3D">
              <div className="flex h-full items-end justify-center pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-accent/60">O destino está em movimento</div>
            </div>
          )}

          {!current.result && !rolling && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-stretch">
              <Button
                size="lg"
                onClick={handleRoll}
                disabled={!char}
                className="h-20 w-full gap-3 bg-accent font-display text-xl font-black uppercase text-accent-foreground shadow-[0_14px_35px_-12px_hsl(var(--accent)/0.7)] hover:bg-accent/90 sm:text-2xl"
              >
                <Dice6 className="w-8 h-8" />
                Rolar d20
              </Button>
              <div className="flex min-w-32 flex-col items-center justify-center rounded-md border border-border/80 bg-background/45 px-4 py-2 text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Bônus</span>
                <strong className="font-display text-2xl text-accent">{bonus >= 0 ? '+' : ''}{bonus}</strong>
                <span className="max-w-48 text-[10px] leading-tight text-muted-foreground">{breakdown}</span>
              </div>
              </div>
            </div>
          )}

          {/* Resultado */}
          {current.result && !rolling && (
            <div className={`rounded-md border p-5 text-center animate-in zoom-in-50 fade-in duration-300 ${
              showOutcome && current.dc != null
                ? (current.result.total >= current.dc
                    ? 'border-neon-green/60 bg-neon-green/10 shadow-[0_0_30px_-5px_hsl(var(--neon-green)/0.5)]'
                    : 'border-neon-red/60 bg-neon-red/10 shadow-[0_0_30px_-5px_hsl(var(--neon-red)/0.5)]')
                : 'border-primary/40 bg-primary/10'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Resultado final</div>
              <div className="mt-1 font-display text-6xl font-black text-foreground">
                {current.result.total}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                d20 {current.result.d20}
                {current.result.advantageMode && current.result.advantageMode !== 'normal' && current.result.rolls && (
                  <span className="ml-1">
                    [{current.result.advantageMode === 'advantage' ? 'V' : 'D'} 2d20({current.result.rolls.join(',')})]
                  </span>
                )}
                {' '}+ {current.result.bonus}
              </div>
              {showOutcome && current.dc != null && (
                  <div className={`mt-3 font-display text-lg font-black uppercase ${
                  current.result.total >= current.dc ? 'text-neon-green' : 'text-neon-red'
                }`}>
                  {current.result.total >= current.dc ? '✅ SUCESSO' : '❌ FALHA'}
                </div>
              )}
              {!showOutcome && current.dc != null && !isMaster && (
                <div className="mt-2 text-xs italic text-muted-foreground">
                  Resultado enviado ao mestre.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => (isMaster ? dismiss(current.id) : ackResult(current.id))}
              >
                <Check className="w-4 h-4 mr-1" /> Fechar
              </Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
