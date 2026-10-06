/**
 * Seções do Painel de Ataque para Preparo Imediato, Recarga Rápida e Uso Rápido
 * (habilidades de 4º nível do Especialista em Combate).
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useItemStore } from '@/stores/useItemStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import {
  hasPreparoImediato, temPreparada, dispararPreparada, rotuloDe,
} from '@/lib/preparoImediato';
import {
  hasRecargaRapida, capacidadeDaReferencia, tirosRestantes, custoRecarga, recarregar, rotuloCusto,
} from '@/lib/recargaRapida';
import {
  hasUsoRapido, isConsumivel, podeUsarItemAdicional, pagarItemAdicional,
} from '@/lib/usoRapido';

const box = 'rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5';
const btn = 'rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200 disabled:opacity-50';
const sel = 'rounded-md border border-border bg-background px-1 py-0.5 text-xs';

export function EspecialistaNv4CSections({ character }: { character: Character }) {
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === character.id)) ?? character;
  return (
    <>
      {hasPreparoImediato(c) && temPreparada(c) && <PreparoImediatoSection character={c} />}
      <RecargaSection character={c} />
      {hasUsoRapido(c) && <UsoRapidoSection character={c} />}
    </>
  );
}

function PreparoImediatoSection({ character: c }: { character: Character }) {
  const order = useCombatStore((s) => s.initiativeOrder);
  const idx = useCombatStore((s) => s.currentTurnIndex);
  const [msg, setMsg] = useState<string | null>(null);
  const meuTurno = order[idx]?.charId === c.id;
  const prep = c.prontidaoPreparada!;
  return (
    <div className={box} data-testid="preparo-imediato-section">
      <div className="text-xs font-bold text-amber-300">⏱️ Preparo Imediato</div>
      <div className="text-xs text-muted-foreground">
        {rotuloDe(prep.tipo)} preparada ({prep.custo} Preparo).{' '}
        {meuTurno ? 'No seu turno, disparar não gasta a Reação.' : 'Disparar agora gasta a sua Reação.'}
      </div>
      <button
        className={btn}
        data-testid="preparo-imediato-disparar"
        onClick={() => {
          const r = dispararPreparada(c.id, { meuTurno });
          setMsg(r.ok ? `Ação preparada liberada (${rotuloDe(prep.tipo)}).` : r.reason ?? 'Não foi possível.');
        }}
      >
        Disparar ação preparada
      </button>
      {msg && <div className="text-xs text-amber-200">{msg}</div>}
    </div>
  );
}

/** Munição e recarga — aparece para qualquer arma com Recarga [X] empunhada. */
function RecargaSection({ character: c }: { character: Character }) {
  const [msg, setMsg] = useState<string | null>(null);
  const armas = [
    { nome: c.mainHandWeaponName, id: c.mainHandWeaponInstanceId ?? undefined },
    { nome: c.offHandWeaponName, id: c.offHandWeaponInstanceId ?? undefined },
  ].filter((a, index, all): a is { nome: string; id: string | undefined } => !!a.nome &&
    (index === 0 || a.id !== all[0].id || a.nome !== all[0].nome) && capacidadeDaReferencia(c, a.nome, a.id) !== null);
  if (armas.length === 0) return null;
  return (
    <div className={box} data-testid="recarga-section">
      <div className="text-xs font-bold text-amber-300">
        🔃 Munição {hasRecargaRapida(c) && <span className="text-xs">(Recarga Rápida)</span>}
      </div>
      {armas.map(({ nome, id }) => {
        const cap = capacidadeDaReferencia(c, nome, id)!;
        const rest = tirosRestantes(c, nome, id) ?? cap;
        const custo = custoRecarga(c, nome, id);
        const key = id ?? nome;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span data-testid={`ammo-${key}`}>
              {nome}: {rest}/{cap} tiros
            </span>
            <button
              className={btn}
              data-testid={`recarregar-${key}`}
              disabled={rest >= cap}
              onClick={() => {
                const r = recarregar(c.id, nome, id);
                setMsg(r.ok ? `${nome} recarregada (${rotuloCusto(custo)}).` : r.reason ?? 'Não foi possível.');
              }}
            >
              Recarregar ({rotuloCusto(custo)})
            </button>
          </div>
        );
      })}
      {msg && <div className="text-xs text-amber-200">{msg}</div>}
    </div>
  );
}

function UsoRapidoSection({ character: c }: { character: Character }) {
  const items = useItemStore((s) => s.items);
  const log = useLogStore((s) => s.addLog);
  const [itemId, setItemId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const consumiveis = items.filter(
    (i) => (i.assignedTo ?? []).includes(c.id) && (i.quantity ?? 0) > 0 && isConsumivel(i),
  );
  const chk = podeUsarItemAdicional(c);
  return (
    <div className={box} data-testid="uso-rapido-section">
      <div className="text-xs font-bold text-amber-300">⚡ Uso Rápido</div>
      <div className="text-xs text-muted-foreground">
        Depois de usar um item com uma ação, gaste 1 PE para usar um item adicional (1 por turno).
      </div>
      <div className="flex items-center gap-2">
        <select className={sel} data-testid="uso-rapido-item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">Escolha o consumível…</option>
          {consumiveis.map((i) => (
            <option key={i.id} value={i.id}>{i.name} (x{i.quantity})</option>
          ))}
        </select>
        <button
          className={btn}
          data-testid="uso-rapido-usar"
          disabled={!itemId || !chk.ok}
          onClick={() => {
            const item = consumiveis.find((i) => i.id === itemId);
            if (!item) return;
            const pago = pagarItemAdicional(c.id, item.name);
            if (!pago.ok) { setMsg(pago.reason ?? 'Não foi possível.'); return; }
            const usou = useItemStore.getState().spendItem(item.id);
            if (!usou) log('system', `⚠️ ${item.name} não pôde ser consumido.`);
            setMsg(`${item.name} usado sem gastar ação (1 PE).`);
            setItemId('');
          }}
        >
          Usar item adicional (1 PE)
        </button>
      </div>
      {!chk.ok && <div className="text-xs text-muted-foreground">{chk.reason}</div>}
      {msg && <div className="text-xs text-amber-200">{msg}</div>}
    </div>
  );
}
