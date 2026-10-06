import { pedirAlvoMapa } from '@/stores/useAlvoMapaStore';
import { aceitaAlvoAtivo, limiteAlvosAtivos } from '@/lib/omni/alvosAtivos';
import { weaponMaxRangeMeters } from '@/lib/weaponRange';
import { agruparAcoesAtivas } from '@/lib/omni/agruparAcoesAtivas';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
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

const ACAO_ROT = { comum: 'Ação Comum', bonus: 'Ação Bônus', reacao: 'Reação', movimento: 'Ação de Movimento', livre: 'Livre' } as const;
const TR_ROT: Record<string, string> = { astucia: 'Astúcia', fortitude: 'Fortitude', integridade: 'Integridade', reflexos: 'Reflexos', vontade: 'Vontade' };
const chip = 'rounded border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap';

export function AcoesAtivasSection({ charId }: { charId: string }) {
  const inventario = useInventoryStore((s) => s.items);
  useOmniEntidadesStore((s) => s.entidades);
  const [exemplares, setExemplares] = useState<Record<string, string>>({});
  const chars = useCharacterStore((s) => s.characters);
  const [intensificacoes, setIntensificacoes] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<Record<string, string>>({});
  const u = chars.find((c) => c.id === charId);
  const lista = agruparAcoesAtivas(acoesAtivasDe(charId));
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
              <span className="min-w-0 flex-1 truncate"><b>{s.nome}</b> · sustentada · {s.pePorTurno} PE/turno</span>
              <button className="shrink-0 rounded border border-destructive/50 px-2 py-0.5 text-destructive hover:bg-destructive/10" aria-label={`Encerrar ${s.nome}`} onClick={() => encerrarSustentacaoAtiva(charId, s.id)}>Encerrar</button>
            </div>
          ))}
          {prot.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded border border-border bg-background/60 px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate"><b>{p.fonte}</b> · {p.restante} {p.tipo === 'escudo' ? 'escudo' : 'PV temp.'} · {p.rodadas ? `${p.rodadas} rod.` : 'até remover'}</span>
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

      {lista.map(grupo => {
        const selecionado = grupo.exemplares.find(e => e.instanceId === exemplares[grupo.chave])
          ?? grupo.exemplares.find(e => inventario[e.instanceId]?.isEquipped)
          ?? grupo.exemplares[0];
        const { instanceId, ent, cfg } = selecionado;
        const key = instanceId + cfg.id, intensidade = intensificacoes[key] ?? 0;
        const arma = armaDaAcao(u, ent, instanceId);
        const custos = planejarCustosAtivos(cfg, u, intensidade, { armaNome: arma?.name, instanciaId: instanceId, entidadeId: ent.id });
        const p = custos.ok ? custos.plano : undefined;
        const proprio = cfg.tipo_alvo === 'proprio';
        const multiplo = cfg.tipo_alvo === 'multiplo';
        const area = cfg.tipo_alvo === 'area';

        const teste = cfg.teste === 'tr' ? `TR ${TR_ROT[cfg.tr ?? 'fortitude']}${cfg.cd ? ` CD ${cfg.cd}` : ''}` : cfg.teste === 'ataque' ? 'Ataque' : cfg.teste === 'disputa' ? 'Disputa' : null;
        const cargas = p?.contador ? (u.omniCounters?.[p.contador] ?? 0) : null;
        return (
          <div key={grupo.chave} className="rounded-md border border-border bg-background/70 p-2 space-y-1.5" data-testid={`acao-ativa-${cfg.nome}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-foreground">{cfg.nome || 'Ação sem nome'}</div>
                <div className="truncate text-xs text-muted-foreground">{ent.nome}</div>
              </div>
              <span className={`${chip} border-primary/50 bg-primary/15 text-primary`}>{p ? `${p.pe} PE${p.pv ? ` + ${p.pv} PV` : ''}` : `${cfg.custoPE} PE`}</span>
            </div>
            {grupo.exemplares.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Exemplar ({grupo.exemplares.length})</span>
                <select aria-label={`Exemplar para ${cfg.nome}`} value={instanceId} disabled={!!busy}
                  onChange={e => setExemplares(s => ({ ...s, [grupo.chave]: e.target.value }))}
                  className="min-w-0 rounded border border-border bg-background px-2 py-1 text-foreground">
                  {grupo.exemplares.map((e, indice) => {
                    const item = inventario[e.instanceId];
                    return <option key={e.instanceId} value={e.instanceId}>
                      {ent.nome} #{indice + 1}{item?.isEquipped ? ' · equipado' : ''}
                      {item?.usosRestantes !== undefined ? ` · ${item.usosRestantes} usos` : ''}
                    </option>;
                  })}
                </select>
              </label>
            )}
            <div className="flex flex-wrap gap-1">
              <span className={`${chip} border-border`}>{ACAO_ROT[p?.acao ?? cfg.acao]}</span>
              {teste && <span className={`${chip} border-border`}>{teste}</span>}
              {cfg.alcanceM > 0 && <span className={`${chip} border-border`}>{String(cfg.alcanceM).replace('.', ',')} m</span>}
              {area && <span className={`${chip} border-border`}>Área: {cfg.area?.forma ?? '?'} {cfg.area?.tamanho_m ?? ''}m</span>}
              {proprio && <span className={`${chip} border-border`}>Em si</span>}
              {cfg.dano && cfg.tipo_efeito !== 'cura' && <span className={`${chip} border-border`}>Dano {cfg.dano}</span>}
              {cfg.tipo_efeito === 'cura' && <span className={`${chip} border-border`}>Cura {cfg.cura ?? '0'} {(cfg.recurso_cura ?? 'pv').toUpperCase()}</span>}
              {p?.contador && <span className={`${chip} border-accent/50`}>{p.contador}: {cargas} (gasta {p.cargas})</span>}
              {p?.municao ? <span className={`${chip} border-border`}>Munição {p.municao}/{p.armaMunicao?.restanteAntes}</span> : null}
              {p?.usosItem ? <span className={`${chip} border-border`}>Usos {useInventoryStore.getState().items[instanceId]?.usosRestantes ?? ent.usos?.total ?? 0}</span> : null}
              {p?.pePorTurno ? <span className={`${chip} border-border`}>+{p.pePorTurno} PE/turno</span> : null}
            </div>
            {!custos.ok && <div className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">⚠ {custos.reason}</div>}
            <div className="flex flex-wrap items-center gap-2">
              {cfg.custo_recursos?.max_intensificacoes ? (
                <label className="flex items-center gap-1 text-xs">Intensificar
                  <input aria-label={`Intensificação de ${cfg.nome}`} className="h-8 w-14 rounded border border-input bg-background px-1" type="number" min={0} max={p?.maxIntensificacoes} value={intensidade} disabled={!!busy}
                    onChange={(e) => setIntensificacoes({ ...intensificacoes, [key]: Number(e.target.value) })} />
                </label>
              ) : null}
              <button
                disabled={!!busy || !custos.ok}
                title={!proprio && !area ? 'Selecionar alvos no alcance pelo mapa' : undefined}
                className="ml-auto h-8 shrink-0 rounded bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                onClick={async () => {
                  setBusy(key); setErro({ ...erro, [key]: '' }); setResultado(s => { const next = { ...s }; delete next[key]; return next; });
                  try {
                    let alvoSel: string | string[] = '';
                    if (!proprio && !area) {
                      const ids = await pedirAlvoMapa({ usuarioId: charId, label: cfg.nome,
                        maxRangeMeters: cfg.alcanceM > 0 ? cfg.alcanceM : (arma && (ent.categoria === 'arma' || cfg.teste === 'ataque') ? weaponMaxRangeMeters(arma) ?? 0 : 0),
                        medicao: ent.categoria === 'arma' || cfg.teste === 'ataque' ? 'borda' : 'circular',
                        maxAlvos: multiplo ? limiteAlvosAtivos(cfg, u) : 1, aceita: alvo => aceitaAlvoAtivo(u, alvo, cfg) });
                      if (!ids) return;
                      alvoSel = multiplo ? ids : ids[0];
                    }
                    // Revalida a empunhadura após a seleção no mapa.
                    if (ent.categoria === 'arma' && !acoesAtivasDe(charId).some(a => a.instanceId === instanceId && a.cfg.id === cfg.id)) {
                      setErro(e => ({ ...e, [key]: 'A arma não está mais empunhada.' })); return;
                    }
                    const r = await executarAcaoAtiva(charId, cfg, alvoSel, ent, { intensificacoes: intensidade, instanciaId: instanceId });
                    if (!r.ok) { useLogStore.getState().addLog('combat', `❌ ${cfg.nome}: ${r.reason}`); setErro((e) => ({ ...e, [key]: r.reason ?? 'Falhou' })); }
                    else setResultado((s) => ({ ...s, [key]: r.detalhe || 'Ação concluída.' }));
                  } catch (e) { setErro(s => ({ ...s, [key]: e instanceof Error ? e.message : 'Não foi possível selecionar o alvo.' })); } finally { setBusy(null); }
                }}
              >{busy === key ? 'Usando…' : 'Usar'}</button>
            </div>
            {erro[key] && <div className="text-xs text-destructive">❌ {erro[key]}</div>}
            {resultado[key] && <div role="status" aria-label={`Resultado de ${cfg.nome}`} className={`whitespace-pre-wrap rounded border px-2 py-1.5 text-xs leading-relaxed ${resultado[key].includes('→ ERROU') ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-emerald-600/40 bg-emerald-600/10 text-foreground'}`}>{resultado[key]}</div>}
          </div>
        );
      })}
    </div>
  );
}
