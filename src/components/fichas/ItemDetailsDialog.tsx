/**
 * 🔎 ItemDetailsDialog — Modal de detalhes para itens do inventário e
 * acessórios equipados. Aceita tanto entidades Omni quanto itens legados.
 *
 * Disparado ao clicar (sem usar nenhum botão interno) numa linha de
 * inventário ou num slot de acessório ocupado. Mostra:
 *   • Nome, slot, descrição
 *   • Bônus passivos (ca, hp, pe, rd, esc, slots) + fórmulas opcionais
 *   • Plano de Execução (humano) via OmniItemDescription
 *   • Dados de combate (custo, alcance, área, crítico) quando isActive
 *   • Bônus do item legado (CA/HP/PE/RD/ataque)
 */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Gem, Sword, Sparkles, Clock, Target, Zap } from 'lucide-react';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import { normalizarCombatData } from '@/lib/omni/tipos';
import type { Item } from '@/types';
import { ITEM_SLOT_LABELS, DAMAGE_TYPE_LABELS } from '@/types';
import { OmniItemDescription } from '@/components/omni/OmniItemDescription';
import {
  SYSTEM_ACTIONS, RANGE_TYPES, AOE_SHAPES,
} from '@/lib/omni/constantesDoSistema';

export type ItemDetailsTarget =
  | { kind: 'omni'; entity: EntidadeOmni; equippedSlot?: string | null; isEquipped?: boolean }
  | { kind: 'legacy'; item: Item };

interface Props {
  target: ItemDetailsTarget | null;
  onClose: () => void;
}

const BONUS_LABELS: Record<string, string> = {
  ca: 'Defesa (CA)',
  hp: 'Vida Máxima',
  pe: 'Energia Máxima',
  rd: 'Redução de Dano',
  esc: 'Esquiva',
  slots: 'Slots de Inventário',
};

function findActionLabel(actionId?: string): string | null {
  if (!actionId) return null;
  const meta = Object.values(SYSTEM_ACTIONS).find((a) => a.id === actionId);
  return meta?.label ?? null;
}
function findRangeLabel(id?: string): string | null {
  if (!id) return null;
  const m = Object.values(RANGE_TYPES).find((r) => r.id === id);
  return m?.label ?? null;
}
function findAoeLabel(id?: string): string | null {
  if (!id) return null;
  const m = Object.values(AOE_SHAPES).find((a) => a.id === id);
  return m?.label ?? null;
}

export function ItemDetailsDialog({ target, onClose }: Props) {
  const open = target !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        {target?.kind === 'omni' && <OmniDetails target={target} />}
        {target?.kind === 'legacy' && <LegacyDetails item={target.item} />}
      </DialogContent>
    </Dialog>
  );
}

