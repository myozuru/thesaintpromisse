/**
 * ReactionPromptOverlay — exibe prompts de REAÇÃO (auras + FAH)
 * disparados por `useReactionStore`.
 *
 * Kinds suportados:
 *   - nullify_offer / absorption_offer / redirect_offer  (Auras)
 *   - fah_alma_maldita_offer        (Alma Maldita antes do dano à alma)
 *   - fah_anatomia_incompr_offer    (TR CON p/ mitigar crítico/furtivo)
 *   - fah_devorador_energia_offer   (informativo, +1 tempPE confirmado)
 *   - fah_presenca_nefasta          (rolagem por inimigo no início do combate)
 *
 * O overlay é montado no shell global da aplicação, para continuar visível
 * enquanto o jogador está no mapa ou em qualquer outra aba.
 */
import { useEffect, useState } from 'react';
import { useReactionStore, type ReactionPrompt, kindConsumesReaction } from '@/stores/useReactionStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { DAMAGE_TYPE_LABELS, type DamageType } from '@/types';
import { rollDiceCom } from '@/lib/dice';
import { X, Shield, Flame, Crosshair, Skull, Sparkles, Hourglass, ShieldPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playSuccessSound, playErrorSound, playClickSound } from '@/lib/sounds';

export function ReactionPromptOverlay() {
  const prompts = useReactionStore(s => s.prompts);
  const dismiss = useReactionStore(s => s.dismiss);
  useCharacterStore(s => s.characters);
  const consumeReaction = useReactionStore(s => s.consumeReaction);
  const addLog = useLogStore(s => s.addLog);
  const tryNullifyCondition = useCharacterStore(s => s.tryNullifyCondition);
  const armElementalAbsorption = useCharacterStore(s => s.armElementalAbsorption);
  const redirectMissedAttack = useCharacterStore(s => s.redirectMissedAttack);
  const removeCondition = useCharacterStore(s => s.removeCondition);
  const useAlmaMaldita = useCharacterStore(s => s.useAlmaMaldita);
  const applyDamage = useCharacterStore(s => s.applyDamage);
  const addCondition = useCharacterStore(s => s.addCondition);

  if (prompts.length === 0) return null;

  /** O saldo da ficha é a única fonte de disponibilidade para todas as reações. */
  const canReact = (charId: string, kind: ReactionPrompt['kind']): boolean => {
    if (!kindConsumesReaction(kind)) return true;
    if (!useReactionStore.getState().hasReactionAvailable(charId)) {
      playErrorSound();
      addLog('system', 'Sem reações disponíveis na ficha.');
      return false;
    }
    return true;
  };


  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 max-w-sm w-[min(92vw,24rem)]">
      {prompts.map(p => (
        <PromptCard
          key={p.id}
          prompt={p}
          reactionLocked={kindConsumesReaction(p.kind) && useReactionStore.getState().reactionsLeft(p.charId) <= 0}
          onDismiss={() => {
            if (p.kind === 'cobrir_se_offer' || p.kind === 'fah_anatomia_incompr_offer') useReactionStore.getState().resolveDecision(p.id, null);
            else if (p.kind === 'lua_reacao_offer' || p.kind === 'fah_alma_maldita_offer') useReactionStore.getState().resolveDecision(p.id, 0);
            else dismiss(p.id);
          }}
          onNullify={(tier) => {
            if (!canReact(p.charId, p.kind)) return;
            const r = tryNullifyCondition(p.charId, tier);
            if (r.ok) {
              playSuccessSound();
              consumeReaction(p.charId);
              if (p.payload?.conditionId) removeCondition(p.charId, p.payload.conditionId);
              addLog('combat', `🛡 ${p.charName}: Aura Anuladora — anulou ${p.payload?.conditionName ?? 'condição'} (tier ${tier}). Usos restantes: ${r.usesLeft ?? '∞'}.`);
            } else {
              playErrorSound();
              addLog('system', `${p.charName}: ${r.reason ?? 'falha ao anular'}`);
            }
            dismiss(p.id);
          }}
          onAbsorb={() => {
            if (!canReact(p.charId, p.kind)) return;
            const elem = p.payload?.element;
            if (!elem) return;
            const r = armElementalAbsorption(p.charId, elem);
            if (r.ok) {
              playSuccessSound();
              consumeReaction(p.charId);
              const sides = (r.au ?? 0) >= 5 ? 10 : (r.au ?? 0) >= 3 ? 8 : 6;
              addLog('combat', `🔮 ${p.charName}: Absorção Elemental ARMADA (${DAMAGE_TYPE_LABELS[elem]}) — próximo ataque ganha ${r.au}d${sides}.`);
            } else {
              playErrorSound();
              addLog('system', `${p.charName}: ${r.reason ?? 'falha ao armar absorção'}`);
            }
            dismiss(p.id);
          }}
          onRedirect={() => {
            if (!canReact(p.charId, p.kind)) return;
            const r = redirectMissedAttack(p.charId);
            if (r.ok) {
              playSuccessSound();
              consumeReaction(p.charId);
              addLog('combat', `🎯 ${p.charName}: Aura Redirecionadora — refaça o ataque com +${r.bonus} (-${r.peSpent} PE).`);
            } else {
              playErrorSound();
              addLog('system', `${p.charName}: ${r.reason ?? 'falha ao redirecionar'}`);
            }
            dismiss(p.id);
          }}
          onAlmaMaldita={(useIt) => {
            if (useIt && !canReact(p.charId, p.kind)) return;
            const awaited = useReactionStore.getState().resolveDecision(p.id, useIt ? 1 : 0);
            if (!awaited) {
              const raw = p.payload?.pendingSoulDamage ?? p.payload?.soulDamageRaw ?? 0;
              const opts = p.payload?.soulDamageOpts;
              const resolvedOpts = { ...opts, tags: [...(opts?.tags ?? []), '__alma_maldita_resolved'] };
              if (useIt) {
                const result = useAlmaMaldita(p.charId, raw);
                if (result.ok && (result.reducedTo ?? 0) > 0) applyDamage(p.charId, result.reducedTo!, 'DAL', resolvedOpts);
                else if (!result.ok) applyDamage(p.charId, raw, 'DAL', resolvedOpts);
              } else applyDamage(p.charId, raw, 'DAL', resolvedOpts);
            }
            if (!useIt) addLog('combat', `${p.charName}: optou por não usar Alma Maldita; o dano segue normalmente.`);
            else playSuccessSound();
          }}
          onAnatomiaIncompreensivel={async () => {
            if (!canReact(p.charId, p.kind)) return;
            // TR de Constituição vs CD informada no payload (cursedDC).
            const c = useCharacterStore.getState().characters.find((x) => x.id === p.charId);
            if (!c) { useReactionStore.getState().resolveDecision(p.id, null); return; }
            const con = c.attributes?.find((a) => a.name === 'Constituição');
            const conMod = con ? Math.floor((con.value - 10) / 2) : 0;
            const r = await rollDiceCom(p.charId, '1d20');
            const total = r.total + conMod;
            const dc = p.payload?.cursedDC ?? 12;
            const passed = total >= dc;
            useReactionStore.getState().resolveDecision(p.id, passed ? 2 : 1);
            if (passed) playSuccessSound(); else playErrorSound();
            addLog('combat', `🧬 ${p.charName}: TR CON ${total} vs CD ${dc} ${passed ? '✅' : '❌'}.`);
          }}
          onPresencaNefastaRoll={async (enemy) => {
            const dc = p.payload?.cursedDC ?? 12;
            const r = await rollDiceCom(p.charId, '1d20');
            const total = r.total; // assume mod Vontade do NPC = 0 (Mestre ajusta livre)
            const failed = total < dc;
            const condId = failed ? 'amedrontado' : 'abalado';
            const condName = failed ? 'Amedrontado' : 'Abalado';
            const condIcon = failed ? '😨' : '😰';
            addCondition(enemy.id, {
              id: `presenca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              conditionId: condId,
              name: condName,
              icon: condIcon,
              remainingTurns: -1,
              remainingRounds: 1,
              sourceCharName: p.charName,
            });
            addLog('combat', `💀 Presença Nefasta de ${p.charName} → ${enemy.name}: TR Vontade ${total} vs CD ${dc} ${failed ? '❌ Amedrontado' : '✅ Abalado'} (1 rodada).`, `💀 Presença Nefasta de ${p.charName} → ${enemy.name}: ${failed ? 'Amedrontado' : 'Abalado'} (1 rodada).`);
            playClickSound();
          }}
          onLua={(useIt) => {
            const c = useCharacterStore.getState().characters.find((x) => x.id === p.charId);
            const use = useIt && !!c && canReact(p.charId, p.kind);
            const awaited = useReactionStore.getState().resolveDecision(p.id, use ? 1 : 0);
            if (!awaited) {
              const opts = (p.payload?.luaOpts ?? {}) as Parameters<typeof applyDamage>[3] & { tags?: string[] };
              applyDamage(p.charId, p.payload?.luaDamage ?? 0, p.payload?.luaDamageType, {
                ...opts,
                tags: [...(opts?.tags ?? []), '__lua'],
              });
            }
            if (use) playSuccessSound();
            else addLog('combat', `🌙 ${p.charName}: não usou Postura da Lua; o dano segue normalmente.`);
          }}
          onDevoradorAck={() => {
            addLog('combat', `⚡ ${p.charName}: Devorador de Energia — +1 tempPE.`);
            dismiss(p.id);
          }}
          onConditionEndTR={async () => {
            const c = useCharacterStore.getState().characters.find((x) => x.id === p.charId);
            if (!c) { dismiss(p.id); return; }
            const trType = (p.payload?.endTrType || 'reflexos').toLowerCase();
            const dc = p.payload?.endCD ?? 10;
            // Procura o TR pelo nome canônico.
            const stEntry = (c.savingThrows || []).find(
              (s) => (s.name || '').toLowerCase() === trType,
            );
            const linkedAttr = stEntry?.linkedAttribute;
            const linked = linkedAttr ? (c.attributes || []).find((a) => a.name === linkedAttr) : undefined;
            const attrMod = linked ? Math.floor((linked.value - 10) / 2) : 0;
            const baseBonus = (stEntry?.value || 0) + attrMod;
            const r = await rollDiceCom(p.charId, '1d20');
            const total = r.total + baseBonus;
            const passed = total >= dc;
            if (passed) {
              playSuccessSound();
              if (p.payload?.conditionInstanceId) {
                removeCondition(p.charId, p.payload.conditionInstanceId);
              }
              addLog('combat', `✅ ${p.charName}: TR de ${p.payload?.conditionName ?? 'condição'} — SUCESSO. Condição encerrada.`);
            } else {
              playErrorSound();
              addLog('combat', `❌ ${p.charName}: TR de ${p.payload?.conditionName ?? 'condição'} — FALHA. Condição continua.`);
            }
            dismiss(p.id);
          }}
          onPersistentAreaTR={async () => {
            const c = useCharacterStore.getState().characters.find((x) => x.id === p.charId);
            if (!c) { dismiss(p.id); return; }
            const trType = (p.payload?.endTrType || 'reflexos').toLowerCase();
            const dc = p.payload?.endCD ?? 10;
            const stEntry = (c.savingThrows || []).find((s) => (s.name || '').toLowerCase() === trType);
            const linkedAttr = stEntry?.linkedAttribute;
            const linked = linkedAttr ? (c.attributes || []).find((a) => a.name === linkedAttr) : undefined;
            const attrMod = linked ? Math.floor((linked.value - 10) / 2) : 0;
            const bonus = (stEntry?.value || 0) + attrMod;
            const r = await rollDiceCom(p.charId, '1d20');
            const passed = (r.total + bonus) >= dc;
            // Resolve via map store: aplica dano/condição se falhou, marca imune se passou.
            const { useMapStore } = await import('@/stores/useMapStore');
            const mp = useMapStore.getState();
            const tpl = mp.templates.find((t) => t.id === p.payload?.zoneTemplateId);
            const pz = tpl?.persistent;
            if (!pz) { dismiss(p.id); return; }
            if (passed) {
              playSuccessSound();
              if (p.payload?.zoneTRMode === 'uma_vez' || p.payload?.zoneTRMode === 'todo_round') {
                pz.affected[p.payload.targetEntityId!] = { ...(pz.affected[p.payload.targetEntityId!] || {}), immune: true };
              }
              addLog('combat', `✅ ${c.name}: TR vs ${p.payload?.zoneLabel} — SUCESSO.`);
            } else {
              playErrorSound();
              const cfg = pz.config;
              if ((cfg.effectMode === 'dano' || cfg.effectMode === 'ambos') && pz.damage) {
                const avg = pz.damage.numDice * Math.ceil((pz.damage.dieSize + 1) / 2) + pz.damage.mod;
                applyDamage(p.charId, avg, pz.damage.type as DamageType, { tags: ['__persistent_area_tick'] });
              }
              if ((cfg.effectMode === 'condicao' || cfg.effectMode === 'ambos') && pz.condition) {
                addCondition(p.charId, {
                  id: `pz_${tpl!.id}_${Date.now()}`,
                  conditionId: pz.condition.conditionId,
                  name: pz.condition.name,
                  icon: pz.condition.icon,
                  remainingTurns: pz.condition.turns,
                  remainingRounds: 0,
                  sourceCharName: pz.ownerCharName,
                  durationMode: pz.condition.durationMode,
                  endCD: pz.condition.endCD,
                  endTrType: pz.condition.endTrType,
                } as any);
              }
              addLog('combat', `❌ ${c.name}: TR vs ${p.payload?.zoneLabel} — FALHA. Sofre o efeito.`);
            }
            dismiss(p.id);
          }}
          onCobrirSe={(peSpent) => {
            if (!canReact(p.charId, p.kind)) return;
            const maxPe = Math.max(0, Math.min(p.payload?.maxPe ?? 0, p.payload?.peAvailable ?? 0));
            if (!Number.isInteger(peSpent) || peSpent < 1 || peSpent > maxPe) {
              playErrorSound();
              addLog('system', `${p.charName}: gasto de Cobrir-se fora do limite disponível.`);
              return;
            }
            useReactionStore.getState().resolveDecision(p.id, peSpent);
            playSuccessSound();
          }}
        />
      ))}
    </div>
  );
}

interface PromptCardProps {
  prompt: ReactionPrompt;
  reactionLocked?: boolean;
  onDismiss: () => void;
  onNullify: (tier: 'fraca' | 'media' | 'forte' | 'extrema') => void;
  onAbsorb: () => void;
  onRedirect: () => void;
  onAlmaMaldita: (useIt: boolean) => void;
  onAnatomiaIncompreensivel: () => void;
  onPresencaNefastaRoll: (enemy: { id: string; name: string }) => void;
  onDevoradorAck: () => void;
  onLua: (useIt: boolean) => void;
  onConditionEndTR: () => void;
  onPersistentAreaTR: () => void;
  onCobrirSe: (peSpent: number) => void;
}

function PromptCard({
  prompt: p, reactionLocked = false, onDismiss, onNullify, onAbsorb, onRedirect,
  onAlmaMaldita, onAnatomiaIncompreensivel, onPresencaNefastaRoll, onDevoradorAck, onLua,
  onConditionEndTR, onPersistentAreaTR, onCobrirSe,
}: PromptCardProps) {
  const [tier, setTier] = useState<'fraca' | 'media' | 'forte' | 'extrema'>('fraca');
  const [cobrirPe, setCobrirPe] = useState<number>(1);
  const maxCobrirPe = Math.max(0, Math.min(p.payload?.maxPe ?? 0, p.payload?.peAvailable ?? 0));
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil(((p.expiresAt ?? Date.now() + 12000) - Date.now()) / 1000)));
  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil(((p.expiresAt ?? Date.now()) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, [p.expiresAt]);

  const Icon =
    p.kind === 'nullify_offer' ? Shield :
    p.kind === 'absorption_offer' ? Flame :
    p.kind === 'redirect_offer' ? Crosshair :
    p.kind === 'fah_alma_maldita_offer' ? Sparkles :
    p.kind === 'fah_anatomia_incompr_offer' ? Shield :
    p.kind === 'cobrir_se_offer' ? ShieldPlus :
    p.kind === 'condition_end_tr_offer' ? Hourglass :
    p.kind === 'persistent_area_tr_offer' ? Hourglass :
    Skull;

  return (
    <div
      className={cn(
        'rounded-lg border-2 border-primary/60 bg-card shadow-lg shadow-primary/20 p-3 space-y-2',
        'animate-in slide-in-from-right duration-300',
        reactionLocked && 'opacity-80 border-muted-foreground/40',
      )}
    >
      {reactionLocked && (
        <div className="text-xs font-semibold uppercase tracking-wide text-destructive bg-destructive/10 border border-destructive/30 rounded px-1.5 py-0.5">
          Reação já usada nesta rodada
        </div>
      )}
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 text-xs text-foreground leading-snug">{p.message}</div>
        <button
          onClick={() => { playClickSound(); onDismiss(); }}
          className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          title="Ignorar"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className={cn('text-xs font-semibold tabular-nums', secondsLeft <= 3 ? 'text-destructive' : 'text-muted-foreground')}>
        {secondsLeft > 0 ? `Tempo para reagir: ${secondsLeft}s` : 'Encerrando reação…'}
      </div>

      {p.kind === 'nullify_offer' && (
        <div className="flex items-center gap-1.5">
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as typeof tier)}
            className="flex-1 text-xs bg-secondary/40 border border-border rounded px-1.5 py-1 text-foreground"
          >
            <option value="fraca">Fraca — 2 PE</option>
            <option value="media">Média — 4 PE</option>
            <option value="forte">Forte — 6 PE</option>
            <option value="extrema">Extrema — 10 PE</option>
          </select>
          <button
            onClick={() => onNullify(tier)}
            className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            Anular
          </button>
        </div>
      )}

      {p.kind === 'absorption_offer' && (
        <button
          onClick={onAbsorb}
          className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
        >
          🔮 Armar absorção {p.payload?.element ? `(${DAMAGE_TYPE_LABELS[p.payload.element as DamageType]})` : ''}
        </button>
      )}

      {p.kind === 'redirect_offer' && (
        <button
          onClick={onRedirect}
          className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
        >
          🎯 Redirecionar (2 PE)
        </button>
      )}

      {p.kind === 'lua_reacao_offer' && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onLua(true)}
            className="flex-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            🌙 Usar reação
          </button>
          <button
            onClick={() => onLua(false)}
            className="flex-1 text-xs px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
          >
            Aceitar dano
          </button>
        </div>
      )}

      {p.kind === 'fah_alma_maldita_offer' && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onAlmaMaldita(true)}
            className="flex-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            🩸 Usar (1 uso)
          </button>
          <button
            onClick={() => onAlmaMaldita(false)}
            className="flex-1 text-xs px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
          >
            Aceitar dano
          </button>
        </div>
      )}

      {p.kind === 'fah_anatomia_incompr_offer' && (
        <button
          onClick={onAnatomiaIncompreensivel}
          className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
        >
          🧬 Rolar TR Constituição vs CD {p.payload?.cursedDC ?? '?'}
        </button>
      )}

      {p.kind === 'fah_devorador_energia_offer' && (
        <button
          onClick={onDevoradorAck}
          className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
        >
          ⚡ +1 tempPE confirmado
        </button>
      )}

      {p.kind === 'fah_presenca_nefasta' && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">CD {p.payload?.cursedDC} — clique em cada inimigo para rolar TR Vontade.</div>
          <div className="grid grid-cols-2 gap-1">
            {(p.payload?.enemies ?? []).map((e) => (
              <button
                key={e.id}
                onClick={() => onPresencaNefastaRoll(e)}
                className="text-xs px-1.5 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary text-left truncate"
                title={e.name}
              >
                {e.name}
              </button>
            ))}
          </div>
          <button
            onClick={onDismiss}
            className="w-full text-xs px-2 py-0.5 rounded text-muted-foreground hover:text-foreground"
          >
            Encerrar Presença Nefasta
          </button>
        </div>
      )}

      {p.kind === 'condition_end_tr_offer' && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            TR de <span className="font-semibold">{p.payload?.conditionName ?? 'condição'}</span>
            {p.payload?.durationMode === 'ate_passar_tr' && ' — só sai se passar.'}
            {p.payload?.durationMode === 'tr_todo_round' && ' — sucesso encerra antes do prazo.'}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onConditionEndTR}
              className="flex-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              🎲 Rolar TR
            </button>
            <button
              onClick={onDismiss}
              className="text-xs px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
              title="Adiar (mantém o prompt fechado neste turno)"
            >
              Adiar
            </button>
          </div>
        </div>
      )}

      {p.kind === 'persistent_area_tr_offer' && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            Zona: <span className="font-semibold">{p.payload?.zoneLabel ?? 'área persistente'}</span>
            {p.payload?.zoneTRMode === 'uma_vez' && ' — TR uma vez ao entrar (imune se passar).'}
            {p.payload?.zoneTRMode === 'todo_round' && ' — TR a cada round (imune se passar).'}
            {p.payload?.zoneTRMode === 'todo_turno' && ' — TR a cada turno enquanto dentro.'}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onPersistentAreaTR}
              className="flex-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              ⏳ Rolar TR vs zona
            </button>
            <button
              onClick={onDismiss}
              className="text-xs px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
              title="Aceitar efeito sem rolar"
            >
              Aceitar
            </button>
          </div>
        </div>
      )}

      {p.kind === 'cobrir_se_offer' && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            Dano previsto: <span className="font-semibold text-foreground">{p.payload?.damageDealt ?? 0}</span>.
            {' '}{p.payload?.hasCoberturaAvancada ? 'Cobertura Avançada' : 'Cobrir-se'}: {p.payload?.perPe ?? 4} PVTs/PE.
            {' '}Você tem até 12 segundos para decidir; depois o dano segue normalmente.
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={maxCobrirPe}
              value={Math.min(cobrirPe, maxCobrirPe)}
              onChange={(e) => setCobrirPe(Math.min(maxCobrirPe, Math.max(1, parseInt(e.target.value || '1', 10))))}
              className="w-14 text-xs bg-secondary/40 border border-border rounded px-1.5 py-1 text-foreground"
            />
            <span className="text-xs text-muted-foreground">
              PE × {p.payload?.perPe ?? 4} = +{cobrirPe * (p.payload?.perPe ?? 4)}
            </span>
            <button
              onClick={() => onCobrirSe(cobrirPe)}
              disabled={maxCobrirPe <= 0 || cobrirPe > maxCobrirPe}
              className="ml-auto text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              🛡️ Cobrir-se
            </button>
          </div>
          <button
            onClick={onDismiss}
            className="w-full text-xs px-2 py-0.5 rounded text-muted-foreground hover:text-foreground"
          >
            Ignorar (aceitar dano)
          </button>
        </div>
      )}
    </div>
  );
}
