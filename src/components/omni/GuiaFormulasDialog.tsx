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
import { BookOpen, GripHorizontal, X, Maximize2, Minimize2 } from 'lucide-react';
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
                {
                  titulo: 'Cura limitada à vida que falta',
                  script: 'somar min(1d8 + @USUARIO.sab, @ALVO.vida_max - @ALVO.vida) em @ALVO.vida',
                  descricao: 'Rola 1d8 e soma Sabedoria. min compara essa cura com o espaço que falta até a vida máxima e usa o menor valor. Exemplo: se a rolagem cura 9, mas faltam 4 PV, recupera só 4.',
                },
                {
                  titulo: 'Golpe que aproveita a vida baixa',
                  script: 'se @ALVO.vida_pct <= 25 entao subtrair 2d8 em @ALVO.vida',
                  descricao: 'A condição consulta a porcentagem de vida do alvo. O golpe de 2d8 só acontece quando ela está em 25% ou menos; acima desse limite, o comando não aplica dano.',
                },
                {
                  titulo: 'Explosão em área',
                  script: 'subtrair 2d6 + @USUARIO.inteligencia em area.vida',
                  descricao: 'Rola 2d6, soma Inteligência e envia o resultado ao recurso Vida do alvo AREA. O construtor determina quais criaturas fazem parte da área.',
                },
                {
                  titulo: 'Drenagem em duas etapas',
                  script: 'subtrair 2d6 + @USUARIO.forca em @ALVO.vida, somar floor(@RESULTADO_1 / 2) em @USUARIO.vida',
                  descricao: 'Primeiro calcula e aplica o dano ao alvo. Depois, @RESULTADO_1 reutiliza o resultado do primeiro comando; floor arredonda para baixo a metade que será recuperada pelo usuário.',
                },
                {
                  titulo: 'Recuperar PE sem passar do máximo',
                  script: 'somar min(3, @ALVO.pe_max - @ALVO.pe) em @ALVO.pe',
                  descricao: 'Tenta recuperar 3 PE. min limita a recuperação ao espaço disponível: se faltam 2 PE para o máximo, recupera 2; se faltam 5, recupera 3.',
                },
                {
                  titulo: 'Defesa que cresce com treinamento',
                  script: 'somar @USUARIO.treino em usuario.defesa',
                  descricao: 'Quando o script é executado, consulta Treinamento e soma esse valor à Defesa do usuário. Com Treinamento 4, adiciona +4; mudanças futuras na ficha não atualizam esse bônus automaticamente.',
                },
                {
                  titulo: 'Aplicar cegueira por duas rodadas',
                  script: 'aplicar cego rodadas 2 em alvo',
                  descricao: 'Aplica a condição Cego ao alvo e define sua duração em duas rodadas. O comando de condição não precisa ser escrito como uma alteração numérica de Vida ou PE.',
                },
                {
                  titulo: 'Efeito aleatório no fim do turno',
                  script: '@fim_turno -> ( rolar 1d4 entao ( 1: aplicar cego rodadas 1, 2: aplicar surdo rodadas 1, 3-4: subtrair 2d6 em alvo.vida ) )',
                  descricao: 'No fim do turno, rola 1d4. Resultado 1 aplica Cego; 2 aplica Surdo; 3 ou 4 causa 2d6 de dano. Os parênteses mantêm todas as opções sob o mesmo gatilho.',
                },
                {
                  titulo: 'Reduzir custo de feitiços de círculo baixo',
                  script: 'reduzir custo pe de feitico nivel:1-3 em 2 min 1',
                  descricao: 'Reduz em 2 PE o custo de feitiços dos níveis 1 a 3. min 1 impede que o custo final fique abaixo de 1 PE.',
                },
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

