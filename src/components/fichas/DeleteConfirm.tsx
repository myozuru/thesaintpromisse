import { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { playDeleteSound } from '@/lib/sounds';

interface Props {
  onConfirm: () => void;
  label: string;
}

export function DeleteConfirm({ onConfirm, label }: Props) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const handleClick = () => {
    if (countdown !== null) return;
    setCountdown(5);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setShowConfirm(true);
      setCountdown(null);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [countdown]);

  if (showConfirm) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-destructive">Excluir "{label}"?</span>
        <button onClick={() => { playDeleteSound(); onConfirm(); setShowConfirm(false); }} className="rounded bg-destructive px-2 py-0.5 text-destructive-foreground">Sim</button>
        <button onClick={() => setShowConfirm(false)} className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">Não</button>
      </div>
    );
  }

  return (
    <button onClick={handleClick} className="flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors" title="Excluir">
      <Trash2 className="h-3.5 w-3.5" />
      {countdown !== null && <span className="text-xs text-destructive font-mono">{countdown}s</span>}
    </button>
  );
}
