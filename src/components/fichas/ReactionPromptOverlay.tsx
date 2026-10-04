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
 * O overlay é montado uma única vez no FichasModule.
 */
import { useState } from 'react';
import { useReactionStore, type ReactionPrompt, kindConsumesReaction } from '@/stores/useReactionStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { effectiveMovement } from '@/lib/movementBudget';
import { useLogStore } from '@/stores/useLogStore';
import { DAMAGE_TYPE_LABELS, type DamageType } from '@/types';
import { rollDiceCom } from '@/lib/dice';
import { X, Shield, Flame, Crosshair, Skull, Sparkles, Hourglass, ShieldPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playSuccessSound, playErrorSound, playClickSound } from '@/lib/sounds';

export function ReactionPromptOverlay() {
  const prompts = useReactionStore(s => s.prompts);
  const dismiss = useReactionStore(s => s.dismiss);
  const reactionsUsedByChar = useReactionStore(s => s.reactionsUsedByChar);
  const consumeReaction = useReactionStore(s => s.consumeReaction);
  const addLog = useLogStore(s => s.addLog);
  const tryNullifyCondition = useCharacterStore(s => s.tryNullifyCondition);
  const armElementalAbsorption = useCharacterStore(s => s.armElementalAbsorption);
  const redirectMissedAttack = useCharacterStore(s => s.redirectMissedAttack);
  const removeCondition = useCharacterStore(s => s.removeCondition);
  const useAlmaMaldita = useCharacterStore(s => s.useAlmaMaldita);
  const applyDamage = useCharacterStore(s => s.applyDamage);
  const applyHealing = useCharacterStore(s => s.applyHealing);
  const addCondition = useCharacterStore(s => s.addCondition);

  if (prompts.length === 0) return null;

  /** Bloqueia ação se a reação da rodada já foi gasta. */
  const canReact = (charId: string, kind: ReactionPrompt['kind']): boolean => {
    if (!kindConsumesReaction(kind)) return true;
    if ((reactionsUsedByChar[charId] ?? 0) >= 1) {
      playErrorSound();
      addLog('system', 'Reação já usada nesta rodada (limite: 1 por personagem).');
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
          reactionLocked={kindConsumesReaction(p.kind) && (reactionsUsedByChar[p.charId] ?? 0) >= 1}
          onDismiss={() => {
            if (p.kind === 'cobrir_se_offer') useReactionStore.getState().resolveDecision(p.id, null);
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
            const raw = p.payload?.pendingSoulDamage ?? 0;
            const opts = p.payload?.soulDamageOpts;
            const opcoesResolvidas = { ...opts, tags: [...(opts?.tags ?? []), '__alma_maldita_resolved'] };
            if (useIt) {
              if (!canReact(p.charId, p.kind)) return;
              const r = useAlmaMaldita(p.charId, raw);
              if (r.ok) {
                playSuccessSound();
                consumeReaction(p.charId);
                addLog('combat', `🩸 ${p.charName}: Alma Maldita — dano à Alma reduzido de ${raw} → ${r.reducedTo}. Restantes: ${r.usesLeft}.`);
                if ((r.reducedTo ?? 0) > 0) {
                  applyDamage(p.charId, r.reducedTo!, 'DAL', opcoesResolvidas);
                }
              } else {
                playErrorSound();
                addLog('system', `${p.charName}: ${r.reason ?? 'falha Alma Maldita'} — aplicando dano cheio.`);
                applyDamage(p.charId, raw, 'DAL', opcoesResolvidas);
              }
            } else {
              applyDamage(p.charId, raw, 'DAL', opcoesResolvidas);
              addLog('combat', `${p.charName}: optou por NÃO usar Alma Maldita — sofreu ${raw} de dano à Alma.`);
            }
            dismiss(p.id);
          }}
          onAnatomiaIncompreensivel={async () => {
            if (!canReact(p.charId, p.kind)) return;
            consumeReaction(p.charId);
            // TR de Constituição vs CD informada no payload (cursedDC).
            const c = useCharacterStore.getState().characters.find((x) => x.id === p.charId);
            if (!c) { dismiss(p.id); return; }
            const con = c.attributes?.find((a) => a.name === 'Constituição');
            const conMod = con ? Math.floor((con.value - 10) / 2) : 0;
            const r = await rollDiceCom(p.charId, '1d20');
            const total = r.total + conMod;
            const dc = p.payload?.cursedDC ?? 12;
            const passed = total >= dc;
            const raw = p.payload?.critDamageRaw ?? 0;
            if (passed) {
              // Mitigação: cura metade do dano sofrido (representa "ferida não atinge órgão vital").
              const heal = Math.floor(raw / 2);
              applyHealing(p.charId, heal, 'other');
              playSuccessSound();
              addLog('combat', `🧬 ${p.charName}: Anatomia Incompreensível — TR CON ${total} vs CD ${dc} ✅ — cura ${heal} (metade do crítico).`);
            } else {
              playErrorSound();
              addLog('combat', `🧬 ${p.charName}: Anatomia Incompreensível — TR CON ${total} vs CD ${dc} ❌ — dano integral mantido.`);
            }
            dismiss(p.id);
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
            addLog('combat', `💀 Presença Nefasta de ${p.charName} → ${enemy.name}: TR Vontade ${total} vs CD ${dc} ${failed ? '❌ Amedrontado' : '✅ Abalado'} (1 rodada).`);
            playClickSound();
          }}
          onLua={(useIt) => {
            const raw = p.payload?.luaDamage ?? 0;
            const type = p.payload?.luaDamageType;
            const opts = (p.payload?.luaOpts ?? {}) as Parameters<typeof applyDamage>[3] & { tags?: string[] };
            const tags = [...(opts?.tags ?? []), '__lua'];
            const c = useCharacterStore.getState().characters.find((x) => x.id === p.charId);
            if (useIt && c && (c.reactionsCurrent ?? 0) > 0 && canReact(p.charId, p.kind)) {
              const red = p.payload?.luaReducao ?? c.level ?? 1;
              const reduced = Math.max(0, raw - red);
              const used = useCombatStore.getState().movementUsedByChar[p.charId] ?? 0;
              useCharacterStore.getState().updateCharacter(p.charId, {
                reactionsCurrent: Math.max(0, (c.reactionsCurrent ?? 0) - 1),
                mobilidadeReacaoM: effectiveMovement(c),
                mobilidadeReacaoBase: used,
                desengajado: true,
              });
              consumeReaction(p.charId);
              playSuccessSound();
              addLog('combat', `🌙 Postura da Lua: ${p.charName} usa a reação — dano ${raw} → ${reduced} (−${Math.min(red, raw)}). Pode Andar (${effectiveMovement(c)} m) e está Desengajado até o fim do seu turno.`);
              if (reduced > 0) applyDamage(p.charId, reduced, type, { ...opts, tags });
            } else {
              if (useIt) addLog('system', `${p.charName}: sem reação disponível — dano cheio.`);
              else addLog('combat', `🌙 ${p.charName}: não usou a reação da Lua — sofreu ${raw} de dano.`);
              applyDamage(p.charId, raw, type, { ...opts, tags });
            }
            dismiss(p.id);
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
            useReactionStore.getState().resolveDecision(p.id, peSpent);
            playSuccessSound();
            addLog('combat', `🛡️ ${p.charName}: confirmou Cobrir-se antes da aplicação do dano.`);
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
        <div className="text-[10px] font-semibold uppercase tracking-wide text-destructive bg-destructive/10 border border-destructive/30 rounded px-1.5 py-0.5">
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

      {p.kind === 'nullify_offer' && (
        <div className="flex items-center gap-1.5">
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as typeof tier)}
            className="flex-1 text-[11px] bg-secondary/40 border border-border rounded px-1.5 py-1 text-foreground"
          >
            <option value="fraca">Fraca — 2 PE</option>
            <option value="media">Média — 4 PE</option>
            <option value="forte">Forte — 6 PE</option>
            <option value="extrema">Extrema — 10 PE</option>
          </select>
          <button
            onClick={() => onNullify(tier)}
            className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            Anular
          </button>
        </div>
      )}

      {p.kind === 'absorption_offer' && (
        <button
          onClick={onAbsorb}
          className="w-full text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
        >
          🔮 Armar absorção {p.payload?.element ? `(${DAMAGE_TYPE_LABELS[p.payload.element as DamageType]})` : ''}
        </button>
      )}

      {p.kind === 'redirect_offer' && (
        <button
          onClick={onRedirect}
          className="w-full text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
        >
          🎯 Redirecionar (2 PE)
        </button>
      )}

      {p.kind === 'lua_reacao_offer' && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onLua(true)}
            className="flex-1 text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            🌙 Usar reação
          </button>
          <button
            onClick={() => onLua(false)}
            className="flex-1 text-[10px] px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
          >
            Aceitar dano
          </button>
        </div>
      )}

      {p.kind === 'fah_alma_maldita_offer' && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onAlmaMaldita(true)}
            className="flex-1 text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            🩸 Usar (1 uso)
          </button>
          <button
            onClick={() => onAlmaMaldita(false)}
            className="flex-1 text-[10px] px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
          >
            Aceitar dano
          </button>
        </div>
      )}

      {p.kind === 'fah_anatomia_incompr_offer' && (
        <button
          onClick={onAnatomiaIncompreensivel}
          className="w-full text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
        >
          🧬 Rolar TR Constituição vs CD {p.payload?.cursedDC ?? '?'}
        </button>
      )}

      {p.kind === 'fah_devorador_energia_offer' && (
        <button
          onClick={onDevoradorAck}
          className="w-full text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
        >
          ⚡ +1 tempPE confirmado
        </button>
      )}

      {p.kind === 'fah_presenca_nefasta' && (
        <div className="space-y-1">
          <div className="text-[10px] text-muted-foreground">CD {p.payload?.cursedDC} — clique em cada inimigo para rolar TR Vontade.</div>
          <div className="grid grid-cols-2 gap-1">
            {(p.payload?.enemies ?? []).map((e) => (
              <button
                key={e.id}
                onClick={() => onPresencaNefastaRoll(e)}
                className="text-[10px] px-1.5 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary text-left truncate"
                title={e.name}
              >
                {e.name}
              </button>
            ))}
          </div>
          <button
            onClick={onDismiss}
            className="w-full text-[10px] px-2 py-0.5 rounded text-muted-foreground hover:text-foreground"
          >
            Encerrar Presença Nefasta
          </button>
        </div>
      )}

      {p.kind === 'condition_end_tr_offer' && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-muted-foreground">
            TR de <span className="font-semibold">{p.payload?.conditionName ?? 'condição'}</span>
            {p.payload?.durationMode === 'ate_passar_tr' && ' — só sai se passar.'}
            {p.payload?.durationMode === 'tr_todo_round' && ' — sucesso encerra antes do prazo.'}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onConditionEndTR}
              className="flex-1 text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              🎲 Rolar TR
            </button>
            <button
              onClick={onDismiss}
              className="text-[10px] px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
              title="Adiar (mantém o prompt fechado neste turno)"
            >
              Adiar
            </button>
          </div>
        </div>
      )}

      {p.kind === 'persistent_area_tr_offer' && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-muted-foreground">
            Zona: <span className="font-semibold">{p.payload?.zoneLabel ?? 'área persistente'}</span>
            {p.payload?.zoneTRMode === 'uma_vez' && ' — TR uma vez ao entrar (imune se passar).'}
            {p.payload?.zoneTRMode === 'todo_round' && ' — TR a cada round (imune se passar).'}
            {p.payload?.zoneTRMode === 'todo_turno' && ' — TR a cada turno enquanto dentro.'}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onPersistentAreaTR}
              className="flex-1 text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              ⏳ Rolar TR vs zona
            </button>
            <button
              onClick={onDismiss}
              className="text-[10px] px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
              title="Aceitar efeito sem rolar"
            >
              Aceitar
            </button>
          </div>
        </div>
      )}

      {p.kind === 'cobrir_se_offer' && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-muted-foreground">
            Dano previsto: <span className="font-semibold text-foreground">{p.payload?.damageDealt ?? 0}</span>.
            {' '}{p.payload?.hasCoberturaAvancada ? 'Cobertura Avançada' : 'Cobrir-se'}: {p.payload?.perPe ?? 4} PVTs/PE.
            {' '}Você tem até 12 segundos para decidir; depois o dano segue normalmente.
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={Math.min(p.payload?.maxPe ?? 1, p.payload?.peAvailable ?? 1)}
              value={cobrirPe}
              onChange={(e) => setCobrirPe(Math.max(1, parseInt(e.target.value || '1', 10)))}
              className="w-14 text-[11px] bg-secondary/40 border border-border rounded px-1.5 py-1 text-foreground"
            />
            <span className="text-[10px] text-muted-foreground">
              PE × {p.payload?.perPe ?? 4} = +{cobrirPe * (p.payload?.perPe ?? 4)}
            </span>
            <button
              onClick={() => onCobrirSe(cobrirPe)}
              className="ml-auto text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              🛡️ Cobrir-se
            </button>
          </div>
          <button
            onClick={onDismiss}
            className="w-full text-[10px] px-2 py-0.5 rounded text-muted-foreground hover:text-foreground"
          >
            Ignorar (aceitar dano)
          </button>
        </div>
      )}
    </div>
  );
}
