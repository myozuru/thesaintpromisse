/** Módulo Mundo — por enquanto, a galeria e as fichas de chefes. */
import { BossGallery } from './BossGallery';

export function MundoModule() {
  return (
    <div className="animate-fade-in">
      <BossGallery />
    </div>
  );
}
