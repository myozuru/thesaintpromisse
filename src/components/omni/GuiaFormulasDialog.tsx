/**
 * 📖 Bíblia de Fórmulas Omni-Engine
 * Guia visual para o Mestre entender o sistema de fórmulas escaláveis,
 * prefixos de contexto, funções matemáticas e Receitas prontas (clicáveis)
 * que injetam efeitos completos no editor.
 *
 * Suporta dois modos visuais:
 *  - `dialog`     → modal centralizado (compatível com chamadas antigas).
 *  - `flutuante`  → painel lateral arrastável que NÃO bloqueia a edição.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Sparkles, GripHorizontal, X, Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { RECEITAS_OMNI, type ReceitaOmni } from '@/lib/omni/receitas';
import { CHAVES_GUIA_OMNI, GATILHOS_GUIA_OMNI, ACOES_GUIA_OMNI, escoposDaChaveGuia, referenciaDaChaveGuia, referenciaDoAliasGuia, type CategoriaGuiaId, type ChaveGuia, type EscopoGuia } from '@/lib/omni/guiaDados';
import { FUNCOES_MATEMATICAS_OMNI } from '@/lib/omni/constantesDoSistema';
import type { CombatEffect } from '@/lib/omni/tipos';
import {
  extrairPrefixoNoCaret,
  filtrarSugestoes,
  type SugestaoAutocomplete,
} from '@/lib/omni/dicionarioAutocomplete';

interface Props {
  aberto: boolean;
  onClose: () => void;
  /** Modo visual. Padrão: 'dialog'. */
  modo?: 'dialog' | 'flutuante';
  /**
   * Callback opcional. Se fornecido, aparece o botão "Aplicar" em cada
   * receita e clicar injeta os efeitos no construtor sem fechar o painel.
   */
  onAplicarReceita?: (efeitos: CombatEffect[]) => void;
  /**
   * Callback opcional. Quando fornecido, clicar em uma fórmula/chave
   * (no Guia ou nos Exemplos) insere o trecho no campo de fórmula
   * atualmente em foco, em vez de apenas copiar para a área de transferência.
   */
  onInserirFormula?: (trecho: string) => void;
  /**
   * Callback opcional. Quando fornecido, exibe um botão "🎯 Alvo" ao lado
   * de cada chave do Guia. Ao clicar, a chave (sem o prefixo @ESCOPO.) é
   * enviada ao consumidor — geralmente para preencher o seletor "Afetar
   * Recurso" do efeito atualmente em edição.
   */
  onSelecionarRecurso?: (chave: string) => void;
}

