/**
 * 💻 Omni-Syntax Terminal — Modo Avançado.
 *
 * Campo de texto monoespaçado com syntax highlighting violeta para os
 * tokens da OmniScript (somar, subtrair, definir, em, e). Exibe um
 * pré-visualizador da compilação (efeitos detectados) abaixo.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  parseOmniScript,
  tokenizarOmniScript,
  frasePlanoExecucao,
  humanizarWatcher,
  type OmniToken,
} from '@/lib/omni/omniScript';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import {
  extrairPrefixoNoCaret,
  sugerirNoCaret,
  type SugestaoAutocomplete,
} from '@/lib/omni/dicionarioAutocomplete';
import type { Character } from '@/types';

interface Props {
  valor: string;
  onChange: (s: string, compilado?: ReturnType<typeof parseOmniScript>) => void;
  /** Isola a digitação e entrega texto e compilação juntos após uma pausa. */
  adiarEdicao?: boolean;
  onFocus?: () => void;
  ativoParaInsercao?: boolean;
  /** Personagem opcional para preview de valores reais no Plano de Execução. */
  personagemPreview?: Character;
  /**
   * Alvo padrão para recursos sem prefixo (`em vida_max`).
   * Use 'USUARIO' para itens passivos / acessórios. Padrão: 'ALVO'.
   */
  defaultTarget?: 'ALVO' | 'USUARIO' | 'AREA';
}

const COR_TOKEN: Record<OmniToken['tipo'], string> = {
  keyword: 'text-violet-400 font-bold',
  numero: 'text-amber-300',
  identificador: 'text-sky-300',
  operador: 'text-pink-400',
  espaco: '',
};