function OmniDetails({
  target,
}: {
  target: Extract<ItemDetailsTarget, { kind: 'omni' }>;
}) {
  const e = target.entity;
  const cd = normalizarCombatData(e.combatData);
  const slotType = e.slotType ?? 'nenhum';
  const isEquippable = slotType !== 'nenhum';
  const bonus = e.bonusEquipado ?? {};
  const bonusF = e.bonusEquipadoFormula ?? {};
  const bonusEntries = (['ca','hp','pe','rd','esc','slots'] as const)
    .map((k) => ({ k, v: bonus[k] ?? 0, f: bonusF[k] }))
    .filter(({ v, f }) => v !== 0 || (f && f.trim() !== ''));
  const rollBonusEntries = [
    ...Object.entries(bonus.pericias ?? {}).map(([k, v]) => ({ k: `Perícia ${k.replace(/_/g, ' ')}`, v })),
    ...Object.entries(bonus.trs ?? {}).map(([k, v]) => ({ k: `TR ${k}`, v })),
    ...(bonus.deslocamento ? [{ k: 'Deslocamento (m)', v: bonus.deslocamento }] : []),
  ].filter(({ v }) => v !== 0);
  const mitigationEntries = [
    ...(e.resistencias ?? []).map((t) => ({ label: `Resistência — ${DAMAGE_TYPE_LABELS[t]}`, value: 'metade' })),
    ...(e.vulnerabilidades ?? []).map((t) => ({ label: `Vulnerabilidade — ${DAMAGE_TYPE_LABELS[t]}`, value: '×1,5' })),
    ...(e.imunidades_dano ?? []).map((t) => ({ label: `Imunidade — ${DAMAGE_TYPE_LABELS[t]}`, value: 'anula' })),
  ];

  const isActive = cd?.isActive === true;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-violet-400" />
          {e.nome || 'Item sem nome'}
        </DialogTitle>
        <DialogDescription className="flex flex-wrap gap-1.5 mt-1">
          {isEquippable && (
            <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-xs text-primary inline-flex items-center gap-1">
              <Gem className="h-3 w-3" /> {ITEM_SLOT_LABELS[slotType]}
            </span>
          )}
          {target.isEquipped && target.equippedSlot && (
            <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300">
              Equipado em {target.equippedSlot}
            </span>
          )}
          {!isActive && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
              Passivo
            </span>
          )}
          {isActive && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
              Ativo (Uso)
            </span>
          )}
          {e.duracao?.tipo && (
            <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {e.duracao.tipo}
            </span>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 text-sm">
        {e.descricao && (
          <p className="text-muted-foreground italic break-words whitespace-pre-wrap">
            {e.descricao.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\n)\*(.+?)\*(?=\n|$)/g, '$1$2')}
          </p>
        )}

        {(bonusEntries.length > 0 || rollBonusEntries.length > 0 || mitigationEntries.length > 0) && (
          <section className="rounded-md border border-violet-500/30 bg-violet-500/5 p-2 space-y-1">
            <div className="text-xs uppercase tracking-wider text-violet-300/80">
              Bônus Passivos (quando equipado)
            </div>
            <ul className="space-y-0.5">
              {bonusEntries.map(({ k, v, f }) => (
                <li key={k} className="text-[12px] flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{BONUS_LABELS[k] ?? k}</span>
                  <span className="font-mono text-foreground">
                    {v !== 0 && <span className="text-primary">{v >= 0 ? '+' : ''}{v}</span>}
                    {f && (
                      <span className="text-sky-300 ml-1" title="Fórmula avaliada da ficha">
                        {v !== 0 ? ' + ' : ''}ƒ({f})
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {rollBonusEntries.map(({ k, v }) => <li key={k} className="text-[12px] flex items-baseline justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-mono text-primary">{v > 0 ? '+' : ''}{v}</span></li>)}
              {mitigationEntries.map(({ label, value }) => <li key={label} className="text-[12px] flex items-baseline justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="font-mono text-primary">{value}</span></li>)}
            </ul>
          </section>
        )}

        {cd && cd.effects.length > 0 && (
          <OmniItemDescription effects={cd.effects} variante="bloco" />
        )}

        {isActive && cd && (
          <section className="rounded-md border border-border/60 bg-background/40 p-2 space-y-1">
            <div className="text-xs uppercase tracking-wider text-amber-300/80">
              Dados de Combate
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              {findActionLabel(cd.actionCost) && (
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span className="text-muted-foreground">Custo:</span>{' '}
                  <span className="text-foreground">{findActionLabel(cd.actionCost)}</span>
                </div>
              )}
              {findRangeLabel(cd.rangeType) && (
                <div className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-sky-400" />
                  <span className="text-muted-foreground">Alcance:</span>{' '}
                  <span className="text-foreground">{findRangeLabel(cd.rangeType)}</span>
                </div>
              )}
              {findAoeLabel(cd.aoeShape) && (
                <div>
                  <span className="text-muted-foreground">Área:</span>{' '}
                  <span className="text-foreground">{findAoeLabel(cd.aoeShape)}{cd.aoeSize ? ` · ${cd.aoeSize}m` : ''}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Crítico:</span>{' '}
                <span className="text-foreground">≥ {cd.critRange} · ×{cd.critMultiplier}</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function LegacyDetails({ item }: { item: Item }) {
  const slotType = item.slotType ?? 'nenhum';
  const isEquippable = slotType !== 'nenhum';
  const bonusList: Array<{ label: string; value: number; cls?: string }> = [
    { label: 'CA',  value: item.bonusCA ?? 0, cls: 'text-primary' },
    { label: 'HP',  value: item.bonusHP ?? 0, cls: 'text-hp' },
    { label: 'PE',  value: item.bonusPE ?? 0, cls: 'text-pe' },
    { label: 'RD',  value: item.bonusRD ?? 0 },
  ].filter((b) => b.value !== 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-foreground">
          <Sword className="h-4 w-4 text-primary" />
          {item.name || 'Item sem nome'}
        </DialogTitle>
        <DialogDescription className="flex flex-wrap gap-1.5 mt-1">
          {isEquippable && (
            <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-xs text-primary inline-flex items-center gap-1">
              <Gem className="h-3 w-3" /> {ITEM_SLOT_LABELS[slotType]}
            </span>
          )}
          <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-xs text-muted-foreground">
            {item.slots} slot{item.slots === 1 ? '' : 's'} · x{item.quantity || 1}
          </span>
          {item.isFood && (
            <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-2 py-0.5 text-xs text-neon-yellow">
              🍽️ Comida
            </span>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 text-sm">
        {item.description && (
          <p className="text-muted-foreground italic break-words">{item.description}</p>
        )}

        {bonusList.length > 0 && (
          <section className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1">
            <div className="text-xs uppercase tracking-wider text-primary/80">
              Bônus do Item
            </div>
            <div className="flex flex-wrap gap-2">
              {bonusList.map((b) => (
                <span key={b.label} className={`text-[12px] font-mono ${b.cls ?? 'text-foreground'}`}>
                  {b.label}{b.value >= 0 ? '+' : ''}{b.value}
                </span>
              ))}
            </div>
          </section>
        )}

        {item.isFood && (
          <section className="rounded-md border border-neon-yellow/30 bg-neon-yellow/5 p-2 space-y-1">
            <div className="text-xs uppercase tracking-wider text-neon-yellow">
              Restauração ao Consumir
            </div>
            <div className="flex flex-wrap gap-2 text-[12px]">
              {(item.hungerRestore ?? 0) > 0 && <span className="text-neon-yellow">🍞 Fome +{item.hungerRestore}</span>}
              {(item.hpRestore ?? 0)     > 0 && <span className="text-hp">❤️ HP +{item.hpRestore}</span>}
              {(item.peRestore ?? 0)     > 0 && <span className="text-pe">💠 PE +{item.peRestore}</span>}
              {(item.pvtRestore ?? 0)    > 0 && <span className="text-shield">🛡️ PvT +{item.pvtRestore}</span>}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

