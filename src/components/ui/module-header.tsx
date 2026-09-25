import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface ModuleHeaderProps {
  icon: LucideIcon;
  title: string;
  /** Texto auxiliar à direita do título (ex.: contagem, status). */
  subtitle?: React.ReactNode;
  /** Curta descrição do módulo (1 linha). */
  description?: React.ReactNode;
  /** Ações alinhadas à direita (botões, toggles). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de qualquer módulo. Mantém tipografia Cinzel,
 * ícone em primary com glow sutil, espaçamento consistente.
 */
export function ModuleHeader({
  icon: Icon,
  title,
  subtitle,
  description,
  actions,
  className,
}: ModuleHeaderProps) {
  return (
    <header
      className={cn(
        'card-enigmatic flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3',
        className,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_-3px_hsl(var(--primary)/0.4)]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2
            className="text-base sm:text-lg font-bold tracking-[0.08em] text-foreground glow-text"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {title}
          </h2>
          {subtitle && (
            <span className="text-sm text-muted-foreground font-mono">{subtitle}</span>
          )}
        </div>
        {description && (
          <p
            className="mt-0.5 text-sm text-muted-foreground italic"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
