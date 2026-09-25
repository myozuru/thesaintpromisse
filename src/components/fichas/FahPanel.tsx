/**
 * ============================================================================
 *  FAH PANEL — Painel de gestão da origem "Feto Amaldiçoado Híbrido"
 * ============================================================================
 *  Engloba:
 *  - Vigor Maldito: contador de usos, slider para escolher quantos gastar de
 *    uma vez, prévia em tempo real da cura ((Base + ConMod) × usos), botão
 *    Ação Bônus que dispara `useVigorMaldito` no store.
 *  - Anatomias ativas: chips das características escolhidas (data-driven).
 *  - Toggles de combate: "Duas Mãos Livres" (Braços Extras), "Sangue Tóxico
 *    Ativo" (gancho `onTakeDamage` ativo em `useCharacterStore.applyDamage`,
 *    devolve dano ao atacante em ataques corpo-a-corpo).
 *  - Prompts contextuais:
 *      * Corpo Especializado → seleção da perícia (uma vez).
 *      * Carapaça Mutante Lv 10+ → seleção do tipo físico para Resistência.
 *  - Alma Maldita: contador diário (consumo automático via prompt de reação
 *    quando o personagem recebe dano à Alma).
 *
 *  Toda a matemática vem de helpers exportados pelo store/origins — o jogador
 *  e o Mestre nunca precisam calcular nada à mão.
 * ============================================================================
 */
import { useState } from 'react';
import { Heart, Activity, Shield, Eye, Zap, ChevronRight, Hand, Skull, Sparkles } from 'lucide-react';
import type { Character, DamageType } from '@/types';
import {
  useCharacterStore,
  calcVigorMalditoBase,
  calcAlmaMalditaMax,
  calcVigorMalditoMax,
} from '@/stores/useCharacterStore';
import { FAH_ANATOMIES } from '@/lib/origins';
import { hasAnatomy, PHYSICAL_DAMAGE_TYPES } from '@/lib/anatomyEffects';
import { useLogStore } from '@/stores/useLogStore';
import { DAMAGE_TYPE_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  character: Character;
}

function getConMod(c: Character): number {
  const con = c.attributes?.find((a) => a.name === 'Constituição');
  return con ? Math.floor((con.value - 10) / 2) : 0;
}

