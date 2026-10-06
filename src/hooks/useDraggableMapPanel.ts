import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

/** Panel positions are screen-local and never change map entities or camera. */
export function useDraggableMapPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const panel = ref.current;
    const parent = panel?.offsetParent;
    const active = drag.current;
    if (!panel || !(parent instanceof HTMLElement) || !active || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const bounds = parent.getBoundingClientRect();
    setPosition({
      x: Math.max(0, Math.min(parent.clientWidth - panel.offsetWidth, event.clientX - bounds.left - active.offsetX)),
      y: Math.max(0, Math.min(parent.clientHeight - panel.offsetHeight, event.clientY - bounds.top - active.offsetY)),
    });
  };

  const stop = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const style: CSSProperties | undefined = position ? {
    left: position.x, top: position.y, right: 'auto', bottom: 'auto',
    maxWidth: '100%', maxHeight: '100%', overflowY: 'auto',
  } : undefined;

  return {
    ref, style,
    handleProps: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0 || !ref.current) return;
        event.preventDefault();
        event.stopPropagation();
        const bounds = ref.current.getBoundingClientRect();
        drag.current = { pointerId: event.pointerId, offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: move,
      onPointerUp: stop,
      onPointerCancel: stop,
      onLostPointerCapture: () => { drag.current = null; },
    },
  };
}