export function OmniScriptTerminal({ valor, onChange, onFocus, ativoParaInsercao, personagemPreview, defaultTarget, adiarEdicao = false }: Props) {
  const [rascunho, setRascunho] = useState(valor);
  const texto = adiarEdicao ? rascunho : valor;
  const rascunhoRef = useRef(texto);
  const enviadoRef = useRef(valor);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [analise, setAnalise] = useState(() => ({ texto: valor, alvo: defaultTarget,
    compilado: parseOmniScript(valor || '', { defaultTarget }), tokens: tokenizarOmniScript(valor || '') }));
  const analiseRef = useRef(analise);
  const atualizar = (novo: string) => {
    rascunhoRef.current = novo;
    versaoRef.current++;
    if (adiarEdicao) setRascunho(novo);
    else onChangeRef.current(novo);
  };
  const workerRef = useRef<Worker | null>(null);
  const versaoRef = useRef(0);
  const concluirEdicao = useCallback(() => {
    if (!adiarEdicao) return;
    clearTimeout(timerRef.current);
    const novo = rascunhoRef.current;
    let a = analiseRef.current;
    if (a.texto !== novo || a.alvo !== defaultTarget) {
      a = { texto: novo, alvo: defaultTarget, compilado: parseOmniScript(novo || '', { defaultTarget }), tokens: tokenizarOmniScript(novo || '') };
      analiseRef.current = a;
      setAnalise(a);
    }
    if (enviadoRef.current !== novo) {
      enviadoRef.current = novo;
      onChangeRef.current(novo, a.compilado);
    }
  }, [adiarEdicao, defaultTarget]);
  useEffect(() => {
    if (valor !== enviadoRef.current) {
      enviadoRef.current = valor;
      rascunhoRef.current = valor;
      setRascunho(valor);
    }
  }, [valor]);
  useEffect(() => {
    if (!adiarEdicao) return;
    timerRef.current = setTimeout(() => {
      const worker = workerRef.current;
      if (worker) {
        try { worker.postMessage({ id: ++versaoRef.current, texto: rascunhoRef.current, alvo: defaultTarget }); }
        catch { worker.terminate(); workerRef.current = null; concluirEdicao(); }
      } else concluirEdicao();
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [rascunho, concluirEdicao, adiarEdicao]);
  const opcoesRef = useRef({ adiarEdicao, defaultTarget });
  opcoesRef.current = { adiarEdicao, defaultTarget };
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    const novo = rascunhoRef.current;
    if (!opcoesRef.current.adiarEdicao || enviadoRef.current === novo) return;
    const a = analiseRef.current;
    const compilado = a.texto === novo && a.alvo === opcoesRef.current.defaultTarget
      ? a.compilado : parseOmniScript(novo || '', { defaultTarget: opcoesRef.current.defaultTarget });
    enviadoRef.current = novo;
    onChangeRef.current(novo, compilado);
  }, []);
  useEffect(() => {
    if (!adiarEdicao || typeof Worker === 'undefined') return;
    let worker: Worker;
    try { worker = new Worker(new URL('../../lib/omni/editorWorker.ts', import.meta.url), { type: 'module' }); }
    catch { return; }
    workerRef.current = worker;
    worker.onmessage = (evento) => {
      const dados = evento.data;
      if (dados.id !== versaoRef.current) return;
      if (dados.erro) { worker.terminate(); workerRef.current = null; concluirEdicao(); return; }
      if (dados.texto !== rascunhoRef.current || dados.alvo !== defaultTarget) return;
      const a = { texto: dados.texto, alvo: dados.alvo, compilado: dados.compilado, tokens: dados.tokens };
      analiseRef.current = a;
      setAnalise(a);
      if (enviadoRef.current !== a.texto) {
        enviadoRef.current = a.texto;
        onChangeRef.current(a.texto, a.compilado);
      }
    };
    worker.onerror = () => { worker.terminate(); workerRef.current = null; concluirEdicao(); };
    return () => { worker.terminate(); if (workerRef.current === worker) workerRef.current = null; };
  }, [adiarEdicao, defaultTarget, concluirEdicao]);
  const tokens = useMemo(() => adiarEdicao || analise.texto === valor ? analise.tokens : tokenizarOmniScript(valor || ''), [adiarEdicao, analise, valor]);
  const compilado = useMemo(() => adiarEdicao || analise.texto === valor && analise.alvo === defaultTarget ? analise.compilado : parseOmniScript(valor || '', { defaultTarget }), [adiarEdicao, analise, valor, defaultTarget]);
  const pendente = adiarEdicao && texto !== analise.texto;

  const variaveisPreview = useMemo(() => personagemPreview ? montarVariaveisDoPersonagem(personagemPreview, 'USUARIO') : undefined, [personagemPreview]);

  // Calcula valores mock dos efeitos quando há um personagem selecionado.
  const avaliacoesMock = useMemo<(ReturnType<typeof avaliarFormula> | undefined)[]>(() => {
    if (!personagemPreview) return compilado.efeitos.map(() => undefined);
    try {
      const vars = variaveisPreview!;
      return compilado.efeitos.map((eff) => {
        try {
          const r = avaliarFormula(eff.formula || '0', vars, () => 0.5);
          return r;
        } catch {
          return undefined;
        }
      });
    } catch {
      return compilado.efeitos.map(() => undefined);
    }
  }, [compilado.efeitos, variaveisPreview]);
  const valoresMock = useMemo(() => avaliacoesMock.map(r => r && r.diagnosticos.length === 0 ? Math.round(r.valor) : undefined), [avaliacoesMock]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Tab-Completion (estilo Minecraft / IntelliSense) ────────────────────
  const [sugestoes, setSugestoes] = useState<SugestaoAutocomplete[]>([]);
  const [indiceSugestao, setIndiceSugestao] = useState(0);
  const [prefixoAtual, setPrefixoAtual] = useState('');
  // Marca se o usuário está no meio de um ciclo de Tab — nesse caso não
  // recalculamos a lista a cada keydown, para o ciclo permanecer estável.
  const ciclandoRef = useRef(false);

  const recomputarSugestoes = (texto: string, caret: number) => {
    const { prefixo } = extrairPrefixoNoCaret(texto, caret);
    if (prefixo.length < 2) {
      setSugestoes([]);
      setPrefixoAtual('');
      setIndiceSugestao(0);
      return;
    }
    const matches = sugerirNoCaret(texto, caret);
    setSugestoes(matches);
    setPrefixoAtual(prefixo);
    setIndiceSugestao(0);
  };

  const aplicarSugestao = (texto: string, caret: number, escolha: SugestaoAutocomplete) => {
    const { inicio, fim } = extrairPrefixoNoCaret(texto, caret);
    const novo = texto.slice(0, inicio) + escolha.valor + texto.slice(fim);
    atualizar(novo);
    // Reposiciona o caret após a palavra inserida.
    const novoCaret = inicio + escolha.valor.length;
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(novoCaret, novoCaret);
      }
    });
  };

  const handleChange = (ev: ChangeEvent<HTMLTextAreaElement>) => {
    const texto = ev.target.value;
    atualizar(texto);
    ciclandoRef.current = false;
    const caret = ev.target.selectionStart ?? texto.length;
    recomputarSugestoes(texto, caret);
  };

  const handleKeyDown = (ev: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = ev.currentTarget;
    const caret = ta.selectionStart ?? 0;

    // ESC fecha o dropdown.
    if (ev.key === 'Escape' && sugestoes.length > 0) {
      ev.preventDefault();
      setSugestoes([]);
      return;
    }

    // Setas para navegar pelo dropdown visível.
    if (sugestoes.length > 0 && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      setIndiceSugestao((i) => {
        const n = sugestoes.length;
        return ev.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
      });
      return;
    }

    // Enter aceita sugestão atual quando dropdown está aberto.
    if (ev.key === 'Enter' && sugestoes.length > 0 && !ev.shiftKey) {
      ev.preventDefault();
      aplicarSugestao(texto, caret, sugestoes[indiceSugestao]);
      setSugestoes([]);
      ciclandoRef.current = false;
      return;
    }

    // ─── TAB: sequestrar e ciclar ──────────────────────────────────────
    if (ev.key === 'Tab') {
      // Recalcula sugestões a partir do prefixo atual se ainda não temos.
      let lista = sugestoes;
      if (!ciclandoRef.current || lista.length === 0) {
        const { prefixo } = extrairPrefixoNoCaret(texto, caret);
        if (prefixo.length === 0) return; // deixa o Tab navegar normalmente
        lista = sugerirNoCaret(texto, caret);
        if (lista.length === 0) return;
        setSugestoes(lista);
        setPrefixoAtual(prefixo);
      }
      ev.preventDefault();
      const direcao = ev.shiftKey ? -1 : 1;
      const proximoIndice = ciclandoRef.current
        ? (indiceSugestao + direcao + lista.length) % lista.length
        : 0;
      setIndiceSugestao(proximoIndice);
      ciclandoRef.current = true;
      aplicarSugestao(texto, caret, lista[proximoIndice]);
    }
  };

  // Fecha dropdown ao perder foco.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const onBlur = () => {
      // Pequeno delay permite click no dropdown registrar antes do fechamento.
      setTimeout(() => setSugestoes([]), 150);
    };
    ta.addEventListener('blur', onBlur);
    return () => ta.removeEventListener('blur', onBlur);
  }, []);

  const painelAnalise = useMemo(() => <>
      {/* Pré-visualização compilada */}
      {compilado.efeitos.length > 0 && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">
              Plano de Execução
            </div>
            {personagemPreview && (
              <div className="text-[10px] text-emerald-300/60">
                Preview: {personagemPreview.name}
              </div>
            )}
          </div>
          {compilado.efeitos.map((eff, i) => {
            const prev = i > 0 ? compilado.efeitos[i - 1] : undefined;
            // Comparação por JSON do watcher para detectar mudança entre efeitos.
            const watcherKey = eff.watcher ? JSON.stringify(eff.watcher) : '';
            const prevWatcherKey = prev?.watcher ? JSON.stringify(prev.watcher) : '';
            const mostrarWatcher = !!eff.watcher && watcherKey !== prevWatcherKey;
            const mostrarTrigger = !!eff.trigger && eff.trigger !== prev?.trigger;
            const mostrarCondicao = !!eff.condition && eff.condition !== prev?.condition;
            return (
              <div key={eff.id} className="space-y-0.5">
                {mostrarWatcher && (
                  <div className="text-[12px] text-amber-300 font-mono">
                    ⚡ Gatilho: <span className="text-amber-200">{humanizarWatcher(eff.watcher!)}</span>
                  </div>
                )}
                {mostrarTrigger && (
                  <div className="text-[12px] text-amber-300 font-mono">
                    ⚡ Gatilho: <span className="text-amber-200">{eff.trigger}</span>
                  </div>
                )}
                {mostrarCondicao && (
                  <div className="text-[12px] text-sky-300 font-mono">
                    ❓ Condição: <span className="text-sky-200">{eff.condition!.replace(/@USUARIO\./gi, '')}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2 text-[12px] text-foreground/95">
                  <span className="text-emerald-400/70 font-mono shrink-0">#{i + 1}</span>
                  <span className="text-emerald-200">
                    ✅ {frasePlanoExecucao(eff, valoresMock[i])}
                  </span>
                </div>
                {avaliacoesMock[i]?.diagnosticos.map((d, j) => (
                  <div key={j} role="status" className="text-[12px] text-amber-300">
                    Prévia incompleta: {d.mensagem}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {compilado.erros.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-destructive">
            ⚠ Erros de Sintaxe
          </div>
          {compilado.erros.map((er, i) => (
            <div key={i} className="text-[11px] font-mono text-destructive/90">
              <span className="opacity-70">"{er.trecho}"</span> — {er.mensagem}
            </div>
          ))}
        </div>
      )}
  </>, [compilado, personagemPreview, avaliacoesMock, valoresMock]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-wider text-violet-300">
          Omni-Script (Terminal)
        </Label>
        <span className="text-[10px] text-muted-foreground">
          {compilado.efeitos.length} efeito(s) · {compilado.erros.length} erro(s){pendente ? ' · Atualizando prévia…' : ''}
        </span>
      </div>

      {/* Editor com overlay de highlight */}
      <div
        className={`relative rounded-md border bg-zinc-950/80 ${
          ativoParaInsercao ? 'border-violet-500/80 ring-2 ring-violet-500/40' : 'border-violet-500/30'
        }`}
      >
        {/* Camada de highlight (visual). Cresce com o conteúdo e dita a altura do bloco. */}
        <pre
          aria-hidden
          className="whitespace-pre-wrap break-words p-3 font-mono text-[13px] leading-[1.5] text-transparent min-h-[4.5em] m-0"
          style={{ fontFamily: 'JetBrains Mono, Courier New, monospace' }}
        >
          {pendente ? texto : tokens.map((t, i) => (
            <span key={i} className={COR_TOKEN[t.tipo]}>{t.texto}</span>
          ))}
          {/* Garante que a última linha vazia conte na altura */}
          {(texto === '' || texto.endsWith('\n')) && <span> </span>}
        </pre>
        <Textarea
          ref={textareaRef}
          value={texto}
          onBlur={concluirEdicao}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder={'somar treino * 2 em vida_max, somar 10 em vida_atual  ·  Tab para autocompletar'}
          spellCheck={false}
          className={`absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent ${pendente ? 'text-zinc-100' : 'text-transparent'} caret-violet-300 selection:bg-violet-500/30 placeholder:text-muted-foreground/40 font-mono text-[13px] leading-[1.5] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-3`}
          style={{ fontFamily: 'JetBrains Mono, Courier New, monospace' }}
        />

        {/* Dropdown de sugestões (estilo IntelliSense). */}
        {sugestoes.length > 0 && (
          <div
            className="absolute left-3 top-full z-50 mt-1 max-h-64 w-72 overflow-auto rounded-md border border-violet-500/40 bg-zinc-950/95 shadow-xl shadow-violet-900/40 backdrop-blur"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-violet-300/70 border-b border-violet-500/20">
              "{prefixoAtual}" · {sugestoes.length} sugestão(ões) · Tab para ciclar · Enter aceita
            </div>
            {sugestoes.map((s, i) => (
              <button
                key={s.valor + i}
                type="button"
                className={`block w-full text-left px-2 py-1 font-mono text-[12px] transition-colors ${
                  i === indiceSugestao
                    ? 'bg-violet-500/30 text-violet-100'
                    : 'text-zinc-200 hover:bg-violet-500/10'
                }`}
                onClick={() => {
                  const ta = textareaRef.current;
                  const caret = ta?.selectionStart ?? texto.length;
                  aplicarSugestao(texto, caret, s);
                  setSugestoes([]);
                  ciclandoRef.current = false;
                }}
              >
                <span className="text-violet-300">{s.valor.slice(0, prefixoAtual.length)}</span>
                <span>{s.valor.slice(prefixoAtual.length)}</span>
                <span className="ml-2 text-[10px] text-zinc-500">{s.categoria}</span>
                {s.hint && (
                  <div className="text-[10px] text-zinc-500 truncate">{s.hint}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legenda das keywords */}
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        <span><span className="text-violet-400 font-bold font-mono">somar</span> = +</span>
        <span><span className="text-violet-400 font-bold font-mono">subtrair</span> = −</span>
        <span><span className="text-violet-400 font-bold font-mono">definir</span> = =</span>
        <span><span className="text-violet-400 font-bold font-mono">em</span> → recurso</span>
        <span><span className="text-pink-400 font-bold font-mono">,</span> → próximo comando</span>
        <span><span className="text-pink-400 font-bold font-mono">e</span> → soma (+) na fórmula</span>
        <span><span className="text-violet-400 font-bold font-mono">Tab</span> → autocompletar / ciclar</span>
      </div>

      {painelAnalise}
    </div>
  );
}
