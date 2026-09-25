import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
}

export function NullSafeInput({ value, onChange, className, min }: Props) {
  const [display, setDisplay] = useState(String(value));

  useEffect(() => {
    setDisplay(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        setDisplay(raw);
        if (raw === '' || raw === '-') return;
        const num = parseInt(raw, 10);
        if (!isNaN(num)) {
          onChange(min !== undefined ? Math.max(min, num) : num);
        }
      }}
      onBlur={() => {
        if (display === '' || display === '-') {
          onChange(min !== undefined ? Math.max(min, 0) : 0);
          setDisplay('0');
        }
      }}
      className={cn(
        'h-7 rounded border border-input bg-background px-2 text-xs text-foreground text-center font-mono overflow-hidden',
        className
      )}
    />
  );
}
