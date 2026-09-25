import { cn } from '@/lib/utils';

/**
 * Ícone "R" destacado — replica o logo principal (quadrado gradiente místico
 * com a letra R em Cinzel Decorative). Aceita className compatível com os
 * ícones do lucide-react (ex.: "h-3.5 w-3.5") para encaixar nas barras de
 * navegação sem alterar a assinatura dos demais ícones.
 */
export function RIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex items-center justify-center rounded-[3px] gradient-mystic shadow-[0_0_8px_-1px_hsl(var(--primary)/0.7)] shrink-0',
        className,
      )}
    >
      <span
        className="text-primary-foreground font-black leading-none"
        style={{
          fontFamily: "'Cinzel Decorative', serif",
          fontSize: '0.7em',
        }}
      >
        R
      </span>
      <span
        className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-accent/40"
      />
    </span>
  );
}
