/**
 * TestRequestOverlay — overlay full-screen exibido ao PLAYER quando o
 * Mestre solicita um teste para alguma ficha. Mostra um botão grande
 * "Rolar d20" que executa a rolagem com bônus apropriado, registra log
 * e fecha o overlay.
 *
 * Visual do jogador: "Obsidian fundido" — o pedido e a bandeja 3D são uma
 * superfície só. Pré-rolagem mostra o fosso ritual com o botão ancorado;
 * ao rolar, a janela se expande e a bandeja 3D (DiceTrayPanel) ocupa o
 * espaço grande inteiro, sem ficar limitada ao tamanho do pedido.
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
import { perguntarFortuna } from '@/lib/fortuna';
import { perguntarIndomavel } from '@/lib/indomavel';
import { posturaPericia } from '@/lib/posturas';
import { penalidadeTRFlanqueado } from '@/lib/flanqueadorSuperior';
import { ehTesteDeDesarme, extensaoDesarmeBonus } from '@/lib/extensaoCorpo';
import { useMapStore } from '@/stores/useMapStore';
import { getAttrModifier } from '@/components/fichas/CharacterCard';
import { getTrainingBonus, getLevelSkillBonus } from '@/types';
import { hasRecompensaNote, recompensaPEPatch } from '@/lib/suportePreAnaliseRecompensa';
import { consumeAdvantageFor, consumeFlatBonusFor, peekAdvantageFor, type RollContext } from '@/lib/omni/rollAdvantage';
import { consumeAutoOutcomeFor, peekAutoOutcomeFor, type OutcomeContext } from '@/lib/omni/autoOutcome';
import { Dice6, X, Check, Loader2, Hourglass, ShieldQuestion, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playDiceSound, playSuccessSound, playErrorSound } from '@/lib/sounds';
import { DiceTrayPanel } from '@/components/dice-physics/DiceTrayPanel';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';
import { canViewerRollTestRequest, isPlayerOwnedTestRequest } from '@/lib/testRequestAudience';
import { guardaEstudadaTrBonus } from '@/lib/guardaEstudada';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { selectOmniModifiers } from '@/lib/omni/omniBridge';
import { resolveAuraTurnTest } from '@/lib/auraTurnResolution';

/** Modificadores externos de combate que valem para qualquer teste pedido. */
function bonusDeCombate(c: Character, req: TestRequest): { bonus: number; parts: string[] } {
  const parts: string[] = [];
  let bonus = 0;
  if (ehTesteDeDesarme(req.testName)) {
    const ext = extensaoDesarmeBonus(c);
    if (ext) { bonus += ext; parts.push(`Extensão do Corpo +${ext}`); }
  }
  if (req.kind === 'save') {
    const ms = useMapStore.getState();
    const pen = penalidadeTRFlanqueado(c, useCharacterStore.getState().characters, ms.entities as never, ms.gridConfig as never);
    if (pen) { bonus += pen; parts.push(`Flanqueador Superior ${pen}`); }
    const guarda = guardaEstudadaTrBonus(c, req.testName);
    if (guarda) { bonus += guarda; parts.push(`Guarda Estudada +${guarda}`); }
  }
  return { bonus, parts };
}

