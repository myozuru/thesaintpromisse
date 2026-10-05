/**
 * ShortcutsHelp — Fase 14.
 *
 * Overlay com lista de atalhos do mapa. Abre/fecha com `?`.
 */
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const GROUPS: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: 'Navegação',
    rows: [
      ['Espaço + arrastar', 'Pan da câmera'],
      ['Scroll', 'Zoom'],
      ['Middle mouse', 'Pan'],
    ],
  },
  {
    title: 'Seleção',
    rows: [
      ['Clique', 'Seleciona token (e seu grupo, se houver)'],
      ['Alt + clique', 'Isola apenas o token clicado (ignora grupo)'],
      ['Shift + clique', 'Adiciona / remove da seleção'],
      ['Arrastar em vazio', 'Marquee de seleção'],
      ['Ctrl/Cmd + A', 'Selecionar tudo (não-locked)'],
    ],
  },
  {
    title: 'Edição',
    rows: [
      ['Ctrl/Cmd + C / V', 'Copiar / Colar'],
      ['Ctrl/Cmd + D', 'Duplicar seleção'],
      ['Ctrl/Cmd + Z / Y', 'Desfazer / Refazer'],
      ['Ctrl/Cmd + G', 'Agrupar seleção'],
      ['Ctrl + Shift + G', 'Desagrupar'],
      ['Delete', 'Apagar seleção'],
      ['] / [', 'Z-order: frente / atrás'],
      ['Shift + ] / [', 'Frente total / fundo total'],
    ],
  },
  {
    title: 'Movimento',
    rows: [
      ['Setas', 'Nudge 1 célula'],
      ['Shift + Setas', 'Nudge fino (0.1 célula)'],
      ['Alt + Setas', 'Nudge grande (5 células)'],
      ['Ctrl/Cmd (segurar)', 'Bypass do snap'],
    ],
  },
  {
    title: 'Ferramentas e Painéis',
    rows: [
      ['L', 'Painel de camadas'],
      ['I', 'Tracker de iniciativa'],
      ['D', 'Painel de dados'],
      ['?', 'Esta janela'],
      ['Shift + soltar régua', 'Pinar régua persistente'],
    ],
  },
];

export function ShortcutsHelp({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-w-[92vw] max-h-[80vh] overflow-y-auto rounded-lg border shadow-2xl"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
      >
        <div
          className="flex items-center h-10 px-3 border-b sticky top-0"
          style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}
        >
          <div className="text-sm font-semibold">Atalhos do mapa</div>
          <button
            onClick={onClose}
            className="ml-auto h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4 text-xs">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-xs uppercase tracking-wider text-amber-300/80 mb-2">
                {g.title}
              </div>
              <div className="flex flex-col gap-1">
                {g.rows.map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <kbd
                      className="shrink-0 px-1.5 py-0.5 rounded border text-xs font-mono text-foreground"
                      style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                    >
                      {k}
                    </kbd>
                    <div className="text-muted-foreground">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
