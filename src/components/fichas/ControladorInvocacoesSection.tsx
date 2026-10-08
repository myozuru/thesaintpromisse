import { useEffect, useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useMapStore } from '@/stores/useMapStore';
import { invocarControlador, recolherInvocacao, limparInvocacoesDerrotadas, comandarReposicionamento, comandarAtaque, type DirecaoInvocacao } from '@/lib/controlador/mapa';
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
  const [direcao, setDirecao] = useState<DirecaoInvocacao>('leste');
  const [mensagem, setMensagem] = useState('');
  const [alvosAtaque, setAlvosAtaque] = useState<Record<string, string>>({});
  const [busyAtaque, setBusyAtaque] = useState(false);
  const entities = useMapStore(s => s.entities);
  const ativos = Object.values(entities).filter(e => e.ownerCharId === character.id && !!e.invocationId);
  useEffect(() => { if (ativos.some(e => (e.hp ?? 0) <= 0)) limparInvocacoesDerrotadas(character.id); }, [entities, character.id]);
  const invocar = (id: string) => {
    const resultado = invocarControlador(character.id, id, direcao);
    if (!resultado.ok) { setErro(resultado.motivo); return; }
    setErro(''); setMensagem('Invocação materializada no mapa.');
  };
  const comandar = (id: string) => {
    const r = comandarReposicionamento(character.id, id, direcao);
    if (!r.ok) { setErro(r.motivo); return; }
    setErro(''); setMensagem('Reposicionamento executado com uma Ação Bônus.');
  };
  const atacar = async (invocacaoId: string, acaoId: string) => {
    const alvoId = alvosAtaque[invocacaoId];
    if (!alvoId || busyAtaque) return;
    setBusyAtaque(true); setErro(''); setMensagem('');
    try {
      const r = await comandarAtaque(character.id, invocacaoId, acaoId, alvoId);
      if (!r.ok) { setErro(r.motivo); return; }
      setMensagem(r.acertou ? `Acertou! Dano rolado: ${r.dano}. Ataque: ${r.totalAtaque}.` : `Ataque errou (resultado ${r.totalAtaque}).`);
    } finally { setBusyAtaque(false); }
  };
  const recolher = (id: string) => {
    if (recolherInvocacao(character.id, id)) { setErro(''); setMensagem('Invocação recolhida.'); }
  };
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
      <div className="font-semibold">Invocações conhecidas: {catalogo.length}/{max} · Em campo: {ativos.length}/{ativas}</div>
      <label className="block text-xs">Posicionar na célula adjacente ao Controlador
        <select aria-label="Direção da invocação" value={direcao} onChange={e => setDirecao(e.target.value as DirecaoInvocacao)} className="mt-1 w-full rounded border border-input bg-background p-2">
          <option value="norte">Norte</option><option value="sul">Sul</option><option value="leste">Leste</option><option value="oeste">Oeste</option>
        </select>
      </label>
      {mensagem && <p role="status" className="text-xs text-muted-foreground">{mensagem}</p>}
      {catalogo.map(inv => (
        <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
          <div><strong>{inv.nome}</strong><div className="text-xs text-muted-foreground">{inv.tipo === 'shikigami' ? 'Shikigami' : 'Corpo Amaldiçoado'} · PV {inv.hpAtual}/{inv.hpMaximo} · Defesa {inv.defesa} · {inv.deslocamentoM} m · {inv.custoInvocacaoPE} PE · {inv.acoes.length} ações</div></div>
          <div className="flex shrink-0 flex-wrap gap-1">
            {ativos.some(e => e.invocationId === inv.id) ? (
              <><button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => comandar(inv.id)}>Comandar movimento (bônus)</button><button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => recolher(inv.id)}>Recolher</button></>
            ) : (
              <button type="button" className="rounded border border-primary px-2 py-1 text-xs" onClick={() => invocar(inv.id)}>Invocar</button>
            )}
            <button type="button" disabled={ativos.some(e => e.invocationId === inv.id)} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => remover(inv.id)}>Remover</button>
          </div>
          {ativos.some(e => e.invocationId === inv.id) && inv.acoes.some(a => a.tipo === 'ataque') && (
            <div className="basis-full space-y-2 border-t border-border/60 pt-2">
              <label className="block text-xs">Alvo para ataque
                <select aria-label={`Alvo de ${inv.nome}`} className="mt-1 w-full rounded border border-input bg-background p-2"
                  value={alvosAtaque[inv.id] ?? ''} onChange={e => setAlvosAtaque(v => ({ ...v, [inv.id]: e.target.value }))}>
                  <option value="">Selecione uma ficha no mapa</option>
                  {Object.values(entities).filter(e => e.characterId && e.characterId !== character.id && !e.invocationId).map(e => (
                    <option key={e.id} value={e.characterId}>{e.label || e.characterId}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-1">
                {inv.acoes.filter(a => a.tipo === 'ataque').map(a => (
                  <button key={a.id} type="button" disabled={busyAtaque || !alvosAtaque[inv.id]}
                    onClick={() => void atacar(inv.id, a.id)}
                    className="rounded border border-primary px-2 py-1 text-xs disabled:opacity-50">
                    Comandar ataque: {a.nome} (Ação Comum)
                  </button>
                ))}
              </div>
            </div>
          )}
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
      <p className="text-xs text-muted-foreground">Invocar gasta PE e cria um token no mapa. Reposicionamento comandado custa uma Ação Bônus no turno do Controlador. Ataques comandados gastam uma Ação Comum e utilizam a bandeja 3D, alcance real e defesa do alvo.</p>
    </div>
  );
}