export function GuiaFormulasDialog({ aberto, onClose, modo = 'dialog', onAplicarReceita, onInserirFormula, onSelecionarRecurso }: Props) {
  const [maximizado, setMaximizado] = useState(false);
  const inserir = (trecho: string) => {
    if (onInserirFormula) onInserirFormula(trecho);
    else if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(trecho).catch(() => {});
  };
  const extrairChaveRecurso = (key: string): string | null => {
    const match = key.match(/^@(?:USUARIO|ALVO|CENA)\.(.+)$/);
    if (match) return match[1];
    return key.startsWith('@') ? null : key;
  };
  useEffect(() => { if (!aberto) setMaximizado(false); }, [aberto]);

  const Conteudo = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs defaultValue={onAplicarReceita ? 'receitas' : 'recursos'} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="sintaxe" className="min-h-10 whitespace-normal text-xs leading-relaxed">⌨ Sintaxe</TabsTrigger>
          <TabsTrigger value="recursos" className="min-h-10 whitespace-normal text-xs leading-relaxed">🩺 Recursos</TabsTrigger>
          <TabsTrigger value="combate" className="min-h-10 whitespace-normal text-xs leading-relaxed">⚔ Combate</TabsTrigger>
          <TabsTrigger value="pericias" className="min-h-10 whitespace-normal text-xs leading-relaxed">🥋 Perícias</TabsTrigger>
          <TabsTrigger value="eventos" className="min-h-10 whitespace-normal text-xs leading-relaxed">⚡ Eventos</TabsTrigger>
          <TabsTrigger value="magia" className="min-h-10 whitespace-normal text-xs leading-relaxed">🔮 Magia</TabsTrigger>
          <TabsTrigger value="acoes" className="min-h-10 whitespace-normal text-xs leading-relaxed">🎯 Ações</TabsTrigger>
          <TabsTrigger value="receitas" className="min-h-10 whitespace-normal text-xs leading-relaxed">✦ Receitas</TabsTrigger>
        </TabsList>

        <TabsContent value="sintaxe" className="min-h-0 flex-1 space-y-5 overflow-y-auto pt-3 pr-2">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-violet-300">Comandos e sequência</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">Use linguagem direta. Cada comando aplica uma mudança; a vírgula ou o conector “e” encadeia ações.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { cmd: 'somar', ex: 'somar 2d6 em vida', desc: 'Adiciona ao recurso.' },
                { cmd: 'subtrair', ex: 'subtrair 2d6 em vida', desc: 'Remove do recurso.' },
                { cmd: 'definir', ex: 'definir 0 em pe', desc: 'Define o valor exato.' },
              ].map((item) => (
                <button key={item.cmd} type="button" onClick={() => inserir(item.ex)} className="rounded-md border border-border bg-background/50 p-3 text-left hover:border-primary/60">
                  <code className="text-sm font-semibold text-primary">{item.cmd}</code>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                  <code className="mt-2 block break-words text-xs text-foreground">{item.ex}</code>
                </button>
              ))}
            </div>
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed text-amber-100">
              <strong>Atalho de contexto:</strong> uma chave sem prefixo, como <code>vida</code> ou <code>pericia_furtividade</code>, usa o usuário. Para escolher o alvo, use <code>@ALVO.vida</code>. Aliases legados continuam aceitos.
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-violet-300">Operadores, funções e dados</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { fn: '+  −  *  /', desc: 'Somar, subtrair, multiplicar e dividir.', ex: '@USUARIO.for + 2' },
                { fn: 'comparações', desc: '>  >=  <  <=  ==  !=', ex: 'if(@ALVO.vida < 10, 2, 0)' },
                { fn: 'XdY', desc: 'Rola dados; kh/kl mantém maiores/menores.', ex: '2d20kh1 + @USUARIO.treino' },
              ].map((item) => <FuncCard key={item.fn} fn={item.fn} desc={item.desc} ex={item.ex} />)}
              {FUNCOES_MATEMATICAS_OMNI.map((item) => <FuncCard key={item.fn} fn={item.fn} desc={item.desc} ex={item.ex} />)}
            </div>
          </section>

          <TabAutocompletePlayground onInserir={inserir} />
        </TabsContent>

        <TabsContent value="recursos" className="min-h-0 flex-1 overflow-y-auto pt-3 pr-2">
          <KeyCatalog categoria="recursos" onInsert={inserir} onSelecionarRecurso={onSelecionarRecurso} extrairChaveRecurso={extrairChaveRecurso} />
        </TabsContent>
        <TabsContent value="combate" className="min-h-0 flex-1 overflow-y-auto pt-3 pr-2">
          <KeyCatalog categoria="combate" onInsert={inserir} onSelecionarRecurso={onSelecionarRecurso} extrairChaveRecurso={extrairChaveRecurso} />
        </TabsContent>
        <TabsContent value="pericias" className="min-h-0 flex-1 overflow-y-auto pt-3 pr-2">
          <KeyCatalog categoria="pericias" onInsert={inserir} onSelecionarRecurso={onSelecionarRecurso} extrairChaveRecurso={extrairChaveRecurso} />
        </TabsContent>

        <TabsContent value="eventos" className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-3 pr-2">
          <p className="text-sm leading-relaxed text-muted-foreground">Gatilhos são eventos que iniciam efeitos automaticamente. Clique no exemplo ou em um alias para inserir no campo em foco.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {GATILHOS_GUIA_OMNI.map((gatilho) => (
              <article key={gatilho.id} className="rounded-md border border-border bg-background/50 p-3">
                <h3 className="text-sm font-semibold">{gatilho.rotulo}</h3>
                <button type="button" onClick={() => inserir(gatilho.exemplo)} className="mt-2 block w-full break-all rounded bg-muted px-2 py-1 text-left font-mono text-xs text-primary hover:bg-primary/10">{gatilho.exemplo}</button>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {gatilho.aliases.map((alias) => <button key={alias} type="button" onClick={() => inserir('@' + alias + ' -> ')} className="rounded-full border border-border px-2 py-1 text-xs leading-relaxed text-muted-foreground hover:border-primary/60 hover:text-foreground">{alias}</button>)}
                </div>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="magia" className="min-h-0 flex-1 overflow-y-auto pt-3 pr-2">
          <KeyCatalog categoria="magia" onInsert={inserir} onSelecionarRecurso={onSelecionarRecurso} extrairChaveRecurso={extrairChaveRecurso} />
        </TabsContent>

        <TabsContent value="acoes" className="min-h-0 flex-1 space-y-5 overflow-y-auto pt-3 pr-2">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">Ações primitivas do construtor</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">Lista gerada diretamente das definições do OMNI para ficar sincronizada com o construtor.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ACOES_GUIA_OMNI.map((acao) => (
                <article key={acao.id} className="rounded-md border border-border bg-background/50 p-3">
                  <div className="text-sm font-semibold">{acao.label}</div>
                  <button type="button" onClick={() => inserir(acao.comando)} className="mt-2 rounded bg-muted px-2 py-1 font-mono text-xs text-primary hover:bg-primary/10">Inserir {acao.comando}</button>
                </article>
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">Ações ativas, custos e movimento</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { titulo: 'Tipo de ação', texto: 'Comum, bônus, reação ou livre. A ação sustentada pode consumir recurso a cada turno.' },
                { titulo: 'Custo flexível', texto: 'PE base e por intensificação, cargas, PV, munição e usos do item.' },
                { titulo: 'Movimento', texto: 'Puxar, empurrar, avançar até o alvo, teleportar ou trocar de posição.' },
                { titulo: 'Alvos e área', texto: 'Alvo único, múltiplos, área ou próprio; filtros para aliados e inimigos.' },
              ].map((item) => <div key={item.titulo} className="rounded-md border border-border bg-background/50 p-3"><h3 className="text-sm font-semibold">{item.titulo}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.texto}</p></div>)}
            </div>
            <button type="button" onClick={() => inserir('subtrair 2d6 em @ALVO.vida')} className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20">Exemplo: ataque com dano →</button>
          </section>
        </TabsContent>

        <TabsContent value="receitas" className="min-h-0 flex-1 space-y-5 overflow-y-auto pt-3 pr-2">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">Exemplos clicáveis</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { titulo: 'Vitalidade dinâmica', script: 'somar @USUARIO.treino * 2 em vida_max', descricao: 'Aumenta vida máxima conforme o treinamento.' },
                { titulo: 'Ataque básico', script: 'subtrair @USUARIO.for + 2d6 em @ALVO.vida', descricao: 'Força e dados determinam o dano.' },
                { titulo: 'Maldição severa', script: 'subtrair 10 em @ALVO.vida_max, definir 0 em @ALVO.pe', descricao: 'Reduz vida máxima e zera PE do alvo.' },
                { titulo: 'Dreno vital', script: 'subtrair 2d6 em @ALVO.vida, somar 1d6 em @USUARIO.vida', descricao: 'Causa dano e recupera vida.' },
                { titulo: 'Bola de fogo', script: 'subtrair @USUARIO.int + 2d6 em @ALVO.vida', descricao: 'Dano mágico baseado em Inteligência.' },
                { titulo: 'Buff de defesa', script: 'somar @USUARIO.pericia_feiticaria em defesa', descricao: 'Usa Feitiçaria como bônus defensivo.' },
                { titulo: 'Área escalável', script: 'subtrair @USUARIO.int + @USUARIO.nivel em @ALVO.vida', descricao: 'Dano que escala com nível.' },
                { titulo: 'Postura defensiva', script: 'somar 2 em defesa, subtrair 2 em acerto', descricao: 'Troca acerto por defesa.' },
                { titulo: 'Condição por gatilho', script: '@fim_turno -> aplicar cego em alvo', descricao: 'Demonstra o alias amigável de evento.' },
                { titulo: 'Recuperar energia', script: 'somar 1d6 em @USUARIO.pe', descricao: 'Recupera PE com dados.' },
              ].map((item) => <ExemploCard key={item.titulo} titulo={item.titulo} formula={item.script} explicacao={item.descricao} onInsert={inserir} />)}
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">Receitas do OMNI</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{onAplicarReceita ? 'Selecione uma receita para aplicar ao construtor.' : 'Receitas prontas do sistema. Conecte o construtor para aplicá-las diretamente.'}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {RECEITAS_OMNI.map((receita) => <ReceitaCard key={receita.id} receita={receita} onAplicar={onAplicarReceita ? () => onAplicarReceita(receita.build()) : undefined} />)}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );

  if (modo === 'flutuante') {
    return <PainelLateral aberto={aberto} onClose={onClose}>{Conteudo}</PainelLateral>;
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="!max-w-none flex flex-col overflow-hidden p-4"
        style={{
          position: 'fixed',
          left: maximizado ? 0 : '50%',
          top: maximizado ? 0 : '50%',
          transform: maximizado ? 'none' : 'translate(-50%, -50%)',
          width: maximizado ? '100vw' : 'min(1100px, 96vw)',
          height: maximizado ? '100vh' : 'min(900px, 88vh)',
          minWidth: 'min(500px, 96vw)',
          minHeight: 'min(500px, 88vh)',
          maxWidth: maximizado ? '100vw' : '96vw',
          maxHeight: maximizado ? '100vh' : '96vh',
          resize: maximizado ? 'none' : 'both',
          borderRadius: maximizado ? 0 : undefined,
        }}
      >
        <DialogHeader className="mb-3 flex shrink-0 flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="flex items-center gap-2 text-primary"><BookOpen className="h-5 w-5" /> Guia de Fórmulas OMNI</DialogTitle>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Chaves, eventos, ações e exemplos em um só lugar.</p>
          </div>
          <button type="button" onClick={() => setMaximizado((value) => !value)} className="rounded-md border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={maximizado ? 'Restaurar tamanho do guia' : 'Maximizar guia'}>
            {maximizado ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </DialogHeader>
        {Conteudo}
      </DialogContent>
    </Dialog>
  );
}

