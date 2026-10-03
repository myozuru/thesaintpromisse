/**
 * Simulador Dinâmico: avalia fórmulas/efeitos contra um personagem hipotético
 * (sliders) ou um personagem real selecionado da lista (modo USUARIO).
 */
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EntidadeOmni, ValorDinamico } from '@/lib/omni/tipos';
import { normalizarCombatData, ehCategoriaSempreAtiva } from '@/lib/omni/tipos';
import { avaliarFormula } from '@/lib/omni/parser';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { SYSTEM_ACTIONS, RANGE_TYPES, AOE_SHAPES } from '@/lib/omni/constantesDoSistema';
import { verboAcao, nomeAmigavelRecurso } from '@/lib/omni/omniScript';

interface Props {
  entidade: EntidadeOmni;
}

function avaliar(v: ValorDinamico | undefined, vars: Record<string, number>): number {
  if (!v) return 0;
  if (v.tipo === 'fixo') return v.valor;
  return avaliarFormula(v.expressao, vars).valor;
}

export function SimuladorPreview({ entidade }: Props) {
  const characters = useCharacterStore((s) => s.characters);
  const [modo, setModo] = useState<'mock' | 'real'>('mock');
  const [charId, setCharId] = useState<string>('');
  const [alvoCharId, setAlvoCharId] = useState<string>('');
  const [nivel, setNivel] = useState(5);
  const [treino, setTreino] = useState(3);
  const [forca, setForca] = useState(4);
  const [intel, setIntel] = useState(3);

  const vars = useMemo<Record<string, number>>(() => {
    if (modo === 'real') {
      const c = characters.find((x) => x.id === charId);
      if (c) return montarVariaveisDoPersonagem(c, 'USUARIO');
    }
    return {
      NIVEL: nivel, TREINO: treino,
      FOR: forca, DES: 3, CON: 3, INT: intel, AST: 3, VON: 3,
      VIDA: 50, VIDA_MAX: 50, PE: 20, PE_MAX: 20,
      DEFESA: 14, DESLOCAMENTO: 9, EXAUSTAO: 0,
    };
  }, [modo, charId, characters, nivel, treino, forca, intel]);

  // Bag de ALVO: real (se selecionado) ou fictício (alvo padrão genérico).
  const alvoVars = useMemo<Record<string, number>>(() => {
    const realAlvo = characters.find((x) => x.id === alvoCharId);
    if (realAlvo) {
      // Reaproveita a projeção; usaremos as mesmas chaves curtas (sem prefixo aqui;
      // o parser as remapeia para ALVO_*).
      return montarVariaveisDoPersonagem(realAlvo, 'USUARIO');
    }
    // Alvo fictício de referência (Nv 5, vida 50).
    return {
      NIVEL: 5, TREINO: 3,
      FOR: 3, DES: 3, CON: 3, INT: 3, AST: 3, VON: 3,
      VIDA: 50, VIDA_MAX: 50, PE: 20, PE_MAX: 20,
      DEFESA: 14, DESLOCAMENTO: 9, EXAUSTAO: 0,
    };
  }, [alvoCharId, characters]);

  // Efeitos divididos em dois scripts (passivo + ativo). Mantemos o `effects`
  // legado como união para back-compat; cá usamos os splits canônicos.
  const cd = useMemo(() => normalizarCombatData(entidade.combatData), [entidade.combatData]);
  const efeitosPassivos = cd?.effectsPassive ?? [];
  const efeitosAtivos = cd?.effectsActive ?? [];
  const efeitos = cd?.effects ?? [];
  const formulasConcatenadas = efeitos.map((e) => e.formula).join(' ');
  const usaAlvo = /@ALVO\./i.test(formulasConcatenadas);
  // Item passivo puro: não tem efeitos ativos. Esconde campos de combate.
  const isPassivo = efeitosAtivos.length === 0;

  const duracaoVal = entidade.duracao.valor ? avaliar(entidade.duracao.valor, vars) : null;
  const custosResolvidos = entidade.custos.map((c) => ({
    caminho: c.caminhoRecurso,
    valor: avaliar(c.valor, vars),
  }));
  const alcance = entidade.alcance ? avaliar(entidade.alcance, vars) : null;
  const areaRaio = entidade.areaRaio ? avaliar(entidade.areaRaio, vars) : null;
  const charSel = characters.find((c) => c.id === charId);
  const alvoSel = characters.find((c) => c.id === alvoCharId);

  // Monte Carlo (200 amostras) por efeito de uma lista qualquer.
  // Cada amostra simula a SEQUÊNCIA inteira para que @RESULTADO_N seja válido.
  function simular(lista: typeof efeitos, varsUsuario: Record<string, number>, varsAlvo: Record<string, number>) {
    if (lista.length === 0) return [] as Array<{ eff: typeof lista[number]; media: number }>;
    const N = 200;
    const somas = lista.map(() => 0);
    for (let i = 0; i < N; i++) {
      const resultados: number[] = [];
      lista.forEach((eff, idx) => {
        const v = avaliarFormula(eff.formula, varsUsuario, undefined, {
          alvo: varsAlvo,
          resultados,
        }).valor;
        resultados.push(v);
        somas[idx] += v;
      });
    }
    return lista.map((eff, idx) => ({ eff, media: Math.round(somas[idx] / N) }));
  }

  // As médias só são recalculadas por uma ação explícita, não durante a edição.
  const [simulacao, setSimulacao] = useState<{
    cd: typeof cd; vars: typeof vars; alvoVars: typeof alvoVars;
    passivos: ReturnType<typeof simular>; ativos: ReturnType<typeof simular>;
    perspectiva: ReturnType<typeof simular> | null;
  }>();
  const atualizada = simulacao?.cd === cd && simulacao?.vars === vars && simulacao?.alvoVars === alvoVars;
  const resumoPassivos = atualizada ? simulacao!.passivos : [];
  const resumoAtivos = atualizada ? simulacao!.ativos : [];
  const resumoAlvoPerspectiva = atualizada ? simulacao!.perspectiva : null;
  const calcularMedias = () => setSimulacao({ cd, vars, alvoVars,
    passivos: simular(efeitosPassivos, vars, alvoVars), ativos: simular(efeitosAtivos, vars, alvoVars),
    perspectiva: usaAlvo && efeitosAtivos.length ? simular(efeitosAtivos, alvoVars, vars) : null,
  });

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold">
          Simulador Dinâmico
        </div>
        <div className="flex gap-1 text-[10px]">
          <button
            onClick={() => setModo('mock')}
            className={`px-2 py-0.5 rounded ${modo === 'mock' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}
          >Mock</button>
          <button
            onClick={() => setModo('real')}
            className={`px-2 py-0.5 rounded ${modo === 'real' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}
          >Personagem Real</button>
        </div>
      </div>

      {modo === 'real' ? (
        <select
          value={charId}
          onChange={(e) => setCharId(e.target.value)}
          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs"
        >
          <option value="">— escolha um personagem —</option>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name} (Nv. {c.level ?? 1})</option>)}
        </select>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Nível</Label>
            <Input type="number" value={nivel} onChange={(e) => setNivel(Number(e.target.value) || 1)} className="h-8" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Treino</Label>
            <Input type="number" value={treino} onChange={(e) => setTreino(Number(e.target.value) || 0)} className="h-8" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Força</Label>
            <Input type="number" value={forca} onChange={(e) => setForca(Number(e.target.value) || 0)} className="h-8" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Inteligência</Label>
            <Input type="number" value={intel} onChange={(e) => setIntel(Number(e.target.value) || 0)} className="h-8" />
          </div>
        </div>
      )}

      {/* Seletor de ALVO (mostrado só quando a fórmula referencia @ALVO) */}
      {usaAlvo && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2 space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-red-400">
            🎯 Alvo da Fórmula
          </Label>
          <select
            value={alvoCharId}
            onChange={(e) => setAlvoCharId(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
          >
            <option value="">— Alvo fictício (Nv 5, Vida 50) —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name} (Nv. {c.level ?? 1})</option>
            ))}
          </select>
        </div>
      )}

      {efeitos.length > 0 && <div className="space-y-1">
        <button type="button" onClick={calcularMedias} className="rounded border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10">
          {atualizada ? 'Recalcular médias' : 'Calcular médias'}
        </button>
        {!atualizada && <p className="text-xs text-muted-foreground">Calcule as médias depois de editar as fórmulas ou os valores da simulação.</p>}
      </div>}

      <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs space-y-1">
        <div className="text-sm font-semibold text-foreground">{entidade.nome || '—'}</div>
        <div className="text-muted-foreground italic text-[11px] whitespace-pre-wrap break-words">
          {entidade.descricao?.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\n)\*(.+?)\*(?=\n|$)/g, '$1$2') || 'Sem descrição'}
        </div>
        <div className="pt-2 grid grid-cols-2 gap-1">
          {ehCategoriaSempreAtiva(entidade.categoria) ? (
            <div><span className="text-muted-foreground">Duração:</span> <span className="text-primary">Sempre ativa</span></div>
          ) : (
            <div><span className="text-muted-foreground">Duração:</span> {entidade.duracao.tipo}{duracaoVal !== null && ` · ${duracaoVal}`}</div>
          )}
          {alcance !== null && <div><span className="text-muted-foreground">Alcance:</span> {alcance}m</div>}
          {areaRaio !== null && <div><span className="text-muted-foreground">Raio:</span> {areaRaio}m</div>}
          <div><span className="text-muted-foreground">Gatilhos:</span> {entidade.gatilhos.length}</div>
        </div>
        {custosResolvidos.length > 0 && (
          <div className="pt-1 text-[11px]">
            <span className="text-muted-foreground">Custos:</span>{' '}
            {custosResolvidos.map((c, i) => (
              <span key={i} className="text-primary">{c.valor} de {c.caminho}{i < custosResolvidos.length - 1 ? ', ' : ''}</span>
            ))}
          </div>
        )}
        {cd && efeitos.length > 0 && (() => {
          const renderLinha = (eff: typeof efeitos[number], media: number, i: number) => {
            const isPositive = eff.type === 'ADICIONAR' || (eff.type === 'MODIFICADOR' && media >= 0);
            const cor = isPositive ? 'text-emerald-400' : 'text-destructive';
            const sinal = eff.type === 'ADICIONAR' ? '+' : eff.type === 'MODIFICADOR' ? (media >= 0 ? '+' : '') : '';
            const verbo = verboAcao(eff.type);
            const recursoNome = nomeAmigavelRecurso(eff.resourcePath);
            const alvo = eff.target === 'USUARIO' ? '👤 Usuário' : eff.target === 'AREA' ? '◯ Área' : '🎯 Alvo';
            return (
              <div key={eff.id} className="pl-2 border-l border-border/40">
                <span className="font-mono text-muted-foreground">#{i + 1}</span>{' '}
                <span className={`${cor} font-semibold`}>{sinal}{media}</span>{' '}
                <span className="text-muted-foreground">({verbo}) → {alvo} ({recursoNome}){eff.damageType ? ` · ${eff.damageType}` : ''}</span>
                {eff.formula && (
                  <div className="text-[10px] text-muted-foreground/70 font-mono pl-3">
                    <span className="text-muted-foreground/50">Cálculo:</span> ({eff.formula}) ={' '}
                    <span className={cor}>{sinal}{media}</span>{' '}
                    <span className="text-muted-foreground/60 not-italic">
                      {eff.type === 'ADICIONAR' ? 'somado em' : eff.type === 'MODIFICADOR' ? 'aplicado em' : 'definido em'} {recursoNome}
                    </span>
                  </div>
                )}
              </div>
            );
          };
          return (
            <div className="pt-1 text-[11px] border-t border-border/40 mt-1 space-y-2">
              {/* === 🛡️ Bloco Passivo === */}
              {efeitosPassivos.length > 0 && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                    🛡️ Efeitos Passivos (Ao Equipar) — {efeitosPassivos.length}
                  </div>
                  <div className="text-emerald-400/80 font-semibold text-[10px]">
                    ▸ Aplicado em {modo === 'real' && charSel ? charSel.name : `mock Nv. ${nivel}`}
                  </div>
                  {resumoPassivos.map(({ eff, media }, i) => renderLinha(eff, media, i))}
                </div>
              )}

              {/* === ⚔️ Bloco Ativo === */}
              {efeitosAtivos.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
                    ⚔️ Ação do Item (Ao Usar/Atacar) — {efeitosAtivos.length}
                  </div>
                  <div className="text-amber-400/80 font-semibold text-[10px]">
                    ▸ Disparado por {modo === 'real' && charSel ? charSel.name : `mock Nv. ${nivel}`}
                  </div>
                  {resumoAtivos.map(({ eff, media }, i) => renderLinha(eff, media, i))}

                  {resumoAlvoPerspectiva && (
                    <div className="space-y-1 pt-1 border-t border-border/30">
                      <div className="text-red-400 font-semibold text-[10px]">
                        ▸ Se o Alvo {alvoSel ? `(${alvoSel.name})` : '(fictício)'} aplicasse
                      </div>
                      {resumoAlvoPerspectiva.map(({ eff, media }, i) => {
                        const isPositive = eff.type === 'ADICIONAR' || (eff.type === 'MODIFICADOR' && media >= 0);
                        const cor = isPositive ? 'text-emerald-400' : 'text-destructive';
                        const sinal = eff.type === 'ADICIONAR' ? '+' : eff.type === 'MODIFICADOR' ? (media >= 0 ? '+' : '') : '';
                        return (
                          <div key={eff.id} className="pl-2 border-l border-border/40">
                            <span className="font-mono text-muted-foreground">#{i + 1}</span>{' '}
                            <span className={`${cor} font-semibold`}>{sinal}{media}</span>{' '}
                            <span className="text-muted-foreground">médio</span>
                          </div>
                        );
                      })}
                      <div className="text-[10px] text-muted-foreground/70 italic">
                        Validação: confirme se "quem aplica em quem" está correto.
                      </div>
                    </div>
                  )}

                  {!isPassivo && (
                    <>
                      <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                        crit ≥ {cd.critRange} ×{cd.critMultiplier}
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 mt-0.5 flex flex-wrap gap-x-2">
                        {cd.actionCost && (
                          <span>⚡ {Object.values(SYSTEM_ACTIONS).find((a) => a.id === cd.actionCost)?.label ?? cd.actionCost}</span>
                        )}
                        {cd.rangeType && (
                          <span>🎯 {RANGE_TYPES.find((r) => r.id === cd.rangeType)?.label ?? cd.rangeType}{cd.rangeType === 'ranged' && cd.aoeSize ? ` ${cd.aoeSize}m` : ''}</span>
                        )}
                        {cd.aoeShape && cd.aoeShape !== 'single' && (
                          <span>◯ {AOE_SHAPES.find((s) => s.id === cd.aoeShape)?.label}{cd.aoeSize ? ` ${cd.aoeSize}m` : ''}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="text-[10px] text-muted-foreground">
        {modo === 'real' && charSel
          ? `Avaliando contra ${charSel.name} (Nv. ${charSel.level ?? 1}).`
          : `Mock: Nv ${nivel}, Treino ${treino}, FOR ${forca}, INT ${intel}.`}
      </div>
    </div>
  );
}

export function textoValor(v: ValorDinamico | undefined): string {
  if (!v) return '—';
  return v.tipo === 'fixo' ? String(v.valor) : v.expressao;
}

