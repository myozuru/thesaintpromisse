import { act, fireEvent, screen } from '@testing-library/react';
import { clicarAlvoMapa, terminarAlvoMapa, useAlvoMapaStore } from '@/stores/useAlvoMapaStore';
import { useMapStore } from '@/stores/useMapStore';
/** Seleciona pelo mesmo protocolo usado pelo clique no canvas; não rola o ataque. */
export async function selecionarAlvoNoMapaUI(id: string) {
  let erro: string | null = null;
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar alvo no mapa' }));
    if (!useAlvoMapaStore.getState().pending) throw new Error('A mira não abriu.');
    const token = Object.values(useMapStore.getState().entities).find(e => e.characterId === id);
    if (!token) throw new Error(`Token ausente: ${id}`);
    clicarAlvoMapa(token.id);
    if (useAlvoMapaStore.getState().pending) { erro = `Alvo fora do alcance: ${id}`; terminarAlvoMapa(null); }
    await Promise.resolve();
  });
  if (erro) throw new Error(erro);
}
