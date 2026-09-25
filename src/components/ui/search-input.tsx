import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  containerClassName?: string;
  /** Mostra botão limpar quando há texto. Padrão: true */
  clearable?: boolean;
}

/**
 * Barra de pesquisa estilizada (tema místico): ícone de lupa, input semi-transparente
 * com glow violeta no foco, e botão limpar opcional.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onValueChange, placeholder = 'Buscar...', className, containerClassName, clearable = true, ...props }, ref) => {
    return (
      <div className={cn('relative group', containerClassName)}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 group-focus-within:text-accent transition-colors"
          aria-hidden
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'h-9 w-full rounded-md border border-border/70 bg-card/60 pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all',
            'hover:border-primary/40',
            'focus-visible:outline-none focus-visible:border-primary/60 focus-visible:bg-card/60 focus-visible:shadow-[0_0_18px_-4px_hsl(var(--primary)/0.45)]',
            className,
          )}
          {...props}
        />
        {clearable && value && (
          <button
            type="button"
            onClick={() => onValueChange('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/70 hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);
SearchInput.displayName = 'SearchInput';
