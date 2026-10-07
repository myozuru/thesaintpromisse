import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import type { EntidadeOmni } from '@/lib/omni/tipos';

export function OmniItemImagem({ entidade, tamanho = 28 }: { entidade: Pick<EntidadeOmni, 'id' | 'imagem' | 'nome'>; tamanho?: number }) {
  const src = useOmniEntidadesStore(s => s.entidades[entidade.id]?.imagem) ?? entidade.imagem;
  if (!src) return null;
  return <img src={src} alt={entidade.nome} width={tamanho} height={tamanho} className="shrink-0 rounded border border-border object-contain bg-background/60" style={{ width: tamanho, height: tamanho }} />;
}