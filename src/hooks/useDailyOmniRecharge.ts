/**
 * 🌅 Recarga Diária do Omni-Engine.
 *
 * Observa o `useChronosStore` e, sempre que o dia/mês/ano muda, dispara
 * `recargaPorTipo('diaria')` no inventário. Persiste o último (dia,mês,ano)
 * processado em localStorage para evitar recarga dupla por hot-reload.
 */
import { useEffect, useRef } from 'react';
import { useChronosStore } from '@/stores/useChronosStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';

const STORAGE_KEY = 'omni-last-recharged-day';

interface DayKey { y: number; m: number; d: number }

function readLast(): DayKey | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DayKey;
  } catch {
    return null;
  }
}

function writeLast(k: DayKey) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(k)); } catch { /* ignore */ }
}

function sameDay(a: DayKey | null, b: DayKey): boolean {
  return !!a && a.y === b.y && a.m === b.m && a.d === b.d;
}

export function useDailyOmniRecharge() {
  const day = useChronosStore((s) => s.day);
  const month = useChronosStore((s) => s.month);
  const year = useChronosStore((s) => s.year);
  const lastRef = useRef<DayKey | null>(readLast());

  useEffect(() => {
    const atual: DayKey = { y: year, m: month, d: day };
    if (sameDay(lastRef.current, atual)) return;
    // Primeira execução: só registra a baseline, não recarrega.
    if (lastRef.current === null) {
      lastRef.current = atual;
      writeLast(atual);
      return;
    }
    const n = useInventoryStore.getState().recargaPorTipo('diaria');
    if (n > 0) {
      useLogStore.getState().addLog(
        'system',
        `🌅 Novo dia: ${n} item(ns) com recarga diária foram restaurados.`,
      );
    }
    lastRef.current = atual;
    writeLast(atual);
  }, [day, month, year]);
}