const EXEMPLOS_CONTEXTUAIS_CHAVES: Record<string, { formula: string; explicacao: string }> = {
  defesa: {"formula":"se @ALVO.defesa <= 12 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma manobra de abertura pune um alvo com guarda baixa. Se a Defesa dele for 12 ou menos, aplica 1d8; com Defesa 13, não dispara. A chave lê a defesa passiva do alvo e pode alimentar efeitos que dependem do quanto ele está protegido."},
  esquiva: {"formula":"se @USUARIO.esquiva > 0 entao subtrair 1 em @USUARIO.esquiva, somar 1d8 em @USUARIO.vida","explicacao":"Neste sistema, Esquiva é o recurso legado que corresponde aos pontos de vida temporários da ficha. O exemplo consome 1 ponto dessa camada para ativar uma recuperação de 1d8 PV; se ela estiver zerada, não há custo disponível. Use a referência para mecânicas que ainda dependem desse recurso."},
  resistencia: {"formula":"subtrair max(1, 2d8 - @ALVO.resistencia) em @ALVO.vida","explicacao":"Uma armadura reduz um impacto de 2d8 pela RD do alvo, mas o golpe ainda causa pelo menos 1 ponto. Se os dados somarem 9 e a Resistência for 4, entram 5 de dano; se a RD for 12, o mínimo mantém 1. Isso demonstra redução numérica sem fixar uma RD específica."},
  acerto: {"formula":"se @USUARIO.acerto >= 6 entao subtrair 1d10 em @ALVO.vida","explicacao":"Uma técnica de precisão libera um dado de dano extra quando o bônus de Acerto personalizado chega a +6. Com +5, o efeito não ocorre; com +6 ou +8, aplica 1d10. Ataques normais continuam usando os cálculos próprios de cada tipo de arma."},
  desloc: {"formula":"somar @USUARIO.desloc em @USUARIO.movimento_restante","explicacao":"No início de uma investida, esta linha repõe no orçamento de movimento os metros do deslocamento base. Se a criatura se desloca 9 m, acrescenta 9 m disponíveis; uma ficha com 6 m acrescenta 6. O exemplo usa o deslocamento como quantidade, sem embutir uma velocidade fixa."},
  defesa_cac: {"formula":"se @ALVO.defesa_cac <= 14 entao subtrair 1d10 em @ALVO.vida","explicacao":"Um golpe corpo a corpo especial encontra uma abertura quando a defesa CaC do alvo é 14 ou menos. Um defensor com 14 recebe 1d10; com 15, evita esse efeito. A chave separa a proteção contra golpes próximos da defesa geral."},
  defesa_dist: {"formula":"se @ALVO.defesa_dist <= 13 entao subtrair 2d6 em @ALVO.vida","explicacao":"Um disparo de cobertura atinge alvos cuja defesa contra ataques à distância seja 13 ou menor. Se a defesa à distância for 13, aplica 2d6; com 14, não passa pela condição. Esta leitura permite que uma habilidade interaja especificamente com proteção contra projéteis."},
  iniciativa: {"formula":"subtrair 1d6 + @USUARIO.iniciativa em @ALVO.vida","explicacao":"Em uma regra caseira de emboscada, a vantagem de agir primeiro aumenta o dano de abertura. Com Iniciativa +3 e um d6 que resulta 4, o ataque causa 7. A chave oferece o valor configurado de iniciativa para efeitos que queiram escalonar com rapidez ou prontidão."},
  atencao: {"formula":"se @USUARIO.atencao >= @ALVO.pericia_furtividade entao somar 2 em @USUARIO.acerto","explicacao":"Um vigia percebe o inimigo escondido quando sua Atenção passiva iguala ou supera a Furtividade dele. Com Atenção 15 contra Furtividade 14, revela a posição e recebe +2 de Acerto no primeiro contra-ataque; contra Furtividade 16, a condição falha."},
  ataques_no_turno: {"formula":"se @USUARIO.ataques_no_turno >= 2 entao subtrair 1d6 em @ALVO.vida","explicacao":"Uma técnica de sequência só habilita o golpe adicional se a ficha permite pelo menos dois ataques neste turno. Com limite 1, não há segundo golpe; com limite 2 ou 3, o efeito aplica 1d6 ao alvo. A chave consulta a capacidade total do turno."},
  ataques_restantes: {"formula":"se @USUARIO.ataques_restantes > 0 entao subtrair 1 em @USUARIO.ataques_restantes, subtrair 1d8 + @USUARIO.for em @ALVO.vida","explicacao":"Este ataque só ocorre enquanto houver uma ação de ataque disponível. Com 1 restante, consome essa ação e aplica 1d8 + Força; com 0, não consome nada. `acoes_restantes` é um alias aceito para a mesma contagem."},
  acao_bonus: {"formula":"se @USUARIO.acao_bonus > 0 entao subtrair 1 em @USUARIO.acao_bonus, somar 1d8 em @USUARIO.vida","explicacao":"Uma poção rápida usa uma Ação Bônus e cura 1d8 PV. Se ainda houver 1 ação bônus nesta rodada, ela é gasta e a cura acontece; se o valor for 0, o personagem precisa esperar outra oportunidade. O recurso pode controlar outras ações curtas, não só poções."},
  ado_max: {"formula":"definir @USUARIO.ado_max em @USUARIO.ado_restantes","explicacao":"No início da rodada, copia o máximo de ataques de oportunidade para a contagem disponível. Se o personagem tem máximo 2, começa a rodada com 2 oportunidades; com máximo 1, recebe 1. Assim, a reposição acompanha talentos que aumentam o limite."},
  ado_restantes: {"formula":"se @USUARIO.ado_restantes > 0 entao subtrair 1 em @USUARIO.ado_restantes, subtrair 1d8 em @ALVO.vida","explicacao":"Quando um inimigo deixa o alcance, a reação só pode atacar se ainda houver uma AdO restante. Com 2 disponíveis, o gatilho gasta uma e causa 1d8; com 0, não executa. A chave representa o saldo atual de oportunidades, não o máximo da ficha."},
  reacao_disponivel: {"formula":"se @USUARIO.reacao_disponivel > 0 entao subtrair 1 em @USUARIO.reacao_disponivel, somar 3 em @USUARIO.defesa","explicacao":"Ao ser declarado alvo de um ataque, o personagem pode gastar sua reação para ganhar +3 de Defesa contra a investida. Com a reação disponível, consome o marcador e ergue a guarda; sem reação, o bônus não entra. O gatilho e a duração são configurados no efeito que usa a fórmula."},
  movimento_restante: {"formula":"se @USUARIO.movimento_restante >= 3 entao subtrair 3 em @USUARIO.movimento_restante, somar 2 em @USUARIO.defesa","explicacao":"Um passo defensivo exige pelo menos 3 m de deslocamento restante. Se houver 5 m, gasta 3 e concede +2 de Defesa; com apenas 2 m, a manobra não pode ser usada. A leitura evita permitir movimento extra além do orçamento atual."},
  for: {"formula":"subtrair 1d8 + @USUARIO.for em @ALVO.vida","explicacao":"Exemplo de um golpe pesado com machado: a fórmula rola 1d8 e soma a Força de quem ataca. Se Força for 4 e o dado cair 6, o alvo perde 10 pontos de vida. A mesma chave pode alimentar qualquer efeito que escale com força física."},
  des: {"formula":"subtrair 1d6 + @USUARIO.des em @ALVO.vida","explicacao":"Use em um ataque ágil, como uma adaga arremessada: o dano combina 1d6 com a Destreza do personagem. Com Destreza 3 e resultado 5 no dado, são 8 pontos de dano. A fórmula consulta quem executa a ação, não o alvo."},
  con: {"formula":"somar @USUARIO.con * 2 em @USUARIO.vida_max","explicacao":"Uma passiva de vigor pode aumentar a Vida Máxima em 2 pontos por ponto de Constituição. Com Constituição 3, o bônus acrescenta 6 à capacidade máxima. Como o destino é vida_max, isso altera o limite da ficha, não cura automaticamente a vida atual."},
  int: {"formula":"subtrair 2d6 + @USUARIO.int em @ALVO.vida","explicacao":"Exemplo de um disparo arcano cuja potência depende de Inteligência: role 2d6 e some o atributo do conjurador. Com Inteligência 5 e dados totalizando 7, o efeito causa 12 de dano. Trocar o alvo ou o recurso não exige criar uma chave nova."},
  sab: {"formula":"se @USUARIO.sab >= 4 entao somar 2 em @USUARIO.pericia_percepcao","explicacao":"Uma bênção de vigilância concede +2 em Percepção somente a quem tem Sabedoria 4 ou maior. Com Sabedoria 3, nada acontece; com Sabedoria 4, aplica o bônus. A condição pode ser reaproveitada em efeitos diferentes que dependam do mesmo atributo."},
  pre: {"formula":"subtrair 1d6 + @USUARIO.pre em @ALVO.vida","explicacao":"Exemplo de uma técnica de pressão espiritual que converte Presença em impacto: role 1d6 e some o atributo de quem a ativa. Se Presença for 4 e o dado sair 3, são 7 pontos de dano. Em outra habilidade, a mesma chave pode escalar intimidação, proteção de aliados ou qualquer outro valor."},
  vida: {"formula":"quando @ALVO.vida <= 10 -> subtrair 2d8 em @ALVO.vida","explicacao":"Este gatilho observa a vida atual do alvo: ao chegar a 10 PV ou menos, dispara um golpe final de 2d8. Um alvo com 11 PV não satisfaz a condição; ao cair para 10, satisfaz. A comparação usa o valor atual, não o limite máximo."},
  vida_max: {"formula":"somar floor(@ALVO.vida_max * 0.2) em @ALVO.vida","explicacao":"Uma magia de recuperação restaura 20% da Vida Máxima do alvo, arredondando para baixo. Se o máximo for 37 PV, o cálculo dá 7 PV; com máximo 40, dá 8. A quantidade acompanha personagens de portes diferentes sem fixar uma cura única."},
  pe: {"formula":"subtrair 3 em @USUARIO.pe, subtrair 2d8 em @ALVO.vida","explicacao":"Exemplo de um raio que custa 3 pontos de energia e depois causa 2d8 de dano. A primeira instrução consome PE de quem conjura; a segunda reduz a vida do alvo. Use a leitura de pe para conferir recursos, criar custos condicionais ou calcular efeitos."},
  pe_max: {"formula":"somar ceil(@USUARIO.pe_max * 0.1) em @USUARIO.pe","explicacao":"Uma fonte de energia recupera 10% do PE máximo, arredondando para cima. Um personagem com máximo 23 recebe 3 PE; com máximo 30, recebe 3. O cálculo se adapta à capacidade do personagem, em vez de restaurar sempre o mesmo número."},
  vida_temp: {"formula":"somar 12 em @USUARIO.vida_temp","explicacao":"Uma barreira concede 12 pontos de vida temporários ao usuário. Esses pontos formam uma camada protetora consumida antes dos PV normais, então servem para escudos, bênçãos ou absorção temporária sem alterar Vida Máxima."},
  vida_temp_max: {"formula":"somar @USUARIO.vida_temp_max - @USUARIO.vida_temp em @USUARIO.vida_temp","explicacao":"Use para preencher exatamente a diferença entre os pontos temporários atuais e o teto configurado. Se o máximo for 15 e restarem 6, a fórmula acrescenta 9; se já houver 15, acrescenta zero. Isso permite criar uma ação de recomposição sem ultrapassar o limite."},
  vida_temp_pct: {"formula":"se @USUARIO.vida_temp_pct < 0.25 entao somar 8 em @USUARIO.vida_temp","explicacao":"Uma armadura reativa concede 8 pontos temporários quando a proteção atual está abaixo de 25% do máximo. Se o máximo for 20 e restarem 4, o percentual é 20% e o escudo ativa; com 5 restantes, fica em 25% e a condição não ativa."},
  vida_total: {"formula":"se @USUARIO.vida_total <= 15 entao somar 1d8 em @USUARIO.vida","explicacao":"A vida total soma PV atuais e pontos temporários. Com 11 PV e 3 temporários, o total é 14 e a cura de emergência de 1d8 é liberada; com 13 PV e 3 temporários, totaliza 16 e não dispara. Use quando a regra deve considerar a proteção inteira do personagem."},
  vida_pct: {"formula":"se @ALVO.vida_pct <= 0.25 entao subtrair 2d6 em @ALVO.vida","explicacao":"Uma execução causa 2d6 adicionais apenas quando o alvo está com 25% ou menos da própria Vida Máxima. Um alvo de máximo 40 precisa estar com até 10 PV; alguém de máximo 80 precisa estar com até 20. Assim, o limite acompanha cada ficha."},
  pe_pct: {"formula":"se @USUARIO.pe_pct < 0.2 entao somar 2 em @USUARIO.pe","explicacao":"Uma técnica de foco recupera 2 PE quando o usuário está abaixo de 20% da energia máxima. Com máximo 30, 5 PE representam cerca de 16,7% e ativam a recuperação; 6 PE representam exatamente 20% e não passam pelo sinal de menor estrito. O alias energia_pct usa a mesma chave."},
  pe_temp: {"formula":"se @USUARIO.pe_temp >= 2 entao subtrair 2 em @USUARIO.pe_temp, subtrair 2d6 em @ALVO.vida","explicacao":"Este disparo gasta 2 PE temporários antes de causar 2d6 de dano. Com 2 ou mais pontos temporários, a técnica pode ser paga por essa camada; com apenas 1, a condição falha. O PE temporário é consultado separadamente do PE normal."},
  pe_faltante: {"formula":"somar min(@USUARIO.pe_faltante, 4) em @USUARIO.pe","explicacao":"Uma bateria restaura até 4 PE, limitada pelo espaço que ainda falta até o máximo. Se faltarem 2, recupera 2; se faltarem 9, recupera 4. O min evita que a fórmula ultrapasse o limite de energia."},
  pe_faltante_pct: {"formula":"se @USUARIO.pe_faltante_pct >= 0.5 entao somar 1d6 em @USUARIO.pe","explicacao":"Uma recarga de emergência fica disponível quando falta pelo menos metade da energia máxima. Com máximo 24 e 12 PE atuais, faltam 12 (50%) e a ação ativa; com 13 PE atuais, faltam 11 (aprox. 45,8%) e não ativa."},
  sorte: {"formula":"se @USUARIO.sorte > 0 entao subtrair 1 em @USUARIO.sorte, subtrair 1d10 em @ALVO.vida","explicacao":"O personagem pode gastar uma utilização de Sorte para fortalecer um ataque com 1d10 extra. A ação só segue se ainda houver pelo menos um uso; com zero, não consome recurso nem aplica o dano. Assim, a mesma chave serve para limitar qualquer efeito por usos restantes."},
  sorte_max: {"formula":"somar @USUARIO.sorte_max - @USUARIO.sorte em @USUARIO.sorte","explicacao":"No começo do dia, esta fórmula restaura os usos gastos até o limite diário. Se o máximo for 3 e restar 1, devolve 2; se já houver 3, devolve zero. O exemplo lê o máximo e altera o estoque atual, sem codificar um limite fixo."},
  dado_vida: {"formula":"se @USUARIO.dado_vida > 0 entao subtrair 1 em @USUARIO.dado_vida, somar 1d8 + @USUARIO.con em @USUARIO.vida","explicacao":"Durante um descanso curto, o personagem gasta um Dado de Vida e recupera 1d8 + Constituição. Com Constituição 2 e resultado 5, recupera 7 PV; sem dados disponíveis, a condição impede o gasto e a cura."},
  dado_vida_max: {"formula":"somar @USUARIO.dado_vida_max - @USUARIO.dado_vida em @USUARIO.dado_vida","explicacao":"Uma recuperação completa devolve os Dados de Vida gastos até o total máximo. Se o personagem tem 7 dados no limite e conserva 3, a fórmula recupera 4; se já tem os 7, não altera nada. O máximo pode acompanhar o nível sem um número fixo na regra."},
  reserva_pe: {"formula":"se @USUARIO.reserva_pe >= 3 entao subtrair 3 em @USUARIO.reserva_pe, somar 3 em @USUARIO.pe","explicacao":"O personagem converte 3 pontos guardados na reserva em PE utilizável. A regra exige saldo suficiente; com 2 na reserva, não executa, e com 5, transfere 3 e deixa 2 armazenados. Use quando uma habilidade transforma energia poupada em energia imediata."},
  reserva_pe_disponivel: {"formula":"se @USUARIO.reserva_pe_disponivel > 0 entao subtrair 1 em @USUARIO.reserva_pe, somar 1 em @USUARIO.pe","explicacao":"Esta chave funciona como uma verificação simples: vale 1 quando existe energia armazenada e 0 quando a reserva está vazia. O exemplo libera uma conversão de 1 PE somente no primeiro caso; com 4 na reserva, usa 1 e deixa 3."},
  reserva_pe_recuperavel: {"formula":"subtrair @USUARIO.reserva_pe_recuperavel em @USUARIO.reserva_pe, somar @USUARIO.reserva_pe_recuperavel em @USUARIO.pe","explicacao":"Transfere para o PE atual exatamente a parcela da reserva que cabe antes de atingir o máximo. Se há 8 na reserva, mas só cabem 3 PE, transfere 3 e preserva 5; se cabem todos os 8, transfere os 8. Isso evita exceder a capacidade."},
  exaustao: {"formula":"se @USUARIO.exaustao >= 3 entao subtrair 2 em @USUARIO.pericia_atletismo","explicacao":"Uma regra de marcha impõe -2 em Atletismo a partir do terceiro nível de Exaustão. Com nível 2, a penalidade não se aplica; com nível 3 ou 4, aplica. O alias exaustao_nivel consulta o mesmo estado, permitindo reaproveitar a checagem."},
  fome: {"formula":"se @USUARIO.fome >= 18 entao subtrair 2 em @USUARIO.pericia_sobrevivencia","explicacao":"Nesta regra, 18 ou mais pontos na escala de Fome indicam privação suficiente para impor -2 em Sobrevivência. Com 17, o personagem ainda não cruza o limite; com 18, a penalidade entra. O mesmo valor pode orientar outras regras de descanso ou consumo."},
  treino: {"formula":"subtrair 1d8 + @USUARIO.treino em @ALVO.vida","explicacao":"Um golpe de classe treinada soma o Bônus de Treinamento ao dado de dano. Se o treino vale 3 e o d8 mostra 6, o alvo recebe 9 de dano. A fórmula cresce conforme a progressão do personagem sem exigir uma versão diferente da habilidade por nível."},
  nivel: {"formula":"somar floor(@USUARIO.nivel / 2) em @USUARIO.pe_max","explicacao":"Uma característica de progressão aumenta o PE máximo em metade do nível, arredondada para baixo. No nível 7, acrescenta 3 ao limite; no nível 8, acrescenta 4. Como consulta o nível atual, a mesma regra acompanha o avanço do personagem."},
  ado_concedida: {
    formula: 'se @USUARIO.ado_concedida > 0 entao subtrair 1d8 + @USUARIO.forca em @ALVO.vida',
    explicacao: 'Quando o Mestre concede um ataque de oportunidade, a condição fica verdadeira e o comando causa 1d8 + Força de dano ao alvo. Sem a concessão, não executa o ataque.',
  },
  ado_consumida: {
    formula: 'se @USUARIO.ado_concedida > 0 e @USUARIO.ado_consumida = 0 entao subtrair 1d8 + @USUARIO.forca em @ALVO.vida',
    explicacao: 'Confere duas coisas antes de atacar: a AdO foi concedida e ainda não foi consumida. A conjunção “e” exige que as duas condições sejam verdadeiras.',
  },
  reacoes_restantes: {
    formula: 'se @USUARIO.reacoes_restantes > 0 entao subtrair 1d8 + @USUARIO.forca em @ALVO.vida',
    explicacao: 'Só executa o ataque se ainda houver pelo menos uma reação disponível. A quantidade pode ser maior que 1 quando a ficha ou uma habilidade concede reações extras.',
  },
  'CENA.distancia_m': {
    formula: 'quando @CENA.distancia_m <= 1.5 -> subtrair 1d8 em @ALVO.vida',
    explicacao: 'Cria um gatilho de distância: quando usuário e alvo ficam a 1,5 m ou menos, aplica 1d8 de dano. A medida está em metros.',
  },
  'DANO.foi_critico': {
    formula: 'se @DANO.foi_critico > 0 entao subtrair 2d6 em @ALVO.vida',
    explicacao: 'Durante a resolução de dano, verifica a marca de crítico do ataque. Se ela valer 1, acrescenta 2d6 de dano; caso contrário, não aplica esse efeito extra.',
  },
  vida_pct_abaixo_25: {
    formula: 'se @ALVO.vida_pct_abaixo_25 > 0 entao subtrair 2d8 em @ALVO.vida',
    explicacao: 'A key vale 1 quando a vida do alvo está em 25% ou menos. Nesse caso, o golpe recebe um efeito adicional de 2d8.',
  },
  qtd_inimigos_adjacentes: {
    formula: 'subtrair @USUARIO.qtd_inimigos_adjacentes * 6 em @ALVO.vida',
    explicacao: 'Causa 6 pontos de dano por inimigo adjacente ao usuário. Com 3 inimigos adjacentes, o resultado é 18 de dano.',
  },
  'tem_condicao_<id>': {
    formula: 'se @ALVO.tem_condicao_atordoado > 0 entao subtrair 2d6 em @ALVO.vida',
    explicacao: 'Troca <id> pelo identificador da condição. Aqui, testa se o alvo está Atordoado; se estiver, aplica 2d6 de dano adicional.',
  },
};

