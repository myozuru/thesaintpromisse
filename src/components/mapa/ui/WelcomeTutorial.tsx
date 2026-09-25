/**
 * WelcomeTutorial — Fase 15.
 *
 * Overlay de boas-vindas mostrado apenas na primeira visita ao módulo de mapa.
 * Persiste dispensa em localStorage (`mapa.tutorial.seen`).
 */
import { useEffect, useState } from 'react';
import { Sparkles, MousePointer2, Move, Ruler, Eye, Dices, X } from 'lucide-react';

const KEY = 'mapa.tutorial.seen.v1';

interface Props {
  onClose: () => void;
  onOpenShortcuts: () => void;
}

const TIPS: Array<{ icon: React.ComponentType<{ className?: string }>; title: string; body: string }> = [
  { icon: Move, title: 'Navegação', body: 'Segure Espaço (ou botão do meio) para arrastar a câmera. Use scroll para zoom.' },
  { icon: MousePointer2, title: 'Tokens', body: 'Duplo-clique no vazio cria entidade. Clique direito abre menu com presets de luz, iniciativa, agrupar e mais.' },
  { icon: Ruler, title: 'Medição', body: 'Use a régua para medir distâncias. Shift ao soltar pina a régua. Templates servem áreas de efeito.' },
  { icon: Eye, title: 'Luz', body: 'Tokens podem emitir luz (Vela, Tocha, Lanterna) via menu de contexto.' },
  { icon: Dices, title: 'Dados & Iniciativa', body: 'Tecle D para o painel de dados, I para iniciativa. ? abre a lista completa de atalhos.' },
];

export function WelcomeTutorial({ onClose, onOpenShortcuts }: Props) {
  return (
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[92vw] rounded-lg border shadow-2xl overflow-hidden"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
      >
        <div
          className="flex items-center h-10 px-3 border-b"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <Sparkles className="h-4 w-4 text-amber-300 mr-2" />
          <div className="text-sm font-semibold">Bem-vindo ao Mapa</div>
          <button
            onClick={onClose}
            className="ml-auto h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {TIPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <div
                className="h-8 w-8 shrink-0 rounded flex items-center justify-center"
                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
              >
                <Icon className="h-4 w-4 text-amber-300/80" />
              </div>
              <div>
                <div className="text-xs font-semibold">{title}</div>
                <div className="text-xs text-muted-foreground leading-snug">{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="flex items-center gap-2 px-3 h-11 border-t"
          style={{ borderColor: 'hsl(var(--border))', background: '#131417' }}
        >
          <button
            onClick={() => { onClose(); onOpenShortcuts(); }}
            className="h-7 px-3 rounded text-xs text-foreground hover:bg-secondary border"
            style={{ borderColor: 'hsl(var(--border))' }}
          >
            Ver todos os atalhos
          </button>
          <button
            onClick={onClose}
            className="ml-auto h-7 px-3 rounded text-xs font-semibold text-zinc-900"
            style={{ background: '#e6c068' }}
          >
            Começar
          </button>
        </div>
      </div>
    </div>
  );
}

export function useWelcomeTutorial() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch { /* ignore */ }
  }, []);
  const close = () => {
    setOpen(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  };
  const reopen = () => setOpen(true);
  return { open, close, reopen };
}
