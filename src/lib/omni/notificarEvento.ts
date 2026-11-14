import type { GatilhoId } from './constantesDoSistema';
import { capturarCadeiaOmni } from './cadeiaEventos';

const notificacoesPendentes = new Set<Promise<void>>();

function acompanharNotificacao(promise: Promise<unknown>) {
  let pendencia!: Promise<void>;
  pendencia = promise.then(() => undefined, () => undefined).finally(() => {
    notificacoesPendentes.delete(pendencia);
  });
  notificacoesPendentes.add(pendencia);
}

/** Mantém a cadeia ao atravessar o import assíncrono do barramento. */
export function notificarEventoPersonagem(evento: GatilhoId, usuarioId: string, origemNome: string, cena?: Record<string, number>) {
  const cadeia = capturarCadeiaOmni();
  acompanharNotificacao(import('./eventBus').then(({ emitirEvento }) => emitirEvento(evento, { cadeia, usuarioId, origemNome, cena }))
    .catch(err => console.warn('[Omni] Falha ao emitir evento:', evento, err)));
}

/** Equipar dispara só os gatilhos da nova instância, respeitando seus usos. */
export function notificarEquiparItem(instanciaId: string) {
  const cadeia = capturarCadeiaOmni();
  acompanharNotificacao(Promise.all([import('./eventBus'), import('@/stores/useInventoryStore'), import('@/stores/useOmniEntidadesStore')])
    .then(([bus, inv, catalogo]) => {
      const item = inv.useInventoryStore.getState().items[instanciaId];
      if (!item?.isEquipped) return;
      const ent = catalogo.useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity;
      bus.emitirEventoDaEntidade(ent, 'aoEquipar', { cadeia, usuarioId: item.ownerId, instanciaId });
    }).catch(err => console.warn('[Omni] Falha ao emitir equipar:', err)));
}

/** Aguarda notificações e despachos encadeados antes do teardown de testes. */
export async function aguardarEventosOmniPendentes(): Promise<void> {
  do {
    while (notificacoesPendentes.size > 0) {
      await Promise.all([...notificacoesPendentes]);
    }
    const { aguardarDespachosAutonomia } = await import('./eventBus');
    await aguardarDespachosAutonomia();
  } while (notificacoesPendentes.size > 0);
}
