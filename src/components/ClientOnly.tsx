import { useEffect, useState, type ReactNode } from "react";

/**
 * Renderiza filhos somente no cliente — necessário para módulos que dependem
 * de Web APIs (AudioContext, localStorage via zustand/persist, window) e para
 * evitar mismatches de hidratação SSR no app stateful.
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
