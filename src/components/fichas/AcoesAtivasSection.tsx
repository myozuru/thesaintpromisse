import { planejarCustosAtivos, encerrarSustentacaoAtiva } from '@/lib/omni/custosAtivos';
import { ajustarProtecoesOmni } from '@/lib/omni/protecoesAtivas';
/**
 * Ações ativas OMNI (itens do inventário): escolher alvo e usar.
 * Cada ação vira um card com custo, tipo, teste e alvo próprios.
 */
import { useState } from 'react';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { acoesAtivasDe, armaDaAcao, executarAcaoAtiva } from '@/lib/omni/acaoAtiva';

const ACAO_ROT = { comum: 'Ação Comum', bonus: 'Ação Bônus', reacao: 'Reação', livre: 'Livre' } as const;
const TR_ROT: Record<string, string> = { astucia: 'Astúcia', fortitude: 'Fortitude', integridade: 'Integridade', reflexos: 'Reflexos', vontade: 'Vontade' };
const chip = 'rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap';

export function AcoesAtivasSection({ charId }: { charId: string }) {
  useInventoryStore((s) => s.items);
  const chars = useCharacterStore((s) => s.characters);
  const [alvos, setAlvos] = useState<Record<string, string>>({});
  const [multiplos, setMultiplos] = useState<Record<string, string[]>>({});
  const [intensificacoes, setIntensificacoes] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const u = chars.find((c) => c.id === charId);
  const lista = acoesAtivasDe(charId);
  const sust = u?.omniSustentacoes ?? [];
  const prot = u ? ajustarProtecoesOmni(u) : [];
  if (!u || (lista.length === 0 && !sust.length && !prot.length)) return null;
  const outros = chars.filter((c) => c.id !== charId);

  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-2" data-testid="acoes-ativas-section">
      <div className="text-xs font-bold uppercase tracking-wider text-primary">⚡ Ações Ativas</div>

      {(sust.length > 0 || prot.length > 0) && (
        <div className="space-y-1">
          {sust.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded border border-border bg-background/60 px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate">🔁 <b>{s.nome}</b> · sustentada · {s.pePorTurno} PE/turno</span>
              <button className="shrink-0 rounded border border-destructive/50 px-2 py-0.5 text-destructive hover:bg-destructive/10" aria-label={`Encerrar ${s.nome}`} onClick={() => encerrarSustentacaoAtiva(charId, s.id)}>Encerrar</button>
            </div>
          ))}
          {prot.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded border border-border bg-background/60 px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate">🛡 <b>{p.fonte}</b> · {p.restante} {p.tipo === 'escudo' ? 'escudo' : 'PV temp.'} · {p.rodadas ? `${p.rodadas} rod.` : 'até remover'}</span>
              <button aria-label={`Remover proteção ${p.fonte}`} className="shrink-0 rounded border border-border px-2 py-0.5 hover:bg-muted" onClick={() => {
                const atual = useCharacterStore.getState().characters.find((c) => c.id === charId);
                if (!atual) return;
                const protecoes = ajustarProtecoesOmni(atual), remover = protecoes.find((x) => x.id === p.id);
                useCharacterStore.getState().updateCharacter(charId, { escCurrent: Math.max(0, (atual.escCurrent ?? 0) - (remover?.restante ?? 0)), protecoesOmni: protecoes.filter((x) => x.id !== p.id) });
              }}>Remover</button>
            </div>
          ))}
        </div>
      )}

      {lista.map(({ instanceId, ent, cfg }) => {
        const key = instanceId + cfg.id, intensidade = intensificacoes[key] ?? 0;
        const arma = armaDaAcao(u, ent);
        const custos = planejarCustosAtivos(cfg, u, intensidade, { armaNome: arma?.name, instanciaId: instanceId, entidadeId: ent.id });
        const p = custos.ok ? custos.plano : undefined;
        const proprio = cfg.tipo_alvo === 'proprio';
        const multiplo = cfg.tipo_alvo === 'multiplo';
        const area = cfg.tipo_alvo === 'area';
        const alvoAtual = alvos[key] ?? '';
        const alvoSel = multiplo ? (multiplos[key] ?? []) : alvoAtual;
        const precisaAlvo = !proprio && !area && (multiplo ? (multiplos[key] ?? []).length === 0 : !alvoAtual);
        const teste = cfg.teste === 'tr' ? `TR ${TR_ROT[cfg.tr ?? 'fortitude']}${cfg.cd ? ` CD ${cfg.cd}` : ''}` : cfg.teste === 'ataque' ? 'Ataque' : cfg.teste === 'disputa' ? 'Disputa' : null;
        const cargas = p?.contador ? (u.omniCounters?.[p.contador] ?? 0) : null;
        return (
          <div key={key} className="rounded-md border border-border bg-background/70 p-2 space-y-1.5" data-testid={`acao-ativa-${cfg.nome}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-foreground">{cfg.nome || 'Ação sem nome'}</div>
                <div className="truncate text-[10px] text-muted-foreground">{ent.nome}</div>
              </div>
              <span className={`${chip} border-primary/50 bg-primary/15 text-primary`}>{p ? `${p.pe} PE${p.pv ? ` + ${p.pv} PV` : ''}` : '—'}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className={`${chip} border-border`}>{ACAO_ROT[p?.acao ?? cfg.acao]}</span>
              {teste && <span className={`${chip} border-border`}>🎯 {teste}</span>}
              {cfg.alcanceM > 0 && <span className={`${chip} border-border`}>📏 {String(cfg.alcanceM).replace('.', ',')} m</span>}
              {area && <span className={`${chip} border-border`}>Área: {cfg.area?.forma ?? '?'} {cfg.area?.tamanho_m ?? ''}m</span>}
              {proprio && <span className={`${chip} border-border`}>Em si</span>}
              {cfg.dano && cfg.tipo_efeito !== 'cura' && <span className={`${chip} border-border`}>💥 {cfg.dano}</span>}
              {cfg.tipo_efeito === 'cura' && <span className={`${chip} border-border`}>💚 {cfg.cura ?? '0'} {(cfg.recurso_cura ?? 'pv').toUpperCase()}</span>}
              {p?.contador && <span className={`${chip} border-accent/50`}>{p.contador}: {cargas} (gasta {p.cargas})</span>}
              {p?.municao ? <span className={`${chip} border-border`}>Munição {p.municao}/{p.armaMunicao?.restanteAntes}</span> : null}
              {p?.usosItem ? <span className={`${chip} border-border`}>Usos {useInventoryStore.getState().items[instanceId]?.usosRestantes ?? ent.usos?.total ?? 0}</span> : null}
              {p?.pePorTurno ? <span className={`${chip} border-border`}>+{p.pePorTurno} PE/turno</span> : null}
            </div>
            {!custos.ok && <div className="rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">⚠ {custos.reason}</div>}
            <div className="flex flex-wrap items-center gap-2">
              {!proprio && !area && !multiplo && (
                <select data-testid="acao-ativa-alvo" aria-label={`Alvo de ${cfg.nome}`} value={alvoAtual} onChange={(e) => setAlvos({ ...alvos, [key]: e.target.value })}
                  className="h-8 min-w-0 flex-1 rounded border border-input bg-background px-2 text-xs">
                  <option value="">Escolha o alvo…</option>
                  {outros.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              {multiplo && (
                <select multiple aria-label={`Alvos de ${cfg.nome}`} className="min-w-0 flex-1 rounded border border-input bg-background text-xs" value={multiplos[key] ?? []}
                  onChange={(e) => setMultiplos({ ...multiplos, [key]: Array.from(e.target.selectedOptions, (o) => o.value) })}>
                  {outros.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              {cfg.custo_recursos?.max_intensificacoes ? (
                <label className="flex items-center gap-1 text-xs">Intensificar
                  <input aria-label={`Intensificação de ${cfg.nome}`} className="h-8 w-14 rounded border border-input bg-background px-1" type="number" min={0} max={p?.maxIntensificacoes} value={intensidade} disabled={!!busy}
                    onChange={(e) => setIntensificacoes({ ...intensificacoes, [key]: Number(e.target.value) })} />
                </label>
              ) : null}
              <button
                disabled={!!busy || !custos.ok || precisaAlvo}
                title={precisaAlvo ? 'Escolha um alvo primeiro' : undefined}
                className="ml-auto h-8 shrink-0 rounded bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                onClick={async () => {
                  setBusy(key); setErro({ ...erro, [key]: '' });
                  try {
                    const r = await executarAcaoAtiva(charId, cfg, alvoSel, ent, { intensificacoes: intensidade, instanciaId: instanceId });
                    if (!r.ok) { useLogStore.getState().addLog('combat', `❌ ${cfg.nome}: ${r.reason}`); setErro((e) => ({ ...e, [key]: r.reason ?? 'Falhou' })); }
                  } finally { setBusy(null); }
                }}
              >{busy === key ? 'Usando…' : 'Usar'}</button>
            </div>
            {erro[key] && <div className="text-[11px] text-destructive">❌ {erro[key]}</div>}
          </div>
        );
      })}
    </div>
  );
}
