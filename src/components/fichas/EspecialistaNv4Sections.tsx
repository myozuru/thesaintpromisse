/**
 * Seções do Painel de Ataque para Técnicas de Avanço (Avanço Bumerangue e
 * Sombra Descendente), Buscar Oportunidade e Compensar Erro.
 * Os ataques em si usam `ataque()` do AttackPanel (rolagem real + dano).
 */
import { useState } from 'react';
import type { Character } from '@/types';
import type { Weapon } from '@/lib/weapons';
import type { AttackResult } from '@/lib/combatEngine';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { distanceBetweenChars } from '@/lib/weaponRange';
import { getPreparoAtual, spendPreparo } from '@/lib/artesCombate';
import {
  hasTecnicasAvanco, entDe, escolherPonto, pontoLivre, distPontosM, passoEmDirecao,
  BUMERANGUE_CUSTO, RETORNO_CUSTO, SOMBRA_CUSTO, AVANCO_M, QUEDA_M,
} from '@/lib/tecnicasAvanco';
import {
  hasBuscarOportunidade, buscarOportunidade, escolherAcaoOportunidade, ganhosPendentes,
  inimigosPendentes, inimigosVivos, cdBuscar, type AcaoOportunidade,
} from '@/lib/buscarOportunidade';
import {
  hasCompensarErro, compensarPeMax, podeCompensar, usarCompensarErro, useCompensarErroStore, type CompensarAttr,
} from '@/lib/compensarErro';

const box = 'rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5';
const btn = 'rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200 disabled:opacity-50';
const sel = 'rounded-md border border-border bg-background px-1 py-0.5 text-xs';

type Props = {
  character: Character;
  possibleTargets: Character[];
  mainWeapon: Weapon | null;
  rangedWeapons: Weapon[];
  ataque: (alvo: Character, arma: Weapon) => Promise<AttackResult | null>;
  reachBlock: (alvoId: string, arma: Weapon) => string | null;
};

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

export function EspecialistaNv4Sections(p: Props) {
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === p.character.id)) ?? p.character;
  return (
    <>
      {hasTecnicasAvanco(c) && <TecnicasAvanco {...p} character={c} />}
      {hasBuscarOportunidade(c) && <BuscarOportunidade character={c} />}
      {hasCompensarErro(c) && <CompensarErro character={c} />}
    </>
  );
}

