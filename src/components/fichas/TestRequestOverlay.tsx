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
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Dice6, X, Check, Loader2, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playDiceSound, playSuccessSound, playErrorSound } from '@/lib/sounds';
import type { Character } from '@/types';

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

  // Master observa pedidos cujo alvo é uma ficha de PLAYER (quem rola é o jogador).
  const watching = useMemo(
    () => requests.filter((r) => {
      const c = characters.find((x) => x.id === r.charId);
      // se a ficha não foi encontrada (não sincronizou), ainda assim mostra ao mestre
      if (!c) return true;
      return c.createdBy !== 'MASTER' && c.category === 'PLAYER';
    }),
    [requests, characters]
  );

  if (watching.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[180] w-80 space-y-2 pointer-events-none">
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
            className={`pointer-events-auto rounded-lg border-2 bg-card/95 backdrop-blur-sm p-3 shadow-lg animate-in slide-in-right fade-in duration-300 ${
              r.result
                ? passed === true
                  ? 'border-neon-green/60'
                  : passed === false
                    ? 'border-neon-red/60'
                    : 'border-primary/60'
                : 'border-primary/40'
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
                <div className="text-xs text-muted-foreground truncate">
                  {r.charName}
                </div>
                <div className="text-sm font-semibold truncate">
                  {r.testName}{r.dc != null && <span className="text-muted-foreground font-normal"> · CD {r.dc}</span>}
                </div>
                {!r.result && (
                  <div className="text-xs text-primary/80 italic mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Aguardando rolagem…
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
              <button
                onClick={() => dismiss(r.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dispensar"
              >
                <X className="w-4 h-4" />
              </button>
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
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);

  const isMaster = role === 'MASTER';

  // Filtra pedidos por dono real da ficha alvo:
  //  - MASTER → fichas master-controlled (createdBy MASTER ou categoria !== PLAYER)
  //  - PLAYER → fichas criadas por player E pertencentes ao perfil ativo
  const pending = useMemo(
    () => requests.filter((r) => {
      const c = characters.find((x) => x.id === r.charId);
      if (!c) return false;
      const masterControlled = c.createdBy === 'MASTER' || c.category !== 'PLAYER';
      if (isMaster) return masterControlled;
      if (masterControlled) return false;
      // player: precisa ser dono do perfil (ou ficha sem profileId vinculado)
      return !c.profileId || c.profileId === activeProfileId;
    }),
    [requests, characters, isMaster, activeProfileId]
  );
  // Prioriza pedidos sem resultado; senão mostra o último resolvido (até ser dispensado).
  const current = pending.find((r) => !r.result) ?? pending[pending.length - 1];

  // Animação dramática: cicla números antes de revelar.
  const [rolling, setRolling] = useState(false);
  const [tick, setTick] = useState(1);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
  }, []);

  // Reseta animação quando muda o pedido atual.
  useEffect(() => {
    setRolling(false);
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
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
      const masterControlled = rollerChar.createdBy === 'MASTER' || rollerChar.category !== 'PLAYER';
      const mine = isMaster
        ? masterControlled
        : !masterControlled && (!rollerChar.profileId || rollerChar.profileId === activeProfileId);
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
  }, [isMaster, activeProfileId]);


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

    // Inicia animação cíclica
    if (tickTimer.current) clearInterval(tickTimer.current);
    tickTimer.current = setInterval(() => {
      setTick(Math.floor(Math.random() * 20) + 1);
    }, 60);

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
        d20 = await rollD20Com(char.id);
        rolls = [d20];
      } else {
        const a = await rollD20Com(char.id);
        const b = await rollD20Com(char.id);
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

    // Revela após ~1.4s de suspense
    setTimeout(() => {
      if (tickTimer.current) {
        clearInterval(tickTimer.current);
        tickTimer.current = null;
      }
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
      // Recompensa pelo Sucesso: sucesso com CD conhecida sob Comando reduzido → +2 PE.
      if (passedFinal === true && current.dc != null && flat.bonus && hasRecompensaNote(flat.notes)) {
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
    }, 1400);
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
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/85 backdrop-blur-sm p-6 animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg rounded-2xl border-2 border-primary/60 bg-card p-8 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.6)]">
          {(isMaster || current.result) && (
            <button
              onClick={() => dismiss(current.id)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Dispensar"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="text-center space-y-1 mb-6">
            <div className="text-xs uppercase tracking-widest text-primary/80" style={{ fontFamily: "'Cinzel', serif" }}>
              {kindLabel}
            </div>
            <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>
              {current.testName}
            </h2>
            <div className="text-sm text-muted-foreground">
              Solicitado para <span className="text-foreground font-semibold">{current.charName}</span>
            </div>
            {showDc && (
              <div className="inline-block mt-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-sm font-semibold">
                CD {current.dc}
              </div>
            )}
            {!showDc && current.dc != null && !isMaster && (
              <div className="inline-block mt-2 px-3 py-1 rounded-full bg-muted/40 text-muted-foreground text-xs italic">
                CD oculta
              </div>
            )}
            {advPreview === 'advantage' && (
              <div className="inline-block ml-2 mt-2 px-3 py-1 rounded-full bg-neon-green/15 text-neon-green text-xs font-bold">
                🟢 Vantagem
              </div>
            )}
            {advPreview === 'disadvantage' && (
              <div className="inline-block ml-2 mt-2 px-3 py-1 rounded-full bg-neon-red/15 text-neon-red text-xs font-bold">
                🔴 Desvantagem
              </div>
            )}
            {autoPreview === 'success' && (
              <div className="inline-block ml-2 mt-2 px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-bold">
                ✨ Sucesso garantido
              </div>
            )}
            {autoPreview === 'failure' && (
              <div className="inline-block ml-2 mt-2 px-3 py-1 rounded-full bg-destructive/20 text-destructive text-xs font-bold">
                💀 Falha garantida
              </div>
            )}
          </div>

          {current.note && (
            <div className="mb-4 rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground italic">
              “{current.note}”
            </div>
          )}

          {!char && (
            <div className="mb-4 text-center text-sm text-destructive">
              Ficha não encontrada neste cliente.
            </div>
          )}

          {/* Estado: rolando (animação dramática) */}
          {rolling && (
            <div className="mb-4 flex flex-col items-center justify-center py-6 animate-in fade-in duration-200">
              <Dice6 className="w-16 h-16 text-primary animate-spin mb-3" style={{ animationDuration: '0.5s' }} />
              <div
                className="text-7xl font-black text-primary tabular-nums tracking-wider"
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: '0 0 30px hsl(var(--primary) / 0.8)',
                }}
              >
                {tick}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
                Rolando…
              </div>
            </div>
          )}

          {!current.result && !rolling && (
            <div className="space-y-3">
              <Button
                size="lg"
                onClick={handleRoll}
                disabled={!char}
                className="w-full h-20 text-2xl font-bold gap-3 bg-gradient-to-r from-primary to-primary/70 hover:from-primary/90 hover:to-primary/60 text-primary-foreground shadow-[0_0_30px_-5px_hsl(var(--primary)/0.6)]"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                <Dice6 className="w-8 h-8" />
                Rolar d20 {bonus >= 0 ? '+' : ''}{bonus}
              </Button>
              <div className="text-center text-xs text-muted-foreground">
                Bônus: {breakdown}
              </div>
            </div>
          )}

          {/* Resultado */}
          {current.result && !rolling && (
            <div className={`mt-4 rounded-md border p-4 text-center animate-in zoom-in-50 fade-in duration-300 ${
              showOutcome && current.dc != null
                ? (current.result.total >= current.dc
                    ? 'border-neon-green/60 bg-neon-green/10 shadow-[0_0_30px_-5px_hsl(var(--neon-green)/0.5)]'
                    : 'border-neon-red/60 bg-neon-red/10 shadow-[0_0_30px_-5px_hsl(var(--neon-red)/0.5)]')
                : 'border-primary/40 bg-primary/10'
            }`}>
              <div className="text-5xl font-black text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>
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
                <div className={`mt-2 text-lg font-bold ${
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
                onClick={() => dismiss(current.id)}
              >
                <Check className="w-4 h-4 mr-1" /> Fechar
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
