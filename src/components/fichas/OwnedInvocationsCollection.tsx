import type { ReactNode } from 'react';

export interface OwnedInvocationsCollectionProps {
  /** Conteúdo e copy do estado vazio, independente do título exibido. */
  variant: 'owned' | 'catalog';
  /** Título da seção */
  title?: string;
  /** Subtítulo ou descrição curta */
  description?: string;
  /** Total de fichas na biblioteca */
  totalCount: number;
  /** Limite de indivíduos-base (null = sem limite/Interlúdio) */
  baseLimit: number | null;
  /** Quantidade de formas derivadas */
  derivedCount: number;
  /** Invocações ativas em campo */
  activeCount: number;
  /** Limite de invocações simultâneas */
  activeLimit: number;
  /** Invocações selecionadas para invocar (máx 2) */
  selectedCount: number;
  /** Aguardando aprovação do Mestre */
  pendingApprovalCount: number;
  /** Estado de erro (validação do pai) — exibido inline, não oculta busca/cards/HUD */
  error?: string | null;
  /** Busca não retornou resultados (controlado pelo pai) */
  zeroResults?: boolean;
  /** Cards das invocações conhecidas (renderizados pelo pai) */
  children: ReactNode;
  /** Callback: invocar selecionadas */
  onInvokeSelected?: () => void;
  /** Callback: direção dos comandos de movimento */
  movementDirection?: 'norte' | 'sul' | 'leste' | 'oeste';
  onMovementDirectionChange?: (direction: 'norte' | 'sul' | 'leste' | 'oeste') => void;
  /** Callback: buscar nas fichas */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** Texto do botão primário (ex: "Criar primeira ficha") — não associado a retry de erro */
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  /** Mensagem de status (sucesso/info) */
  statusMessage?: string;
  /** Classe CSS adicional para o container */
  className?: string;
}

export function OwnedInvocationsCollection({
  variant,
  title = 'Minhas invocações',
  description,
  totalCount,
  baseLimit,
  derivedCount,
  activeCount,
  activeLimit,
  selectedCount,
  pendingApprovalCount,
  error = null,
  zeroResults = false,
  children,
  onInvokeSelected,
  movementDirection = 'leste',
  onMovementDirectionChange,
  searchQuery = '',
  onSearchChange,
  primaryActionLabel,
  onPrimaryAction,
  statusMessage,
  className = '',
}: OwnedInvocationsCollectionProps) {
  const hasInvocations = totalCount > 0;
  const canInvoke = selectedCount >= 1 && selectedCount <= 2;
  const isOwned = variant === 'owned';

  return (
    <div className={`inv-library-panel space-y-3 rounded-lg border border-border p-3 text-sm ${className}`}>
      <div className="inv-toolbar">
        <div>
          <p className="inv-eyebrow">{isOwned ? 'Coleção pessoal' : 'Acervo do personagem'}</p>
          <h2>{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        {primaryActionLabel && onPrimaryAction && (
          <button type="button" className="inv-primary" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs inv-error" aria-live="assertive">
          {error}
        </p>
      )}

      <label className="inv-field">
        {isOwned ? 'Buscar minhas invocações' : 'Buscar fichas salvas'}
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={isOwned ? 'Nome ou apelido' : 'Nome de uma ficha salva'}
          disabled={!hasInvocations}
        />
      </label>

      {!hasInvocations && !searchQuery.trim() && (
        <div className="inv-empty">
          <div className="inv-empty-icon" aria-hidden="true">◇</div>
          <h3>{isOwned ? 'Nenhuma invocação domada ainda' : 'Nenhuma ficha no acervo'}</h3>
          <p>
            {isOwned
              ? 'Rituais pendentes aparecem no Catálogo.'
              : 'Adicione um perfil de referência ou crie uma ficha.'}
          </p>
        </div>
      )}

      {searchQuery.trim() && hasInvocations && (
        <p role="status" className="text-xs text-muted-foreground">
          Filtrando por &ldquo;{searchQuery}&rdquo;…
        </p>
      )}

      <dl className="inv-library-hud" aria-label={`Resumo: ${title}`}>
        <div>
          <dt>Indivíduos / limite</dt>
          <dd>{totalCount - derivedCount} / {baseLimit ?? 'Interlúdio'}</dd>
        </div>
        <div>
          <dt>Formas derivadas</dt>
          <dd>{derivedCount}</dd>
        </div>
        <div>
          <dt>Em campo / limite</dt>
          <dd>{activeCount} / {activeLimit}</dd>
        </div>
        <div>
          <dt>Selecionadas</dt>
          <dd>{selectedCount} / 2</dd>
        </div>
        <div>
          <dt>Aguardando aprovação</dt>
          <dd>{pendingApprovalCount}</dd>
        </div>
      </dl>

      {hasInvocations && (
        <div className="inv-command-bar flex flex-wrap items-end gap-2">
          <label className="block min-w-40 flex-1 text-xs">
            Direção do movimento
            <select
              aria-label="Direção do movimento da invocação"
              value={movementDirection}
              onChange={(e) => onMovementDirectionChange?.(e.target.value as 'norte' | 'sul' | 'leste' | 'oeste')}
              className="mt-1 w-full rounded border border-input bg-background p-2"
            >
              <option value="norte">Norte</option>
              <option value="sul">Sul</option>
              <option value="leste">Leste</option>
              <option value="oeste">Oeste</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded border border-primary px-3 py-2 text-xs disabled:opacity-50"
            disabled={!canInvoke}
            onClick={onInvokeSelected}
          >
            Invocar selecionadas ({selectedCount}/2)
          </button>
        </div>
      )}

      {hasInvocations && (
        <p className="text-xs text-muted-foreground">
          Selecione até duas e posicione no alcance; invocar é Ação Livre e custa PE. Com 0 PV, entram Caídas; descanso longo restaura 100% dos PV.
        </p>
      )}

      {statusMessage && <p role="status" className="text-xs text-muted-foreground">{statusMessage}</p>}

      <div className="inv-catalog-list" role="list" aria-label={title}>
        {children}
      </div>

      {zeroResults && searchQuery.trim() && (
        <p role="status" className="text-xs text-muted-foreground">
          {isOwned
            ? 'Nenhuma invocação corresponde à busca. Tente outro nome.'
            : 'Nenhuma ficha salva corresponde à busca. Tente outro nome.'}
        </p>
      )}
    </div>
  );
}