function TecnicasAvanco({ character: c, possibleTargets, mainWeapon, rangedWeapons, ataque, reachBlock }: Props) {
  const log = useLogStore((s) => s.addLog);
  const entities = useMapStore((s) => s.entities);
  const grid = useMapStore((s) => s.gridConfig);
  const [alvoId, setAlvoId] = useState('');
  const [alvo2Id, setAlvo2Id] = useState('');
  const [armaRet, setArmaRet] = useState('');
  const [busy, setBusy] = useState(false);
  const [fase, setFase] = useState<
    | null
    | { k: 'retorno'; alvoId: string; entId: string; x: number; y: number }
    | { k: 'segundo'; alvoId: string }
    | { k: 'queda'; alvo2Id: string }
  >(null);
  const preparo = getPreparoAtual(c);
  const inimigos = possibleTargets.filter((t) => t.category === 'INIMIGO' && (t.hpCurrent ?? 1) > 0);
  const dist = (a: string, b: string) => {
    const A = inimigos.find((x) => x.id === b) ?? possibleTargets.find((x) => x.id === b);
    const me = a === c.id ? c : possibleTargets.find((x) => x.id === a);
    return A && me ? distanceBetweenChars(a, b, entities, grid, { casterProfileId: me.profileId, targetProfileId: A.profileId }) : null;
  };
  const noAlcance = inimigos.filter((t) => { const d = dist(c.id, t.id); return d !== null && d <= AVANCO_M + 0.01; });
  const alvo = inimigos.find((t) => t.id === alvoId) ?? null;
  const armaRetorno = rangedWeapons.find((w) => w.name === armaRet) ?? null;
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); } finally { setBusy(false); } };

  const bumerangue = () => run(async () => {
    if (!alvo || !mainWeapon) return;
    if (preparo < BUMERANGUE_CUSTO) { log('combat', `🚫 Avanço Bumerangue: Preparo insuficiente.`); return; }
    const me = entDe(c);
    if (!me) { log('combat', `⚠️ Avanço Bumerangue: sua peça não está no mapa.`); return; }
    const start = { x: me.x, y: me.y };
    const ponto = await escolherPonto(`Avanço Bumerangue — onde parar (até ${AVANCO_M} m)`, start, AVANCO_M);
    if (!ponto) { log('combat', `↩️ Avanço Bumerangue cancelado.`); return; }
    if (distPontosM(start, ponto) > AVANCO_M + 0.01) { log('combat', `🚫 Avanço Bumerangue: o salto passa de ${AVANCO_M} m.`); return; }
    if (!pontoLivre(ponto, me.id)) { log('combat', `🚫 Avanço Bumerangue: esse espaço está ocupado.`); return; }
    useMapStore.getState().updateEntity(me.id, ponto);
    const bloq = reachBlock(alvo.id, mainWeapon);
    if (bloq) {
      useMapStore.getState().updateEntity(me.id, start);
      log('combat', `🚫 Avanço Bumerangue: desse ponto ${alvo.name} fica fora do alcance (${bloq}). Nada foi gasto.`);
      return;
    }
    spendPreparo(c.id, BUMERANGUE_CUSTO);
    log('combat', `🪃 Avanço Bumerangue: ${c.name} gasta ${BUMERANGUE_CUSTO} Preparo e salta ${fmt(distPontosM(start, ponto))} m até ${alvo.name} (sem ataques de oportunidade).`);
    await ataque(alvo, mainWeapon);
    setFase({ k: 'retorno', alvoId: alvo.id, entId: me.id, x: start.x, y: start.y });
  });

  const retornar = (atacar: boolean) => run(async () => {
    if (fase?.k !== 'retorno') return;
    const a = possibleTargets.find((t) => t.id === fase.alvoId);
    if (atacar && (!armaRetorno || !a)) return;
    if (atacar && getPreparoAtual(c) < RETORNO_CUSTO) { log('combat', `🚫 Retorno: Preparo insuficiente.`); return; }
    useMapStore.getState().updateEntity(fase.entId, { x: fase.x, y: fase.y });
    log('combat', `🪃 ${c.name} retorna ao ponto de partida (sem ataques de oportunidade).`);
    setFase(null);
    if (atacar && armaRetorno && a) {
      spendPreparo(c.id, RETORNO_CUSTO);
      log('combat', `🪃 Retorno: ${c.name} gasta ${RETORNO_CUSTO} Preparo e ataca ${a.name} com ${armaRetorno.name}.`);
      await ataque(a, armaRetorno);
    }
  });

  const sombra = () => run(async () => {
    if (!alvo || !mainWeapon) return;
    const inCombat = useCombatStore.getState().inCombat;
    if (inCombat && (c.actionsCurrent ?? 0) <= 0) { log('combat', `🚫 Sombra Descendente: sem Ação Comum.`); return; }
    if (preparo < SOMBRA_CUSTO) { log('combat', `🚫 Sombra Descendente: Preparo insuficiente.`); return; }
    const me = entDe(c); const te = entDe(alvo);
    if (!me || !te) { log('combat', `⚠️ Sombra Descendente: peças fora do mapa.`); return; }
    const start = { x: me.x, y: me.y };
    if (reachBlock(alvo.id, mainWeapon)) {
      const d = dist(c.id, alvo.id) ?? 0;
      const falta = Math.max(0, d - 1.5 + 0.05);
      useMapStore.getState().updateEntity(me.id, passoEmDirecao(start, te, Math.min(AVANCO_M, falta)));
      const bloq = reachBlock(alvo.id, mainWeapon);
      if (bloq) { useMapStore.getState().updateEntity(me.id, start); log('combat', `🚫 Sombra Descendente: ${alvo.name} continua fora do alcance (${bloq}).`); return; }
    }
    spendPreparo(c.id, SOMBRA_CUSTO);
    const fresh = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
    if (inCombat) useCharacterStore.getState().updateCharacter(c.id, { actionsCurrent: Math.max(0, (fresh.actionsCurrent ?? 0) - 1) });
    log('combat', `🌑 Sombra Descendente: ${c.name} gasta ${SOMBRA_CUSTO} Preparo e a Ação Comum, avança contra ${alvo.name} (sem ataques de oportunidade).`);
    await ataque(alvo, mainWeapon);
    setAlvo2Id('');
    setFase({ k: 'segundo', alvoId: alvo.id });
  });

  const segundos = fase?.k === 'segundo'
    ? inimigos.filter((t) => t.id !== fase.alvoId && (() => { const d = dist(fase.alvoId, t.id); return d !== null && d <= AVANCO_M + 0.01; })())
    : [];

  const atacarSegundo = () => run(async () => {
    if (fase?.k !== 'segundo' || !mainWeapon) return;
    const a2 = segundos.find((t) => t.id === alvo2Id);
    if (!a2) return;
    log('combat', `🌑 Sombra Descendente: ${c.name} se ergue no ar e cai sobre ${a2.name}.`);
    await ataque(a2, mainWeapon);
    setFase({ k: 'queda', alvo2Id: a2.id });
    await cair(a2.id);
  });

  const cair = async (a2Id: string) => {
    const a2 = possibleTargets.find((t) => t.id === a2Id);
    const te = a2 ? entDe(a2) : undefined; const me = entDe(c);
    if (!a2 || !te || !me) { setFase(null); return; }
    const ponto = await escolherPonto(`Sombra Descendente — onde cair (até ${QUEDA_M} m de ${a2.name})`, { x: te.x, y: te.y }, QUEDA_M);
    if (!ponto) { log('combat', `⚠️ Escolha onde cair perto de ${a2.name}.`); return; }
    if (distPontosM(ponto, te) > QUEDA_M + 0.01) { log('combat', `🚫 Queda: precisa ser a até ${QUEDA_M} m de ${a2.name}.`); return; }
    if (!pontoLivre(ponto, me.id)) { log('combat', `🚫 Queda: esse espaço está ocupado.`); return; }
    useMapStore.getState().updateEntity(me.id, ponto);
    log('combat', `🌑 ${c.name} cai a ${fmt(distPontosM(ponto, te))} m de ${a2.name}.`);
    setFase(null);
  };

  return (
    <div className={box} data-testid="tecnicas-avanco">
      <div className="text-xs font-bold uppercase tracking-wider text-amber-300">Técnicas de Avanço · Preparo {preparo}</div>
      {!fase && (
        <>
          <div className="flex flex-wrap items-center gap-1">
            <select aria-label="Alvo da Técnica de Avanço" data-testid="avanco-alvo" value={alvoId} onChange={(e) => setAlvoId(e.target.value)} className={sel}>
              <option value="">— inimigo a até 6 m —</option>
              {noAlcance.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" data-testid="avanco-bumerangue" className={btn} disabled={busy || !alvo || !mainWeapon || preparo < BUMERANGUE_CUSTO} onClick={bumerangue}>
              Avanço Bumerangue (3 PP)
            </button>
            <button type="button" data-testid="sombra-descendente" className={btn} disabled={busy || !alvo || !mainWeapon || preparo < SOMBRA_CUSTO || (useCombatStore.getState().inCombat && (c.actionsCurrent ?? 0) <= 0)} onClick={sombra}>
              Sombra Descendente (3 PP · Ação Comum)
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Bumerangue: clique no mapa onde parar (até 6 m), ataque e volte. Sombra: avança, ataca e pode cair sobre outro inimigo.</p>
        </>
      )}
      {fase?.k === 'retorno' && (
        <div className="flex flex-wrap items-center gap-1" data-testid="bumerangue-retorno">
          <span className="text-xs">Retorno:</span>
          <select aria-label="Arma do retorno" data-testid="retorno-arma" value={armaRet} onChange={(e) => setArmaRet(e.target.value)} className={sel}>
            <option value="">— arma de arremesso/distância —</option>
            {rangedWeapons.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
          </select>
          <button type="button" data-testid="retorno-atacar" className={btn} disabled={busy || !armaRetorno || getPreparoAtual(c) < RETORNO_CUSTO} onClick={() => retornar(true)}>Retornar e atacar (1 PP)</button>
          <button type="button" data-testid="retorno-so" className={btn} disabled={busy} onClick={() => retornar(false)}>Só retornar</button>
        </div>
      )}
      {fase?.k === 'segundo' && (
        <div className="flex flex-wrap items-center gap-1" data-testid="sombra-segundo">
          <select aria-label="Segundo alvo" data-testid="sombra-alvo2" value={alvo2Id} onChange={(e) => setAlvo2Id(e.target.value)} className={sel}>
            <option value="">— outro inimigo a até 6 m —</option>
            {segundos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" data-testid="sombra-atacar2" className={btn} disabled={busy || !alvo2Id} onClick={atacarSegundo}>Cair e atacar</button>
          <button type="button" data-testid="sombra-encerrar" className={btn} disabled={busy} onClick={() => { log('combat', `🌑 ${c.name} encerra a Sombra Descendente ao lado do alvo.`); setFase(null); }}>Encerrar aqui</button>
        </div>
      )}
      {fase?.k === 'queda' && (
        <button type="button" data-testid="sombra-queda" className={btn} disabled={busy} onClick={() => run(() => cair(fase.alvo2Id))}>Escolher onde cair</button>
      )}
    </div>
  );
}

function BuscarOportunidade({ character: c }: { character: Character }) {
  const inCombat = useCombatStore((s) => s.inCombat);
  useCombatStore((s) => s.combatId);
  useCharacterStore((s) => s.characters);
  const [busy, setBusy] = useState(false);
  const ganhos = ganhosPendentes(c);
  const pend = inimigosPendentes(c);
  const log = useLogStore((s) => s.addLog);
  const escolher = (a: AcaoOportunidade) => { const r = escolherAcaoOportunidade(c.id, a); if (!r.ok) log('combat', `🚫 ${r.reason}`); };
  return (
    <div className={box} data-testid="buscar-oportunidade">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold">Buscar Oportunidade</span>
        <button type="button" data-testid="buscar-oportunidade-rolar" className={btn} disabled={busy || !inCombat || !pend.length || ganhos.length > 0}
          onClick={async () => { setBusy(true); try { const r = await buscarOportunidade(c.id); if (!r.ok) log('combat', `🚫 Buscar Oportunidade: ${r.reason}`); } finally { setBusy(false); } }}>
          Testar Percepção (Ação Livre)
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {inCombat ? `CD ${cdBuscar(inimigosVivos().length)} · ${pend.length} inimigo(s) ainda não testado(s) neste combate.` : 'Só em combate.'}
      </p>
      {ganhos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1" data-testid="buscar-oportunidade-escolha">
          <span className="text-xs">Venceu {ganhos.length} — escolha uma:</span>
          <button type="button" className={btn} onClick={() => escolher('andar')}>Andar</button>
          <button type="button" className={btn} onClick={() => escolher('desengajar')}>Desengajar</button>
          <button type="button" className={btn} onClick={() => escolher('esconder')}>Esconder</button>
        </div>
      )}
    </div>
  );
}

function CompensarErro({ character: c }: { character: Character }) {
  const pendente = useCompensarErroStore((s) => (s.pendente?.espId === c.id ? s.pendente : null));
  const round = useCombatStore((s) => s.round);
  const alvoNome = useCharacterStore((s) => s.characters.find((x) => x.id === pendente?.alvoId)?.name);
  const [pe, setPe] = useState(1);
  const [attr, setAttr] = useState<CompensarAttr>('Força');
  const [busy, setBusy] = useState(false);
  const chk = podeCompensar(c, pe, round);
  if (!pendente) return null;
  return (
    <div className={box} data-testid="compensar-erro">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-sm font-semibold">Compensar Erro</span>
        <span className="text-xs text-muted-foreground">vs {alvoNome ?? 'alvo'}</span>
        <select aria-label="PE do Compensar Erro" data-testid="compensar-pe" value={pe} onChange={(e) => setPe(Number(e.target.value))} className={sel}>
          {Array.from({ length: compensarPeMax(c) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} PE · {n}d10</option>)}
        </select>
        <select aria-label="Atributo do Compensar Erro" data-testid="compensar-attr" value={attr} onChange={(e) => setAttr(e.target.value as CompensarAttr)} className={sel}>
          {(['Força', 'Destreza', 'Sabedoria'] as const).map((a) => <option key={a}>{a}</option>)}
        </select>
        <button type="button" data-testid="compensar-usar" className={btn} disabled={busy || !chk.ok}
          onClick={async () => { setBusy(true); try { await usarCompensarErro(c.id, pe, attr, round); } finally { setBusy(false); } }}>
          Causar dano Energético
        </button>
        <button type="button" className="text-muted-foreground text-xs" onClick={() => useCompensarErroStore.getState().set(null)}>✕</button>
      </div>
      {!chk.ok && <p className="text-xs text-muted-foreground">{chk.reason}</p>}
    </div>
  );
}