function KeyCatalog({ categoria, onInsert, onSelecionarRecurso, extrairChaveRecurso }: {
  categoria: CategoriaGuiaId;
  onInsert: (formula: string) => void;
  onSelecionarRecurso?: (key: string) => void;
  extrairChaveRecurso: (key: string) => string | null;
}) {
  const [busca, setBusca] = useState('');
  const chaves = CHAVES_GUIA_OMNI.filter((chave) => {
    if (chave.categoria !== categoria) return false;
    const texto = [chave.id, chave.label, chave.descricao, ...chave.aliases, ...chave.grupos].join(' ').toLocaleLowerCase();
    return texto.includes(busca.trim().toLocaleLowerCase());
  });

  return (
    <section className="space-y-3">
      <label className="block text-sm font-medium">
        Buscar chave
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: vida, crítico, furtividade…" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary" />
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">{chaves.length} cards nesta categoria. Clique na referência para inserir. Os aliases aceitos aparecem abaixo.</p>
      <div className="grid gap-2 md:grid-cols-2">
        {chaves.map((chave) => <KeyCard key={chave.id} chave={chave} onInsert={onInsert} onSelecionarRecurso={onSelecionarRecurso} extrairChaveRecurso={extrairChaveRecurso} />)}
      </div>
      {chaves.length === 0 && <p className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhuma chave corresponde à busca.</p>}
    </section>
  );
}

