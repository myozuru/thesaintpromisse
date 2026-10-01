/** Galeria de chefes: lista, busca e abre a ficha. */
import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Skull } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRoleStore } from '@/stores/useRoleStore';
import { useBossStore } from '@/stores/useBossStore';
import { BossCard } from './BossCard';
import { BossSheet } from './BossSheet';

export function BossGallery() {
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const bosses = useBossStore((s) => s.bosses);
  const create = useBossStore((s) => s.create);
  const update = useBossStore((s) => s.update);
  const remove = useBossStore((s) => s.remove);
  const duplicate = useBossStore((s) => s.duplicate);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const all = Object.values(bosses)
      .filter((b) => isMaster || b.visivel)
      .filter((b) => b.nome.toLowerCase().includes(query.trim().toLowerCase()));
    return all.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [bosses, isMaster, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gradient-mystic" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
          <Skull className="h-4 w-4 text-accent" /> Chefes
        </h2>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar chefe…"
            className="h-10 max-w-[260px] text-sm"
        />
        {isMaster && (
          <Button
            size="sm"
            className="h-10 text-sm"
            onClick={() => {
              const boss = create();
              setOpenId(boss.id);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Novo chefe
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isMaster ? 'Nenhum chefe criado ainda.' : 'Nenhum chefe revelado até agora.'}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {list.map((boss) => (
              <BossCard
                key={boss.id}
                boss={boss}
                isMaster={isMaster}
                onOpen={() => setOpenId(boss.id)}
                onToggleVisible={() => update(boss.id, { visivel: !boss.visivel })}
                onDuplicate={() => duplicate(boss.id)}
                onRemove={() => remove(boss.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <BossSheet bossId={openId} isMaster={isMaster} onClose={() => setOpenId(null)} />
    </div>
  );
}
