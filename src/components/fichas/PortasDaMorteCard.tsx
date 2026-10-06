import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useMapStore } from '@/stores/useMapStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { charsDistanceMeters } from '@/lib/touchRange';
import { rollD20Com } from '@/lib/dice';
import { Button } from '@/components/ui/button';
import {
  FERIMENTOS, aplicarFerimento, cdEstabilizar, curarFerimento, estabilizar, tratarFeridaInterna, naPorta, registrarTesteMorte,
} from '@/lib/portasDaMorte';

// Resolve pedidos de Medicina "estabilizar:<id>" quando o resultado chega (idempotente).
useTestRequestStore.subscribe((s) => {
  for (const r of s.requests) {
    if (!r.result || r.resolutionApplied || !r.sourceTag?.startsWith('estabilizar:')) continue;
    useTestRequestStore.getState().markResolutionApplied(r.id);
    const alvo = r.sourceTag.slice('estabilizar:'.length);
    if (r.dc != null && r.result.total >= r.dc) estabilizar(alvo, `Medicina de ${r.charName}`);
  }
});

export function PortasDaMorteCard({ c }: { c: Character }) {
  const role = useRoleStore((s) => s.role);
  const perfil = useProfileStore((s) => s.activeProfileId);
  const chars = useCharacterStore((s) => s.characters);
  const { inCombat, round, initiativeOrder, currentTurnIndex } = useCombatStore();
  const [rolando, setRolando] = useState(false);
  const [escolha, setEscolha] = useState(1);
  const isMaster = role === 'MASTER';
  const controla = (x: Character) => isMaster || (!!x.profileId && x.profileId === perfil);
  const morrendo = naPorta(c) && !!c.portasMorte;
  const vezDele = inCombat && initiativeOrder[currentTurnIndex]?.charId === c.id;
  const podeRolar = morrendo && controla(c) && vezDele && c.portasMorte?.ultimaRodada !== round;
  const cd = cdEstabilizar(c.hpCurrent ?? 0);

  const ajudantes = useMemo(() => {
    if (!morrendo) return [];
    const { entities, gridConfig } = useMapStore.getState();
    return chars.filter((x) => x.id !== c.id && controla(x) && (x.hpCurrent ?? 0) > 0
      && (!inCombat || (x.actionsCurrent ?? 1) > 0)
      && (charsDistanceMeters(x.id, c.id, entities as never, gridConfig) ?? 99) <= 1.5 + 0.05);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chars, c.id, morrendo, inCombat, isMaster, perfil]);

  if (!morrendo && !c.ferimentoPendente && !(c.ferimentosComplexos?.length) && !(c.falhasMorte ?? 0)) return null;

  const rolar = async () => {
    setRolando(true);
    try { const d = await rollD20Com(c.id, undefined, { label: `Teste de Morte — ${c.name}` }); registrarTesteMorte(c.id, d, round); }
    finally { setRolando(false); }
  };
  const medicina = (h: Character) => {
    if (inCombat) useCharacterStore.getState().updateCharacter(h.id, { actionsCurrent: Math.max(0, (h.actionsCurrent ?? 1) - 1) });
    useTestRequestStore.getState().enqueue({ charId: h.id, charName: h.name, targetProfileId: h.profileId, kind: 'skill', testName: 'Medicina', dc: cd, note: `Estabilizar ${c.name}`, sourceTag: `estabilizar:${c.id}` });
  };

  return (
    <div className="mx-4 mb-2 space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm" data-testid="portas-da-morte">
      {morrendo && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-destructive">🚪 Portas da Morte</b>
            <span className="font-mono">✅ {c.portasMorte!.sucessos}/3 · ❌ {c.portasMorte!.falhas}/3</span>
          </div>
          <p className="text-xs text-muted-foreground">Teste no começo de cada turno: 1 = 2 falhas · 2–9 = 1 falha · 10–19 = 1 sucesso · 20 = 2 sucessos. Dano = +1 falha. Medicina para estabilizar: CD {cd}.</p>
          {podeRolar && <Button size="sm" variant="destructive" disabled={rolando} onClick={() => void rolar()}>Rolar Teste de Morte</Button>}
          {ajudantes.map((h) => (
            <Button key={h.id} size="sm" variant="outline" onClick={() => medicina(h)}>Estabilizar com Medicina ({h.name}, CD {cd})</Button>
          ))}
        </>
      )}
      {!morrendo && (c.falhasMorte ?? 0) > 0 && <p className="text-xs">Falhas de morte acumuladas: <b>{c.falhasMorte}</b> (somem no descanso longo).</p>}
      {!!c.ferimentoPendente && (
        <div className="space-y-1">
          <b>🦴 Ferimento Complexo pendente</b> <span className="text-xs text-muted-foreground">({c.ferimentoPendente} de dano de uma vez)</span>
          {isMaster ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => aplicarFerimento(c.id, 1 + Math.floor(Math.random() * 10))}>Sortear d10</Button>
              <select aria-label="Escolher ferimento" className="rounded border border-border bg-background px-2 py-1 text-sm" value={escolha} onChange={(e) => setEscolha(Number(e.target.value))}>
                {Object.entries(FERIMENTOS).map(([k, f]) => <option key={k} value={k}>{k} — {f.nome}</option>)}
              </select>
              <Button size="sm" onClick={() => aplicarFerimento(c.id, escolha)}>Aplicar escolhido</Button>
              <Button size="sm" variant="ghost" onClick={() => useCharacterStore.getState().updateCharacter(c.id, { ferimentoPendente: undefined })}>Ignorar</Button>
            </div>
          ) : <p className="text-xs text-muted-foreground">Aguardando o Mestre.</p>}
        </div>
      )}
      {(c.ferimentosComplexos ?? []).map((f) => (
        <div key={f.id} className="flex items-start justify-between gap-2 text-xs">
          <span><b>🦴 {f.nome}</b> — {FERIMENTOS[f.resultado]?.efeito}</span>
          {f.resultado === 7 && (f.tratada
            ? <span className="text-xs text-muted-foreground">Tratada (CD 10)</span>
            : chars.filter((h) => h.id !== c.id && controla(h) && (h.skills ?? []).some((sk) => sk.name === 'Medicina' && sk.mastery)).map((h) => (
              <Button key={h.id} size="sm" variant="outline" onClick={() => { const r = tratarFeridaInterna(c.id, h.id); if (!r.ok) toast.error(r.reason); }}>Tratar ({h.name})</Button>
            )))}
          {f.resultado === 7 && c.feridaInternaBloqueada && <span className="text-xs text-destructive">Sem ação e reações neste turno</span>}
          {isMaster && <Button size="sm" variant="ghost" onClick={() => curarFerimento(c.id, f.id)}>Curar</Button>}
        </div>
      ))}
    </div>
  );
}