function KeyCard({ chave, onInsert, onSelecionarRecurso, extrairChaveRecurso }: {
  chave: ChaveGuia;
  onInsert: (formula: string) => void;
  onSelecionarRecurso?: (key: string) => void;
  extrairChaveRecurso: (key: string) => string | null;
}) {
  const escopos = escoposDaChaveGuia(chave);
  const escopoExemplo = escopos[0];
  const referenciaExemplo = referenciaDaChaveGuia(chave, escopoExemplo);
  const exemplo = 'if(' + referenciaExemplo + ' > 0, ' + referenciaExemplo + ', 0)';
  const recurso = extrairChaveRecurso(referenciaExemplo);
  return (
    <article className="min-w-0 rounded-md border border-border/70 bg-background/50 p-3 hover:border-primary/50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-all font-mono text-sm font-semibold text-primary">{chave.id}</h3>
          <p className="mt-1 text-sm leading-relaxed">{chave.descricao}</p>
        </div>
        {onSelecionarRecurso && recurso && <button type="button" onClick={() => onSelecionarRecurso(recurso)} className="shrink-0 rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10">🎯 Alvo</button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {escopos.map((escopo) => {
          const ref = referenciaDaChaveGuia(chave, escopo);
          return <button key={escopo} type="button" onClick={() => onInsert(ref)} className="rounded border border-primary/30 bg-primary/5 px-2 py-1 font-mono text-xs text-primary hover:bg-primary/15">{ref}</button>;
        })}
      </div>
      {chave.aliases.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-medium text-muted-foreground">Aliases aceitos</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {chave.aliases.map((alias) => <button key={alias} type="button" onClick={() => onInsert(referenciaDoAliasGuia(chave, alias, escopoExemplo))} className="max-w-full break-all rounded-full border border-border px-2 py-1 text-xs leading-relaxed text-muted-foreground hover:border-primary/50 hover:text-foreground">{alias}</button>)}
          </div>
        </div>
      )}
      <button type="button" onClick={() => onInsert(exemplo)} className="mt-3 block max-w-full break-all rounded bg-muted px-2 py-1.5 text-left font-mono text-xs leading-relaxed text-foreground hover:bg-primary/10">Exemplo: {exemplo}</button>
    </article>
  );
}

