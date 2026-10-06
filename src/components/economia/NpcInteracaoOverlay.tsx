/**
 * Lojas (NPCs) e murais de quests no mapa: o jogador abre clicando na peça
 * ou pela lista, só a até 1,5 m. O Mestre gerencia quests e processa prazos.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useShopStore } from '@/stores/useShopStore';
import { useQuestStore } from '@/stores/useQuestStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { findMyCharacter } from '@/lib/myCharacter';
import { tokenDaFicha } from '@/stores/useAlvoMapaStore';
import { touchDistanceMeters } from '@/lib/touchRange';
import { processarQuestsMestre } from '@/lib/economia/acoesQuest';
import { ShopModal } from '@/components/omni/ShopModal';
import { MuralQuestsDialog } from './MuralQuests';
import { GerenciadorQuests } from './GerenciadorQuests';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggableMapPanel } from '@/hooks/useDraggableMapPanel';

export const ALCANCE_INTERACAO_M = 1.5;

export function NpcInteracaoOverlay() {
  const entities = useMapStore((s) => s.entities);
  const grid = useMapStore((s) => s.gridConfig);
  const selected = useMapStore((s) => s.selectedIds);
  const chars = useCharacterStore((s) => s.characters);
  const profile = useProfileStore((s) => s.activeProfileId);
  const master = useRoleStore((s) => s.role) === 'MASTER';
  const shopsMap = useShopStore((s) => s.shops);
  const muraisMap = useQuestStore((s) => s.murais);
  const [loja, setLoja] = useState<string | null>(null);
  const [mural, setMural] = useState<{ id: string | null } | null>(null);
  const [gerenciar, setGerenciar] = useState<{ id: string | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(true);
  const panel = useDraggableMapPanel();

  const me = findMyCharacter(chars, profile);
  const token = me ? tokenDaFicha(me) : null;
  const pontos = useMemo(() => [
    ...Object.values(shopsMap).filter((s) => !s.deletedAt && s.npcEntityId && entities[s.npcEntityId]).map((s) => ({ tipo: 'loja' as const, id: s.id, nome: s.name, ent: entities[s.npcEntityId!] })),
    ...Object.values(muraisMap).filter((m) => !m.deletedAt && m.entityId && entities[m.entityId]).map((m) => ({ tipo: 'mural' as const, id: m.id, nome: m.nome, ent: entities[m.entityId!] })),
  ].filter((p) => !p.ent.hidden || master), [shopsMap, muraisMap, entities, master]);

  const distancia = (p: (typeof pontos)[number]) => (token ? touchDistanceMeters(token, p.ent, grid) : null);
  const abrir = (p: (typeof pontos)[number]) => {
    if (!master) {
      if (!me) { setAviso('Você precisa de uma ficha para interagir.'); return; }
      const d = distancia(p);
      if (d == null) { setAviso('Coloque sua ficha no mapa para interagir.'); return; }
      if (d > ALCANCE_INTERACAO_M + 0.05) { setAviso(`Aproxime-se de ${p.nome} (a até 1,5 m).`); return; }
    }
    setAviso(null);
    if (p.tipo === 'loja') { if (me) setLoja(p.id); else setAviso('O Mestre edita lojas pelo Gerenciador de Lojas.'); }
    else setMural({ id: p.id });
  };

  // Clicar na peça do NPC/mural abre a interação.
  useEffect(() => {
    if (selected.length !== 1) return;
    const p = pontos.find((x) => x.ent.id === selected[0]);
    if (p) abrir(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Mestre: expira prazos (tempo do mundo) e aplica revelações de quests aceitas.
  useEffect(() => {
    if (!master) return;
    processarQuestsMestre();
    let last = 0;
    const unsubC = useChronosStore.subscribe(() => { const n = Date.now(); if (n - last > 1000) { last = n; processarQuestsMestre(); } });
    const unsubQ = useQuestStore.subscribe(() => queueMicrotask(() => processarQuestsMestre()));
    return () => { unsubC(); unsubQ(); };
  }, [master]);

  if (!pontos.length && !master) return null;
  return (
    <>
      <div ref={panel.ref} style={panel.style} data-npc-overlay className="absolute top-16 right-3 z-40 w-64 rounded-lg border border-border bg-card/95 p-2 pointer-events-auto text-sm">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-5 shrink-0 touch-none cursor-grab active:cursor-grabbing" aria-label="Mover lojas e murais" title="Arrastar lojas e murais" {...panel.handleProps}><GripVertical /></Button>
          <button type="button" onClick={() => setAberto((v) => !v)} className="font-semibold text-xs">{aberto ? '▾' : '▸'} Lojas e murais</button>
          {master && <button type="button" className="ml-auto rounded border border-primary/50 px-2 py-0.5 text-xs text-primary" onClick={() => setGerenciar({ id: null })}>📜 Quests</button>}
          {master && <button type="button" className="rounded border border-border px-2 py-0.5 text-xs" onClick={() => setMural({ id: null })}>📌 Ver</button>}
        </div>
        {aberto && <>
          {!pontos.length && <p className="mt-1 text-xs text-muted-foreground italic">Vincule lojas a NPCs e crie murais em “📜 Quests”.</p>}
          {pontos.map((p) => {
            const d = distancia(p); const perto = master || (d != null && d <= ALCANCE_INTERACAO_M + 0.05);
            return (
              <div key={`${p.tipo}-${p.id}`} className="mt-1 flex items-center gap-2">
                <span>{p.tipo === 'loja' ? '🛒' : '📌'}</span>
                <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                {!master && d != null && <span className="text-xs text-muted-foreground">{d.toFixed(1)} m</span>}
                <button type="button" onClick={() => abrir(p)} className={`rounded border px-2 py-0.5 text-xs ${perto ? 'border-primary/60 text-primary' : 'border-border text-muted-foreground'}`}>
                  {perto ? 'Abrir' : 'Longe'}
                </button>
              </div>
            );
          })}
          {aviso && <p className="mt-1 text-xs text-destructive" role="alert">{aviso}</p>}
        </>}
      </div>
      {loja && me && <ShopModal aberto onClose={() => setLoja(null)} shopId={loja} characterId={me.id} />}
      {mural && <MuralQuestsDialog aberto onClose={() => setMural(null)} muralId={mural.id} charId={me?.id} master={master} onEditar={(id) => setGerenciar({ id })} />}
      {gerenciar && <GerenciadorQuests aberto onClose={() => setGerenciar(null)} inicialId={gerenciar.id} />}
    </>
  );
}