function KeyCard({ chave, onInsert, onSelecionarRecurso, extrairChaveRecurso }: {
  chave: ChaveGuia;
  onInsert: (formula: string) => void;
  onSelecionarRecurso?: (key: string) => void;
  extrairChaveRecurso: (key: string) => string | null;
}) {
  const escopos = escoposDaChaveGuia(chave);
  const escopoExemplo = escopos[0];
  const referenciaExemplo = referenciaDaChaveGuia(chave, escopoExemplo);
  const exemplo = EXEMPLOS_CONTEXTUAIS_CHAVES[chave.id];
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
      {exemplo && (
        <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">Exemplo prático</div>
          <button type="button" onClick={() => onInsert(exemplo.formula)} className="mt-1 block w-full break-words rounded bg-background/70 px-2 py-1.5 text-left font-mono text-xs leading-relaxed text-foreground hover:bg-primary/10">{exemplo.formula}</button>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{exemplo.explicacao}</p>
        </div>
      )}
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
    <article className="rounded-lg border border-border bg-background/70 p-3 shadow-sm">
      <h3 className="text-sm font-semibold leading-relaxed text-foreground">{titulo}</h3>
      <button
        type="button"
        onClick={() => onInsert?.(formula)}
        disabled={!onInsert}
        title={onInsert ? 'Clique para inserir/copiar o exemplo' : ''}
        className="mt-2 block w-full break-words rounded-md border border-primary/20 bg-muted/70 px-3 py-2 text-left font-mono text-sm leading-relaxed text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors disabled:cursor-default"
      >
        {formula}
      </button>
      <div className="mt-3 border-t border-border pt-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como funciona</div>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{explicacao}</p>
      </div>
    </article>
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
        Usa as chaves publicadas no catálogo oficial do OMNI.
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