function computeBonus(c: Character, req: TestRequest): { bonus: number; breakdown: string } {
  const level = c.level || 1;
  const extra = bonusDeCombate(c, req);
  if (req.kind === 'attribute') {
    const attr = c.attributes.find((a) => a.name === req.testName);
    if (!attr) return { bonus: 0, breakdown: 'sem atributo' };
    const mod = getAttrModifier(attr.value);
    return {
      bonus: mod + extra.bonus,
      breakdown: [`mod ${req.testName} ${mod >= 0 ? '+' : ''}${mod}`, ...extra.parts].join(' · '),
    };
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
    const equipment = selectOmniModifiers(c, useInventoryStore.getState().listEquipped(c.id).map(item => ({ instanceId: item.instanceId, equippedSlot: item.equippedSlot, entity: item.entity })));
    const skillKey = req.testName.trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const equipmentBonus = equipment.pericias[skillKey] ?? 0;
    const bonus = attrMod + train + half + ext + insp + equipmentBonus;
    const parts = [
      `½nv +${half}`,
      linked ? `${sk.linkedAttribute} ${attrMod >= 0 ? '+' : ''}${attrMod}` : null,
      train ? `treino +${train}` : null,
      ext ? `ext ${ext >= 0 ? '+' : ''}${ext}` : null,
      insp ? `inspirado +${insp}` : null,
      equipmentBonus ? `equipamento ${equipmentBonus > 0 ? '+' : ''}${equipmentBonus}` : null,
    ].filter(Boolean);
    return { bonus: bonus + extra.bonus, breakdown: [...parts, ...extra.parts].join(' · ') };
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
  const equipment = selectOmniModifiers(c, useInventoryStore.getState().listEquipped(c.id).map(item => ({ instanceId: item.instanceId, equippedSlot: item.equippedSlot, entity: item.entity })));
  const trKey = req.testName.trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const equipmentBonus = equipment.trs[trKey as keyof typeof equipment.trs] ?? 0;
  const bonus = base + attrMod + train + ext + equipmentBonus;
  const parts = [
    base ? `base +${base}` : null,
    linked ? `${st.linkedAttribute} ${attrMod >= 0 ? '+' : ''}${attrMod}` : null,
    train ? `treino +${train}` : null,
    ext ? `ext ${ext >= 0 ? '+' : ''}${ext}` : null,
    equipmentBonus ? `equipamento ${equipmentBonus > 0 ? '+' : ''}${equipmentBonus}` : null,
  ].filter(Boolean);
  return {
    bonus: bonus + extra.bonus,
    breakdown: [...parts, ...extra.parts].join(' · ') || 'sem mods',
  };
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
                <div className="truncate text-xs font-bold uppercase tracking-[0.16em] text-accent/75">{r.charName}</div>
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
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({r.result.advantageMode === 'advantage' ? 'V' : 'D'} {r.result.rolls?.join(',')})
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      d20 {r.result.d20} {r.result.bonus >= 0 ? '+' : ''}{r.result.bonus}
                    </div>
                    {r.result.forced && (
                      <div className="text-xs text-accent font-semibold mt-0.5">
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

  useEffect(() => {
    if (!isMaster) return;
    for (const request of requests) {
      if (request.auraResolution && request.result && !request.resolutionApplied) {
        resolveAuraTurnTest(request);
      }
    }
  }, [isMaster, requests]);

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
          rollerChar.category === 'INIMIGO' ? `${rollerChar.name} — Outra Chance: teste realizado.` : `${rollerChar.name} — Outra Chance (${req.testName}): total ${best.total}${!req.hideDcFromPlayer && req.dc != null ? ` vs CD ${req.dc}` : ''}${!req.hideOutcomeFromPlayer && req.dc != null ? (best.total >= req.dc ? ' → SUCESSO' : ' → FALHA') : ''}`,
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

  const dramaLevel = Math.max(0, Math.min(3, Math.round(current.drama ?? 0)));

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
    let auto = consumeAutoOutcomeFor(char.id, outCtx);
    // Teste forçado por uma ficha: aliados podem reagir antes da rolagem.
    let preReacao = { cancelado: false, testeBonus: 0 };
    if (current.originId && current.kind !== 'attribute' && !auto.outcome) {
      const { abrirJanelaReacaoAtiva } = await import('@/lib/omni/reacoesAtivas');
      preReacao = await abrirJanelaReacaoAtiva({ gatilho: current.kind === 'save' ? 'quando_alvo_de_tr' : 'quando_alvo_de_pericia', origemId: current.originId, protegidoId: char.id });
      if (preReacao.cancelado) auto = { outcome: 'success', note: 'anulado por reação' } as typeof auto;
    }

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
        d20 = await rollD20Com(char.id, undefined, { label: `${current.testName} — ${char.name}`, layout: 'test-request', drama: current.drama ?? 0, cinematicFocus: current.cinematicFocus });
        rolls = [d20];
      } else {
        const a = await rollD20Com(char.id, undefined, { label: `${current.testName} — vantagem`, layout: 'test-request', drama: current.drama ?? 0 });
        const b = await rollD20Com(char.id, undefined, { label: `${current.testName} — vantagem`, layout: 'test-request', drama: current.drama ?? 0 });
        rolls = [a, b];
        d20 = adv.net === 'advantage' ? Math.max(a, b) : Math.min(a, b);
      }
      if (current.kind === 'save') {
        const novo = await perguntarFortuna(char.id, d20, 'resistencia', () => rollD20Com(char.id, undefined, { label: `${current.testName} — Fortuna`, layout: 'test-request' }));
        if (novo !== d20) { const i = rolls.lastIndexOf(d20); if (i >= 0) rolls[i] = novo; d20 = novo; }
      }
    }

    // Bônus fixos (ex: Apoio Focado do Suporte) somam no total e são consumidos.
    const flat = consumeFlatBonusFor(char.id, ctx);
    const masterBonus = current.masterBonus ?? 0;
    const totalBonus = bonus + flat.bonus + masterBonus + preReacao.testeBonus + (current.kind === 'skill' ? posturaPericia(char) : 0);

    let total = d20 + totalBonus;
    // Quando o resultado é FORÇADO e há CD, ajusta `total` pra garantir
    // o veredito visual (sucesso ≥ CD, falha < CD).
    if (auto.outcome && current.dc != null) {
      if (auto.outcome === 'success' && total < current.dc) total = current.dc;
      if (auto.outcome === 'failure' && total >= current.dc) total = current.dc - 1;
    }

    // Indomável (Especialista em Combate): falhou no TR → pode gastar 1 PE
    // para rolar de novo e ficar com o melhor resultado.
    if (!auto.outcome && current.kind === 'save' && current.dc != null) {
      const melhor = await perguntarIndomavel(
        char.id, current.testName, d20, total, current.dc,
        () => rollD20Com(char.id, undefined, { label: `${current.testName} — Indomável`, layout: 'test-request' }),
      );
      if (melhor !== d20) {
        const i = rolls.lastIndexOf(d20);
        if (i >= 0) rolls[i] = melhor;
        d20 = melhor;
        total = d20 + totalBonus;
      }
    }



    // A própria física já cria o suspense; revela logo após o dado parar.
    setTimeout(() => {
      setRolling(false);
      setResult(current.id, {
        d20,
        bonus: totalBonus,
        masterBonus: masterBonus || undefined,
        total,
        rolledAt: Date.now(),
        advantageMode: advNet,
        rolls,
        forced: auto.outcome ? { kind: auto.outcome, note: auto.note } : undefined,
      });
      const passedFinal = current.dc != null
        ? (auto.outcome ? auto.outcome === 'success' : total >= current.dc)
        : null;
      if (current.originId && current.kind === 'save' && passedFinal != null) {
        void import('@/lib/omni/reacoesAtivas').then(({ abrirJanelaReacaoAtiva }) => abrirJanelaReacaoAtiva({ gatilho: passedFinal ? 'quando_passar_tr' : 'quando_falhar_tr', origemId: current.originId!, protegidoId: char.id }));
      }
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
        `🎲 ${char.name} — ${kindLabel} (${current.testName}): d20 ${d20}${advTxt} ${totalBonus >= 0 ? '+' : ''}${totalBonus} = ${total}${flatTxt}${forcedTxt}${dcTxt}`,
        char.category === 'INIMIGO' ? `🎲 ${char.name} — ${kindLabel} (${current.testName}): teste realizado.` : `🎲 ${char.name} — ${kindLabel} (${current.testName}): d20 ${d20} ${totalBonus >= 0 ? '+' : ''}${totalBonus} = ${total}${!current.hideDcFromPlayer && current.dc != null ? ` vs CD ${current.dc}` : ''}${!current.hideOutcomeFromPlayer && current.dc != null ? (passedFinal ? ' → SUCESSO' : ' → FALHA') : ''}`
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
  const singleCinematicResult = !!current.cinematicFocus
    && !!current.result
    && (current.result.rolls?.length ?? 1) === 1;

  // ──────────────────────────────────────────────────────────────────
  // MESTRE — painel clássico (acompanha/rola pedidos de NPCs).
  // ──────────────────────────────────────────────────────────────────
  if (isMaster) {
    return (
      <>
        <MasterWatchPanel />
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 p-3 backdrop-blur-md animate-in fade-in duration-200 sm:p-6">
          <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-lg border border-border/90 bg-card/95 shadow-[0_35px_90px_-30px_hsl(var(--background))] before:pointer-events-none before:absolute before:inset-x-20 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent before:to-transparent">
            {(current.result) && (
              <Button
                onClick={() => dismiss(current.id)}
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
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-accent/75">{kindLabel}</div>
              <h2 className="mt-1 font-display text-2xl font-black uppercase text-foreground sm:text-3xl">{current.testName}</h2>
              <div className="mt-1 text-sm text-muted-foreground">Desafio para <span className="font-semibold text-foreground">{current.charName}</span></div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {showDc && (
                <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1 text-sm font-bold text-accent">CD {current.dc}</div>
              )}
              {!showDc && current.dc != null && (
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

            {/* A bandeja 3D embutida ocupa este espaço enquanto a física resolve o teste. */}
            {rolling && (
              <div className="h-[min(480px,56dvh)] overflow-hidden rounded-md border border-accent/25 bg-background/45 animate-in fade-in duration-200" aria-label="Bandeja de dados 3D">
                <DiceTrayPanel />
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
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Bônus</span>
                  <strong className="font-display text-2xl text-accent">{bonus >= 0 ? '+' : ''}{bonus}</strong>
                  <span className="max-w-48 text-xs leading-tight text-muted-foreground">{breakdown}</span>
                  {current.masterBonus ? (
                    <span className="text-xs font-bold text-accent">+ Mestre {current.masterBonus >= 0 ? '+' : ''}{current.masterBonus} (oculto)</span>
                  ) : null}
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
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Resultado final</div>
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
                  {current.result.masterBonus ? (
                    <div className="mt-1 font-bold text-accent animate-in fade-in duration-700">
                      Bônus do Mestre revelado: {current.result.masterBonus >= 0 ? '+' : ''}{current.result.masterBonus}
                    </div>
                  ) : null}
                </div>
                {showOutcome && current.dc != null && (
                    <div className={`mt-3 font-display text-lg font-black uppercase ${
                    current.result.total >= current.dc ? 'text-neon-green' : 'text-neon-red'
                  }`}>
                    {current.result.total >= current.dc ? '✅ SUCESSO' : '❌ FALHA'}
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
        </div>
      </>
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // JOGADOR — Obsidian fundido: pedido + bandeja 3D numa superfície só.
  // ──────────────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'fixed inset-0 z-[200] flex items-center justify-center bg-relic-deep/90 p-3 backdrop-blur-md animate-in fade-in duration-200 sm:p-6',
      `test-drama-${dramaLevel}`,
    )}>
      <div className={cn(
        'relative max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-sm border border-relic/25 bg-card/95 before:pointer-events-none before:absolute before:inset-x-20 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-relic before:to-transparent transition-[max-width,box-shadow] duration-500',
        rolling
          ? 'max-w-5xl shadow-[0_0_80px_-15px_hsl(var(--relic)/0.5)]'
          : singleCinematicResult
            ? 'max-w-sm shadow-[0_24px_70px_-24px_hsl(var(--background))]'
            : current.result
              ? 'max-w-lg shadow-[0_35px_90px_-30px_hsl(var(--background))]'
            : 'max-w-md shadow-[0_35px_90px_-30px_hsl(var(--background))]',
      )}>
        {current.result && (
          <Button
            onClick={() => ackResult(current.id)}
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3 z-20"
            aria-label="Dispensar"
          >
            <X className="w-5 h-5" />
          </Button>
        )}

        {/* Cabeçalho ritualístico */}
        <div className={cn('border-b border-relic/25 bg-gradient-to-b from-relic/15 via-transparent to-transparent text-center transition-all duration-500', singleCinematicResult ? 'px-4 pb-3 pt-4' : 'px-5 pb-5 pt-7 sm:px-6')}>
          {!singleCinematicResult && <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-relic/40 bg-relic/10 text-relic shadow-[0_0_20px_-4px_hsl(var(--relic)/0.7)]"><ShieldQuestion className="h-5 w-5" /></div>}
          <div className="text-xs font-black uppercase tracking-[0.45em] text-relic">{kindLabel}</div>
          <h2 className={cn('mt-1.5 font-display font-black uppercase text-foreground', singleCinematicResult ? 'text-xl' : 'text-3xl')} style={{ textShadow: '0 0 22px hsl(var(--relic)/0.5)' }}>{current.testName}</h2>
          {!singleCinematicResult && <div className="mt-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">Desafio de <span className="font-bold text-relic">{current.charName}</span></div>}
          {!singleCinematicResult && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {showDc && (
              <div className="rounded-sm border border-relic/40 bg-relic/10 px-3 py-0.5 text-xs font-black text-relic">CD {current.dc}</div>
            )}
            {!showDc && current.dc != null && (
              <div className="rounded-sm border border-border bg-muted/40 px-3 py-0.5 text-xs italic text-muted-foreground">CD oculta</div>
            )}
            {advPreview === 'advantage' && (
              <div className="rounded-sm border border-neon-green/30 bg-neon-green/10 px-2.5 py-0.5 text-xs font-bold text-neon-green">Vantagem</div>
            )}
            {advPreview === 'disadvantage' && (
              <div className="rounded-sm border border-neon-red/30 bg-neon-red/10 px-2.5 py-0.5 text-xs font-bold text-neon-red">Desvantagem</div>
            )}
            {autoPreview === 'success' && (
              <div className="rounded-sm border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">Sucesso garantido</div>
            )}
            {autoPreview === 'failure' && (
              <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">Falha garantida</div>
            )}
          </div>}
        </div>

        <div className={cn(singleCinematicResult ? 'p-3' : 'p-4 sm:p-5')}>
          {current.note && !singleCinematicResult && (
            <div className="mb-4 flex gap-2.5 border-l-2 border-relic/50 bg-relic/5 p-3 text-sm italic text-muted-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-relic" /><span>“{current.note}”</span>
            </div>
          )}

          {!char && (
            <div className="mb-4 text-center text-sm text-destructive">
              Ficha não encontrada neste cliente.
            </div>
          )}

          {/* Fosso mesclado: pré-rolagem → rolagem (espaço grande) → resultado */}
          {char && (
            <div className={cn(
              'relative mx-auto overflow-hidden rounded-sm border bg-background transition-[height,width,box-shadow,border-color] duration-500',
              rolling
                ? 'h-[min(600px,64dvh)] w-full border-relic/30 shadow-[inset_0_0_60px_hsl(var(--background)),0_0_45px_-12px_hsl(var(--relic)/0.5)]'
                : singleCinematicResult
                  ? 'h-56 w-56 border-relic/35 shadow-[inset_0_0_38px_hsl(var(--background)),0_0_32px_-12px_hsl(var(--relic)/0.55)] sm:h-60 sm:w-60'
                : current.result
                  ? 'min-h-[280px] border-border'
                  : 'h-64 w-full border-border shadow-[inset_0_4px_24px_hsl(var(--background)/0.8)] sm:h-72',
            )}>
              {rolling || singleCinematicResult ? (
                <div className="absolute inset-0 animate-in fade-in duration-300" aria-label="Bandeja de dados 3D">
                  <DiceTrayPanel hideCinematicResultSummary />
                </div>
              ) : current.result ? (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className={cn('w-full rounded-md border p-5 text-center animate-in zoom-in-50 fade-in duration-300',
                    showOutcome && current.dc != null
                      ? (current.result.total >= current.dc
                          ? 'border-neon-green/60 bg-neon-green/10 shadow-[0_0_30px_-5px_hsl(var(--neon-green)/0.5)]'
                          : 'border-neon-red/60 bg-neon-red/10 shadow-[0_0_30px_-5px_hsl(var(--neon-red)/0.5)]')
                      : 'border-primary/40 bg-primary/10',
                  )}>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Resultado final</div>
                    <div className="mt-1 font-display text-6xl font-black text-foreground">{current.result.total}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      d20 {current.result.d20}
                      {current.result.advantageMode && current.result.advantageMode !== 'normal' && current.result.rolls && (
                        <span className="ml-1">[{current.result.advantageMode === 'advantage' ? 'V' : 'D'} 2d20({current.result.rolls.join(',')})]</span>
                      )}
                      {' '}+ {current.result.bonus}
                      {current.result.masterBonus ? (
                        <div className="mt-1 font-bold text-relic animate-in fade-in duration-700">
                          Bônus do Mestre revelado: {current.result.masterBonus >= 0 ? '+' : ''}{current.result.masterBonus}
                        </div>
                      ) : null}
                    </div>
                    {showOutcome && current.dc != null && (
                      <div className={cn('mt-3 font-display text-lg font-black uppercase', current.result.total >= current.dc ? 'text-neon-green' : 'text-neon-red')}>
                        {current.result.total >= current.dc ? '✅ SUCESSO' : '❌ FALHA'}
                      </div>
                    )}
                    {!showOutcome && current.dc != null && (
                      <div className="mt-2 text-xs italic text-muted-foreground">Resultado enviado ao mestre.</div>
                    )}
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => ackResult(current.id)}>
                      <Check className="w-4 h-4 mr-1" /> Fechar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Círculo de invocação */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-relic/25 bg-relic/5">
                      <div className="absolute -inset-2 animate-pulse rounded-full border border-relic/10" />
                      <span className="text-center text-xs font-black uppercase leading-relaxed tracking-[0.35em] text-relic/70">Solte o<br />Destino</span>
                    </div>
                  </div>
                  {/* Controles ancorados no fundo do fosso */}
                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-background via-background/85 to-transparent p-4 pt-10">
                    <Button
                      size="lg"
                      onClick={handleRoll}
                      disabled={!char}
                      className="h-16 flex-1 gap-3 border border-relic/40 bg-gradient-to-b from-relic/30 to-relic-deep/60 font-display text-lg font-black uppercase tracking-[0.18em] text-foreground shadow-[0_12px_30px_-10px_hsl(var(--relic)/0.7)] hover:from-relic/45 hover:to-relic-deep/70"
                    >
                      <Dice6 className="h-6 w-6 text-relic" />Rolar D20
                    </Button>
                    <div className="w-24 shrink-0 rounded-sm border border-relic/30 bg-relic-deep/40 px-2 py-2 text-center">
                      <div className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Bônus</div>
                      <strong className="font-display text-2xl text-relic">{bonus >= 0 ? '+' : ''}{bonus}</strong>
                      <div className="text-xs leading-tight text-muted-foreground">{breakdown}</div>
                      {current.masterBonus ? <div className="text-xs font-black text-relic">+ ? do Mestre</div> : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {singleCinematicResult && current.result && (
            <div className="mx-auto mt-3 w-56 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:w-60">
              <div className="grid grid-cols-2 divide-x divide-relic/20 border-y border-relic/25 bg-relic/5 py-2 text-center">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">Bônus</div>
                  <div className="font-display text-base font-black text-relic">{current.result.bonus >= 0 ? '+' : ''}{current.result.bonus}</div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">Total</div>
                  <div className="font-display text-base font-black text-foreground">{current.result.total}</div>
                </div>
              </div>
              {current.result.masterBonus ? <div className="mt-1.5 text-center text-xs font-bold text-relic">Bônus do Mestre: {current.result.masterBonus >= 0 ? '+' : ''}{current.result.masterBonus}</div> : null}
              {showOutcome && current.dc != null && (
                <div className={cn('mt-2 text-center font-display text-sm font-black uppercase', current.result.total >= current.dc ? 'text-neon-green' : 'text-neon-red')}>
                  {current.result.total >= current.dc ? 'Sucesso' : 'Falha'}
                </div>
              )}
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => ackResult(current.id)}>
                <Check className="mr-1 h-4 w-4" /> Fechar
              </Button>
            </div>
          )}

          {/* Rodapé de status */}
          {!singleCinematicResult && <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground/60">
              {rolling ? 'O destino está em movimento' : current.result ? 'Destino revelado' : 'Aguardando sua escolha'}
            </span>
            <div className="flex gap-1 text-xs text-relic/50"><span>◆</span><span>◆</span><span>◆</span></div>
          </div>}
        </div>
      </div>
    </div>
  );
}