// === Painel flutuante arrastável (Portal + Framer Motion) ===================
/**
 * Renderizado via React Portal direto no <body> para escapar de qualquer
 * stacking context do Construtor (Radix Dialog cria seu próprio overlay z-50).
 *
 * z-index 10000 garante que o helper fique acima do overlay escuro do modal.
 * O arraste é manual via listeners nativos no window para não depender do
 * sistema de drag do Framer dentro do Dialog modal do Radix.
 */
function PainelLateral({
  aberto, onClose, children,
}: { aberto: boolean; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [posicao, setPosicao] = useState({ x: 0, y: 80 });
  const [maximizado, setMaximizado] = useState(false);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    setPosicao({ x: Math.max(12, window.innerWidth - 444), y: 80 });
  }, [mounted]);

  const moverPainel = useCallback((clientX: number, clientY: number) => {
    const painel = panelRef.current;
    const largura = painel?.offsetWidth ?? 420;
    const altura = painel?.offsetHeight ?? Math.min(window.innerHeight * 0.8, 720);
    const margem = 12;

    setPosicao({
      x: Math.min(Math.max(margem, clientX - dragOffsetRef.current.x), window.innerWidth - largura - margem),
      y: Math.min(Math.max(margem, clientY - dragOffsetRef.current.y), window.innerHeight - altura - margem),
    });
  }, []);

  const iniciarArraste = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || maximizado) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;

    e.preventDefault();
    e.stopPropagation();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      moverPainel(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  }, [moverPainel, maximizado]);

  if (!mounted || !aberto || typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      ref={panelRef}
      data-omni-helper
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="fixed flex flex-col overflow-hidden rounded-lg border border-primary/30 bg-background/95 shadow-2xl shadow-primary/20 backdrop-blur-md"
      style={{
        zIndex: 10000,
        left: maximizado ? 0 : posicao.x,
        top: maximizado ? 0 : posicao.y,
        width: maximizado ? '100vw' : 'min(860px, 96vw)',
        height: maximizado ? '100vh' : '80vh',
        minWidth: 'min(500px, 92vw)',
        minHeight: 'min(500px, 90vh)',
        maxWidth: maximizado ? '100vw' : '96vw',
        maxHeight: maximizado ? '100vh' : '96vh',
        resize: maximizado ? 'none' : 'both',
        pointerEvents: 'auto',
      }}
    >
      <DragHandleBar onClose={onClose} onStartDrag={iniciarArraste} maximizado={maximizado} onToggleMaximizado={() => setMaximizado((value) => !value)} />
      <div className="flex-1 min-h-0 flex flex-col p-4 pt-2">{children}</div>
    </motion.div>,
    document.body,
  );
}

