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
        'atlas-module-header card-enigmatic flex flex-wrap items-center gap-3 rounded-2xl border border-border px-4 py-4 sm:px-5',
        className,
      )}
    >
      <div className="atlas-module-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2
            className="text-lg sm:text-xl font-bold tracking-[0.055em] text-foreground"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {title}
          </h2>
          {subtitle && (
            <span className="text-sm text-muted-foreground font-mono tabular-nums">{subtitle}</span>
          )}
        </div>
        {description && (
          <p
            className="mt-1 text-base text-muted-foreground italic leading-snug"
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
