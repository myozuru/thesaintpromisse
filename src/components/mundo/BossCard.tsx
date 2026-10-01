/** Cartão compacto de um chefe na galeria do Mapa do Mundo. */
import { motion } from 'framer-motion';
import { Skull, Eye, EyeOff, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOSS_STATE_LABELS, BOSS_TIER_ACCENT, bossHpRatio, canSeeField, type Boss } from '@/lib/bosses';

interface Props {
  boss: Boss;
  isMaster: boolean;
  onOpen: () => void;
  onToggleVisible?: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
}

export function BossCard({ boss, isMaster, onOpen, onToggleVisible, onDuplicate, onRemove }: Props) {
  const hp = bossHpRatio(boss);
  const showHp = canSeeField(boss, 'pv', isMaster);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-card/80 p-4 shadow-lg backdrop-blur transition-colors hover:border-accent/60"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 gradient-mystic mix-blend-soft-light" aria-hidden />

      <div className="relative flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-accent/50 shadow-[0_0_18px_-6px_hsl(var(--primary)/0.9)] transition-transform duration-300 group-hover:scale-105">
          {boss.retrato && canSeeField(boss, 'retrato', isMaster) ? (
            <img src={boss.retrato} alt={boss.nome} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary/60">
              <Skull className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>
            {boss.nome}
          </h3>
          {boss.titulo && <p className="truncate text-[11px] italic text-muted-foreground">{boss.titulo}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px]', BOSS_TIER_ACCENT[boss.patamar])}>
              {canSeeField(boss, 'patamar', isMaster) ? boss.patamar : '???'}
            </span>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              {BOSS_STATE_LABELS[boss.estado]}
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/70">
        <motion.div
          className="h-full rounded-full bg-hp"
          initial={false}
          animate={{ width: `${(showHp ? hp : 1) * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>

      {isMaster && (
        <div className="relative mt-3 flex items-center justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <IconBtn title={boss.visivel ? 'Visível aos jogadores' : 'Oculto'} onClick={onToggleVisible} active={boss.visivel}>
            {boss.visivel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn title="Duplicar" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn title="Excluir" onClick={onRemove} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
        </div>
      )}
    </motion.div>
  );
}

function IconBtn({
  children, onClick, title, active, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={cn(
        'rounded-md p-1 text-muted-foreground transition-all hover:scale-110',
        active && 'text-accent',
        danger ? 'hover:text-destructive' : 'hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
