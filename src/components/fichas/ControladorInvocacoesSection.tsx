import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { limiteInvocacoesConhecidas, limiteInvocacoesAtivas, validarCatalogoControlador, type InvocacaoControlador, type TipoInvocacaoControlador } from '@/lib/controlador/tipos';

type Fonte = { id: string; nome: string; tipo: 'grimorio' | 'omni'; hp: number; defesa: number; deslocamento: number; porte: InvocacaoControlador['porte']; acoes: InvocacaoControlador['acoes'] };
const numero = (valor: unknown, padrao: number): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
};
function criaturasGrimorio(): Fonte[] {
  try {
    const raw = JSON.parse(localStorage.getItem('fm_creatures_v1') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((c) => c && c.id && c.name).map((c) => ({
      id: String(c.id), nome: String(c.name), tipo: 'grimorio' as const,
      hp: Math.max(1, numero(c.hpMax ?? c.hp ?? c.pvMax ?? c.pv, 10)),
      defesa: Math.max(0, numero(c.defense ?? c.defesa ?? c.ca, 10)),
      deslocamento: Math.max(0, numero(c.speed ?? c.deslocamento ?? c.movement, 9)),
      porte: (['Pequeno', 'Médio', 'Grande'].includes(c.size) ? c.size : 'Médio') as InvocacaoControlador['porte'],
      acoes: Array.isArray(c.actions) ? c.actions.map((a: { id?: string; name?: string; damage?: string }, i: number) => ({
        id: String(a.id || i), nome: String(a.name || 'Ação'), tipo: 'ataque' as const, dano: a.damage ? String(a.damage) : undefined,
      })) : [],
    }));
  } catch { return []; }
}
export function ControladorInvocacoesSection({ character }: { character: Character }) {
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const entidades = useOmniEntidadesStore(s => s.entidades);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoInvocacaoControlador>('shikigami');
  const [hp, setHp] = useState(10);
  const [defesa, setDefesa] = useState(10);
  const [deslocamento, setDeslocamento] = useState(9);
  const [custoPE, setCustoPE] = useState(3);
  const [fonte, setFonte] = useState('');
  const [erro, setErro] = useState('');
  const catalogo = character.invocacoesConhecidas ?? [];
  const max = limiteInvocacoesConhecidas(character.level);
  const ativas = limiteInvocacoesAtivas(character.treinoControle ?? 1);
  const fontes: Fonte[] = [
    ...criaturasGrimorio(),
    ...Object.values(entidades).filter(e => e.categoria !== 'condicao' && e.categoria !== 'voto').map(e => ({
      id: e.id, nome: e.nome, tipo: 'omni' as const,
      hp: 10, defesa: 10, deslocamento: 9, porte: 'Médio' as const,
      acoes: (e.acoesAtivas ?? []).map(a => ({
        id: a.id, nome: a.nome, tipo: 'habilidade' as const, alcanceM: a.alcanceM,
        dano: a.dano, entidadeOmniId: e.id,
      })),
    })),
  ];
  const escolhido = fontes.find(f => `${f.tipo}:${f.id}` === fonte);
  const salvar = () => {
    const novo: InvocacaoControlador = {
      id: crypto.randomUUID(), donoCharacterId: character.id,
      nome: escolhido?.nome ?? nome.trim(), tipo,
      origem: escolhido ? { tipo: escolhido.tipo, entidadeId: escolhido.id } : { tipo: 'manual' },
      hpAtual: escolhido?.hp ?? hp, hpMaximo: escolhido?.hp ?? hp,
      defesa: escolhido?.defesa ?? defesa, deslocamentoM: escolhido?.deslocamento ?? deslocamento,
      porte: escolhido?.porte ?? 'Médio', custoInvocacaoPE: custoPE,
      acoes: escolhido?.acoes ?? [],
    };
    const resultado = validarCatalogoControlador(character.id, character.level, [...catalogo, novo]);
    if (!resultado.ok) { setErro(resultado.motivo); return; }
    updateCharacter(character.id, { invocacoesConhecidas: [...catalogo, novo], limiteInvocacoesConhecidas: max, limiteInvocacoesAtivas: ativas });
    setFonte(''); setNome(''); setErro('');
  };
  const remover = (id: string) => {
    updateCharacter(character.id, { invocacoesConhecidas: catalogo.filter(i => i.id !== id) });
    setErro('');
  };
  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="font-semibold">Invocações conhecidas: {catalogo.length}/{max} · Limite em campo: {ativas}</div>
      {catalogo.map(inv => (
        <div key={inv.id} className="flex items-center justify-between gap-2 rounded border border-border p-2">
          <div><strong>{inv.nome}</strong><div className="text-xs text-muted-foreground">{inv.tipo === 'shikigami' ? 'Shikigami' : 'Corpo Amaldiçoado'} · PV {inv.hpAtual}/{inv.hpMaximo} · Defesa {inv.defesa} · {inv.deslocamentoM} m · {inv.custoInvocacaoPE} PE · {inv.acoes.length} ações</div></div>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => remover(inv.id)}>Remover</button>
        </div>
      ))}
      <div className="space-y-2 rounded border border-border p-2">
        <strong>Adicionar invocação</strong>
        <label className="block text-xs">Importar do Grimório ou OMNI
          <select value={fonte} onChange={e => setFonte(e.target.value)} className="mt-1 w-full rounded border border-input bg-background p-2">
            <option value="">Criar manualmente</option>
            {fontes.map(f => <option key={`${f.tipo}:${f.id}`} value={`${f.tipo}:${f.id}`}>{f.tipo === 'grimorio' ? 'Grimório' : 'OMNI'} — {f.nome}</option>)}
          </select>
        </label>
        <label className="block text-xs">Tipo
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoInvocacaoControlador)} className="mt-1 w-full rounded border border-input bg-background p-2">
            <option value="shikigami">Shikigami</option><option value="corpo_amaldicoado">Corpo Amaldiçoado</option>
          </select>
        </label>
        {!escolhido && <>
          <label className="block text-xs">Nome<input value={nome} onChange={e => setNome(e.target.value)} className="mt-1 w-full rounded border border-input bg-background p-2" /></label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs">PV<input type="number" min="1" value={hp} onChange={e => setHp(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
            <label className="text-xs">Defesa<input type="number" min="0" value={defesa} onChange={e => setDefesa(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
            <label className="text-xs">Deslocamento (m)<input type="number" min="0" value={deslocamento} onChange={e => setDeslocamento(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
          </div>
        </>}
        <label className="block text-xs">Custo de invocação (PE)<input type="number" min="0" value={custoPE} onChange={e => setCustoPE(Number(e.target.value))} className="mt-1 w-full rounded border bg-background p-2" /></label>
        {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
        <button type="button" disabled={catalogo.length >= max} onClick={salvar} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">Adicionar ao catálogo</button>
      </div>
      <p className="text-xs text-muted-foreground">Catálogo preparado para a Fase 3: ainda não cria tokens nem gasta PE.</p>
    </div>
  );
}