export function FahPanel({ character: c }: Props) {
  const { useVigorMaldito, updateCharacter } = useCharacterStore();
  const addLog = useLogStore((s) => s.addLog);
  const [usesToSpend, setUsesToSpend] = useState(1);

  if (c.origin !== 'Feto Amaldiçoada Híbrido (FAH)') return null;

  const conMod = getConMod(c);
  const base = calcVigorMalditoBase(c.level);
  const max = c.vigorMalditoMax ?? calcVigorMalditoMax(c.level);
  const cur = c.vigorMalditoUses ?? max;
  const almaMax = c.almaMalditaMax ?? calcAlmaMalditaMax(c.level);
  const almaCur = c.almaMalditaUses ?? almaMax;

  const previewHeal = (base + conMod) * Math.min(usesToSpend, cur);
  const ids = c.anatomyFeatures ?? [];

  const onUseVigor = () => {
    const r = useVigorMaldito(c.id, Math.min(usesToSpend, cur));
    if (!r.ok) {
      addLog('system', `❌ ${c.name}: ${r.reason}`);
      return;
    }
    addLog(
      'combat',
      `🩸 ${c.name} usou ${Math.min(usesToSpend, cur)}× Vigor Maldito → +${r.healed} HP (${r.base}+${r.conMod} CON × ${Math.min(usesToSpend, cur)}). Restantes: ${r.usesLeft}/${max}.`,
    );
    setUsesToSpend(1);
  };

  // ===== Toggles e prompts =====
  const needsCorpoEspSkill = hasAnatomy(c, 'corpo_especializado') && !c.anatomyCorpoEspecializadoSkill;
  const needsCarapacaResist = hasAnatomy(c, 'carapaca_mutante') && c.level >= 10 && !c.anatomyCarapacaResistType;

  return (
    <div className="px-4 pb-2 space-y-2">
      {/* ─── Header da origem ─── */}
      <div className="rounded-xl border border-hp/40 bg-gradient-to-br from-hp/10 to-transparent p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Skull className="h-4 w-4 text-hp" />
          <span className="text-sm font-bold text-hp">Feto Amaldiçoado Híbrido</span>
          <span className="ml-auto text-xs text-muted-foreground">Origem</span>
        </div>

        {/* ─── Vigor Maldito ─── */}
        <div className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 text-hp" />
            <span className="text-xs font-bold">Vigor Maldito</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {cur}/{max} usos
            </span>
          </div>
          {cur === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem usos. Recupere com Descanso Longo.</p>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: max }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-2 flex-1 rounded-sm border border-hp/40',
                      i < cur ? 'bg-hp/70' : 'bg-secondary/50',
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Gastar:</label>
                <input
                  type="range"
                  min={1}
                  max={cur}
                  value={Math.min(usesToSpend, cur)}
                  onChange={(e) => setUsesToSpend(Number(e.target.value))}
                  className="flex-1 accent-hp"
                />
                <span className="text-xs font-bold w-6 text-center">{Math.min(usesToSpend, cur)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  ({base} + {conMod >= 0 ? '+' : ''}{conMod} CON) × {Math.min(usesToSpend, cur)}
                </span>
                <span className="font-bold text-hp">+{previewHeal} HP</span>
              </div>
              <Button
                size="sm"
                className="w-full h-7 text-xs bg-hp/80 hover:bg-hp text-white"
                onClick={onUseVigor}
              >
                <Activity className="h-3 w-3 mr-1" /> Usar (Ação Bônus)
              </Button>
            </>
          )}
        </div>

        {/* ─── Devorador de Energia (manual: TR passado contra Feitiço → +1 tempPE) ─── */}
        <div className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-bold">Devorador de Energia</span>
            <span className="ml-auto text-xs text-muted-foreground">tempPE atual: {c.tempPE ?? 0}</span>
          </div>
          <p className="text-xs text-muted-foreground">Passou em TR contra um efeito com tag &quot;Feitiço&quot;? Confirme para ganhar +1 tempPE.</p>
          <button
            onClick={() => {
              useCharacterStore.getState().notifyFahSavedVsSpell(c.id);
              addLog('combat', `⚡ ${c.name}: Devorador de Energia — +1 tempPE.`);
            }}
            className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            ⚡ Passei no TR → +1 tempPE
          </button>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-bold">Alma Maldita</span>
            <span className="ml-auto text-xs text-muted-foreground">{almaCur}/{almaMax} usos/dia</span>
          </div>
          <p className="text-xs text-muted-foreground">Reduz dano à Alma pela metade (anula no Lv 15+) ANTES do teste de Integridade.</p>
        </div>

        {/* ─── Toggles de combate ─── */}
        <div className="grid grid-cols-2 gap-2">
          {hasAnatomy(c, 'bracos_extras') && (
            <button
              onClick={() => updateCharacter(c.id, { anatomyDuasMaosLivres: !c.anatomyDuasMaosLivres })}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-xs text-left transition-all',
                c.anatomyDuasMaosLivres
                  ? 'border-hp/60 bg-hp/15 text-foreground'
                  : 'border-border bg-secondary/30 text-muted-foreground hover:border-hp/30',
              )}
            >
              <div className="flex items-center gap-1 font-bold">
                <Hand className="h-3 w-3" /> Duas Mãos Livres
              </div>
              <div className="opacity-80">{c.anatomyDuasMaosLivres ? '+2 Atletismo ATIVO' : 'Toggle p/ +2 Atletismo'}</div>
            </button>
          )}
          <button
            onClick={() => updateCharacter(c.id, { sangueToxicoEnabled: !(c.sangueToxicoEnabled ?? true) })}
            className={cn(
              'rounded-lg border px-2 py-1.5 text-xs text-left transition-all',
              (c.sangueToxicoEnabled ?? true)
                ? 'border-neon-red/60 bg-neon-red/15 text-foreground'
                : 'border-border bg-secondary/30 text-muted-foreground',
            )}
          >
            <div className="flex items-center gap-1 font-bold">
              <Zap className="h-3 w-3" /> Sangue Tóxico
            </div>
            <div className="opacity-80">{(c.sangueToxicoEnabled ?? true) ? 'Devolve dano em melee' : 'Desligado'}</div>
          </button>
        </div>

        {/* ─── Anatomias ativas ─── */}
        {ids.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Anatomias ({ids.length})</div>
            <div className="flex flex-wrap gap-1">
              {ids.map((id) => {
                const a = FAH_ANATOMIES.find((x) => x.id === id);
                if (!a) return null;
                return (
                  <span
                    key={id}
                    className="rounded-md border border-hp/30 bg-hp/10 px-1.5 py-0.5 text-xs text-foreground"
                    title={a.description}
                  >
                    {a.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Prompt: Corpo Especializado precisa de perícia ─── */}
        {needsCorpoEspSkill && (
          <div className="rounded-lg border border-accent/50 bg-accent/10 p-2 space-y-1.5">
            <div className="text-xs font-bold flex items-center gap-1">
              <ChevronRight className="h-3 w-3" /> Corpo Especializado: escolha a perícia
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(c.skills ?? []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => updateCharacter(c.id, { anatomyCorpoEspecializadoSkill: s.name })}
                  className="rounded border border-border bg-secondary/40 px-1.5 py-1 text-xs text-left hover:border-accent/50"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Prompt: Carapaça Mutante Lv10+ → Resistência a 1 tipo físico ─── */}
        {needsCarapacaResist && (
          <div className="rounded-lg border border-accent/50 bg-accent/10 p-2 space-y-1.5">
            <div className="text-xs font-bold flex items-center gap-1">
              <Shield className="h-3 w-3" /> Carapaça Mutante (Lv 10): escolha o tipo físico p/ Resistência
            </div>
            <div className="flex gap-1">
              {PHYSICAL_DAMAGE_TYPES.map((t: DamageType) => (
                <button
                  key={t}
                  onClick={() => updateCharacter(c.id, { anatomyCarapacaResistType: t })}
                  className="flex-1 rounded border border-border bg-secondary/40 px-1.5 py-1 text-xs hover:border-accent/50"
                >
                  {DAMAGE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Indicadores rápidos ─── */}
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          {hasAnatomy(c, 'olhos_sombrios') && <span className="rounded bg-secondary/50 px-1.5 py-0.5"><Eye className="inline h-3 w-3 mr-0.5" />Visão no Escuro</span>}
          {hasAnatomy(c, 'pernas_extras') && <span className="rounded bg-secondary/50 px-1.5 py-0.5">Ignora Terreno Difícil</span>}
          {(c.meleeRangeBonus ?? 0) > 0 && <span className="rounded bg-secondary/50 px-1.5 py-0.5">Alcance +{c.meleeRangeBonus}m</span>}
          {hasAnatomy(c, 'desenvolvimento_exagerado') && <span className="rounded bg-secondary/50 px-1.5 py-0.5">Tamanho +1</span>}
          {c.canHealWithCursedEnergy && <span className="rounded bg-secondary/50 px-1.5 py-0.5">Autocura ER (2 PE)</span>}
        </div>
      </div>
    </div>
  );
}
