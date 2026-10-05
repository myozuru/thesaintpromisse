/**
 * ============================================================================
 *  CamCoreTabs — UI dos 3 Núcleos do CAM
 * ============================================================================
 *  Renderiza tabs para os 3 núcleos com:
 *   - botão de troca (Ação Bônus em combate);
 *   - badge [DANIFICADO] e disabled de troca;
 *   - oculta núcleos destruídos;
 *   - barra única de Integridade da Alma (compartilhada);
 *   - prompt de tamanho Grande no Nv 15+.
 * ============================================================================
 */
import { useMemo } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { defaultSizeForLevel, isCamActive } from '@/lib/camCores';
import { cn } from '@/lib/utils';
import { Layers, Sparkles, Skull, ShieldAlert } from 'lucide-react';
import { playClickSound, playErrorSound } from '@/lib/sounds';

interface Props {
  character: Character;
}

export function CamCoreTabs({ character: c }: Props) {
  const { switchCore, updateCharacter } = useCharacterStore();
  const addLog = useLogStore(s => s.addLog);

  const visibleCores = useMemo(
    () => (c.cores ?? []).filter(co => !co.destroyed),
    [c.cores],
  );

  if (!isCamActive(c)) return null;

  const handleSwitch = (coreId: typeof c.activeCoreId) => {
    if (!coreId || coreId === c.activeCoreId) return;
    if (c.dying) {
      playErrorSound();
      addLog('system', `❌ ${c.name} está Morrendo — proibido trocar de núcleo.`);
      return;
    }
    const ok = switchCore(c.id, coreId);
    if (ok) {
      playClickSound();
      addLog('combat', `🔁 ${c.name} trocou para ${coreId.toUpperCase()} (Ação Bônus).`);
    } else {
      playErrorSound();
      addLog('system', `❌ Troca para ${coreId} bloqueada (sem ação bônus ou núcleo danificado/destruído).`);
    }
  };

  const handleSize = (size: 'Pequeno' | 'Médio' | 'Grande') => {
    updateCharacter(c.id, { sizeCategory: size });
    addLog('system', `📏 ${c.name} agora é tamanho ${size}.`);
  };

  const soulMax = c.soulIntegrityMax ?? 0;
  const soulCur = c.soulIntegrityCurrent ?? 0;
  const soulPct = soulMax > 0 ? Math.max(0, Math.min(100, (soulCur / soulMax) * 100)) : 0;

  const autoSize = defaultSizeForLevel(c.level, c.sizeCategory);
  const canPickGrande = c.level >= 15;

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-accent" />
        <span className="text-xs font-bold uppercase tracking-wider text-accent">
          Núcleos Amaldiçoados
        </span>
        {c.dying && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-hp/60 bg-hp/15 px-2 py-0.5 text-xs font-bold text-hp">
            <Skull className="h-3 w-3" /> Morrendo
          </span>
        )}
      </div>

      {/* Tabs dos núcleos */}
      <div className="grid grid-cols-3 gap-2">
        {visibleCores.map(core => {
          const active = core.id === c.activeCoreId;
          const damaged = !!core.damaged;
          const isPrimary = core.id === c.primaryCoreId;
          return (
            <button
              key={core.id}
              onClick={() => handleSwitch(core.id)}
              disabled={active || damaged || c.dying}
              className={cn(
                'rounded-lg border p-2 text-left transition-all',
                active
                  ? 'bg-accent/25 border-accent text-foreground shadow-sm shadow-accent/30'
                  : 'bg-secondary/30 border-border text-muted-foreground hover:border-accent/40',
                (damaged || c.dying) && 'opacity-50 cursor-not-allowed',
              )}
              title={
                damaged
                  ? 'Núcleo danificado — precisa de cura'
                  : active
                    ? 'Núcleo ativo'
                    : c.dying
                      ? 'Não pode trocar enquanto Morrendo'
                      : 'Trocar (Ação Bônus)'
              }
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold">{core.name}</span>
                {isPrimary && (
                  <Sparkles className="h-3 w-3 text-primary" aria-label="Primário" />
                )}
                {damaged && (
                  <span className="ml-auto inline-flex items-center gap-0.5 rounded-full border border-hp/60 bg-hp/15 px-1.5 py-px text-xs font-bold text-hp">
                    <ShieldAlert className="h-2.5 w-2.5" /> DANIFICADO
                  </span>
                )}
                {active && !damaged && (
                  <span className="ml-auto rounded-full bg-accent/30 px-1.5 py-px text-xs font-bold text-accent">
                    ATIVO
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {core.specialization}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs font-mono">
                <div className="text-hp">
                  HP {core.hpCurrent}/{core.hpMax}
                </div>
                <div className="text-pe">
                  PE {core.peCurrent}/{core.peMax}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Barra de Integridade da Alma */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider">
          <span className="font-bold text-accent">Integridade da Alma</span>
          <span className="font-mono text-accent/80">
            {soulCur} / {soulMax}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/60">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${soulPct}%` }}
          />
        </div>
        {soulCur === 0 && soulMax > 0 && (
          <p className="text-xs font-bold text-hp">
            ⚠ Alma destruída — todos os núcleos colapsam.
          </p>
        )}
      </div>

      {/* Tamanho do CAM */}
      <div className="flex items-center gap-2 border-t border-accent/20 pt-2">
        <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
          Tamanho
        </span>
        {(['Pequeno', 'Médio', 'Grande'] as const).map(size => {
          const enabled =
            (size === 'Pequeno' && c.level < 6) ||
            (size === 'Médio' && c.level >= 6) ||
            (size === 'Grande' && canPickGrande);
          const current = (c.sizeCategory ?? autoSize) === size;
          return (
            <button
              key={size}
              onClick={() => enabled && handleSize(size)}
              disabled={!enabled}
              className={cn(
                'rounded-md border px-2 py-0.5 text-xs font-bold transition-colors',
                current
                  ? 'bg-accent/30 border-accent text-accent'
                  : 'bg-background border-border text-muted-foreground hover:border-accent/40',
                !enabled && 'opacity-30 cursor-not-allowed',
              )}
            >
              {size}
            </button>
          );
        })}
        {!canPickGrande && (
          <span className="ml-auto text-xs text-muted-foreground italic">
            Grande disponível Nv 15+
          </span>
        )}
      </div>
    </div>
  );
}
