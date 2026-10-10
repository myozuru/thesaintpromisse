/** Banner animado que aparece na tela do dono da ficha quando uma conquista é desbloqueada. */
import { useEffect, useRef, useState } from 'react';
import { useConquistaStore, listarConquistas } from '@/stores/useConquistaStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { playSuccessSound } from '@/lib/sounds';
import { RARIDADE_INFO, type ConquistaDef, type Desbloqueio } from '@/lib/conquistas/tipos';

interface Item { def: ConquistaDef; d: Desbloqueio; nome: string }

export function ConquistaBanner() {
  const desbloqueios = useConquistaStore((s) => s.desbloqueios);
  const desde = useRef(Date.now());
  const vistos = useRef(new Set<string>());
  const [fila, setFila] = useState<Item[]>([]);

  useEffect(() => {
    const role = useRoleStore.getState().role;
    const perfil = useProfileStore.getState().activeProfileId;
    const chars = useCharacterStore.getState().characters;
    const defs = listarConquistas(useConquistaStore.getState().defs);
    const novos: Item[] = [];
    for (const [k, d] of Object.entries(desbloqueios)) {
      if (d.deletedAt || d.em < desde.current || vistos.current.has(k)) continue;
      vistos.current.add(k);
      const c = chars.find((x) => x.id === d.charId);
      const def = defs.find((x) => x.id === d.conquistaId);
      if (!c || !def) continue;
      if (role !== 'MASTER' && c.profileId !== perfil) continue;
      novos.push({ def, d, nome: c.name });
    }
    if (novos.length) setFila((f) => [...f, ...novos]);
  }, [desbloqueios]);

  const atual = fila[0];
  useEffect(() => {
    if (!atual) return;
    try { playSuccessSound(); } catch { /* sem áudio */ }
    const ms = { comum: 5000, raro: 6000, epico: 7500, lendario: 9000, impossivel: 11000 }[atual.def.raridade];
    const t = setTimeout(() => setFila((f) => f.slice(1)), ms);
    return () => clearTimeout(t);
  }, [atual]);

  if (!atual) return null;
  const info = RARIDADE_INFO[atual.def.raridade];
  const cor = `hsl(var(--raridade-${atual.def.raridade}))`;
  const premios = atual.def.recompensas.map((r) => {
    switch (r.tipo) {
      case 'dinheiro': return `💰 ${r.valor}`;
      case 'item': return `🎒 item ×${r.quantidade}`;
      case 'titulo': return `👑 ${r.texto}`;
      case 'texto': return `📜 ${r.texto}`;
      case 'recuperar_pe': return `⚡ +${r.valor} PE`;
      case 'recuperar_vida': return `💚 +${r.valor} vida`;
      case 'pvt': return `🛡️ +${r.valor} PVT`;
      case 'reduzir_exaustao': return `✨ −${r.niveis} Exaustão`;
    }
  });
  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[200] flex justify-center px-4">
      <button type="button" onClick={() => setFila((f) => f.slice(1))} data-conquista-banner={atual.def.id}
        className="conquista-banner pointer-events-auto w-full max-w-md rounded-xl border-2 bg-card/95 p-4 text-left text-card-foreground backdrop-blur"
        style={{ ['--rar' as string]: `var(--raridade-${atual.def.raridade})`, borderColor: cor }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: cor }}>{info.cabecalho} · {info.nome}</div>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-4xl">{atual.def.icone}</span>
          <div className="min-w-0">
            <div className="text-lg font-bold leading-tight">{atual.def.titulo}</div>
            <div className="text-xs text-muted-foreground">{atual.nome}{atual.d.relato ? ` — “${atual.d.relato}”` : ''}</div>
          </div>
        </div>
        <p className="mt-2 text-sm italic">{info.mensagem}</p>
        {premios.length > 0 && <p className="mt-2 text-xs"><b>Recompensas:</b> {premios.join(' · ')}</p>}
      </button>
    </div>
  );
}
