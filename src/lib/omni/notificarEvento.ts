import type { GatilhoId } from './constantesDoSistema';
import { capturarCadeiaOmni } from './cadeiaEventos';

/** Mantém a cadeia ao atravessar o import assíncrono do barramento. */
export function notificarEventoPersonagem(evento: GatilhoId, usuarioId: string, origemNome: string, cena?: Record<string, number>) {
  const cadeia = capturarCadeiaOmni();
  void import('./eventBus').then(({ emitirEvento }) => emitirEvento(evento, { cadeia, usuarioId, origemNome, cena }))
    .catch(err => console.warn('[Omni] Falha ao emitir evento:', evento, err));
}

/** Equipar dispara só os gatilhos da nova instância, respeitando seus usos. */
export function notificarEquiparItem(instanciaId: string) {
  const cadeia = capturarCadeiaOmni();
  void Promise.all([import('./eventBus'), import('@/stores/useInventoryStore'), import('@/stores/useOmniEntidadesStore')])
    .then(([bus, inv, catalogo]) => {
      const item = inv.useInventoryStore.getState().items[instanciaId];
      if (!item?.isEquipped) return;
      const ent = catalogo.useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity;
      bus.emitirEventoDaEntidade(ent, 'aoEquipar', { cadeia, usuarioId: item.ownerId, instanciaId });
    }).catch(err => console.warn('[Omni] Falha ao emitir equipar:', err));
}