function DragHandleBar({ onClose, onStartDrag, maximizado, onToggleMaximizado }: { onClose: () => void; onStartDrag: (e: React.PointerEvent) => void; maximizado: boolean; onToggleMaximizado: () => void }) {
  return (
    <div
      onPointerDown={onStartDrag}
      className="flex shrink-0 items-center justify-between gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 select-none"
      style={{ cursor: maximizado ? 'default' : 'grab' }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-primary"><GripHorizontal className="h-4 w-4 opacity-70" />📖 Omni-Helper</div>
      <div className="flex items-center gap-1">
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onToggleMaximizado} className="rounded p-1.5 text-muted-foreground hover:bg-background/60 hover:text-foreground" aria-label={maximizado ? 'Restaurar tamanho do guia' : 'Maximizar guia'}>
          {maximizado ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-background/60 hover:text-foreground" aria-label="Fechar Omni-Helper"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

// === Card de Receita ========================================================
function ReceitaCard({ receita, onAplicar }: { receita: ReceitaOmni; onAplicar?: () => void }) {
  const corBorda =
    receita.cor === 'cura' ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
    : receita.cor === 'dano' ? 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10'
    : receita.cor === 'buff' ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
    : 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10';

  return (
    <button
      type="button"
      onClick={onAplicar}
      disabled={!onAplicar}
      className={`text-left rounded-md border p-2.5 transition-colors ${corBorda} ${onAplicar ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">{receita.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{receita.nome}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{receita.descricao}</div>
        </div>
        {onAplicar && (
          <span className="text-xs uppercase tracking-wider text-primary font-semibold shrink-0">
            Aplicar →
          </span>
        )}
      </div>
    </button>
  );
}

function ContextoCard({ cor, nome, descricao, exemplo }: { cor: string; nome: string; descricao: string; exemplo: string }) {
  return (
    <div className={`rounded-md border p-2.5 ${cor}`}>
      <div className="font-mono font-bold text-sm">{nome}</div>
      <div className="text-xs mt-1 opacity-90">{descricao}</div>
      <div className="text-xs mt-1.5 font-mono bg-background/50 px-1.5 py-0.5 rounded">
        {exemplo}
      </div>
    </div>
  );
}

function FuncCard({ fn, desc, ex }: { fn: string; desc: string; ex: string }) {
  return (
    <div className="rounded border border-border/50 bg-background/40 p-2">
      <code className="text-primary font-semibold">{fn}</code>
      <div className="text-muted-foreground mt-0.5">{desc}</div>
      <div className="text-xs mt-1 font-mono text-foreground/70">→ {ex}</div>
    </div>
  );
}

function ExemploCard({ titulo, formula, explicacao, onInsert }: { titulo: string; formula: string; explicacao: string; onInsert?: (trecho: string) => void }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
      <div className="text-xs font-semibold text-foreground">{titulo}</div>
      <button
        type="button"
        onClick={() => onInsert?.(formula)}
        disabled={!onInsert}
        title={onInsert ? 'Clique para inserir/copiar a fórmula' : ''}
        className="block w-full text-left mt-1 text-xs font-mono text-primary bg-background/60 px-2 py-1 rounded whitespace-pre-wrap hover:bg-primary/15 transition-colors disabled:cursor-default"
      >
        {formula}
      </button>
      <div className="text-xs text-muted-foreground mt-1">{explicacao}</div>
    </div>
  );
}

// === Playground interativo do Tab-Autocomplete (estilo Minecraft) ===========
/**
 * Mini-terminal embutido no Guia. Usa exatamente as mesmas funções
 * (`extrairPrefixoNoCaret`, `filtrarSugestoes`) e o mesmo visual do
 * OmniScriptTerminal, para o usuário praticar o Tab dentro da própria
 * documentação. Tab cicla, ↑/↓ navegam, Enter aceita, Esc fecha.
 */
function TabAutocompletePlayground({ onInserir }: { onInserir: (s: string) => void }) {
  const [texto, setTexto] = useState('somar treino * 2 em vid');
  const [sugestoes, setSugestoes] = useState<SugestaoAutocomplete[]>([]);
  const [indice, setIndice] = useState(0);
  const [prefixo, setPrefixo] = useState('');
  const ciclandoRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const recomputar = (val: string, caret: number) => {
    const { prefixo: pf } = extrairPrefixoNoCaret(val, caret);
    if (pf.length < 2) {
      setSugestoes([]); setPrefixo(''); setIndice(0); return;
    }
    setSugestoes(filtrarSugestoes(pf));
    setPrefixo(pf);
    setIndice(0);
  };

  const aplicar = (val: string, caret: number, esc: SugestaoAutocomplete) => {
    const { inicio, fim } = extrairPrefixoNoCaret(val, caret);
    const novo = val.slice(0, inicio) + esc.valor + val.slice(fim);
    setTexto(novo);
    const cur = inicio + esc.valor.length;
    requestAnimationFrame(() => {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(cur, cur);
    });
  };

  // Pré-popula sugestões na montagem (para o demo já aparecer visível)
  useEffect(() => {
    const caret = texto.length;
    recomputar(texto, caret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = ev.currentTarget;
    const caret = ta.selectionStart ?? 0;

    if (ev.key === 'Escape' && sugestoes.length > 0) {
      ev.preventDefault(); setSugestoes([]); return;
    }
    if (sugestoes.length > 0 && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      setIndice((i) => {
        const n = sugestoes.length;
        return ev.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
      });
      return;
    }
    if (ev.key === 'Enter' && sugestoes.length > 0 && !ev.shiftKey) {
      ev.preventDefault();
      aplicar(texto, caret, sugestoes[indice]);
      setSugestoes([]); ciclandoRef.current = false;
      return;
    }
    if (ev.key === 'Tab') {
      let lista = sugestoes;
      if (!ciclandoRef.current || lista.length === 0) {
        const { prefixo: pf } = extrairPrefixoNoCaret(texto, caret);
        if (pf.length === 0) return;
        lista = filtrarSugestoes(pf);
        if (lista.length === 0) return;
        setSugestoes(lista); setPrefixo(pf);
      }
      ev.preventDefault();
      const direcao = ev.shiftKey ? -1 : 1;
      const prox = ciclandoRef.current
        ? (indice + direcao + lista.length) % lista.length
        : 0;
      setIndice(prox);
      ciclandoRef.current = true;
      aplicar(texto, caret, lista[prox]);
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-[0.15em] text-violet-300 font-semibold border-b border-violet-400/40 pb-1">
        🎮 Playground — Tab Autocomplete (Estilo Minecraft)
      </h3>
      <p className="text-xs text-muted-foreground">
        Digite no mini-terminal abaixo. Pressione <kbd className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 font-mono text-xs">Tab</kbd> para autocompletar / ciclar,
        {' '}<kbd className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 font-mono text-xs">↑ ↓</kbd> para navegar,
        {' '}<kbd className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 font-mono text-xs">Enter</kbd> aceita,
        {' '}<kbd className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 font-mono text-xs">Esc</kbd> fecha.
        Funciona com todas as <strong>~200 chaves</strong> do sistema.
      </p>

      <div className="relative rounded-md border border-violet-500/40 bg-zinc-950/80">
        <textarea
          ref={taRef}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            ciclandoRef.current = false;
            recomputar(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="block w-full resize-none bg-transparent text-violet-100 caret-violet-300 selection:bg-violet-500/30 placeholder:text-muted-foreground/40 font-mono text-sm leading-relaxed border-0 focus:outline-none p-3 min-h-[3.5em]"
          style={{ fontFamily: 'JetBrains Mono, Courier New, monospace' }}
          placeholder="experimente digitar: somar pe… ou subtrair vida_pct…"
        />

        {sugestoes.length > 0 && (
          <div
            className="absolute left-3 top-full z-50 mt-1 max-h-64 w-80 overflow-auto rounded-md border border-violet-500/40 bg-zinc-950/95 shadow-xl shadow-violet-900/40 backdrop-blur"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="px-2 py-1 text-xs uppercase tracking-wider text-violet-300/70 border-b border-violet-500/20">
              "{prefixo}" · {sugestoes.length} sugestão(ões) · Tab cicla · Enter aceita
            </div>
            {sugestoes.map((s, i) => (
              <button
                key={s.valor + i}
                type="button"
                className={`block w-full text-left px-2 py-1 font-mono text-xs transition-colors ${
                  i === indice
                    ? 'bg-violet-500/30 text-violet-100'
                    : 'text-zinc-200 hover:bg-violet-500/10'
                }`}
                onClick={() => {
                  const caret = taRef.current?.selectionStart ?? texto.length;
                  aplicar(texto, caret, s);
                  setSugestoes([]); ciclandoRef.current = false;
                }}
              >
                <span className="text-violet-300">{s.valor.slice(0, prefixo.length)}</span>
                <span>{s.valor.slice(prefixo.length)}</span>
                <span className="ml-2 text-xs text-zinc-500">{s.categoria}</span>
                {s.hint && (
                  <div className="text-xs text-zinc-500 truncate">{s.hint}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mock visual estático (caso o usuário ainda não tenha digitado) ----- */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-violet-300 transition-colors">
          📸 Ver exemplo visual do dropdown (estático)
        </summary>
        <div className="mt-2 relative rounded-md border border-violet-500/40 bg-zinc-950/80 p-3">
          <div className="font-mono text-sm leading-relaxed" style={{ fontFamily: 'JetBrains Mono, Courier New, monospace' }}>
            <span className="text-violet-400 font-bold">somar</span>{' '}
            <span className="text-sky-300">treino</span>{' '}
            <span className="text-pink-400">*</span>{' '}
            <span className="text-amber-300">2</span>{' '}
            <span className="text-violet-400 font-bold">em</span>{' '}
            <span className="text-sky-300">vid</span>
            <span className="inline-block w-[2px] h-3 bg-violet-300 ml-0.5 align-middle animate-pulse" />
          </div>
          <div className="mt-2 w-80 rounded-md border border-violet-500/40 bg-zinc-950/95 shadow-xl shadow-violet-900/40">
            <div className="px-2 py-1 text-xs uppercase tracking-wider text-violet-300/70 border-b border-violet-500/20">
              "vid" · 6 sugestão(ões) · Tab cicla · Enter aceita
            </div>
            {[
              { v: 'vida', cat: 'Recurso', hint: 'Vida atual do personagem', sel: true },
              { v: 'vida_max', cat: 'Recurso', hint: 'Vida máxima' },
              { v: 'vida_pct_abaixo_25', cat: 'Recurso', hint: '1 se vida ≤ 25%' },
              { v: 'vida_pct_abaixo_50', cat: 'Recurso', hint: '1 se vida ≤ 50% (bloodied)' },
              { v: 'vida_faltante', cat: 'Recurso', hint: 'vida_max − vida_atual' },
              { v: 'vida_faltante_pct', cat: 'Recurso', hint: '% perdida (0–100)' },
            ].map((s) => (
              <div
                key={s.v}
                className={`block w-full text-left px-2 py-1 font-mono text-xs ${
                  s.sel ? 'bg-violet-500/30 text-violet-100' : 'text-zinc-200'
                }`}
              >
                <span className="text-violet-300">vid</span><span>{s.v.slice(3)}</span>
                <span className="ml-2 text-xs text-zinc-500">{s.cat}</span>
                <div className="text-xs text-zinc-500 truncate">{s.hint}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-zinc-500 italic">
            ↑ Após o <kbd className="px-1 rounded bg-violet-500/20 border border-violet-500/30 font-mono">Tab</kbd>, "<code>vid</code>" vira "<code className="text-violet-300">vida</code>" e o caret pula para o fim da palavra. Apertar Tab de novo cicla para "<code>vida_max</code>", e por aí vai.
          </div>
        </div>
      </details>

      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-200">
        💡 No <strong>Construtor</strong> e no <strong>Modo Avançado</strong>, o autocomplete já está
        ativo em todos os campos de fórmula. Use os botões abaixo para inserir chaves prontas no terminal em foco.
      </div>
    </section>
  );
}

