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
  "pode_ser_curado": {"formula":"se @ALVO.pode_ser_curado > 0 entao somar 2d8 em @ALVO.vida","explicacao":"Uma magia de socorro restaura 2d8 PV apenas se o alvo estiver abaixo da Vida Máxima e não estiver morto nem Morrendo. Um personagem com 18/30 PV pode ser curado; com 30/30 ou em estado incompatível, não."},
  "vida_faltante": {"formula":"somar @ALVO.vida_faltante em @ALVO.vida","explicacao":"Uma fonte de cura completa restaura exatamente o que falta até o máximo. Se o alvo tem 27 de 40 PV, acrescenta 13; com 9 de 40, acrescenta 31. O motor limita a cura ao teto da ficha."},
  "vida_faltante_pct": {"formula":"se @ALVO.vida_faltante_pct >= 75 entao somar 2d8 em @ALVO.vida","explicacao":"Uma poção de emergência fica reservada para quem perdeu pelo menos 75% da Vida Máxima. Em uma ficha com 40 PV máximos, 10 PV atuais significam 75% faltante e liberam 2d8; com 11 PV, o percentual faltante é menor."},
  "cura_recebida": {"formula":"se @ALVO.cura_recebida >= 12 entao somar 1 em @USUARIO.sorte","explicacao":"Uma bênção responde a uma cura recente de 12 ou mais PV e concede 1 uso de Sorte a quem a lançou. Uma cura de 11 não atinge o limiar; 12 ou mais ativa o efeito. A chave registra a última cura recebida, não a soma do turno."},
  "cura_recebida_nesta_rodada": {"formula":"se @ALVO.cura_recebida_nesta_rodada >= 20 entao somar 2 em @ALVO.defesa","explicacao":"Depois de receber ao menos 20 PV de cura na rodada, o paciente ganha +2 de Defesa pela estabilização mágica. Se recebeu 12 de cura e depois mais 8, a soma chega a 20 e ativa; 19 não. `cura_recebida_nesta_rodada` soma as curas do turno atual."},
  "ultimo_dano_recebido": {"formula":"subtrair floor(@USUARIO.ultimo_dano_recebido / 2) em @ALVO.vida","explicacao":"Um contra-ataque devolve metade do último dano sofrido, arredondada para baixo. Se o usuário recebeu 13 de dano, o atacante perde 6 PV; se recebeu 8, perde 4. Use o alvo como a criatura que causou o golpe."},
  "dano_recebido_nesta_rodada": {"formula":"se @USUARIO.dano_recebido_nesta_rodada >= 10 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma habilidade de retaliação desperta depois que o usuário sofreu pelo menos 10 de dano na rodada. Com 6 de um golpe e 4 de outro, o total chega a 10 e libera 1d8; com 9 acumulados, ainda não. `vida_perdida_nesta_rodada` é um alias aceito."},
  "acao_disponivel": {"formula":"se @USUARIO.acao_disponivel > 0 entao subtrair 1 em @USUARIO.ataques_restantes, subtrair 1d10 em @ALVO.vida","explicacao":"Um golpe pesado exige que o personagem ainda tenha uma ação comum nesta rodada. Com ação disponível, consome uma e causa 1d10; sem ação, não ataca. A contagem de ataques e a disponibilidade de ação são consultadas no momento da execução."},
  "bonus_acao_disponivel": {"formula":"se @USUARIO.bonus_acao_disponivel > 0 entao somar 1d8 em @USUARIO.vida","explicacao":"Uma poção rápida pode ser bebida se ainda houver Ação Bônus: a fórmula cura 1d8 PV. Se a ação bônus já foi gasta, não acontece; usar esse marcador evita consumir a ação comum em uma interação simples."},
  "movimento_disponivel": {"formula":"se @USUARIO.movimento_disponivel > 0 entao subtrair 1 em @USUARIO.movimento_restante","explicacao":"Um passo de reposicionamento só pode ser feito se ainda restar deslocamento neste turno. Com qualquer distância disponível, gasta 1 m; quando o orçamento chegou a zero, a ação não concede movimento extra."},
  "slots_descanso_curto": {"formula":"se @USUARIO.slots_descanso_curto > 0 entao subtrair 1 em @USUARIO.slots_descanso_curto, somar 1d8 + @USUARIO.con em @USUARIO.vida","explicacao":"Durante um descanso curto, gasta um Dado de Vida disponível e cura 1d8 mais Constituição. Com 2 dados restantes, usa um e deixa 1; com zero, não pode rolar outro dado. Este card representa o estoque atual de dados de vida."},
  "slots_descanso_curto_max": {"formula":"somar @USUARIO.slots_descanso_curto_max - @USUARIO.slots_descanso_curto em @USUARIO.slots_descanso_curto","explicacao":"Após um descanso longo, repõe os Dados de Vida gastos até o total máximo. Se o limite é 8 e restam 3, acrescenta 5; se já há 8, acrescenta zero. A chave acompanha o nível e o máximo da ficha."},
  "slots_descanso_curto_pct": {"formula":"se @USUARIO.slots_descanso_curto_pct <= 25 entao somar 1d8 em @USUARIO.vida","explicacao":"Uma característica de descanso recupera 1d8 PV quando restam 25% ou menos dos Dados de Vida. Com 8 dados máximos, dois restantes são 25% e ativam; três restantes são 37,5% e não. O valor percentual é expresso de 0 a 100."},
  "vigor_maldito_usos": {"formula":"se @USUARIO.vigor_maldito_usos > 0 entao subtrair 1 em @USUARIO.vigor_maldito_usos, somar 2d8 + @USUARIO.vigor_maldito_bonus em @USUARIO.vida","explicacao":"A cura de Vigor Maldito consome um uso e restaura 2d8 mais o bônus específico da habilidade. Com 1 uso, a ação é válida e o contador cai para 0; sem usos, não gasta nada nem cura."},
  "vigor_maldito_max": {"formula":"somar @USUARIO.vigor_maldito_max - @USUARIO.vigor_maldito_usos em @USUARIO.vigor_maldito_usos","explicacao":"No início do dia, restaura os usos gastos até a capacidade máxima de Vigor Maldito. Se o máximo é 4 e restam 2, recupera 2; se já tem 4, não altera o contador."},
  "vigor_maldito_disponivel": {"formula":"se @USUARIO.vigor_maldito_disponivel > 0 entao somar 2d8 + @USUARIO.vigor_maldito_bonus em @ALVO.vida","explicacao":"Uma cura de Vigor Maldito só é liberada se houver ao menos um uso restante. Com a chave em 1, o aliado recebe 2d8 mais o bônus da habilidade; com 0, não tenta curar. O custo do uso deve ser consumido pela ação configurada."},
  "hp_sacrificado": {"formula":"se @USUARIO.hp_sacrificado >= 10 entao subtrair 3d8 em @ALVO.vida","explicacao":"Um pacto libera uma explosão de 3d8 quando o personagem já sacrificou ao menos 10 PV em usos anteriores de Sacrifício pela Energia. Com 10 PV acumulados, o efeito é desbloqueado; com 9, não. O contador registra o total histórico, então esta fórmula usa esse investimento como requisito e não cobra os mesmos PV uma segunda vez."},
  "sacrificio_pct": {"formula":"se @USUARIO.sacrificio_pct >= 25 entao subtrair 3d8 em @ALVO.vida","explicacao":"Um pacto sombrio libera 3d8 de dano quando o sacrifício acumulado equivale a pelo menos 25% da Vida Máxima. Com máximo 40, 10 PV sacrificados atingem exatamente 25%; 9 ficam abaixo do limite. O percentual informado vai de 0 a 100."},
  "tem_vantagem": {"formula":"se @USUARIO.tem_vantagem > 0 entao subtrair 1d8 em @ALVO.vida","explicacao":"Um disparo aproveita um modificador de Vantagem ativo para acrescentar 1d8 ao dano. A chave vale 1 se existe ao menos um modificador; sem nenhum, o dano extra não entra. A rolagem com vantagem em si é resolvida pelo motor de ataque."},
  "tem_desvantagem": {"formula":"se @USUARIO.tem_desvantagem > 0 entao subtrair 1 em @USUARIO.sorte","explicacao":"Uma técnica de risco custa 1 uso de Sorte se o personagem tentar executá-la enquanto houver ao menos um modificador de Desvantagem ativo. Sem desvantagem, não há esse custo adicional. O marcador não substitui a rolagem com desvantagem feita pelo motor."},
  "qtd_vantagens": {"formula":"se @USUARIO.qtd_vantagens >= 2 entao somar 2 em @USUARIO.acerto","explicacao":"Uma mira preparada com dois ou mais modificadores de Vantagem concede +2 de Acerto adicional nesta regra. Um modificador não basta; dois ou mais ativam. A contagem permite criar escalonamento quando várias fontes diferentes favorecem o mesmo teste."},
  "qtd_desvantagens": {"formula":"se @USUARIO.qtd_desvantagens >= 2 entao subtrair 2 em @USUARIO.acerto","explicacao":"Se dois ou mais modificadores de Desvantagem atingem o ataque, a técnica aplica uma penalidade adicional de -2 de Acerto. Com apenas uma fonte, não acumula essa penalidade. Use a contagem para distinguir uma dificuldade isolada de várias condições simultâneas."},
  "vantagem_proximo_ataque": {"formula":"se @USUARIO.vantagem_proximo_ataque > 0 entao subtrair 1d8 em @ALVO.vida","explicacao":"O próximo ataque recebe 1d8 adicional quando ao menos um modificador de Vantagem está marcado especificamente para ataques. Uma vantagem válida apenas para perícias ou TRs não ativa este efeito."},
  "desvantagem_proximo_ataque": {"formula":"se @USUARIO.desvantagem_proximo_ataque > 0 entao subtrair 1d6 em @USUARIO.vida","explicacao":"Uma técnica instável causa 1d6 de dano ao próprio usuário se a próxima rolagem de ataque estiver marcada com Desvantagem. A penalidade aplicada a uma perícia ou TR não satisfaz esta chave específica de ataque."},
  "vantagem_proximo_tr": {"formula":"se @USUARIO.vantagem_proximo_tr > 0 entao somar 2 em @USUARIO.vontade","explicacao":"Antes de resistir a uma compulsão, a Vantagem marcada para o próximo TR concede +2 em Vontade nesta regra. Uma vantagem reservada para ataque não se aplica a este teste."},
  "desvantagem_proximo_tr": {"formula":"se @USUARIO.desvantagem_proximo_tr > 0 entao subtrair 2 em @USUARIO.fortitude","explicacao":"Uma toxina impõe -2 adicional em Fortitude se o próximo Teste de Resistência estiver marcado com Desvantagem. Se a desvantagem afeta outra rolagem, a condição não entra. O motor ainda resolve a rolagem com desvantagem."},
  "vantagem_proxima_pericia": {"formula":"se @USUARIO.vantagem_proxima_pericia > 0 entao somar 2 em @USUARIO.pericia_investigacao","explicacao":"Ao examinar uma cena, um modificador de Vantagem reservado para a próxima perícia concede +2 em Investigação. A vantagem precisa afetar uma perícia; um bônus para ataque não ativa esse exemplo."},
  "desvantagem_proxima_pericia": {"formula":"se @USUARIO.desvantagem_proxima_pericia > 0 entao subtrair 2 em @USUARIO.pericia_furtividade","explicacao":"Uma armadura barulhenta aplica -2 em Furtividade quando a próxima perícia está marcada com Desvantagem. Se a desvantagem é apenas para um ataque ou TR, a perícia de Furtividade não recebe a penalidade."},
  "cobertura_meia": {"formula":"se @ALVO.cobertura_meia > 0 entao somar 2 em @ALVO.defesa","explicacao":"Uma barricada baixa concede +2 de Defesa ao alvo atrás de meia cobertura. Sem esse nível de proteção, o bônus não se aplica; cobertura de três quartos usa a chave própria e concede o valor correspondente."},
  "cobertura_tres_quartos": {"formula":"se @ALVO.cobertura_tres_quartos > 0 entao somar 5 em @ALVO.defesa","explicacao":"Uma parede que protege três quartos do corpo concede +5 de Defesa ao alvo contra ataques diretos. Se houver apenas meia cobertura, esta chave fica em 0 e não soma os cinco pontos."},
  "cobertura_total": {"formula":"se @ALVO.cobertura_total = 0 entao subtrair 2d8 em @ALVO.vida","explicacao":"O disparo direto só atinge o alvo se ele não estiver protegido por cobertura total. Com marcador 0, aplica 2d8; com marcador 1, a fórmula bloqueia o dano direto. `imune_por_cobertura` é um alias aceito para esse marcador."},
  "bonus_defesa_cobertura": {"formula":"se @ALVO.bonus_defesa_cobertura < 999 entao somar @ALVO.bonus_defesa_cobertura em @ALVO.defesa","explicacao":"Aplica o bônus numérico de cobertura: 0 sem cobertura, +2 em meia e +5 em três quartos. O valor 999 representa cobertura total e é um marcador de imunidade; a condição impede somá-lo como se fossem 999 pontos normais de Defesa."},
  "arma_principal_alcance": {"formula":"se @CENA.distancia_m <= @USUARIO.arma_principal_alcance entao subtrair 1d8 em @ALVO.vida","explicacao":"Um golpe corpo a corpo só alcança o alvo se a distância da cena for menor ou igual ao alcance da arma principal. Uma arma com alcance 1,5 m atinge alguém adjacente; a 3 m, o ataque não passa nesta condição."},
  "arma_principal_alcance_curto": {"formula":"se @CENA.distancia_m <= @USUARIO.arma_principal_alcance_curto entao subtrair 1d6 em @ALVO.vida","explicacao":"Uma adaga arremessada causa 1d6 se o alvo estiver dentro do alcance curto configurado na arma. Se o alcance curto for 6 m, um alvo a 5 m satisfaz a regra; a 7 m, não."},
  "arma_principal_alcance_longo": {"formula":"se @CENA.distancia_m <= @USUARIO.arma_principal_alcance_longo entao subtrair 1d8 em @ALVO.vida","explicacao":"Um arco longo alcança a distância registrada como alcance longo. Com limite 24 m, o alvo a 23 m ainda pode ser atingido; a 25 m fica fora. Em conjunto com a chave de alcance curto, o Mestre pode distinguir tiros sem penalidade de tiros no limite."},
  "arma_margem_critico": {"formula":"se @USUARIO.arma_margem_critico <= 18 entao subtrair 2d8 em @ALVO.vida","explicacao":"Uma técnica de execução libera 2d8 extras para uma arma com margem crítica 18 ou melhor. Uma arma que critica em 18–20 ativa; outra que só critica em 20 não. O resultado do ataque continua sendo marcado como crítico pelo motor."},
  "arma_principal_crit_ampliado": {"formula":"se @USUARIO.arma_principal_crit_ampliado > 0 entao subtrair 2d10 em @ALVO.vida","explicacao":"Quando a arma principal tem crítico ampliado (margem menor que 20), o golpe crítico recebe 2d10 extras nesta regra. Uma arma com margem 19 ativa a propriedade; uma arma que só critica em 20 não. Combine com o resultado crítico registrado pelo ataque."},
  "reacoes_usadas": {"formula":"se @USUARIO.reacoes_usadas >= 2 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma técnica de contra-ataque causa 1d8 ao agressor se o personagem já gastou pelo menos duas reações nesta rodada, representando uma defesa treinada que se converte em golpe. Com zero ou uma reação usada, não dispara; com duas ou mais, o requisito é atendido. A fórmula consulta o contador e não subtrai uma terceira reação restante."},
  "saldo_total": {"formula":"se @USUARIO.saldo_total >= 1000 entao somar 2 em @USUARIO.pericia_persuasao","explicacao":"Um nobre que pode demonstrar pelo menos 1.000 moedas em todas as carteiras recebe +2 em Persuasão ao negociar com o conselho. Com saldo 950, não convence pela riqueza; com 1.000 ou mais, o bônus entra. A chave soma moedas de todas as carteiras."},
  "saldo_padrao": {"formula":"se @USUARIO.saldo_padrao >= 100 entao somar 1 em @USUARIO.sorte","explicacao":"A guilda concede um favor a quem mantém ao menos 100 unidades da moeda padrão. O personagem ganha 1 uso de Sorte com saldo 100; com 99, não. Este valor soma a moeda padrão de todas as carteiras, inclusive compartilhadas."},
  "saldo_pessoal": {"formula":"se @USUARIO.saldo_pessoal >= 50 entao somar 1d8 em @USUARIO.vida_temp","explicacao":"Uma reserva de emergência na carteira pessoal compra um talismã que concede 1d8 PV temporários quando há pelo menos 50 moedas próprias. O saldo do grupo não conta: somente a carteira pessoal pode ativar esta compra."},
  "carteiras_qtd": {"formula":"se @USUARIO.carteiras_qtd >= 3 entao somar 2 em @USUARIO.acerto","explicacao":"Um personagem que participa de três ou mais carteiras tem acesso a suprimentos em várias bases e recebe +2 de Acerto nesta regra de campanha. Com duas carteiras, não atinge o requisito; com três, ativa o benefício."},
  "carteiras_compartilhadas": {"formula":"se @USUARIO.carteiras_compartilhadas > 0 entao somar 1d6 em @USUARIO.pe","explicacao":"Uma carteira compartilhada com a companhia permite recuperar 1d6 PE ao requisitar energia do fundo comum. Se não houver carteira compartilhada, o recurso não é liberado. Carteiras exclusivamente pessoais não contam para esta checagem."},
  "tem_carteira_pessoal": {"formula":"se @USUARIO.tem_carteira_pessoal > 0 entao somar 1 em @USUARIO.sorte","explicacao":"Uma vantagem de contrato exige uma carteira pessoal ativa e concede 1 uso de Sorte ao proprietário. O marcador 1 confirma que a carteira existe; com 0, o benefício não está disponível. Isso separa posse de carteira de seu saldo atual."},
  "saldo_<moeda>": {"formula":"se @USUARIO.saldo_yen >= 500 entao somar 2d8 em @ALVO.vida","explicacao":"Troque `<moeda>` pelo identificador real; neste caso, `yen`. Uma clínica aceita 500 ienes para aplicar um tratamento que restaura 2d8 PV. Abaixo de 500, a fórmula não libera o tratamento; a moeda padrão da ficha pode ser outra."},
  "tem_moeda_<moeda>": {"formula":"se @USUARIO.tem_moeda_yen > 0 entao somar 1 em @USUARIO.pe","explicacao":"Substitua `<moeda>` pela moeda a verificar. Com `yen`, a chave vale 1 se o personagem possui qualquer saldo positivo em ienes, mesmo que seja pouco; então recebe 1 PE de um selo comprado. Saldo zero não ativa a regra."},
  "CENA.hora": {"formula":"se @CENA.hora >= 22 entao subtrair 1d8 em @ALVO.vida","explicacao":"Um guarda aplica a punição de toque de recolher a partir das 22h: qualquer intruso que ainda estiver na rua recebe 1d8 de dano nesta regra. Às 21h não ocorre. A hora usa a escala de 0 a 23 do relógio da cena."},
  "CENA.minuto": {"formula":"se @CENA.minuto >= 30 entao somar 1 em @USUARIO.pe","explicacao":"Uma ampulheta libera 1 PE depois que o minuto atual chega a 30. Às 14:29, o marco ainda não foi alcançado; às 14:30, a fórmula passa a satisfazê-lo. Use o minuto (0–59) para eventos dentro da hora."},
  "CENA.segundo": {"formula":"se @CENA.segundo = 0 entao somar 1 em @USUARIO.reserva_pe","explicacao":"Um mecanismo de relógio armazena 1 PE sempre que o evento é avaliado no começo exato do segundo, quando o campo vale 0. Nos segundos 1 a 59, não acumula. Combine com um gatilho de avanço do relógio para evitar repetir dentro do mesmo instante."},
  "CENA.dia": {"formula":"se @CENA.dia = 15 entao somar 1d8 em @USUARIO.vida","explicacao":"No dia 15 de cada mês in-game, um santuário cura 1d8 PV dos personagens que descansarem ali. No dia 14 ou 16, o evento não se aplica. O campo é o dia do mês, então a regra se repete em cada mês."},
  "CENA.mes": {"formula":"se @CENA.mes = 12 entao subtrair 2 em @USUARIO.movimento_restante","explicacao":"Durante o mês 12, uma nevasca reduz em 2 m o movimento restante na região. Em outros meses, essa penalidade sazonal não entra. O mês é numérico (1–12), permitindo adaptar clima e calendário da campanha."},
  "CENA.ano": {"formula":"se @CENA.ano >= 1000 entao somar 2 em @USUARIO.pe_max","explicacao":"Uma relíquia desperta no milésimo ano da cronologia e aumenta o PE máximo em 2. No ano 999 continua inativa; no ano 1000 e nos seguintes, aplica-se. O valor pertence ao calendário do jogo, não ao ano do computador."},
  "CENA.eh_dia": {"formula":"se @CENA.eh_dia > 0 entao somar 2 em @USUARIO.pericia_percepcao","explicacao":"Uma patrulha recebe +2 em Percepção durante o período diurno, definido pelo relógio como 07h–18h. Às 10h ativa; de madrugada não. O marcador booleano poupa repetir a faixa de horas na fórmula."},
  "CENA.eh_noite": {"formula":"se @CENA.eh_noite > 0 entao somar 2 em @USUARIO.pericia_furtividade","explicacao":"Uma capa de sombras dá +2 em Furtividade durante a noite, entre 20h e 05h conforme o relógio do jogo. Às 22h o marcador vale 1; no meio da tarde vale 0. A regra acompanha a faixa definida pelo sistema."},
  "CENA.eh_amanhecer": {"formula":"se @CENA.eh_amanhecer > 0 entao somar 1d8 em @USUARIO.vida","explicacao":"Uma bênção de alvorada recupera 1d8 PV quando o relógio marca amanhecer, entre 05h e 07h. Às 06h ativa; às 08h já não. Use o marcador para efeitos limitados à transição da noite para o dia."},
  "CENA.eh_anoitecer": {"formula":"se @CENA.eh_anoitecer > 0 entao somar 1d6 em @USUARIO.vida_temp","explicacao":"Quando começa o anoitecer, entre 18h e 20h, o personagem recebe 1d6 PV temporários da aura crepuscular. Às 19h ativa; às 21h não. A condição permite criar efeitos de passagem de período sem fixar uma hora própria."},
  "CENA.relogio_ativo": {"formula":"se @CENA.relogio_ativo > 0 entao subtrair 1 em @USUARIO.pe","explicacao":"Manter uma barreira temporal ativa drena 1 PE em cada pulso enquanto o relógio do jogo está rodando. Durante uma pausa do Mestre, a condição não cobra energia. Vincule a linha ao pulso de tempo configurado para a barreira, de modo que a drenagem não se repita em cada ação."},
  "CENA.multiplicador_tempo": {"formula":"somar ceil(10 * @CENA.multiplicador_tempo) em @USUARIO.reserva_pe","explicacao":"Um ritual acumula energia proporcional à velocidade do relógio: com multiplicador 1, acrescenta 10 à reserva; em velocidade 2, acrescenta 20. `ceil` arredonda para cima caso o ritmo produza uma fração."},
  "CENA.timestamp_segundos": {"formula":"se @CENA.timestamp_segundos >= 43200 entao somar 1 em @USUARIO.sorte","explicacao":"Uma bênção diária fica disponível depois de 43.200 segundos desde meia-noite, isto é, ao meio-dia. Antes desse instante, não concede Sorte; ao atingir 12:00, concede 1 uso. O timestamp permite comparar períodos longos em uma unidade única."},
  "CENA.eventos_hoje": {"formula":"se @CENA.eventos_hoje >= 2 entao somar 1d8 em @USUARIO.vida","explicacao":"Em um festival com dois ou mais eventos no calendário de hoje, os participantes recuperam 1d8 PV pela animação da cidade. Um dia com zero ou um evento não satisfaz o requisito. A chave conta eventos agendados para a data atual."},
  "qtd_itens_inventario": {"formula":"se @USUARIO.qtd_itens_inventario > 20 entao subtrair 3 em @USUARIO.movimento_restante","explicacao":"Carregar mais de 20 itens aplica uma penalidade de 3 m ao movimento restante nesta regra de sobrecarga narrativa. Com exatamente 20 itens não penaliza; ao chegar a 21, o peso extra começa a atrapalhar."},
  "qtd_itens_equipados": {"formula":"se @USUARIO.qtd_itens_equipados >= 5 entao subtrair 1 em @USUARIO.defesa","explicacao":"Uma armadura improvisada fica desajeitada se cinco ou mais itens ocupam slots ao mesmo tempo e impõe -1 de Defesa. Com quatro itens equipados, não há penalidade. A chave conta equipamentos ativos, não tudo que está guardado na mochila."},
  "tem_item_<id>": {"formula":"se @USUARIO.tem_item_pocao_de_cura > 0 entao somar 2d8 em @USUARIO.vida","explicacao":"Troque `<id>` pelo identificador exato do item; aqui, `pocao_de_cura`. Se a poção está no inventário, a fórmula restaura 2d8 PV; se foi consumida, vendida ou não existe, o efeito não é liberado."},
  "equipado_<id>": {"formula":"se @USUARIO.equipado_cota_de_malha > 0 entao somar 4 em @USUARIO.defesa","explicacao":"Substitua `<id>` pelo identificador do equipamento; `cota_de_malha` é o exemplo. Enquanto a cota estiver equipada, concede +4 de Defesa; se estiver apenas guardada no inventário, não ativa o bônus."},
  "esta_no_mapa": {"formula":"se @USUARIO.esta_no_mapa > 0 entao somar 2 em @USUARIO.acerto","explicacao":"Um disparo coordenado recebe +2 de Acerto apenas se o personagem possui um token na cena ativa. Sem peça no mapa, a posição não é conhecida e o bônus de mira não pode ser aplicado."},
  "CENA.token_x": {"formula":"se @CENA.token_x >= 12 entao somar 2 em @USUARIO.defesa","explicacao":"Uma runa protege a faixa leste do mapa: quando a coordenada X do token chega a 12 m ou mais, concede +2 de Defesa. Em X=11,5 m ainda não ativa. As coordenadas estão em metros, não em número de casas."},
  "CENA.token_y": {"formula":"se @CENA.token_y <= 3 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma fileira de espinhos cobre a borda sul, até Y=3 m. Um token em Y=2 sofre 1d8 quando a regra da armadilha dispara; em Y=4 está fora da faixa. A chave representa a coordenada vertical do mapa."},
  "CENA.qtd_tokens": {"formula":"se @CENA.qtd_tokens >= 8 entao somar 2 em @USUARIO.defesa","explicacao":"Uma formação defensiva concede +2 de Defesa quando há oito ou mais tokens visíveis na cena. Com sete criaturas, o grupo ainda não fecha o círculo; ao chegar a oito, a proteção coletiva ativa."},
  "CENA.qtd_aliados": {"formula":"se @CENA.qtd_aliados >= 3 entao somar 1d8 em @ALVO.vida","explicacao":"Uma cura em cadeia salta para um aliado quando a cena tem pelo menos três tokens de PLAYER. Com dois aliados em campo não ativa; com três ou mais, restaura 1d8 no alvo escolhido."},
  "CENA.qtd_inimigos": {"formula":"subtrair @CENA.qtd_inimigos * 2 em @ALVO.vida","explicacao":"Uma onda de choque causa 2 pontos por inimigo presente na cena. Com quatro tokens INIMIGO, cada alvo afetado recebe 8 de dano; com um, recebe 2. O total conta tokens de inimigos visíveis, não aliados próximos."},
  "qtd_aliados_adjacentes": {"formula":"se @USUARIO.qtd_aliados_adjacentes >= 2 entao somar 2 em @USUARIO.defesa","explicacao":"Uma guarda em formação concede +2 de Defesa quando pelo menos dois aliados estão adjacentes, a até 1,5 m. Um aliado ao lado não basta; dois ou mais fecham a linha defensiva."},
  "qtd_aliados_proximos": {"formula":"somar @USUARIO.qtd_aliados_proximos em @USUARIO.vida_temp","explicacao":"Um estandarte concede 1 PV temporário por aliado a até 6 m. Com três aliados próximos, acrescenta 3; se ninguém estiver no raio, acrescenta 0. O alcance é maior que adjacência e favorece formações compactas."},
  "qtd_inimigos_proximos": {"formula":"se @USUARIO.qtd_inimigos_proximos >= 4 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma explosão de cerco se fortalece quando quatro ou mais inimigos estão dentro de 6 m do usuário. Com três, aplica o dano normal; com quatro, acrescenta 1d8. Essa contagem mede proximidade, mesmo que os inimigos não estejam adjacentes."},
  "aliado_adjacente": {"formula":"se @USUARIO.aliado_adjacente > 0 entao somar 1d8 em @ALVO.vida","explicacao":"Uma técnica de transferência só pode curar um aliado quando pelo menos um companheiro está a até 1,5 m. Se não houver nenhum aliado adjacente, a ação não encontra um receptor próximo para os 1d8."},
  "inimigo_adjacente": {"formula":"se @USUARIO.inimigo_adjacente > 0 entao somar 2 em @USUARIO.defesa","explicacao":"Uma guarda de duelo concede +2 de Defesa quando há ao menos um inimigo adjacente, a até 1,5 m. Sem inimigo próximo, o personagem não está em combate corpo a corpo e não recebe o bônus."},
  "flanqueado": {"formula":"se @ALVO.flanqueado > 0 entao subtrair 2d6 em @ALVO.vida","explicacao":"Dois ou mais inimigos adjacentes flanqueiam o alvo e abrem espaço para 2d6 de dano adicional. Um único oponente adjacente não basta. A chave resume a condição espacial que outra regra normalmente exigiria contar manualmente."},
  "sozinho": {"formula":"se @USUARIO.sozinho > 0 entao somar 2 em @USUARIO.defesa","explicacao":"Um talento de lobo solitário concede +2 de Defesa se não houver nenhum aliado a até 6 m. Com um aliado dentro do raio, a chave vale 0; a distância é maior que adjacência e pode incluir companheiros que não estejam ao lado."},
  "na_linha_de_frente": {"formula":"se @USUARIO.na_linha_de_frente > 0 entao subtrair 1d8 + @USUARIO.for em @ALVO.vida","explicacao":"O combatente na linha de frente ganha um golpe de pressão quando pelo menos um inimigo está adjacente. Se não há inimigos a 1,5 m, a técnica não é liberada; quando há, causa 1d8 mais Força ao alvo escolhido."},
  "vida_pct_abaixo_50": {"formula":"se @ALVO.vida_pct_abaixo_50 > 0 entao somar 2d8 em @ALVO.vida","explicacao":"Um curandeiro usa esta checagem para priorizar aliados feridos: se o alvo está com metade ou menos da Vida Máxima, recupera 2d8 PV. Com máximo 40, 20 PV ou menos ativa; com 21, não. `bloodied` é um alias para a mesma chave."},
  "pe_pct_abaixo_50": {"formula":"se @USUARIO.pe_pct_abaixo_50 > 0 entao somar 1d8 em @USUARIO.pe","explicacao":"Uma técnica de respiração recupera 1d8 PE quando o usuário está com metade ou menos de sua energia máxima. Com máximo 30, 15 PE ativa a recuperação; 16 PE não. Assim, o limite acompanha a capacidade de cada ficha."},
  "pe_pct_abaixo_25": {"formula":"se @USUARIO.pe_pct_abaixo_25 > 0 entao somar 2d6 em @USUARIO.pe","explicacao":"Uma reserva de emergência se libera quando resta no máximo um quarto do PE máximo. Se o limite é 24, a chave ativa com 6 PE ou menos; com 7, não. A habilidade pode recuperar 2d6 sem usar um limite absoluto igual para todos."},
  "desarmado": {"formula":"se @USUARIO.desarmado > 0 entao subtrair 1d6 + @USUARIO.for em @ALVO.vida","explicacao":"Se o personagem está sem arma equipada, um golpe desarmado causa 1d6 mais Força. Com Força 3 e o dado mostrando 4, o dano é 7; ao equipar uma arma, a condição deixa de liberar este ataque de punho."},
  "duas_maos": {"formula":"se @USUARIO.duas_maos > 0 entao subtrair 1d12 + @USUARIO.for em @ALVO.vida","explicacao":"Uma arma pesada empunhada com as duas mãos causa 1d12 mais Força. Com Força 4 e resultado 7, causa 11; a fórmula só usa esse dado quando a mesma arma está nas mãos principal e secundária."},
  "duas_armas": {"formula":"se @USUARIO.duas_armas > 0 entao somar 2 em @USUARIO.defesa","explicacao":"O estilo de duas armas concede +2 de Defesa enquanto o personagem realmente estiver com uma arma em cada mão. Com uma arma só, a condição vale 0 e não dá bônus. `dual_wield` é um alias aceito para essa chave."},
  "arma_principal_corpo_a_corpo": {"formula":"se @USUARIO.arma_principal_corpo_a_corpo > 0 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma técnica de corte só adiciona 1d8 se a arma principal for corpo a corpo. Espada ou machado satisfazem o filtro; arco principal não. `arma_principal_eh_cac` é um alias da mesma propriedade."},
  "arma_principal_a_distancia": {"formula":"se @USUARIO.arma_principal_a_distancia > 0 entao subtrair 2d6 em @ALVO.vida","explicacao":"Um talento de atirador acrescenta 2d6 quando a arma principal é de ataque à distância. Com arco equipado como principal, ativa; com espada principal, não. `arma_principal_eh_distancia` consulta o mesmo estado."},
  "arma_principal_leve": {"formula":"se @USUARIO.arma_principal_leve > 0 entao somar 1 em @USUARIO.ataques_restantes","explicacao":"Uma lâmina leve permite uma sequência rápida: se a arma principal tem a propriedade Leve, o usuário recebe um ataque adicional. Uma arma sem essa propriedade não aumenta a contagem. O exemplo verifica a propriedade da arma, não o seu nome."},
  "arma_principal_versatil": {"formula":"se @USUARIO.arma_principal_versatil > 0 entao subtrair 1d10 + @USUARIO.for em @ALVO.vida","explicacao":"Uma arma Versátil, como uma espada longa neste exemplo, pode ser usada com as duas mãos para causar 1d10 mais Força. Se a arma principal não tem a propriedade Versátil, esta fórmula não libera o modo de dano maior."},
  "arma_principal_fineza": {"formula":"se @USUARIO.arma_principal_fineza > 0 entao subtrair 1d6 + @USUARIO.des em @ALVO.vida","explicacao":"Uma adaga com Fineza pode usar Destreza no ataque, então o dano combina 1d6 com o atributo DES do usuário. Com Destreza 4 e dado 3, causa 7. Uma arma sem Fineza não usa este cálculo."},
  "arma_principal_pesada": {"formula":"se @USUARIO.arma_principal_pesada > 0 entao subtrair 2d8 em @ALVO.vida","explicacao":"Um talento de armas pesadas acrescenta 2d8 quando a arma principal tem a propriedade Pesada. Uma marreta pesada ativa o efeito; uma espada leve não. A chave permite separar o benefício pela propriedade registrada no item."},
  "escudo_id_equipado": {"formula":"se @USUARIO.escudo_id_equipado > 0 entao somar 3 em @USUARIO.defesa","explicacao":"Uma técnica de bloqueio concede +3 de Defesa enquanto a ficha informa um escudo equipado. Sem escudo, não há bônus. Apesar do nome técnico conter `id`, a chave documentada é um marcador 1/0 de equipamento."},
  "swaps_armas_neste_turno": {"formula":"se @USUARIO.swaps_armas_neste_turno >= 2 entao subtrair 1 em @USUARIO.ataques_restantes","explicacao":"Uma regra de combate rápido penaliza a segunda troca de empunhadura no mesmo turno, consumindo um ataque disponível. A primeira troca não ativa; quando o contador chega a 2, o custo entra. O número acompanha as trocas já realizadas."},
  "ataques_neste_turno": {"formula":"se @USUARIO.ataques_neste_turno >= 2 entao somar 1d8 em @ALVO.vida_temp","explicacao":"Após dois ataques no turno, uma postura de duelista cria 1d8 PV temporários para se proteger da resposta inimiga. Com zero ou um ataque realizado, o benefício ainda não ativa; o segundo golpe completa a sequência."},
  "ultimo_ataque_acertou": {"formula":"se @USUARIO.ultimo_ataque_acertou > 0 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma técnica de combo libera um golpe de continuação se o último ataque acertou. Depois de um acerto, causa 1d8 adicional; após um erro, não. A marca do resultado anterior evita calcular novamente o teste do ataque."},
  "ultimo_ataque_errou": {"formula":"se @USUARIO.ultimo_ataque_errou > 0 entao somar 1 em @USUARIO.acerto","explicacao":"Uma habilidade de correção concede +1 de Acerto ao próximo golpe se o ataque anterior errou. Se o último resultado foi acerto, a compensação não ativa. A chave permite criar efeitos que respondem ao resultado recém-resolvido."},
  "arma_grupo_<grupo>": {"formula":"se @USUARIO.arma_grupo_espada > 0 entao subtrair 2d6 em @ALVO.vida","explicacao":"Troque `<grupo>` pelo grupo real da arma; `espada` é o identificador usado neste exemplo. Se a arma principal pertence ao grupo espada, o talento de lâminas acrescenta 2d6; uma arma de outro grupo não satisfaz a condição."},
  "eh_player": {"formula":"se @ALVO.eh_player > 0 entao somar 1d8 em @ALVO.vida","explicacao":"Uma habilidade de suporte restaura 1d8 PV apenas quando o alvo é um personagem jogador. A categoria PLAYER ativa a chave; NPCs e inimigos não recebem esta cura. Use o filtro quando a regra tratar fichas de jogador de modo diferente."},
  "eh_npc": {"formula":"se @ALVO.eh_npc > 0 entao somar 2 em @USUARIO.sorte","explicacao":"Ao concluir uma missão com um NPC, o personagem recebe 2 usos de Sorte se a criatura observada estiver classificada como NPC. Um jogador ou inimigo não ativa a recompensa. O marcador permite adaptar interações conforme a categoria da ficha."},
  "eh_inimigo": {"formula":"se @ALVO.eh_inimigo > 0 entao subtrair 1d10 em @ALVO.vida","explicacao":"Um ataque de caça só causa o dano de 1d10 contra uma criatura classificada como inimigo. Aliados e NPCs neutros não satisfazem a condição, evitando que o mesmo efeito os atinja por engano."},
  "origem_<id>": {"formula":"se @USUARIO.origem_nobre > 0 entao somar 2 em @USUARIO.pericia_persuasao","explicacao":"Substitua `<id>` pelo identificador da origem; neste caso, `nobre`. Um personagem com essa origem ganha +2 em Persuasão ao negociar com autoridades; outra origem não ativa o bônus. O nome exibido pode ser diferente do identificador técnico."},
  "especializacao_<id>": {"formula":"se @USUARIO.especializacao_duelista > 0 entao subtrair 1d8 em @ALVO.vida","explicacao":"Troque `<id>` pelo identificador da especialização; `duelista` é o exemplo. Quem possui essa especialização acrescenta 1d8 ao golpe individual; uma ficha sem ela não recebe o dano extra."},
  "condicao_rodadas_desde_<id>": {"formula":"se @ALVO.condicao_rodadas_desde_envenenado >= 3 entao subtrair 2d8 em @ALVO.vida","explicacao":"Substitua `<id>` por `envenenado` para consultar há quantas rodadas essa condição está ativa. A partir da terceira rodada completa, uma toxina tardia causa 2d8; antes disso, ainda não. Valor -1 significa que a condição está ausente ou sem idade conhecida."},
  "condicao_tem_idade_<id>": {"formula":"se @ALVO.condicao_tem_idade_amedrontado > 0 entao somar 1d6 em @USUARIO.vida","explicacao":"Use `amedrontado` no lugar de `<id>` para verificar se a idade da condição foi registrada. Quando o sistema conhece essa duração, o aliado recupera 1d6 PV ao receber apoio; sem idade conhecida, a fórmula não presume há quanto tempo o medo está ativo."},
  "condicao_rodadas_restantes_<id>": {"formula":"se @ALVO.condicao_rodadas_restantes_amedrontado <= 1 entao remover amedrontado","explicacao":"Para a condição Amedrontado, esta limpeza remove o efeito quando resta uma rodada ou menos. Com 2 rodadas restantes, ele continua; com 1, termina. O valor 999 indica duração indefinida, então não é removido por esse limite."},
  "qtd_condicoes": {"formula":"se @USUARIO.qtd_condicoes >= 3 entao somar 2 em @USUARIO.defesa","explicacao":"Uma passiva de resistência concede +2 de Defesa quando o personagem carrega três ou mais condições ativas. Com duas, não ativa; com três, ativa. A contagem considera todas as categorias de condição, não apenas as físicas."},
  "qtd_condicoes_fisica": {"formula":"se @USUARIO.qtd_condicoes_fisica >= 2 entao somar 1d8 em @USUARIO.vida_temp","explicacao":"Um talento de resistência física concede 1d8 PV temporários quando há pelo menos duas condições físicas ativas, como Sangrando e Queimando. Uma condição só não basta; a chave conta apenas as condições classificadas como FÍSICA."},
  "qtd_condicoes_incapacitacao": {"formula":"se @ALVO.qtd_condicoes_incapacitacao > 0 entao subtrair 2d8 em @ALVO.vida","explicacao":"Um golpe de execução causa 2d8 adicionais se o alvo já tiver ao menos uma condição de Incapacitação, como Atordoado ou Paralisado. Sem condição nessa categoria, o ataque não recebe o bônus."},
  "qtd_condicoes_mental": {"formula":"se @ALVO.qtd_condicoes_mental >= 2 entao somar 2 em @ALVO.vontade","explicacao":"Uma técnica de foco concede +2 em Vontade ao alvo quando ele está sob duas ou mais condições mentais, ajudando-o a resistir à próxima influência. Com apenas uma condição mental, o bônus não é aplicado."},
  "qtd_condicoes_movimento": {"formula":"se @ALVO.qtd_condicoes_movimento > 0 entao subtrair 2 em @ALVO.defesa","explicacao":"Um ataque de cerco impõe -2 de Defesa contra um alvo cuja movimentação esteja comprometida por ao menos uma condição da categoria MOVIMENTO. Sem condição desse grupo, não há penalidade."},
  "qtd_condicoes_sensorial": {"formula":"se @ALVO.qtd_condicoes_sensorial > 0 entao somar 2 em @USUARIO.pericia_furtividade","explicacao":"Um infiltrador aproveita uma condição sensorial do guarda, como Cego ou Surdo, para receber +2 em Furtividade. A chave só conta condições classificadas como SENSORIAL; uma condição física isolada não ativa o bônus."},
  "qtd_condicoes_vulnerabilidade": {"formula":"se @ALVO.qtd_condicoes_vulnerabilidade > 0 entao subtrair 2d6 em @ALVO.vida","explicacao":"Uma arma elemental causa 2d6 adicionais contra um alvo com pelo menos uma condição da categoria VULNERABILIDADE, como Exposto. Sem vulnerabilidade ativa, aplica apenas o dano normal da arma."},
  "qtd_concentrando": {"formula":"se @USUARIO.qtd_concentrando >= 2 entao subtrair 1 em @USUARIO.pe","explicacao":"Uma técnica de sobrecarga custa 1 PE quando o personagem já mantém dois ou mais efeitos de concentração. Com um efeito ativo, não cobra esse custo extra; com dois, cobra. A chave conta efeitos ativos, não o limite máximo de espaços."},
  "qtd_sustentados": {"formula":"se @USUARIO.qtd_sustentados >= 3 entao subtrair 2 em @USUARIO.pe","explicacao":"Manter três ou mais buffs sustentados exige 2 PE adicionais neste exemplo. Com dois efeitos, o custo não dispara; ao ativar o terceiro, passa a valer. Use a contagem atual para custos que aumentam conforme os efeitos simultâneos."},
  "slots_concentracao_livres": {"formula":"se @USUARIO.slots_concentracao_livres > 0 entao subtrair 2 em @USUARIO.pe","explicacao":"Uma nova magia de concentração só pode ser iniciada se ainda houver ao menos um espaço livre. Com máximo 3 e dois efeitos ativos, resta 1 e o custo de 2 PE é pago; com zero espaços, a fórmula não inicia outro efeito."},
  "slots_sustentado_livres": {"formula":"se @USUARIO.slots_sustentado_livres > 0 entao somar 1d8 em @ALVO.vida_temp","explicacao":"Uma nova proteção sustentada só pode ser criada se ainda houver um espaço livre; ao iniciar, concede 1d8 PV temporários ao aliado. Com limite 4 e três efeitos ativos, resta um espaço; com quatro ativos, a fórmula não libera outra proteção."},
  "visao_normal": {"formula":"se @USUARIO.visao_normal > 0 entao somar 2 em @USUARIO.pericia_percepcao","explicacao":"Durante uma busca em um salão plenamente iluminado, o personagem recebe +2 em Percepção para ler inscrições e detalhes pequenos. No escuro ou na penumbra, esta chave vale 0 e o bônus de luz plena não se aplica."},
  "visao_penumbra": {"formula":"se @USUARIO.visao_penumbra > 0 entao somar 2 em @USUARIO.pericia_furtividade","explicacao":"Um personagem se deslocando entre sombras recebe +2 em Furtividade quando a cena está em penumbra. Em iluminação plena, não recebe esse benefício. `na_penumbra` é um alias aceito para esta mesma chave."},
  "visao_escuridao": {"formula":"se @USUARIO.visao_escuridao > 0 entao subtrair 2 em @USUARIO.acerto","explicacao":"Quando o próprio atacante está em escuridão total, recebe -2 no Acerto por não enxergar o alvo. Em penumbra ou luz plena, esta penalidade não ativa. `na_escuridao` é um alias para a mesma chave."},
  "esta_iluminado": {"formula":"se @ALVO.esta_iluminado > 0 entao subtrair 1d8 em @ALVO.vida","explicacao":"Um disparo de luz concentrada causa 1d8 extra apenas contra um alvo iluminado por uma fonte visível. Se o alvo estiver na sombra, o efeito não entra. A chave consulta o estado de iluminação do alvo durante a ação."},
  "esta_oculto": {"formula":"se @USUARIO.esta_oculto > 0 entao subtrair 2d6 em @ALVO.vida","explicacao":"Um ataque de emboscada acrescenta 2d6 se o atacante ainda estiver oculto do alvo no momento em que a ação é resolvida. Se a posição já foi revelada ou há linha de visão clara, o bônus não se aplica."},
  "linha_de_visao": {"formula":"se @USUARIO.linha_de_visao > 0 entao subtrair 2d8 em @ALVO.vida","explicacao":"Um disparo de besta exige linha de visão entre o usuário e o alvo. Com o marcador em 1, causa 2d8; uma parede ou obstáculo que bloqueie a visão deixa o marcador em 0 e impede a execução do disparo."},
  "atras_de_cobertura": {"formula":"se @ALVO.atras_de_cobertura > 0 entao somar 2 em @ALVO.defesa","explicacao":"Um inimigo atrás de cobertura recebe +2 de Defesa contra o disparo. O bônus vale tanto para meia cobertura quanto para proteção superior, conforme a chave; sem cobertura, não altera a Defesa."},
  "fonte_de_luz_ativa": {"formula":"se @USUARIO.fonte_de_luz_ativa > 0 entao somar 2 em @USUARIO.pericia_percepcao","explicacao":"Uma lanterna ligada concede +2 em Percepção ao vasculhar uma sala escura. A chave vale 1 somente enquanto a fonte de luz carregada estiver ativa; uma lanterna apagada não revela detalhes nem concede o bônus."},
  "ado_modo": {"formula":"se @USUARIO.ado_modo = 1 entao subtrair 1d8 + @USUARIO.treino em @ALVO.vida","explicacao":"Quando o modo da AdO está configurado como 1 (reação), esta fórmula libera o golpe de resposta com 1d8 mais Treinamento. Valores 2 e 3 representam modos de ação ou qualquer modo, então esta regra específica não os trata como reação."},
  "ado_restrita": {"formula":"se @USUARIO.ado_restrita > 0 e @CENA.distancia_m <= 1.5 entao subtrair 2d6 em @ALVO.vida","explicacao":"Uma AdO limitada a um alvo só usa este efeito quando a restrição está ativa e a criatura autorizada está adjacente, a até 1,5 m. O marcador sinaliza que há um alvo específico definido pela configuração; a seleção desse alvo deve ser feita pelo gatilho."},
  "reacoes_max": {"formula":"definir @USUARIO.reacoes_max em @USUARIO.reacoes_restantes","explicacao":"No começo da rodada, copia o máximo de reações para o saldo disponível. Um talento que dá 2 reações deixa 2 para gastar; uma ficha com máximo 1 começa com 1. Ao consumir uma reação, reduza o saldo, não o máximo."},
  "reacao_usada": {"formula":"se @USUARIO.reacao_usada = 0 entao somar 1 em @USUARIO.reacao_usada, somar 1 em @USUARIO.vida_temp","explicacao":"Uma postura de contra-ataque só pode ser usada uma vez: quando `reacao_usada` vale 0, a fórmula marca 1 e concede 1 PV temporário. Depois disso, a condição bloqueia outra ativação até que o marcador seja reiniciado na próxima rodada."},
  "CENA.distancia_plana": {"formula":"se @CENA.distancia_plana <= 6 entao subtrair 1d8 em @ALVO.vida","explicacao":"Um arco curto alcança até 6 m no plano horizontal. O disparo recebe 1d8 adicional contra uma peça a 5 m, mesmo que esteja em um nível de altura diferente; a diferença vertical é calculada separadamente por outra chave."},
  "CENA.distancia_grade": {"formula":"se @CENA.distancia_grade <= 4.5 entao subtrair 2d6 em @ALVO.vida","explicacao":"Com casas de 1,5 m, um golpe de lança cobre até três casas, ou 4,5 m pela distância da grade. O alvo a três casas satisfaz o alcance; a quatro casas (6 m) não. Esta leitura segue a geometria configurada no mapa."},
  "CENA.diferenca_altura": {"formula":"se @CENA.diferenca_altura >= 3 entao subtrair 1d10 em @ALVO.vida","explicacao":"Um ataque ascendente recebe 1d10 extra quando o alvo está pelo menos 3 m acima do usuário. A diferença é alvo menos usuário: +3 m indica que está acima; valor negativo indica que está abaixo e não ativa este exemplo."},
  "CENA.terreno": {"formula":"se @CENA.terreno < 2 entao subtrair 1.5 em @USUARIO.movimento_restante","explicacao":"Uma criatura só atravessa a casa se o terreno não estiver marcado como intransponível (valor 2). Terreno normal (0) e difícil (1) permitem avançar 1,5 m; com valor 2, a condição bloqueia o movimento."},
  "em_terreno_dificil": {"formula":"se @USUARIO.em_terreno_dificil > 0 entao subtrair 3 em @USUARIO.movimento_restante","explicacao":"Ao atravessar 1,5 m de lama profunda, o personagem gasta 3 m do orçamento de movimento, o dobro do custo normal. Em terreno comum, esta penalidade não entra. A chave é um marcador 1/0 separado do código numérico do terreno."},
  "voando": {"formula":"se @USUARIO.voando > 0 entao somar 2 em @USUARIO.defesa","explicacao":"Enquanto está voando, a criatura recebe +2 de Defesa contra ataques de inimigos presos ao chão. Quando aterrissa, o marcador volta a 0 e o bônus deixa de valer. A chave consulta o estado de movimento, não a velocidade máxima de voo."},
  "prono": {"formula":"se @ALVO.prono > 0 entao subtrair 1d10 em @ALVO.vida","explicacao":"Um golpe de finalização acrescenta 1d10 contra um alvo caído/prono. Se a criatura estiver de pé, não recebe esse dano extra. A chave verifica a postura atual do alvo, permitindo usar a mesma manobra contra qualquer ficha."},
  "agachado": {"formula":"se @ALVO.agachado > 0 entao somar 2 em @ALVO.defesa","explicacao":"Um arqueiro agachado atrás de uma barricada recebe +2 de Defesa contra o próximo disparo. A fórmula aplica o bônus enquanto o marcador estiver ativo; ao se levantar, a Defesa volta ao valor normal."},
  "velocidade_atual": {"formula":"somar @USUARIO.velocidade_atual em @USUARIO.movimento_restante","explicacao":"Ao usar uma ação de Corrida, acrescenta ao deslocamento restante uma segunda parcela igual à velocidade efetiva. Se sobrecarga reduziu a velocidade para 6 m, acrescenta 6; sem sobrecarga, uma velocidade de 9 m acrescenta 9."},
  "metros_movidos": {"formula":"se @USUARIO.metros_movidos >= 6 entao subtrair 1d8 em @ALVO.vida","explicacao":"Um ataque de investida ganha 1d8 adicional se o personagem já percorreu pelo menos 6 m neste turno. Com 5 m movidos, não ativa; ao completar 6 m, libera o bônus. A contagem zera conforme o turno e não mede a distância entre as peças."},
  "usou_corrida": {"formula":"se @USUARIO.usou_corrida > 0 entao subtrair 2d6 em @ALVO.vida","explicacao":"Uma manobra de impacto só pode ser usada depois de gastar a ação de Corrida neste turno; quando a flag vale 1, causa 2d6. Se o personagem apenas caminhou, não recebe o dano de investida."},
  "sobrecarregado": {"formula":"se @USUARIO.sobrecarregado > 0 entao subtrair 3 em @USUARIO.movimento_restante","explicacao":"No início do deslocamento, uma penalidade de carga remove 3 m do orçamento de movimento se os espaços ocupados superarem o máximo da ficha. Com a flag em 0, o personagem mantém a velocidade normal. A chave traduz sobrecarga em um ajuste explícito."},
  "ITEM.usos_restantes": {"formula":"se @ITEM.usos_restantes >= 1 entao subtrair 1d8 em @ALVO.vida","explicacao":"A pistola rúnica ainda tem carga se Usos Restantes for pelo menos 1; nesse caso, o tiro causa 1d8 ao alvo. Com zero, a fórmula não libera o efeito. Configure também o custo `usos_item: 1` na ação para consumir a carga ao ativar."},
  "ITEM.usos_totais": {"formula":"se @ITEM.usos_totais >= 3 entao subtrair 2d8 em @ALVO.vida","explicacao":"Um artefato com capacidade para três ou mais cargas pode disparar seu modo de sobrecarga e causar 2d8. Um item com total máximo 2 não atende ao requisito. A chave lê a capacidade cadastrada para aquela cópia do item, não quantas cargas restam."},
  "DANO": {"formula":"subtrair @DANO + @USUARIO.treino em @ALVO.vida","explicacao":"No processamento de dano da arma, soma o dano-base recebido no contexto ao Treinamento do atacante. Se a arma calculou 7 e o Treinamento vale 2, o alvo perde 9 PV. Use @DANO para reaproveitar o resultado-base sem recalcular os dados da arma."},
  "CENA.rodada": {"formula":"quando @CENA.rodada = 1 -> somar 2 em @USUARIO.acerto","explicacao":"Uma postura de abertura concede +2 de Acerto durante a primeira rodada do combate. O gatilho é verdadeiro quando a cena marca a rodada como 1; na rodada 2 ele já não dispara. É útil para emboscadas ou efeitos que só duram no início do confronto."},
  "CENA.dificuldade": {"formula":"se @USUARIO.pericia_ocultismo >= @CENA.dificuldade entao somar 1 em @USUARIO.sorte","explicacao":"Ao investigar um selo, Ocultismo 15 contra a CD 14 definida pelo Mestre revela uma pista e concede 1 uso de Sorte; 13 contra CD 14 falha. Mudar a dificuldade na cena ajusta a mesma fórmula a grupos mais ou menos experientes."},
  "CENA.no_mapa": {"formula":"se @CENA.no_mapa > 0 e @CENA.distancia_m <= 3 entao subtrair 2d6 em @ALVO.vida","explicacao":"Uma lança de guarda só ameaça o alvo se ambos tiverem peças no mapa e estiverem a até 3 m. Com as duas peças a 2 m, aplica 2d6; sem uma peça posicionada, não presume distância nem dispara. A fórmula combina a disponibilidade espacial com o alcance."},
  "CENA.sujeito_aliado": {"formula":"se @CENA.sujeito_aliado = 1 entao somar 2d8 em @ALVO.vida","explicacao":"Uma aura de socorro restaura 2d8 PV apenas quando a criatura observada é aliada. O marcador 1 libera a cura; se o sujeito for inimigo ou não estiver marcado como aliado, a fórmula não o cura."},
  "CENA.outro_inimigo": {"formula":"se @CENA.outro_inimigo = 1 entao somar 2 em @USUARIO.defesa","explicacao":"Ao observar um evento com outra criatura inimiga envolvida, o usuário ganha +2 de Defesa para se proteger da ameaça. Contra um evento sem inimigo associado, a condição vale 0 e o bônus não entra. Use em reações que filtram quem participou do evento."},
  "CENA.outro_aliado": {"formula":"se @CENA.outro_aliado = 1 entao somar 1d8 em @ALVO.vida","explicacao":"Uma reação de apoio restaura 1d8 PV quando o outro participante registrado no evento é aliado. Se um aliado causou o evento, ativa; se a outra criatura for inimiga ou não houver participante aliado, não cura."},
  "CENA.outro_e_voce": {"formula":"se @CENA.outro_e_voce = 1 entao somar 1d6 em @USUARIO.vida_temp","explicacao":"Uma barreira pessoal se ativa quando o outro envolvido no evento é o próprio usuário, concedendo 1d6 PV temporários. O marcador impede que a mesma reação seja gasta em acontecimentos que envolvam apenas outras criaturas."},
  "CENA.consumido": {"formula":"subtrair (@CENA.consumido)d8 em @ALVO.vida","explicacao":"Se a etapa anterior consumiu 3 unidades, `@CENA.consumido` vale 3 e esta fórmula rola 3d8 de dano. Com 1 unidade, rola 1d8. Use após `CONSUMIR_CONTADOR` quando o efeito posterior deve escalar com a quantidade realmente gasta, não com o total que havia."},
  "CENA.dano": {"formula":"se @CENA.dano >= 10 entao somar 1d8 em @USUARIO.vida_temp","explicacao":"Uma reação cria escudo de 1d8 quando o dano do evento atual foi de pelo menos 10. Um golpe de 12 aciona a proteção; um de 9 não. Esta chave lê o valor informado pelo evento de dano e pode filtrar respostas a golpes fortes."},
  "CENA.turno_indice": {"formula":"se @CENA.turno_indice = 0 entao somar 2 em @USUARIO.acerto","explicacao":"A ficha que ocupa o primeiro lugar na ordem de iniciativa tem índice 0; neste exemplo, ganha +2 de Acerto na abertura do turno. Índice 1 ou maior não recebe o bônus, e -1 indica que não existe turno válido."},
  "CENA.rodadas_em_combate": {"formula":"quando @CENA.rodadas_em_combate >= 4 -> subtrair 1d8 em @ALVO.vida","explicacao":"Um veneno tardio começa a causar 1d8 a partir da quarta rodada de combate. Antes disso, o gatilho ainda não atingiu o limite; na rodada 4 e nas seguintes, pode disparar. Fora de combate a chave vale 0, então não confunde tempo narrativo com rodadas de luta."},
  "DANO.tipo": {"formula":"se @DANO.tipo = 9 entao somar 2d6 em @USUARIO.vida_temp","explicacao":"A proteção reativa concede 2d6 PV temporários quando o código do tipo de dano recebido é 9 (DAL, conforme a tabela do guia). Para outros códigos, como dano de arma ou fogo, a condição não ativa. O número representa a classificação do tipo, não uma quantidade de dano."},
  "DANO.fonte": {"formula":"se @DANO.fonte = 2 entao somar 2 em @USUARIO.defesa","explicacao":"Um manto antimagia concede +2 de Defesa quando a fonte do dano é um feitiço, código 2. Dano de arma (1), efeito Omni (3) ou ambiente (4) não ativa essa reação. A chave identifica a categoria que produziu o dano."},
  "DANO.foi_falha_critica": {"formula":"se @DANO.foi_falha_critica > 0 entao somar 1 em @USUARIO.sorte","explicacao":"Uma regra de azar compensado devolve 1 uso de Sorte quando a resolução informa falha crítica. Vincule a fórmula ao evento de erro de ataque que fornece essa marca: erros não criam eventos de dano, portanto ela não deve depender de `aoSofrerDano`."},
  "DANO.valor_inicial": {"formula":"somar min(@DANO.valor_inicial, 10) em @USUARIO.vida_temp","explicacao":"Num pré-efeito defensivo, concede PV temporários iguais ao dano bruto recebido, limitados a 10. Se chegaram 14 pontos antes de mitigação, gera 10; se chegaram 6, gera 6. Esse valor é lido antes do pré-hook e da redução desta resolução."},
  "DANO.valor_final": {"formula":"se @DANO.valor_final >= 20 entao somar 1 em @USUARIO.sorte","explicacao":"Após a resolução completa, uma passiva concede 1 uso de Sorte se o dano final ficou em 20 ou mais. O valor já considera RD, imunidade, vulnerabilidade e PV temporários; dano bruto 24 reduzido a 18 não cumpre a condição."},
  "DANO.absorvido": {"formula":"somar floor(@DANO.absorvido / 5) em @USUARIO.pe","explicacao":"Uma armadura converte cada bloco completo de 5 pontos absorvidos em 1 PE. Se a diferença entre dano inicial e final for 12, recupera 2 PE; se for 4, recupera 0. O valor inclui todas as formas de absorção e não mede apenas a RD da ficha."},
  "DANO.tem_atacante": {"formula":"se @DANO.tem_atacante = 1 entao subtrair 1 em @ALVO.ataques_restantes","explicacao":"Uma marca de retaliação só consome um ataque restante quando o evento informa quem atacou. Com atacante presente, reduz a contagem do alvo em 1; sem essa informação, não altera a ficha. Isso evita atribuir uma resposta automática a dano ambiental."},
  "DANO.tem_alvo": {"formula":"se @DANO.tem_alvo = 1 entao somar 1d8 em @ALVO.vida_temp","explicacao":"Uma reação de escudo só concede 1d8 PV temporários quando a resolução identifica a ficha atingida. Se não existe entidade-alvo, como em certos efeitos de área sem vítima registrada, a fórmula não tenta aplicar o benefício a uma ficha inexistente."},
  "DANO.alcance": {"formula":"se @DANO.alcance <= 6 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma reação de curta distância funciona se a distância real entre as peças no início da resolução era de até 6 m. Um disparo a 5 m recebe 1d8 adicional; a 7 m não. Sem peças no mapa, o alcance fica ausente e a regra não deve presumir um valor."},
  "DANO.foi_ataque_oportunidade": {"formula":"se @DANO.foi_ataque_oportunidade > 0 entao subtrair 2d6 em @ALVO.vida","explicacao":"Um talento acrescenta 2d6 somente a ataques marcados como Ataque de Oportunidade antes da rolagem. Ataques comuns ficam sem esse bônus. A marca vem do painel do ataque, então o gatilho não depende de adivinhar pelo movimento do alvo."},
  "DANO.foi_furtivo": {"formula":"se @DANO.foi_furtivo > 0 entao subtrair 2d8 em @ALVO.vida","explicacao":"Um ataque feito enquanto o personagem estava escondido recebe 2d8 adicionais se a resolução preservar a marca de furtividade. Um golpe frontal não tem essa marca e não ativa o dano extra. A condição usa o estado registrado pelo ataque, não apenas uma estimativa de distância."},
  "DANO.tipo_ataque": {"formula":"se @DANO.tipo_ataque = 2 entao somar 2 em @ALVO.defesa","explicacao":"Uma capa balística reage a ataques à distância, identificados pelo código 2, e concede ao alvo +2 de Defesa para a resposta definida pela ficha. Código 1 é corpo a corpo e 3 é amaldiçoado; esses tipos não ativam este exemplo."},
  "pericia_atletismo": {"formula":"se @USUARIO.pericia_atletismo >= @ALVO.pericia_atletismo entao subtrair 1d8 em @ALVO.vida","explicacao":"Numa disputa para empurrar um guarda para longe, compare o Atletismo de quem tenta a manobra com o Atletismo do alvo. Se o atacante tiver 6 contra 4, a condição libera 1d8 de impacto; com 3 contra 4, não. A fórmula pressupõe que esses valores já representam os bônus das fichas."},
  "pericia_acrobacia": {"formula":"se @USUARIO.pericia_acrobacia > @ALVO.acerto entao somar 1d6 em @USUARIO.vida_temp","explicacao":"Ao escapar de um golpe, a Acrobacia do personagem precisa superar o Acerto do atacante para ganhar uma camada de proteção de 1d6 PV temporários. Acrobacia 8 contra Acerto 7 ativa o efeito; empate não, pois a comparação é estritamente maior."},
  "pericia_furtividade": {"formula":"se @USUARIO.pericia_furtividade > @ALVO.pericia_percepcao entao subtrair 2d6 em @ALVO.vida","explicacao":"Uma emboscada só pega o alvo desprevenido se a Furtividade do usuário superar a Percepção dele. Furtividade 9 contra Percepção 7 libera 2d6 de dano; contra Percepção 9, o empate não basta. O valor comparado é o bônus total de cada ficha."},
  "pericia_prestidigitacao": {"formula":"se @USUARIO.pericia_prestidigitacao >= @ALVO.pericia_percepcao entao somar 2 em @USUARIO.acerto","explicacao":"Durante uma finta com uma moeda, Prestidigitação igual ou maior que a Percepção do oponente cria uma abertura e concede +2 de Acerto ao usuário. Com 6 contra 6, a finta funciona; com 5 contra 6, o inimigo percebe o truque."},
  "pericia_feiticaria": {"formula":"se @USUARIO.pericia_feiticaria >= @CENA.dificuldade entao subtrair 2d8 em @ALVO.vida","explicacao":"Para conjurar um selo de ataque, compare Feitiçaria com a dificuldade definida pelo Mestre. Feitiçaria 15 contra CD 14 libera 2d8 de dano; 13 contra CD 14 não. Altere a CD da cena para reaproveitar o exemplo em encontros diferentes."},
  "pericia_historia": {"formula":"se @USUARIO.pericia_historia >= @CENA.dificuldade entao somar 1 em @USUARIO.sorte","explicacao":"Ao reconhecer o brasão de uma família antiga, História igual ou maior que a CD revela uma pista que concede 1 uso de Sorte. Resultado 14 contra CD 14 passa; 13 falha. A consequência pode ser trocada mantendo a mesma verificação histórica."},
  "pericia_investigacao": {"formula":"se @USUARIO.pericia_investigacao >= @CENA.dificuldade entao somar 2 em @USUARIO.reserva_pe","explicacao":"Na busca por uma sala oculta, Investigação 17 contra CD 15 encontra um estojo com 2 PE armazenados na reserva; 14 não encontra. O exemplo transforma o sucesso em um recurso concreto e usa a dificuldade atual da cena."},
  "pericia_oficio1": {"formula":"se @USUARIO.pericia_oficio1 >= @CENA.dificuldade entao somar 1d8 em @USUARIO.vida_temp","explicacao":"Se o grupo usa Ofício 1 como ferraria, um teste bem-sucedido para reforçar a armadura concede 1d8 PV temporários ao usuário. Com perícia 12 contra CD 11, a proteção é aplicada; contra CD 13, não. O Mestre pode definir Ofício 1 para outra especialidade na ficha."},
  "pericia_oficio2": {"formula":"se @USUARIO.pericia_oficio2 >= @CENA.dificuldade entao somar 1 em @USUARIO.pe","explicacao":"Neste exemplo, Ofício 2 representa a fabricação de talismãs. Com resultado 16 contra CD 15, a peça recupera 1 PE de quem a preparou; com 14, os materiais se perdem sem recuperar energia. O identificador técnico continua genérico para a especialidade configurada pelo grupo."},
  "pericia_oficio3": {"formula":"se @USUARIO.pericia_oficio3 >= @CENA.dificuldade entao somar 1d6 em @ALVO.vida","explicacao":"Aqui, Ofício 3 representa culinária de campo: preparar uma refeição nutritiva restaura 1d6 PV de um aliado. Ofício 3 igual ou maior que a CD libera a refeição; abaixo da CD, ela não fica pronta a tempo. A ficha decide qual especialidade cada Ofício representa."},
  "pericia_tecnologia": {"formula":"se @USUARIO.pericia_tecnologia >= @CENA.dificuldade entao somar 2 em @USUARIO.movimento_restante","explicacao":"Ao desativar um bloqueio eletrônico, Tecnologia 13 contra CD 12 abre a passagem e economiza 2 m do deslocamento necessário; 11 contra CD 12 falha e não altera o orçamento. O exemplo liga o resultado do teste a uma vantagem tática imediata."},
  "pericia_teologia": {"formula":"se @USUARIO.pericia_teologia >= @CENA.dificuldade entao subtrair 2d6 em @ALVO.vida","explicacao":"Durante um exorcismo, Teologia 18 contra CD 16 permite atingir a entidade com 2d6 de dano sagrado; 15 não alcança a dificuldade. O mesmo teste pode servir para identificar ritos ou afastar uma presença, mudando apenas o efeito após o sucesso."},
  "pericia_direcao": {"formula":"se @USUARIO.pericia_direcao >= @CENA.dificuldade entao somar 3 em @USUARIO.movimento_restante","explicacao":"Numa perseguição, Direção 14 contra CD 12 permite fazer uma curva segura e ganhar 3 m de avanço no veículo; 11 falha e não ganha distância. A chave usa a perícia de condução para transformar o teste em posição tática."},
  "pericia_intuicao": {"formula":"se @USUARIO.pericia_intuicao >= @ALVO.pericia_enganacao entao somar 2 em @USUARIO.acerto","explicacao":"Ao perceber que o adversário está blefando, compare Intuição com Enganação. Intuição 7 contra Enganação 5 revela a finta e dá +2 de Acerto no contra-ataque; contra Enganação 8, o usuário continua enganado."},
  "pericia_medicina": {"formula":"se @USUARIO.pericia_medicina >= @CENA.dificuldade entao somar 2d8 em @ALVO.vida","explicacao":"Durante os primeiros socorros, Medicina 15 contra CD 13 restaura 2d8 PV do paciente; 12 não estabiliza o ferimento a tempo. A cura vai para a ficha do alvo, enquanto a CD permite ao Mestre graduar a gravidade do caso."},
  "pericia_ocultismo": {"formula":"se @USUARIO.pericia_ocultismo >= @CENA.dificuldade entao subtrair 2d8 em @ALVO.vida","explicacao":"Ao identificar uma marca amaldiçoada, Ocultismo 16 contra CD 14 permite inverter o símbolo e causar 2d8 à entidade ligada a ele; 13 falha. A chave pode orientar também identificar, conter ou desfazer fenômenos sobrenaturais."},
  "pericia_percepcao": {"formula":"se @USUARIO.pericia_percepcao >= @ALVO.pericia_furtividade entao somar 2 em @USUARIO.acerto","explicacao":"Um sentinela compara Percepção com a Furtividade do invasor. Com 8 contra 6, percebe a aproximação e ganha +2 de Acerto no primeiro disparo; com 5 contra 7, o alvo permanece escondido."},
  "pericia_sobrevivencia": {"formula":"se @USUARIO.pericia_sobrevivencia >= @CENA.dificuldade entao somar 1d8 em @USUARIO.vida","explicacao":"Ao encontrar ervas e água potável, Sobrevivência 13 contra CD 12 recupera 1d8 PV durante o descanso; 11 não encontra suprimentos seguros. O valor da dificuldade pode subir em um deserto ou cair numa floresta conhecida."},
  "pericia_enganacao": {"formula":"se @USUARIO.pericia_enganacao > @ALVO.pericia_intuicao entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma finta verbal abre espaço para um ataque surpresa quando Enganação supera a Intuição do alvo. Enganação 8 contra Intuição 6 ativa 1d8 de dano; o empate não é suficiente. Isso representa o valor da perícia numa manobra, sem criar uma key especial para fintas."},
  "pericia_intimidacao": {"formula":"se @USUARIO.pericia_intimidacao >= @ALVO.vontade entao aplicar amedrontado rodadas 1","explicacao":"Uma ameaça intimidadora aplica Amedrontado por uma rodada se Intimidação igualar ou superar a Vontade do alvo. Intimidação 7 contra Vontade 7 passa; 6 contra 7 não. O efeito usa a condição existente e a duração está explícita."},
  "pericia_performance": {"formula":"se @USUARIO.pericia_performance >= @CENA.dificuldade entao somar 1d6 em @ALVO.vida","explicacao":"Uma apresentação inspiradora anima um aliado e restaura 1d6 PV se Performance vencer a dificuldade. Performance 15 contra CD 13 funciona; 12 não alcança o público. O exemplo mostra um uso de apoio para a perícia, em vez de limitar Performance a entretenimento."},
  "pericia_persuasao": {"formula":"se @USUARIO.pericia_persuasao >= @ALVO.pericia_intuicao entao somar 2 em @ALVO.vida_temp","explicacao":"Durante uma negociação tensa, Persuasão igual ou maior que a Intuição do aliado o convence a continuar lutando e concede 2 PV temporários como ânimo renovado. Persuasão 8 contra Intuição 6 passa; Persuasão 5 contra Intuição 6 não. A fórmula e a explicação apontam para a mesma proteção temporária."},
  "astucia": {"formula":"se @ALVO.astucia >= @CENA.dificuldade entao somar 1 em @ALVO.acerto","explicacao":"Ao resistir a uma finta complexa, o alvo usa Astúcia contra a CD da cena. Astúcia 14 contra CD 13 permite reconhecer o truque e recebe +1 de Acerto na resposta; 12 não identifica a manobra."},
  "fortitude": {"formula":"se @ALVO.fortitude >= @CENA.dificuldade entao subtrair 1d8 em @ALVO.vida","explicacao":"Este é o ramo de sucesso de uma resistência contra veneno: Fortitude 15 contra CD 14 reduz a consequência a 1d8 de dano; abaixo da CD, a ação configurada pode aplicar o dano integral. A comparação usa o TR do alvo, não o atributo do atacante."},
  "integridade": {"formula":"se @ALVO.integridade >= @CENA.dificuldade entao subtrair 1d6 em @ALVO.vida","explicacao":"Contra uma invasão psíquica de CD 16, Integridade 17 limita a consequência a 1d6; Integridade 15 não passa e pode receber o efeito completo definido no outro grau de sucesso. Use este TR para representar a firmeza da mente e da identidade."},
  "reflexos": {"formula":"se @ALVO.reflexos >= @CENA.dificuldade entao subtrair 1d6 em @ALVO.vida","explicacao":"Quando uma explosão tem CD 14, Reflexos 14 permite ao personagem esquivar parcialmente e sofrer só 1d6 neste ramo de sucesso. Com 13, falha na comparação e a resolução pode aplicar o dano maior. O sinal >= inclui o empate com a CD."},
  "vontade": {"formula":"se @ALVO.vontade >= @CENA.dificuldade entao subtrair 1 em @ALVO.empolgacao","explicacao":"Uma onda de medo tem CD 15; Vontade 16 permite resistir e perde apenas 1 nível de Empolgação neste ramo, enquanto Vontade 14 pode receber a condição completa da habilidade. A chave consulta a resistência mental do alvo contra o efeito."},
  "tamanho": {"formula":"se @ALVO.tamanho >= 3 entao subtrair 2d8 em @ALVO.vida","explicacao":"Uma armadilha de queda causa 2d8 extras a criaturas Grandes ou maiores: tamanho 3 atende ao limite, enquanto Pequeno (1) e Médio (2) não. A chave permite ajustar efeitos pelo porte da criatura, sem criar uma regra separada para cada espécie."},
  "morrendo": {"formula":"se @ALVO.morrendo > 0 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma habilidade de execução só dispara contra um alvo que já entrou no estado Morrendo. O valor 1 libera o dano de 1d8; em um alvo estável, a condição é falsa. Isso deixa o estado atual decidir quando uma habilidade especial pode ser usada."},
  "morto": {"formula":"se @ALVO.morto = 0 entao somar 1d6 em @USUARIO.vida","explicacao":"Um vínculo necromântico só recupera 1d6 PV se a criatura observada ainda não estiver morta. Contra um alvo vivo, a condição permite a cura; depois da morte, não. A chave distingue o estado final de estar apenas inconsciente ou Morrendo."},
  "inconsciente": {"formula":"se @ALVO.inconsciente > 0 entao subtrair 2d10 em @ALVO.vida","explicacao":"Um ataque de misericórdia usa a condição Inconsciente para liberar 2d10 de dano. O golpe especial só entra quando o alvo está inconsciente; estar ferido ou Morrendo não satisfaz essa checagem. A regra pode ser reaproveitada para ações que dependam desse estado."},
  "escudo_equipado": {"formula":"se @USUARIO.escudo_equipado > 0 entao somar 2 em @USUARIO.defesa","explicacao":"Uma manobra de guarda concede +2 de Defesa somente se o personagem estiver usando escudo e tiver a condição necessária para empunhá-lo. Sem escudo equipado, não recebe o bônus. A chave verifica o estado de equipamento durante a resolução."},
  "categoria": {"formula":"se @ALVO.categoria = 3 entao subtrair 1d8 em @ALVO.vida","explicacao":"Uma habilidade de caçador causa 1d8 adicional apenas contra inimigos, identificados pelo valor 3. Jogadores (1) e NPCs (2) não ativam o efeito. Isso mostra como adaptar uma fórmula à categoria da entidade sem depender do nome do personagem."},
  "concentrando": {"formula":"se @USUARIO.concentrando > 0 entao somar 2 em @USUARIO.defesa","explicacao":"Enquanto mantém um feitiço sustentado, o conjurador recebe +2 de Defesa por manter uma postura de concentração. Quando não está concentrando, o bônus não se aplica. A condição pode controlar custos, proteção ou penalidades ligadas a manter um efeito ativo."},
  "empolgacao": {"formula":"subtrair 1d6 + @USUARIO.empolgacao em @ALVO.vida","explicacao":"Um lutador transforma seu nível atual de Empolgação em força para o próximo golpe. No nível 2, com o d6 mostrando 4, causa 6 de dano; no nível 5, o mesmo resultado causa 9. O escalonamento acompanha os cinco níveis do estado."},
  "vendado": {"formula":"se @USUARIO.vendado > 0 entao somar 2 em @USUARIO.pericia_intuicao","explicacao":"Um personagem que luta vendado treina a leitura de movimentos pelo som e recebe +2 em Intuição enquanto a venda está equipada. Sem o item, o bônus não se aplica. O exemplo consulta o estado do slot, em vez de inferir isso pelo nome do equipamento."},
  "descoberto": {"formula":"se @USUARIO.descoberto > 0 entao somar 2 em @USUARIO.pericia_percepcao","explicacao":"Uma lente de reconhecimento concede +2 em Percepção quando o slot de Venda está vazio, que é o estado representado por Descoberto. Se o slot estiver ocupado, a condição falha. Use a chave para regras que dependem de o personagem enxergar livremente."},
  "rodada": {"formula":"quando @CENA.rodada = 3 -> subtrair 2d6 em @ALVO.vida","explicacao":"Uma armadilha programada dispara na terceira rodada de combate e causa 2d6 ao alvo. Na rodada 2 não ocorre; quando o contador chega a 3, o gatilho é satisfeito. `rodadas_em_combate` é um alias aceito para o estado da rodada."},
  "au": {"formula":"subtrair 1d8 + @USUARIO.au em @ALVO.vida","explicacao":"Uma técnica da família AU usa o valor de aptidão Aura do usuário para ampliar o impacto. Com AU 3 e resultado 5 no d8, causa 8 de dano. Se o valor de aptidão aumentar, a fórmula escala sem trocar a chave nem a habilidade."},
  "cl": {"formula":"se @USUARIO.cl >= 2 entao somar 2 em @USUARIO.pericia_feiticaria","explicacao":"Uma prática de Clareza concede +2 em Feitiçaria quando o usuário tem CL 2 ou maior. CL 1 não libera o bônus; CL 2 e CL 3 liberam. A chave deixa que o requisito da aptidão controle efeitos diferentes."},
  "bar": {"formula":"somar @USUARIO.bar * 3 em @USUARIO.vida_temp","explicacao":"Cada ponto de BAR, a aptidão Barreira, cria 3 pontos de vida temporários. BAR 2 concede 6; BAR 4 concede 12. O efeito entra na camada temporária de proteção, sem aumentar a Vida Máxima nem curar os PV atuais."},
  "dom": {"formula":"subtrair 1d10 + @USUARIO.dom em @ALVO.vida","explicacao":"Uma técnica de Domínio soma o valor DOM ao dano de 1d10. Com DOM 3 e resultado 7, aplica 10 de dano. A fórmula consulta a aptidão do usuário para dimensionar o efeito da técnica."},
  "er": {"formula":"se @USUARIO.er >= 1 entao somar 2 em @USUARIO.concentracao_maxima","explicacao":"Uma Expansão ativa libera dois espaços adicionais de concentração enquanto ER for pelo menos 1. Sem ER, o limite não muda; com ER 1 ou mais, aumenta em 2. O exemplo transforma uma aptidão em capacidade de sustentar efeitos."},
  "escudo_proficiente": {"formula":"se @USUARIO.escudo_proficiente > 0 entao somar 2 em @USUARIO.defesa","explicacao":"Um estilo defensivo concede +2 de Defesa quando o personagem tem Proficiência com Escudo. Ter um escudo equipado sem o talento não satisfaz esta checagem; a chave testa a proficiência adquirida, que pode habilitar várias técnicas."},
  "grupos_critico_arma": {"formula":"subtrair 1d8 * @USUARIO.grupos_critico_arma em @ALVO.vida","explicacao":"Uma maestria causa 1d8 adicional por grupo de arma com crítico aprimorado. Se dois grupos atendem à regra e o d8 mostra 5, o bônus total é 10; com nenhum grupo, o termo resulta em zero. A chave conta grupos, não ataques."},
  "defesa_duas_armas": {"formula":"somar @USUARIO.defesa_duas_armas em @USUARIO.defesa","explicacao":"Ao lutar com duas armas, aplica à Defesa exatamente o bônus que a ficha calcula para essa empunhadura. Se o bônus for +1, soma 1; se for +2, soma 2. A fórmula acompanha equipamentos e talentos que alterem o valor."},
  "bonus_movimento": {"formula":"somar @USUARIO.bonus_movimento em @USUARIO.movimento_restante","explicacao":"Uma habilidade de mobilidade acrescenta ao orçamento de movimento os metros extras concedidos por talentos. Se o bônus for 3 m, acrescenta 3 ao deslocamento restante; se não houver bônus, não acrescenta nada. A chave evita fixar a velocidade no efeito."},
  "vigor_maldito_bonus": {"formula":"somar 2d8 + @USUARIO.vigor_maldito_bonus em @USUARIO.vida","explicacao":"Uma cura de Vigor Maldito restaura 2d8 PV e soma o bônus próprio desse talento. Se os dados totalizarem 9 e o bônus for 3, cura 12. O cálculo usa o bônus configurado para essa habilidade, sem aplicar esse valor a toda cura."},
  "suporte_lv2_unlocked": {"formula":"se @USUARIO.suporte_lv2_unlocked > 0 entao somar 2d8 em @ALVO.vida","explicacao":"O suporte avançado só libera esta cura de 2d8 quando Adepto de Medicina desbloqueou o nível 2. Com a chave em 1, cura o aliado; com 0, não executa a opção avançada. Isso permite manter a habilidade no mesmo construtor e condicionar a parte aprimorada."},
  "reducao_dano_alma": {"formula":"subtrair max(1, 2d8 - @ALVO.reducao_dano_alma) em @ALVO.vida","explicacao":"Um ataque de Alma causa 2d8 e desconta a redução específica do alvo, mantendo pelo menos 1 ponto de dano. Com dados 10 e RD de Alma 4, causa 6; se a redução exceder o total, o mínimo preserva 1. Outros tipos de dano não precisam usar esse valor."},
  "atencao_bonus": {"formula":"somar @USUARIO.atencao_bonus em @USUARIO.atencao","explicacao":"Ao recalcular a Atenção passiva, soma o bônus vindo dos talentos ao valor-base. Se a ficha concede +2, Atenção 13 passa a 15; se não houver bônus, o total permanece 13. A chave mantém o ajuste separado do atributo principal."},
  "bonus_tr_defesa_reduzida": {"formula":"somar @USUARIO.bonus_tr_defesa_reduzida em @USUARIO.reflexos","explicacao":"Quando uma condição reduz a Defesa, esta regra acrescenta ao TR de Reflexos o bônus específico configurado para essa situação. Se o bônus for +2 e Reflexos valer 5, o teste usa 7; sem a condição de Defesa reduzida, não inclua esse modificador."},
  "concentracao_maxima": {"formula":"se @USUARIO.concentracao_maxima >= 2 entao somar 1 em @USUARIO.pe","explicacao":"Uma passiva de foco recupera 1 PE se o limite de espaços de concentração do personagem for pelo menos 2. Com limite 1, a condição falha; com limite 2 ou 3, a recuperação ocorre. A chave consulta capacidade máxima, não quantos espaços estão ocupados."},
  "sustentados_maximos": {"formula":"se @USUARIO.sustentados_maximos >= 3 entao somar 1d6 em @USUARIO.vida","explicacao":"Uma bênção de estabilidade concede 1d6 PV a quem consegue manter três ou mais feitiços sustentados. O limite 2 não basta; limites 3 e 4 ativam a regra. Este exemplo usa a capacidade do personagem como requisito narrativo para outra habilidade."},
  "bonus_slots_liberacao": {"formula":"se @USUARIO.bonus_slots_liberacao >= 2 entao subtrair 2d8 em @ALVO.vida","explicacao":"Uma técnica de Liberação aprimorada só libera seu impacto de 2d8 quando os talentos concedem ao menos dois espaços universais extras. Com bônus 1, a condição falha; com bônus 2 ou maior, a técnica fica disponível. O exemplo usa a chave como requisito sem inventar um recurso de slots separado."},
  "pe_temp_por_rodada": {"formula":"somar @USUARIO.pe_temp_por_rodada em @USUARIO.pe_temp","explicacao":"No começo de cada rodada, o personagem recebe a quantidade configurada de PE temporário. Com valor 2, acrescenta 2 PE temporários para aptidões; com valor 0, nada é gerado. Separar essa reserva do PE normal permite regras de duração curta."},
  "aura_bonus_defesa": {"formula":"somar @USUARIO.aura_bonus_defesa em @USUARIO.defesa","explicacao":"Uma aura protetora acrescenta à Defesa o bônus que ela concede aos aliados próximos. Se o bônus de aura for +2, a Defesa 15 passa a 17 enquanto o efeito estiver ativo. A fórmula lê o valor da aura em vez de fixar o bônus na habilidade."},
  "aura_reducao_dano_fisico": {"formula":"subtrair max(1, 2d8 - @ALVO.aura_reducao_dano_fisico) em @ALVO.vida","explicacao":"Uma aura reduz o dano físico recebido pelo alvo antes de aplicar os PV perdidos. Contra 2d8 que somam 9, uma RD de aura 3 deixa 6; caso a redução cubra tudo, ainda se aplica 1 pelo mínimo escolhido no exemplo. A mitigação vale para ataques físicos."},
  "aura_bonus_furtividade": {"formula":"somar @USUARIO.aura_bonus_furtividade em @USUARIO.pericia_furtividade","explicacao":"Enquanto estiver dentro da aura de ocultação, o personagem soma o bônus dela à própria Furtividade. Com +3 de aura, Furtividade 6 passa a 9; fora do alcance ou sem aura ativa, use apenas o valor normal."},
  "aura_bonus_agarrar": {"formula":"somar @USUARIO.aura_bonus_agarrar em @USUARIO.pericia_atletismo","explicacao":"Uma aura de contenção soma seu bônus ao teste de Atletismo usado para agarrar. Se concede +2, Atletismo 5 passa a 7 na manobra; a chave pode refletir a potência da aura sem alterar o atributo ou a perícia da ficha."},
  "<nome_do_contador>": {"formula":"se @USUARIO.rancor >= 3 entao subtrair 2d8 em @ALVO.vida","explicacao":"Substitua o marcador pelo nome real do contador; neste caso, `rancor` acompanha a vingança acumulada. Com 3 ou mais pontos, a descarga causa 2d8; com 2, não dispara. O contador é o total combinado de todas as fontes."},
  "contador_<nome>": {"formula":"se @USUARIO.contador_brasas >= 4 entao subtrair 1d10 em @ALVO.vida","explicacao":"A forma `contador_<nome>` é um alias para o total do contador. Aqui, `contador_brasas` habilita uma explosão quando o personagem acumula pelo menos 4 brasas; com 3, não ativa. Troque `brasas` pelo identificador usado na ficha."},
  "<nome>__fonte__<id>": {"formula":"somar 1 em @USUARIO.brasas__fonte__reliquia_lunar","explicacao":"Esta forma acessa apenas a parcela do contador `brasas` fornecida pela fonte `reliquia_lunar`. O exemplo acrescenta uma carga nessa origem específica; outras fontes continuam separadas, permitindo aplicar tetos individuais por item, talento ou habilidade."},
  "qtd_talentos": {"formula":"se @USUARIO.qtd_talentos >= 5 entao somar 2 em @USUARIO.defesa","explicacao":"Uma recompensa de veterano concede +2 de Defesa quando a ficha possui cinco ou mais talentos. Com quatro talentos, a condição falha; ao adquirir o quinto, o bônus passa a valer. A contagem permite escalonar efeitos conforme a construção do personagem."},
  "qtd_aptidoes": {"formula":"subtrair 1d6 + @USUARIO.qtd_aptidoes em @ALVO.vida","explicacao":"Um ataque que converte domínio técnico em potência soma ao d6 o número de aptidões adquiridas. Com quatro aptidões e resultado 3, causa 7; com seis aptidões, causa 9 no mesmo resultado. Use quando a regra realmente escala pela quantidade escolhida."},
  "qtd_habilidades_especializacao": {"formula":"se @USUARIO.qtd_habilidades_especializacao >= 3 entao somar 2 em @USUARIO.pericia_oficio1","explicacao":"Um especialista recebe +2 em Ofício 1 quando já escolheu pelo menos três habilidades de especialização. Com duas, o bônus não entra; com três, entra. A chave conta as escolhas e não depende de quais habilidades específicas foram selecionadas."},
  "qtd_talentos_combate": {"formula":"subtrair 1d8 + @USUARIO.qtd_talentos_combate em @ALVO.vida","explicacao":"Uma técnica de veterano soma à rolagem o total de talentos de combate da ficha. Com dois talentos e resultado 5 no d8, causa 7; com quatro, causa 9. O exemplo usa a quantidade do grupo de combate, não o total de todos os talentos."},
  "qtd_aptidoes_aura": {"formula":"se @USUARIO.qtd_aptidoes_aura >= 2 entao somar 3 em @USUARIO.defesa","explicacao":"Uma sinergia protetora concede +3 de Defesa quando o personagem escolheu ao menos duas aptidões da família Aura. Uma aptidão não alcança o requisito; duas ou mais liberam o efeito. A contagem específica distingue essa família das demais aptidões."},
  "tem_talento_<id>": {"formula":"se @USUARIO.tem_talento_especialista_escudos > 0 entao somar 2 em @USUARIO.defesa","explicacao":"Troque `<id>` pelo identificador exato do talento; `especialista_escudos` é o exemplo usado aqui. Se a ficha possui esse talento, recebe +2 de Defesa; se não possui, o efeito não acontece. A chave verifica um talento específico, não a quantidade total."},
  "tem_aptidao_<id>": {"formula":"se @USUARIO.tem_aptidao_aura_protetora > 0 entao somar 2 em @USUARIO.defesa","explicacao":"Substitua `<id>` pelo identificador da aptidão que deseja testar. Neste caso, `aura_protetora` concede +2 de Defesa apenas a quem a adquiriu. A condição vale 1 quando está presente e 0 quando ausente."},
  "tem_habilidade_<id>": {"formula":"se @USUARIO.tem_habilidade_mestre_das_laminas > 0 entao subtrair 1d10 em @ALVO.vida","explicacao":"Use o identificador real da habilidade no lugar de `<id>`; o exemplo testa `mestre_das_laminas`. Se a ficha tem a habilidade, o golpe recebe 1d10; sem ela, não. Isso permite condicionar efeitos a uma escolha individual da especialização."},
  "bloqueio_total": {"formula":"somar 1 em @USUARIO.bloqueio_total","explicacao":"Uma postura defensiva ativa o bloqueio total ao definir a flag como 1. Quando o personagem receber o próximo dano em Vida Atual, o motor absorve esse dano e zera a flag conforme a regra descrita para a chave. O efeito não cria pontos de vida nem acumula bloqueios indefinidamente."},
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
    formula: "se @USUARIO.ado_concedida > 0 e @USUARIO.ado_consumida = 0 entao subtrair 2d6 + @USUARIO.treino em @ALVO.vida",
    explicacao: "Quando um inimigo sai do alcance e o Mestre concede uma AdO, a lança do personagem causa 2d6 mais Treinamento se a oportunidade ainda não foi gasta. Sem concessão ou depois de consumir a AdO, não há ataque. A fórmula une autorização da reação, estado de uso e dano de uma arma de haste.",
  },
  ado_consumida: {
    formula: "se @USUARIO.ado_consumida = 0 entao somar 1 em @USUARIO.ado_consumida, subtrair 1d10 em @ALVO.vida",
    explicacao: "Uma única vez por rodada, o contra-golpe muda a marca de AdO de 0 para 1 e causa 1d10. Quando `ado_consumida` já vale 1, a condição bloqueia outra tentativa. Use esta flag para impedir que a mesma oportunidade de movimento gere ataques repetidos.",
  },
  reacoes_restantes: {
    formula: "se @USUARIO.reacoes_restantes > 0 entao subtrair 1 em @USUARIO.reacoes_restantes, somar 1d8 em @USUARIO.vida_temp",
    explicacao: "Ao aparar um golpe, o personagem gasta uma reação disponível e recebe 1d8 PV temporários para absorver o impacto. Com uma reação restante, consome-a; com zero, não pode aparar. O saldo diminui, mas o limite máximo de reações da ficha permanece.",
  },
  'CENA.distancia_m': {
    formula: "quando @CENA.distancia_m <= 3 -> subtrair 2d6 em @ALVO.vida",
    explicacao: "A lança de guarda ameaça um inimigo quando as peças ficam a até 3 m. Ao entrar nesse alcance, o gatilho causa 2d6; a 4 m ele não dispara. A medida vem da distância real do mapa e evita tratar um alvo fora do alcance como adjacente.",
  },
  'DANO.foi_critico': {
    formula: "se @DANO.foi_critico > 0 entao subtrair 2d10 em @ALVO.vida",
    explicacao: "Um martelo de execução acrescenta 2d10 ao golpe quando a resolução informa que o ataque foi crítico. Se a marca vale 1, os dados extras são rolados; num acerto normal, não. A fórmula lê o resultado registrado, sem tentar inferir o crítico pelo total do dano.",
  },
  "vida_pct_abaixo_25": {
    formula: "se @ALVO.vida_pct_abaixo_25 > 0 entao subtrair 2d10 em @ALVO.vida",
    explicacao: "A técnica de execução acrescenta 2d10 quando o alvo está com no máximo um quarto da Vida Máxima. Com máximo 40, 10 PV ou menos ativa; com 11, não. `criticamente_ferido` é um alias válido para esse mesmo limite.",
  },
  qtd_inimigos_adjacentes: {
    formula: 'subtrair @USUARIO.qtd_inimigos_adjacentes * 6 em @ALVO.vida',
    explicacao: 'Causa 6 pontos de dano por inimigo adjacente ao usuário. Com 3 inimigos adjacentes, o resultado é 18 de dano.',
  },
  "tem_condicao_<id>": {
    formula: "se @ALVO.tem_condicao_atordoado > 0 entao subtrair 2d8 + @USUARIO.treino em @ALVO.vida",
    explicacao: "Substitua `<id>` pelo identificador da condição; aqui, a técnica contra Atordoado soma 2d8 mais Treinamento ao golpe. Se o alvo está Atordoado, aplica; caso contrário, não. O exemplo demonstra como trocar a condição sem criar uma key exclusiva para cada habilidade.",
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

