import { Crosshair, Ruler, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { resetarEconomiaManualInvocacao } from '@/lib/controlador/mapa';
import { distanciaCircularMetros } from '@/lib/mapa/alcanceCircular';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';

const ACTION_POOLS = [
  ['acaoComum', 'Ação Comum'],
  ['acaoSimples', 'Ação Simples'],
  ['acaoComplexa', 'Ação Complexa'],
  ['acaoMovimento', 'Movimento'],
  ['acaoBonus', 'Ação Bônus'],
  ['acaoLivre', 'Ação Livre'],
  ['reacao', 'Reação'],
] as const;

export function ShikigamiOwnerPanel({ tokenId }: { tokenId: string }) {
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const token = useMapStore((state) => state.entities[tokenId]);
  const entities = useMapStore((state) => state.entities);
  const grid = useMapStore((state) => state.gridConfig);
  const characters = useCharacterStore((state) => state.characters);
  const role = useRoleStore((state) => state.role);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const sourceTokenId = useShikigamiHudStore((state) => state.sourceTokenId);
  const selectedTargetId = useShikigamiHudStore((state) => state.selectedTargetId);
  const rangeMode = useShikigamiHudStore((state) => state.rangeMode);
  const interaction = useShikigamiHudStore((state) => state.interaction);
  const measurementPoint = useShikigamiHudStore((state) => state.measurementPoint);
  const error = useShikigamiHudStore((state) => state.error);
  const setRangeMode = useShikigamiHudStore((state) => state.setRangeMode);
  const startTargetSelection = useShikigamiHudStore((state) => state.startTargetSelection);
  const startMeasurement = useShikigamiHudStore((state) => state.startMeasurement);
  const clearTarget = useShikigamiHudStore((state) => state.clearTarget);

  const owner = characters.find((character) => character.id === token?.ownerCharId);
  const model = owner?.invocacoesConhecidas?.find((invocation) => invocation.id === token?.invocationId);
  const instance = owner?.instanciasInvocacao?.find((item) => item.id === token?.invocationInstanceId);
  const target = selectedTargetId ? entities[selectedTargetId] : undefined;
  const action = rangeMode?.kind === 'action'
    ? model?.acoes.find((item) => item.id === rangeMode.actionId)
    : undefined;
  const rangeMeters = rangeMode?.kind === 'movement'
    ? model?.deslocamentoM
    : action?.alcanceM;
  const measuredPoint = target ? { x: target.x, y: target.y } : measurementPoint;
  const measuredMeters = token && measuredPoint
    ? distanciaCircularMetros(token, measuredPoint, grid)
    : null;

  const resources = useMemo(() => model?.recursosConfigurados ?? [], [model?.recursosConfigurados]);
  const hasManualReset = Boolean(model && (
    Object.values(model.economiaAcoesConfigurada?.resetPorCategoria ?? {}).includes('manual') ||
    model.acoes.some((invocationAction) => invocationAction.recargaConfigurada?.unidade === 'manual') ||
    resources.some((resource) => resource.recargaConfigurada?.unidade === 'manual')
  ));

  if (!token?.invocationId || !owner || !model || sourceTokenId !== token.id) return null;
  if (role === 'PLAYER' && (owner.profileId !== activeProfileId || (token.ownerProfileId && token.ownerProfileId !== activeProfileId))) return null;

  const targetRangeLabel = rangeMeters === undefined
    ? 'Sem alcance definido'
    : measuredMeters === null
      ? `${rangeMeters} m de alcance`
      : `${measuredMeters.toFixed(1)} m${rangeMeters !== undefined ? ` / ${rangeMeters} m` : ''}${rangeMeters !== undefined && measuredMeters > rangeMeters + 0.05 ? ' · fora de alcance' : ''}`;

  return (
    <section className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3" data-testid="shikigami-owner-panel">
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">Shikigami selecionado</div>
          <h3 className="truncate text-sm font-semibold text-foreground">{model.apelido?.trim() || model.nome}</h3>
          <p className="text-xs text-muted-foreground">
            {owner.name} · PV {token.hp ?? instance?.hpAtual ?? model.hpAtual}/{token.hpMax ?? instance?.hpMaximoAtual ?? model.hpMaximo}
            {(instance?.pvTemporarios ?? token.invocationTempHp ?? 0) > 0 && <> · PVT {instance?.pvTemporarios ?? token.invocationTempHp}</>}
            {' · '}Defesa {token.invocationDefense ?? model.defesa}
          </p>
        </div>
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${token.invocationState === 'caida' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
          {token.invocationState === 'caida' ? 'Caído' : 'Ativo'}
        </span>
      </header>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {ACTION_POOLS.map(([key, label]) => {
          const saldo = instance?.economiaAcoes?.[key];
          if (!saldo) return null;
          return (
            <span key={key} className="rounded border border-border/70 bg-background/70 px-1.5 py-1 text-[10px] text-muted-foreground">
              {label} <strong className="text-foreground">{saldo.atual}/{saldo.maximo}</strong>
            </span>
          );
        })}
      </div>

      {resources.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {resources.map((resource) => {
            const current = instance?.recursosAtuais?.[resource.id] ?? resource.valorInicial;
            return (
              <span key={resource.id} className="rounded border border-border/70 bg-background/70 px-1.5 py-1 text-[10px] text-muted-foreground">
                {resource.nome} <strong className="text-foreground">{current}{resource.valorMaximo === undefined ? '' : `/${resource.valorMaximo}`}</strong>
              </span>
            );
          })}
        </div>
      )}

      {hasManualReset && instance?.estado === 'ativa' && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => {
              const resultado = resetarEconomiaManualInvocacao(owner.id, token.id);
              setFeedback({ ok: resultado.ok, message: resultado.ok ? 'Reset manual aplicado à instância.' : resultado.motivo });
            }}
            className="rounded border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-100 hover:bg-violet-500/20"
          >
            Aplicar reset manual
          </button>
          {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={`mt-1 text-xs ${feedback.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{feedback.message}</p>}
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={startTargetSelection}
          aria-pressed={interaction === 'target'}
          className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-xs ${interaction === 'target' ? 'border-violet-400 bg-violet-500/20 text-violet-100' : 'border-border bg-background text-foreground hover:bg-secondary'}`}
        >
          <Crosshair className="h-3.5 w-3.5" /> Alvo
        </button>
        <button
          type="button"
          onClick={startMeasurement}
          aria-pressed={interaction === 'measure'}
          className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-xs ${interaction === 'measure' ? 'border-violet-400 bg-violet-500/20 text-violet-100' : 'border-border bg-background text-foreground hover:bg-secondary'}`}
        >
          <Ruler className="h-3.5 w-3.5" /> Medir
        </button>
        {(target || measurementPoint) && (
          <button type="button" onClick={clearTarget} title="Limpar alvo e medição" className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setRangeMode({ kind: 'movement' })}
          aria-pressed={rangeMode?.kind === 'movement'}
          className={`rounded px-2 py-1 text-[10px] ${rangeMode?.kind === 'movement' ? 'bg-violet-500/20 text-violet-100' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          Movimento · {model.deslocamentoM} m
        </button>
        {model.acoes.map((invocationAction) => (
          <button
            type="button"
            key={invocationAction.id}
            onClick={() => setRangeMode({ kind: 'action', actionId: invocationAction.id })}
            aria-pressed={rangeMode?.kind === 'action' && rangeMode.actionId === invocationAction.id}
            className={`max-w-full truncate rounded px-2 py-1 text-[10px] ${rangeMode?.kind === 'action' && rangeMode.actionId === invocationAction.id ? 'bg-violet-500/20 text-violet-100' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            {invocationAction.nome}{invocationAction.alcanceM === undefined ? '' : ` · ${invocationAction.alcanceM} m`}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {interaction === 'target' ? 'Clique em um token para defini-lo como alvo.'
          : interaction === 'measure' ? 'Clique no mapa para medir a distância.'
            : target ? `Alvo: ${target.label || 'Token'} · ${targetRangeLabel}`
              : measurementPoint ? `Medição: ${measuredMeters?.toFixed(1) ?? '—'} m`
                : `Arraste o token para mover até ${model.deslocamentoM} m por Ação de Movimento.`}
      </p>
      {error && <p role="alert" className="mt-1 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
