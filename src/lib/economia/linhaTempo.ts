/** Registra um acontecimento na linha do tempo da campanha e no calendário do mundo. */
import { useQuestStore, type TipoEventoTL } from '@/stores/useQuestStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { toTimelineSeconds } from '@/lib/omni/tempo';

const COR: Record<TipoEventoTL, string> = { quest: '#d4a017', viagem: '#3b82f6', encontro: '#dc2626', manual: '#8b5cf6' };

export function registrarEvento(tipo: TipoEventoTL, titulo: string, descricao = '') {
  const c = useChronosStore.getState();
  const texto = descricao ? `${titulo} — ${descricao}` : titulo;
  useQuestStore.getState().adicionarEvento({ tipo, texto, segundosMundo: toTimelineSeconds(c) });
  useCalendarStore.getState().addEvent({
    id: `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    day: c.day, month: c.month, year: c.year,
    time: `${String(c.hours).padStart(2, '0')}:${String(c.minutes).padStart(2, '0')}`,
    title: titulo, description: descricao, color: COR[tipo],
  });
}
