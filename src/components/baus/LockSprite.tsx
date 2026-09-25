import { useEffect, useRef, useState } from 'react';
import { LOCK_SPRITE_MAP, KEY_SPRITE_MAP, LOCK_SPRITES, KEY_SPRITES, DEFAULT_LOCK_SPRITE, DEFAULT_KEY_SPRITE } from './lockSprites';

/**
 * Renderiza um cadeado animado. `play` faz a animação rodar do frame 0 → último (abertura).
 * Quando `play=false`, mostra o frame `frame` (default 0 = fechado).
 */
export function LockSprite({
  id,
  play = false,
  frame = 0,
  scale = 1.6,
  fps = 22,
  onDone,
  className,
}: {
  id?: string;
  play?: boolean;
  frame?: number;
  scale?: number;
  fps?: number;
  onDone?: () => void;
  className?: string;
}) {
  const meta = LOCK_SPRITE_MAP[id ?? DEFAULT_LOCK_SPRITE] ?? LOCK_SPRITE_MAP[DEFAULT_LOCK_SPRITE];
  const [f, setF] = useState(frame);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!play) { setF(frame); doneRef.current = false; return; }
    setF(0);
    doneRef.current = false;
    let cur = 0;
    const iv = window.setInterval(() => {
      cur += 1;
      if (cur >= meta.frames - 1) {
        setF(meta.frames - 1);
        window.clearInterval(iv);
        if (!doneRef.current) { doneRef.current = true; onDone?.(); }
        return;
      }
      setF(cur);
    }, Math.max(20, 1000 / fps));
    return () => window.clearInterval(iv);
  }, [play, meta.frames, fps, frame, onDone]);

  const w = meta.frameW * scale;
  const h = meta.frameH * scale;
  return (
    <div
      className={className}
      style={{
        width: w,
        height: h,
        backgroundImage: `url(${meta.sheet})`,
        backgroundSize: `${meta.frameW * meta.frames * scale}px ${h}px`,
        backgroundPosition: `-${f * w}px 0`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  );
}

export function KeySprite({
  id,
  scale = 1.4,
  className,
}: {
  id?: string;
  scale?: number;
  className?: string;
}) {
  const meta = KEY_SPRITE_MAP[id ?? DEFAULT_KEY_SPRITE] ?? KEY_SPRITE_MAP[DEFAULT_KEY_SPRITE];
  return (
    <img
      src={meta.src}
      alt={meta.label}
      className={className}
      style={{
        height: 28 * (scale / 1.4),
        width: 'auto',
        imageRendering: 'pixelated',
      }}
    />
  );
}

/** Picker em grid para escolher um sprite de cadeado. */
export function LockSpritePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-2">
      {LOCK_SPRITES.map((s) => {
        const active = (value ?? DEFAULT_LOCK_SPRITE) === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            title={s.label}
            className={`flex flex-col items-center justify-end gap-1 rounded-md p-1.5 transition-colors ${
              active ? 'bg-amber-500/20 ring-1 ring-amber-400/70' : 'hover:bg-secondary/60'
            }`}
            style={{ minHeight: 64 }}
          >
            <LockSprite id={s.id} scale={1.2} />
          </button>
        );
      })}
    </div>
  );
}

export function KeySpritePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-2">
      {KEY_SPRITES.map((s) => {
        const active = (value ?? DEFAULT_KEY_SPRITE) === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            title={s.label}
            className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
              active ? 'bg-amber-500/20 ring-1 ring-amber-400/70' : 'hover:bg-secondary/60'
            }`}
            style={{ minHeight: 60 }}
          >
            <KeySprite id={s.id} scale={1.1} />
          </button>
        );
      })}
    </div>
  );
}
