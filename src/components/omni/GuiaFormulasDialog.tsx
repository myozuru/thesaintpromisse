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
import { BookOpen, Sparkles, GripHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { RECEITAS_OMNI, type ReceitaOmni } from '@/lib/omni/receitas';
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
  const inserir = (trecho: string) => {
    if (onInserirFormula) {
      onInserirFormula(trecho);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(trecho).catch(() => {});
    }
  };
  /** Extrai a chave bruta (ex: "vida_max") de strings tipo "@USUARIO.vida_max". */
  const extrairChaveRecurso = (k: string): string | null => {
    const m = k.match(/^@(?:USUARIO|ALVO|CENA)\.(.+)$/);
    if (m) return m[1];
    if (k.startsWith('@')) return null; // @DANO etc — não é recurso de ficha
    return k;
  };
  const Conteudo = (
    <div
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 omni-helper-scroll"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      <Tabs defaultValue={onAplicarReceita ? 'receitas' : 'guia'} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="comandos" className="text-xs gap-1">
            ⌨ Comandos
          </TabsTrigger>
          <TabsTrigger value="guia" className="text-xs gap-1">
            <BookOpen className="h-3.5 w-3.5" /> Chaves
          </TabsTrigger>
          <TabsTrigger value="receitas" className="text-xs gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Receitas
          </TabsTrigger>
          <TabsTrigger value="exemplos" className="text-xs gap-1">
            ✦ Exemplos
          </TabsTrigger>
        </TabsList>

        {/* COMANDOS — Sintaxe da OmniScript ----------------------------- */}
        <TabsContent value="comandos" className="pt-3 space-y-3">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-100 leading-relaxed">
            💡 <strong>Modo Preguiça:</strong> jogadores podem enviar apenas
            <em> Nome e Descrição</em> usando o botão{' '}
            <span className="px-1 rounded bg-amber-500/20 border border-amber-500/40 font-semibold">
              💡 Propor Apenas Conceito
            </span>{' '}
            no rodapé do Construtor. O Mestre pode completar a lógica depois,
            direto no Catálogo (cards marcados com{' '}
            <span className="text-amber-300 font-semibold">"Aguardando mecânica amaldiçoada"</span>).
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Sintaxe da Omni-Script. Escreva no terminal usando palavras naturais — sem
            <code className="text-violet-300 mx-0.5">@</code>, sem símbolos técnicos.
          </p>
          <div className="space-y-2">
            {[
              { cmd: 'somar', sym: '+', cor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10', desc: 'Adiciona ao valor atual do recurso.', ex: 'somar 10 em vida' },
              { cmd: 'subtrair', sym: '−', cor: 'text-destructive border-destructive/40 bg-destructive/10', desc: 'Remove do valor atual (Dano).', ex: 'subtrair 2d6 em vida' },
              { cmd: 'definir', sym: '=', cor: 'text-violet-300 border-violet-500/40 bg-violet-500/10', desc: 'Substitui o valor atual.', ex: 'definir 0 em pe' },
            ].map((c) => (
              <button
                key={c.cmd}
                type="button"
                onClick={() => inserir(`${c.cmd} `)}
                className={`w-full text-left rounded-md border ${c.cor} px-3 py-2 hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <code className="font-mono font-bold">{c.cmd}</code>
                  <span className="opacity-70">[valor]</span>
                  <span className="text-violet-300 font-bold">em</span>
                  <span className="opacity-70">[recurso]</span>
                  <span className="ml-auto font-mono opacity-80">{c.sym}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{c.desc}</div>
                <div className="text-[10px] mt-1 font-mono text-foreground/70">→ {c.ex}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => inserir(', ')}
              className="w-full text-left rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-2 hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-70">[comando]</span>
                <code className="font-mono font-bold text-pink-300">,</code>
                <span className="opacity-70">[comando]</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Encadeia várias ações em sequência (vírgula = próximo comando).
              </div>
              <div className="text-[10px] mt-1 font-mono text-foreground/70">
                → somar 10 em vida, subtrair 5 em pe
              </div>
            </button>
          </div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-muted-foreground">
            <span className="text-amber-400 font-semibold">⚡ Auto-@:</span> chaves canônicas curtas
            (<code>vida</code>, <code>pe</code>, <code>treino</code>, <code>for</code>, <code>des</code>, <code>pericia_feiticaria</code>…)
            são automaticamente tratadas como atributos do usuário — não precisa digitar <code>@</code>.
            Aliases legados (<code>vida_atual</code>, <code>energia</code>, <code>forca</code>, <code>hp</code>, <code>pv</code>…) continuam aceitos
            e são normalizados para a chave curta.
          </div>
        </TabsContent>

        {/* EXEMPLOS — Receitas em forma de script ----------------------- */}
        <TabsContent value="exemplos" className="pt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground italic">
            Clique para inserir o script no terminal em foco.
          </p>
          {[
            { titulo: '💚 Vitalidade Dinâmica', script: 'somar treino * 2 em vida_max',
              expl: 'Aumenta o limite de vida em Dobro do Treino do usuário.' },
            { titulo: '⚔ Ataque Básico', script: 'subtrair for + 2d6 em vida',
              expl: 'Causa dano igual a Força + 2d6 no alvo.' },
            { titulo: '💀 Maldição Severa', script: 'subtrair 10 em vida_max, definir 0 em pe',
              expl: 'Reduz a vida máxima em 10 e zera a energia do alvo.' },
            { titulo: '🩸 Lifesteal Simples', script: 'subtrair 2d6 em vida, somar 1d6 em vida',
              expl: 'Causa dano e cura em sequência (a cura vai para o próximo alvo / usuário).' },
            { titulo: '🔥 Bola de Fogo', script: 'subtrair int + 2d6 em vida',
              expl: 'Dano mágico baseado em Inteligência.' },
            { titulo: '🛡 Buff de Defesa', script: 'somar pericia_feiticaria em defesa',
              expl: 'Adiciona o valor da Perícia Feitiçaria à defesa do alvo.' },
            { titulo: '🌪 AoE Escalável', script: 'subtrair int + nivel em vida',
              expl: 'Dano em área com escala por nível.' },
            { titulo: '🌙 Lua Cheia (gatilho de cena)', script: 'somar 2 em acerto',
              expl: 'Combine com gatilho CENA.eh_noite = 1 no construtor.' },
            { titulo: '🏃 Esprintar', script: 'somar desloc em desloc',
              expl: 'Dobra o deslocamento por uma rodada (use no Bônus de Ação).' },
            { titulo: '🩹 Cura Vital (Bloodied)', script: 'somar treino * 3 em vida',
              expl: 'Gatilho útil: vida_pct_abaixo_50 = 1 (auto-cura quando ferido).' },
            { titulo: '🪖 Postura Defensiva', script: 'somar 2 em defesa, subtrair 2 em acerto',
              expl: 'Trade-off clássico: mais defesa, menos acerto.' },
            { titulo: '⚡ Chakra Surge', script: 'somar 1d4 em pe_max, somar 1d4 em pe',
              expl: 'Expande o pool de PE e enche parcialmente o atual.' },
          ].map((r) => (
            <button
              key={r.titulo}
              type="button"
              onClick={() => inserir(r.script)}
              className="w-full text-left rounded-md border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 p-2.5 transition-colors"
            >
              <div className="text-xs font-semibold text-foreground">{r.titulo}</div>
              <div className="mt-1 text-xs font-mono text-violet-200 bg-zinc-950/60 px-2 py-1 rounded">
                {r.script}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{r.expl}</div>
            </button>
          ))}

          {/* ⚠️ ARMADILHAS COMUNS ------------------------------------------ */}
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-[0.15em] text-amber-300 font-semibold border-b border-amber-400/40 pb-1">
              ⚠️ Armadilhas Comuns (o que NÃO fazer)
            </h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
                <div className="text-destructive font-semibold">❌ Dano fixo com dados</div>
                <div className="text-muted-foreground mt-1">
                  Colocar <code className="font-mono">2d6 + 1d6</code> em um campo de
                  <em> Dano Fixo</em> (Spell.fixedDamage). Esse campo é o "+N" da fórmula
                  <code> Xd? + N</code> — só aceita número inteiro.
                </div>
                <div className="text-emerald-300 text-[11px] mt-1">
                  ✅ Use <code className="font-mono">3</code> como Dano Fixo e configure os dados na fórmula principal.
                </div>
              </div>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
                <div className="text-destructive font-semibold">❌ Divisão sem floor()</div>
                <div className="text-muted-foreground mt-1">
                  <code className="font-mono">@ALVO.vida / 2</code> pode gerar <em>3.5</em>. Recursos vitais não aceitam fracionário.
                </div>
                <div className="text-emerald-300 text-[11px] mt-1">
                  ✅ Use <code className="font-mono">floor(@ALVO.vida / 2)</code> ou <code>ceil(...)</code>.
                </div>
              </div>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
                <div className="text-destructive font-semibold">❌ @ALVO em passiva sem alvo</div>
                <div className="text-muted-foreground mt-1">
                  Passivas <em>aoEquipar</em>/<em>permanente</em> não têm Alvo definido —
                  <code> @ALVO.vida_max</code> retorna 0 e seu buff fica zerado.
                </div>
                <div className="text-emerald-300 text-[11px] mt-1">
                  ✅ Em passivas use <code className="font-mono">@USUARIO.*</code>. Reserve <code>@ALVO</code> para ações ativas.
                </div>
              </div>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
                <div className="text-destructive font-semibold">❌ DEFINIR ao invés de SOMAR em buff</div>
                <div className="text-muted-foreground mt-1">
                  "DEFINIR <code>vida_max = 10</code>" zera a vida máxima e <strong>fixa</strong> em 10
                  (sobrescreve o valor base!).
                </div>
                <div className="text-emerald-300 text-[11px] mt-1">
                  ✅ Para aumentar use <code>SOMAR</code>. <code>DEFINIR</code> é para casos extremos (drenar, congelar valor).
                </div>
              </div>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
                <div className="text-destructive font-semibold">❌ Esquecer o prefixo em fórmulas longas</div>
                <div className="text-muted-foreground mt-1">
                  <code className="font-mono">for + alvo.des</code> mistura — auto-@ resolve <code>for</code> como <code>@USUARIO.for</code>,
                  mas <code>alvo.des</code> precisa do <code>@</code>.
                </div>
                <div className="text-emerald-300 text-[11px] mt-1">
                  ✅ Seja explícito em referências cruzadas: <code>@USUARIO.for + @ALVO.des</code>.
                </div>
              </div>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
                <div className="text-destructive font-semibold">❌ Chaves de inimigo congeladas</div>
                <div className="text-muted-foreground mt-1">
                  Inimigos (categoria <code>INIMIGO</code>) têm <strong>nível e ND travados</strong> após importar do Grimório.
                  Buff que mexe em <code>nivel</code> não terá efeito visual no card de inimigo.
                </div>
              </div>
            </div>
          </section>

          {/* 🎭 RECEITAS POR ARQUÉTIPO -------------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
              🎭 Receitas por Arquétipo
            </h3>
            <p className="text-muted-foreground text-xs">
              Conjuntos prontos. Cada item lista <strong>Ação + Recurso + Fórmula</strong> e o gatilho sugerido.
            </p>

            {/* TANQUE */}
            <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-2.5 space-y-1.5">
              <div className="text-sky-300 font-semibold text-xs">🛡️ Tanque</div>
              <ExemploCard onInsert={inserir} titulo="Postura de Aço (passiva ativa)"
                formula="SOMAR @USUARIO.con em defesa"
                explicacao="Gatilho: aoEquipar — escudo equipado." />
              <ExemploCard onInsert={inserir} titulo="Provocação"
                formula="DEFINIR 1 em ado_concedida (no @ALVO)"
                explicacao="Força o alvo a conceder AdO ao se afastar do tanque." />
              <ExemploCard onInsert={inserir} titulo="Última Resistência"
                formula="SOMAR (treino * 3) em vida_max"
                explicacao="Gatilho: vida_pct_abaixo_25 = 1. Aumento temporário em estado crítico." />
              <ExemploCard onInsert={inserir} titulo="Bloqueio Total"
                formula="DEFINIR 1 em imune_por_cobertura"
                explicacao="Use como reação (gasta 1 reação). Ignora o próximo dano." />
            </div>

            {/* DPS FÍSICO */}
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 space-y-1.5">
              <div className="text-destructive font-semibold text-xs">⚔ DPS Físico</div>
              <ExemploCard onInsert={inserir} titulo="Golpe Pesado"
                formula="SUBTRAIR (@USUARIO.for * 2 + 2d8) em vida"
                explicacao="Gatilho: arma_principal_pesada = 1." />
              <ExemploCard onInsert={inserir} titulo="Duas Armas — Combo"
                formula="SUBTRAIR (@USUARIO.des + 1d6) em vida"
                explicacao="Aplicar 2 vezes. Gatilho: dual_wield = 1." />
              <ExemploCard onInsert={inserir} titulo="Crítico Ampliado (passiva)"
                formula="SOMAR 1 em crit_marg"
                explicacao="Gatilho: arma_grupo_faca = 1 (especialização em facas)." />
              <ExemploCard onInsert={inserir} titulo="Sangue Frio"
                formula="SOMAR 4 em acerto"
                explicacao="Gatilho: ultimo_ataque_errou = 1. Compensação por erro." />
            </div>

            {/* CASTER */}
            <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-2.5 space-y-1.5">
              <div className="text-violet-300 font-semibold text-xs">🔮 Caster</div>
              <ExemploCard onInsert={inserir} titulo="Foco Arcano"
                formula="SOMAR @USUARIO.qtd_feiticos_prontos em spell_attack_bonus"
                explicacao="Quanto mais feitiços prontos, melhor o ataque mágico." />
              <ExemploCard onInsert={inserir} titulo="Conversão de Vida em PE"
                formula="SUBTRAIR 10 em vida, SOMAR 5 em pe"
                explicacao="Sacrifício clássico — encadeie os dois efeitos." />
              <ExemploCard onInsert={inserir} titulo="Pirocinético Especialista"
                formula="SUBTRAIR (@USUARIO.int + 3d6 + @USUARIO.qtd_feiticos_elemento_fogo) em vida"
                explicacao="Dano de fogo escalando com o nº de feitiços de fogo conhecidos." />
              <ExemploCard onInsert={inserir} titulo="Sobrecarga"
                formula="SOMAR (2 * @USUARIO.qtd_concentrando) em spell_attack_bonus"
                explicacao="Mais concentração = mais poder, mas mais frágil." />
            </div>

            {/* SUPORTE */}
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-1.5">
              <div className="text-emerald-300 font-semibold text-xs">💚 Suporte</div>
              <ExemploCard onInsert={inserir} titulo="Bless (vantagem aliada)"
                formula="CONCEDER_VANTAGEM no @ALVO — alvo: atributo:for, escopo: proximo_ataque"
                explicacao="Configurado pelo construtor de vantagem/desvantagem." />
              <ExemploCard onInsert={inserir} titulo="Cura em Massa"
                formula="SOMAR (@USUARIO.sab + @USUARIO.treino + 2d4) em vida"
                explicacao="Aplicar a vários aliados. AoE com alvo coordenado." />
              <ExemploCard onInsert={inserir} titulo="Anular Condição"
                formula="REMOVER_CONDICAO categoria:MENTAL"
                explicacao="Limpa todas as condições mentais do alvo." />
              <ExemploCard onInsert={inserir} titulo="Escudo de Energia"
                formula="SOMAR (@USUARIO.sab * 2) em vida_max"
                explicacao="Vida temporária. Concentração: 1 slot." />
            </div>
          </section>

          {/* 🌌 COOKBOOK DE CENA -------------------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
              🌌 Cookbook de Cena (@CENA.*)
            </h3>
            <p className="text-muted-foreground text-xs">
              Combine variáveis ambientais para criar mecânicas de mundo.
            </p>
            <ExemploCard onInsert={inserir}
              titulo="🌙 Ritual Lunar"
              formula="SOMAR (@USUARIO.int * 2) em spell_attack_bonus"
              explicacao="Gatilho: @CENA.eh_noite = 1. Funciona só sob a lua." />
            <ExemploCard onInsert={inserir}
              titulo="☀️ Vampirismo Inverso"
              formula="SUBTRAIR (@CENA.eh_dia * 5) em vida"
              explicacao="Dano contínuo de 5 enquanto for dia (sol queima)." />
            <ExemploCard onInsert={inserir}
              titulo="🏹 Tiro Crítico de Longa Distância"
              formula="SOMAR (@CENA.distancia >= 10) * 3 em acerto"
              explicacao="+3 de acerto quando o alvo está a 10m ou mais." />
            <ExemploCard onInsert={inserir}
              titulo="🤝 Liderança"
              formula="SOMAR min(@CENA.qtd_aliados, 4) em acerto"
              explicacao="+1 por aliado em cena, até +4. Buff de grupo." />
            <ExemploCard onInsert={inserir}
              titulo="🌧 Tempestade Marcada"
              formula="SUBTRAIR 2 em acerto"
              explicacao="Gatilho: @CENA.eventos_hoje >= 1 com evento 'tempestade'." />
            <ExemploCard onInsert={inserir}
              titulo="⏰ Apostas Tardias"
              formula="SOMAR floor(@CENA.hora / 6) em crit_marg"
              explicacao="Quanto mais tarde, maior o range de crítico (0-3)." />
            <ExemploCard onInsert={inserir}
              titulo="🗓️ Aniversário (buff de cena)"
              formula="SOMAR 2 em treino"
              explicacao="Use no construtor: gatilho @CENA.dia = X e @CENA.mes = Y." />
            <ExemploCard onInsert={inserir}
              titulo="🌀 Onda de Choque (AoE radial)"
              formula="SUBTRAIR (@USUARIO.int + 2d6) em vida"
              explicacao="Aplicar a todos com @CENA.distancia <= 3 — explosão de raio 3m." />
          </section>
        </TabsContent>

        {/* RECEITAS DE BOLO --------------------------------------------- */}
        <TabsContent value="receitas" className="pt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground italic">
            Clique em uma receita para {onAplicarReceita ? 'aplicá-la' : 'ver'} os efeitos prontos.
            Você pode ajustar tudo depois no construtor.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {RECEITAS_OMNI.map((r) => (
              <ReceitaCard
                key={r.id}
                receita={r}
                onAplicar={onAplicarReceita ? () => onAplicarReceita(r.build()) : undefined}
              />
            ))}
          </div>
        </TabsContent>

        {/* GUIA COMPLETO ------------------------------------------------ */}
        <TabsContent value="guia" className="pt-3">
          <div className="space-y-5 text-sm">
            {/* 🎮 PLAYGROUND DO TAB AUTOCOMPLETE ------------------- */}
            <TabAutocompletePlayground onInserir={inserir} />
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-100 leading-relaxed">
              💡 <strong>Dica:</strong> Itens passivos são marcados como{' '}
              <strong>Permanentes</strong> por padrão para funcionarem nos slots de Acessórios
              (Colar, Anel, Pulseira). O bônus só é aplicado enquanto o item estiver equipado num slot —
              ao mover para a Mochila, o efeito é removido instantaneamente.
            </div>
            {/* OMNI-SCRIPT (linguagem natural) ----------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-violet-300 font-semibold border-b border-violet-400/40 pb-1">
                ⌨ Omni-Script — Linguagem Natural
              </h3>
              <p className="text-muted-foreground text-xs">
                No <strong>Modo Avançado</strong>, escreva no terminal usando palavras-chave naturais.
                Comandos: <code className="text-violet-300">somar</code>, <code className="text-violet-300">subtrair</code>,
                <code className="text-violet-300"> definir</code>. Conector de alvo:
                <code className="text-violet-300"> em</code>. Conector de sequência:
                <code className="text-violet-300"> e</code>.
              </p>
              <div className="rounded-md border border-violet-500/40 bg-zinc-950/70 p-2 font-mono text-[11px] leading-relaxed">
                <span className="text-violet-400 font-bold">somar</span>{' '}
                <span className="text-sky-300">treino</span>{' '}
                <span className="text-pink-400">*</span>{' '}
                <span className="text-amber-300">2</span>{' '}
                <span className="text-violet-400 font-bold">em</span>{' '}
                <span className="text-sky-300">vida_max</span>{' '}
                <span className="text-violet-400 font-bold">e</span>{' '}
                <span className="text-violet-400 font-bold">somar</span>{' '}
                <span className="text-amber-300">10</span>{' '}
                <span className="text-violet-400 font-bold">em</span>{' '}
                <span className="text-sky-300">vida</span>
              </div>
              <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                <li>Auto-@: chaves canônicas (<code>vida</code>, <code>pe</code>, <code>treino</code>, <code>for</code>…) viram <code>@USUARIO.chave</code> automaticamente.</li>
                <li>Aliases legados (<code>vida_atual</code>, <code>energia</code>, <code>forca</code>, <code>hp</code>) ainda funcionam — são normalizados internamente.</li>
                <li>O conector <code className="text-violet-300">e</code> executa os comandos em ordem (Ação 1 → Ação 2).</li>
                <li><code>somar</code> = <span className="text-emerald-400">+</span>, <code>subtrair</code> = <span className="text-destructive">−</span>, <code>definir</code> = <span className="text-violet-300">=</span>.</li>
              </ul>
            </section>

            {/* Tríade Ação + Alvo + Recurso (NOVO) ------------------------ */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary font-semibold border-b border-primary/40 pb-1">
                ◎ Tríade Obrigatória — Ação + Recurso + Resultado
              </h3>
              <p className="text-muted-foreground text-xs">
                Todo efeito é definido por <strong>três campos</strong>: o <em>Tipo de Ação</em> (como
                aplicar), o <em>Recurso afetado</em> (em quê) e a <em>Fórmula</em> (quanto).
                Para aumentar atributos ou vida máxima, use a ação{' '}
                <span className="text-emerald-400 font-semibold">SOMAR</span> — o termo "Cura"
                é apenas um caso particular (SOMAR em <code>vida_atual</code>).
              </p>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5">
                  <span className="text-emerald-400 font-bold">🟢 SOMAR</span>
                  <span className="text-muted-foreground ml-2">(Aumentar / Buff)</span>
                  <span className="text-muted-foreground ml-2">Recurso</span>
                  <span className="font-mono mx-1">+</span>
                  <span className="text-muted-foreground">Resultado</span>
                  <span className="ml-2 text-[10px] text-muted-foreground italic">— +Vida Máx, +Força, Cura…</span>
                </div>
                <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5">
                  <span className="text-destructive font-bold">🔴 SUBTRAIR</span>
                  <span className="text-muted-foreground ml-2">(Reduzir / Dano)</span>
                  <span className="text-muted-foreground ml-2">Recurso</span>
                  <span className="font-mono mx-1">−</span>
                  <span className="text-muted-foreground">Resultado</span>
                  <span className="ml-2 text-[10px] text-muted-foreground italic">— retira do recurso alvo</span>
                </div>
                <div className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-1.5">
                  <span className="text-violet-300 font-bold">🟣 DEFINIR</span>
                  <span className="text-muted-foreground ml-2">(Fixar / Set)</span>
                  <span className="text-muted-foreground ml-2">Recurso</span>
                  <span className="font-mono mx-1">=</span>
                  <span className="text-muted-foreground">Resultado</span>
                  <span className="ml-2 text-[10px] text-muted-foreground italic">— iguala exatamente ao resultado</span>
                </div>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs space-y-1">
                <div className="text-primary font-semibold">Exemplo: "Vitalidade Dinâmica" (+Vida Máxima)</div>
                <div className="text-muted-foreground">
                  • <strong>Ação:</strong> 🟢 SOMAR (Aumentar)<br />
                  • <strong>Afetar Recurso:</strong> <code className="text-primary">vida_max</code><br />
                  • <strong>Fórmula:</strong> <code className="text-primary">(@USUARIO.treino * 2)</code>
                </div>
                <p className="text-[10px] text-muted-foreground italic mt-1">
                  Resultado: cada uso adiciona <code>treino × 2</code> ao limite de vida do usuário.
                </p>
              </div>
            </section>

            {/* Chaves Essenciais — atalho rápido fixo no topo --------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary font-semibold border-b border-primary/40 pb-1">
                ★ Chaves Essenciais (clique para {onInserirFormula ? 'inserir' : 'copiar'})
              </h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  { k: '@USUARIO.treino', d: 'Bônus de Treinamento do usuário' },
                  { k: '@USUARIO.vida_max', d: 'Vida máxima do usuário' },
                  { k: '@ALVO.vida', d: 'Vida atual do alvo' },
                  { k: '@CENA.distancia', d: 'Distância (m) usuário → alvo' },
                ].map(({ k, d }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => inserir(k)}
                    className="text-left rounded border border-primary/40 bg-primary/10 px-2 py-1 hover:bg-primary/20 transition-colors"
                  >
                    <code className="text-primary font-mono font-semibold">{k}</code>
                    <span className="text-muted-foreground ml-1.5 text-[10px]">— {d}</span>
                  </button>
                ))}
              </div>
            </section>
            {/* Contextos ----------------------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ① Contextos — Quem sofre o quê?
              </h3>
              <p className="text-muted-foreground">
                Toda fórmula que referencia atributos precisa indicar de quem está
                falando, usando um prefixo:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <ContextoCard
                  cor="bg-sky-500/15 border-sky-500/40 text-sky-300"
                  nome="@USUARIO."
                  descricao="Quem está usando o item / lançando o feitiço."
                  exemplo="@USUARIO.vida / 2"
                />
                <ContextoCard
                  cor="bg-sky-500/15 border-sky-500/40 text-sky-300"
                  nome="@ALVO."
                  descricao="Quem está recebendo o efeito (inimigo ou aliado alvejado)."
                  exemplo="@ALVO.vida / 2"
                />
                <ContextoCard
                  cor="bg-sky-500/15 border-sky-500/40 text-sky-300"
                  nome="@CENA."
                  descricao="Variáveis globais da cena/mesa (definidas pelo Mestre)."
                  exemplo="@CENA.dificuldade"
                />
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
                <span className="text-amber-400 font-semibold">⚡ Atalho:</span>{' '}
                Se você omitir o prefixo (ex: <code>vida</code>), o sistema
                assume <code>@USUARIO.vida</code> automaticamente. Aliases legados
                (<code>vida_atual</code>, <code>energia</code>, <code>forca</code>) são
                normalizados para a chave canônica curta.
              </div>
            </section>

            {/* Chaves disponíveis -------------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ② Chaves Disponíveis (clique para {onInserirFormula ? 'inserir na fórmula' : 'copiar'})
              </h3>
              <p className="text-[10px] text-muted-foreground italic">
                Case-insensitive, com ou sem acento. Use prefixo <code>@USUARIO.</code> ou <code>@ALVO.</code> para escolher o contexto.
                As chaves canônicas são <strong>curtas</strong> (<code>vida</code>, <code>pe</code>, <code>for</code>…) — formas longas
                (<code>vida_atual</code>, <code>energia</code>, <code>forca</code>…) continuam funcionando como aliases.
              </p>
              <div className="space-y-3">
                {[
                  { titulo: 'Atributos (Core Stats)', cor: 'text-sky-300', itens: [
                    ['@USUARIO.for', 'FOR — Força (alias: forca)'],
                    ['@USUARIO.des', 'DES — Destreza (alias: destreza)'],
                    ['@USUARIO.con', 'CON — Constituição (alias: constituicao)'],
                    ['@USUARIO.int', 'INT — Inteligência (alias: inteligencia)'],
                    ['@USUARIO.sab', 'SAB — Sabedoria (alias: sabedoria)'],
                    ['@USUARIO.pre', 'PRE — Presença (alias: presenca, carisma)'],
                  ]},
                  { titulo: 'Recursos Vitais', cor: 'text-emerald-300', itens: [
                    ['@USUARIO.vida', 'Vida atual (alias: vida_atual, hp, pv)'],
                    ['@USUARIO.vida_max', 'Vida máxima'],
                    ['@ALVO.vida', 'Vida atual do alvo'],
                    ['@ALVO.vida_max', 'Vida máxima do alvo'],
                    ['@USUARIO.pe', 'Energia Amaldiçoada atual (alias: energia)'],
                    ['@USUARIO.pe_max', 'Energia Amaldiçoada máxima'],
                    ['@USUARIO.vida_pct_abaixo_25', '1 se vida ≤ 25% do máximo'],
                    ['@USUARIO.vida_pct_abaixo_50', '1 se vida ≤ 50% (alias: bloodied)'],
                    ['@USUARIO.bloodied', '1 quando vida ≤ 50% (alias do anterior)'],
                    ['@USUARIO.criticamente_ferido', '1 quando vida ≤ 25%'],
                    ['@USUARIO.pe_pct_abaixo_25', '1 quando PE ≤ 25%'],
                    ['@USUARIO.pe_pct_abaixo_50', '1 quando PE ≤ 50%'],
                    ['@USUARIO.vida_faltante', 'vida_max − vida_atual'],
                    ['@USUARIO.vida_faltante_pct', 'Percentual de vida perdida (0-100)'],
                  ]},
                  { titulo: 'Progressão', cor: 'text-amber-300', itens: [
                    ['@USUARIO.treino', 'Bônus de Treinamento'],
                    ['@USUARIO.nivel', 'Nível do personagem'],
                    ['@USUARIO.exaustao', 'Nível de Exaustão (alias: nivel_exaustao)'],
                    ['@ALVO.treino', 'Bônus de Treinamento do alvo'],
                    ['@ALVO.nivel', 'Nível do alvo'],
                  ]},
                  { titulo: 'Defesas e Combate', cor: 'text-rose-300', itens: [
                    ['@ALVO.defesa', 'Defesa / CA do alvo'],
                    ['@ALVO.esquiva', 'Esquiva ativa do alvo'],
                    ['@ALVO.rd_curse', 'Resistência Amaldiçoada do alvo'],
                    ['@USUARIO.acerto', 'Modificador de ataque'],
                    ['@USUARIO.crit_marg', 'Margem de Crítico'],
                    ['@USUARIO.crit_mult', 'Multiplicador de Crítico'],
                    ['@USUARIO.desloc', 'Deslocamento (alias: deslocamento)'],
                    ['@USUARIO.velocidade_atual', 'Velocidade efetiva (com modificadores)'],
                    ['@DANO', 'Dano base da arma/habilidade'],
                  ]},
                  { titulo: '👁️ Visão & Iluminação', cor: 'text-cyan-300', itens: [
                    ['@USUARIO.visao_normal', '1 se enxerga normal'],
                    ['@USUARIO.visao_penumbra', '1 se enxerga em penumbra'],
                    ['@USUARIO.visao_escuridao', '1 se enxerga no escuro'],
                    ['@USUARIO.na_penumbra', 'Personagem está em penumbra'],
                    ['@USUARIO.na_escuridao', 'Personagem está no escuro'],
                    ['@USUARIO.esta_iluminado', 'Há fonte de luz sobre ele'],
                    ['@USUARIO.esta_oculto', 'Está escondido'],
                    ['@USUARIO.linha_de_visao', 'Tem LdV até o alvo'],
                    ['@USUARIO.atras_de_cobertura', '1 se atrás de cobertura'],
                    ['@USUARIO.fonte_de_luz_ativa', 'Carrega/emite luz'],
                  ]},
                  { titulo: '⚡ AdO & Reações', cor: 'text-yellow-300', itens: [
                    ['@USUARIO.reacoes_max', 'Reações máximas/rodada'],
                    ['@USUARIO.reacoes_restantes', 'Reações ainda disponíveis'],
                    ['@USUARIO.reacao_usada_nesta_rodada', '1 se já usou reação'],
                    ['@USUARIO.reacoes_usadas_nesta_rodada', 'Quantas reações foram gastas'],
                    ['@USUARIO.ado_concedida', 'AdO concedida por efeito'],
                    ['@USUARIO.ado_modo', 'Modo de AdO ativo'],
                    ['@USUARIO.ado_consumida', 'AdO já gasta'],
                    ['@USUARIO.ado_restrita', 'AdO bloqueada por condição'],
                  ]},
                  { titulo: '🪪 Identidade', cor: 'text-fuchsia-300', itens: [
                    ['@USUARIO.eh_player', '1 se é PJ'],
                    ['@USUARIO.eh_npc', '1 se é NPC'],
                    ['@USUARIO.eh_inimigo', '1 se categoria INIMIGO'],
                  ]},
                  { titulo: '🌀 Concentração', cor: 'text-indigo-300', itens: [
                    ['@USUARIO.qtd_concentrando', 'Efeitos em concentração ativos'],
                    ['@USUARIO.qtd_sustentados', 'Efeitos sustentados ativos'],
                    ['@USUARIO.slots_concentracao_livres', 'Slots de concentração restantes'],
                    ['@USUARIO.slots_sustentado_livres', 'Slots de sustentação restantes'],
                  ]},
                  { titulo: '🗺️ Mapa & Posição', cor: 'text-teal-300', itens: [
                    ['@USUARIO.esta_no_mapa', '1 se token presente no mapa'],
                    ['@USUARIO.em_terreno_dificil', '1 se na casa em terreno difícil'],
                    ['@USUARIO.voando', '1 se voando'],
                    ['@USUARIO.agachado', '1 se agachado'],
                    ['@USUARIO.prono', '1 se caído (prono)'],
                    ['@USUARIO.sobrecarregado', '1 se sobrecarregado'],
                    ['@USUARIO.metros_movidos_neste_turno', 'Metros já movidos neste turno'],
                    ['@USUARIO.usou_corrida', '1 se Correr foi usado'],
                  ]},
                  { titulo: '🤺 Empunhadura & Armas', cor: 'text-orange-300', itens: [
                    ['@USUARIO.desarmado', '1 se sem arma na mão'],
                    ['@USUARIO.duas_maos', '1 se empunhando arma a 2 mãos'],
                    ['@USUARIO.dual_wield', '1 se duas armas (mão dupla)'],
                    ['@USUARIO.escudo_id_equipado', 'ID do escudo equipado (0 se nenhum)'],
                    ['@USUARIO.arma_principal_eh_cac', '1 se principal é corpo-a-corpo'],
                    ['@USUARIO.arma_principal_eh_distancia', '1 se principal é à distância'],
                    ['@USUARIO.arma_principal_fineza', '1 se possui Fineza'],
                    ['@USUARIO.arma_principal_leve', '1 se Leve'],
                    ['@USUARIO.arma_principal_pesada', '1 se Pesada'],
                    ['@USUARIO.arma_principal_versatil', '1 se Versátil'],
                    ['@USUARIO.arma_principal_alcance', 'Alcance corpo-a-corpo (m)'],
                    ['@USUARIO.arma_principal_alcance_curto', 'Alcance curto à distância'],
                    ['@USUARIO.arma_principal_alcance_longo', 'Alcance longo à distância'],
                    ['@USUARIO.arma_principal_crit_range', 'Range de crítico (ex: 19-20 → 2)'],
                    ['@USUARIO.arma_principal_crit_ampliado', '1 se range ampliado (>1)'],
                    ['@USUARIO.arma_grupo_espada', '1 se principal é Espada'],
                    ['@USUARIO.arma_grupo_machado', '1 se principal é Machado'],
                    ['@USUARIO.arma_grupo_faca', '1 se principal é Faca'],
                    ['@USUARIO.ataques_neste_turno', 'Ataques realizados neste turno'],
                    ['@USUARIO.swaps_armas_neste_turno', 'Trocas de arma neste turno'],
                    ['@USUARIO.ultimo_ataque_acertou', '1 se último ataque acertou'],
                    ['@USUARIO.ultimo_ataque_errou', '1 se último ataque errou'],
                  ]},
                  { titulo: '🤕 Condições', cor: 'text-red-300', itens: [
                    ['@USUARIO.qtd_condicoes', 'Quantidade total de condições ativas'],
                    ['@USUARIO.qtd_condicoes_fisica', 'Quantas FÍSICA'],
                    ['@USUARIO.qtd_condicoes_mental', 'Quantas MENTAL'],
                    ['@USUARIO.qtd_condicoes_movimento', 'Quantas MOVIMENTO'],
                    ['@USUARIO.qtd_condicoes_sensorial', 'Quantas SENSORIAL'],
                    ['@USUARIO.qtd_condicoes_incapacitacao', 'Quantas INCAPACITAÇÃO'],
                    ['@USUARIO.qtd_condicoes_vulnerabilidade', 'Quantas VULNERABILIDADE'],
                    ['@USUARIO.tem_condicao_atordoado', '1 se Atordoado ativo'],
                    ['@USUARIO.tem_condicao_envenenado', '1 se Envenenado ativo'],
                    ['@USUARIO.tem_condicao_paralisado', '1 se Paralisado ativo'],
                    ['@USUARIO.tem_condicao_<id>', 'Substitua <id> pela condição desejada'],
                  ]},
                  { titulo: '💰 Economia & Carteiras', cor: 'text-yellow-200', itens: [
                    ['@USUARIO.saldo_total', 'Soma de todas as carteiras'],
                    ['@USUARIO.saldo_padrao', 'Saldo da carteira padrão'],
                    ['@USUARIO.saldo_pessoal', 'Saldo da carteira pessoal'],
                    ['@USUARIO.saldo_ouro', 'Saldo da moeda "ouro"'],
                    ['@USUARIO.saldo_yen', 'Saldo da moeda "yen"'],
                    ['@USUARIO.saldo_<moeda>', 'Saldo de qualquer moeda customizada'],
                    ['@USUARIO.carteiras_qtd', 'Número de carteiras'],
                    ['@USUARIO.carteiras_compartilhadas', 'Quantas são compartilhadas'],
                    ['@USUARIO.tem_carteira_pessoal', '1 se possui carteira pessoal'],
                    ['@USUARIO.tem_moeda_ouro', '1 se tem ≥1 de ouro'],
                    ['@USUARIO.tem_moeda_<moeda>', 'Predicado por moeda'],
                  ]},
                  { titulo: '🎒 Inventário', cor: 'text-amber-200', itens: [
                    ['@USUARIO.qtd_itens_inventario', 'Itens totais no inventário'],
                    ['@USUARIO.qtd_itens_equipados', 'Itens equipados em slots'],
                    ['@USUARIO.tem_item_<id>', '1 se possui o item com ID indicado'],
                    ['@USUARIO.equipado_<id>', '1 se o item está equipado'],
                  ]},
                  { titulo: '💗 Cura & Dano Recebido', cor: 'text-pink-300', itens: [
                    ['@USUARIO.cura_recebida', 'Cura total recebida (acumulada)'],
                    ['@USUARIO.cura_recebida_nesta_rodada', 'Cura na rodada atual'],
                    ['@USUARIO.dano_recebido_nesta_rodada', 'Dano sofrido na rodada atual'],
                    ['@USUARIO.vida_perdida_nesta_rodada', 'Diferença de vida na rodada'],
                    ['@USUARIO.ultimo_dano_recebido', 'Valor do último golpe sofrido'],
                    ['@USUARIO.pode_ser_curado', '1 se vida < máx'],
                    ['@USUARIO.hp_sacrificado', 'HP gasto via Sacrifício'],
                    ['@USUARIO.sacrificio_pct', '% sacrificado da vida_max'],
                    ['@USUARIO.vigor_maldito_usos', 'Usos restantes de Vigor Maldito'],
                    ['@USUARIO.vigor_maldito_max', 'Máx por descanso'],
                    ['@USUARIO.vigor_maldito_disponivel', '1 se ainda pode usar'],
                    ['@USUARIO.slots_descanso_curto', 'Slots disponíveis no descanso curto'],
                    ['@USUARIO.slots_descanso_curto_max', 'Máx de slots'],
                    ['@USUARIO.slots_descanso_curto_pct', '% restante'],
                  ]},
                  { titulo: '🛡️ Cobertura & Ações (PR-7)', cor: 'text-lime-300', itens: [
                    ['@USUARIO.cobertura_meia', '1 se possui meia cobertura'],
                    ['@USUARIO.cobertura_total', '1 se cobertura total'],
                    ['@USUARIO.imune_por_cobertura', '1 quando cobertura concede imunidade'],
                    ['@USUARIO.bonus_defesa_cobertura', 'Bônus de defesa atual'],
                    ['@USUARIO.acao_disponivel', '1 se Ação Padrão livre'],
                    ['@USUARIO.bonus_acao_disponivel', '1 se Bônus livre'],
                    ['@USUARIO.movimento_disponivel', '1 se ainda pode mover'],
                    ['@USUARIO.qtd_vantagens', 'Total de fontes de vantagem'],
                    ['@USUARIO.qtd_desvantagens', 'Total de desvantagens'],
                    ['@USUARIO.tem_vantagem', '1 se ≥1 vantagem'],
                    ['@USUARIO.tem_desvantagem', '1 se ≥1 desvantagem'],
                    ['@USUARIO.vantagem_proximo_ataque', '1 se vantagem pendente em ataque'],
                    ['@USUARIO.vantagem_proximo_tr', '1 se vantagem pendente em TR'],
                    ['@USUARIO.vantagem_proxima_pericia', '1 se vantagem pendente em perícia'],
                    ['@USUARIO.desvantagem_proximo_ataque', '1 se desvantagem em ataque'],
                    ['@USUARIO.desvantagem_proxima_pericia', '1 se desvantagem em perícia'],
                  ]},
                  { titulo: '🎯 Cena Tática', cor: 'text-violet-300', itens: [
                    ['@USUARIO.qtd_aliados_adjacentes', 'Aliados a 1m do usuário'],
                    ['@USUARIO.qtd_inimigos_adjacentes', 'Inimigos a 1m'],
                    ['@USUARIO.qtd_inimigos_proximos', 'Inimigos ≤5m'],
                    ['@USUARIO.qtd_inimigos_engajados', 'Inimigos em engajamento'],
                    ['@USUARIO.aliado_adjacente', '1 se há aliado adjacente'],
                    ['@USUARIO.inimigo_adjacente', '1 se há inimigo adjacente'],
                    ['@USUARIO.flanqueado', '1 se ≥2 inimigos adjacentes'],
                    ['@USUARIO.na_linha_de_frente', '1 se mais próximo de inimigos'],
                    ['@USUARIO.sozinho', '1 se nenhum aliado adjacente'],
                  ]},
                  { titulo: '🔮 Magia & Feitiços', cor: 'text-purple-300', itens: [
                    ['@USUARIO.qtd_feiticos', 'Total de feitiços conhecidos'],
                    ['@USUARIO.qtd_feiticos_prontos', 'Feitiços prontos para uso'],
                    ['@USUARIO.qtd_feiticos_dano', 'Quantos causam dano'],
                    ['@USUARIO.qtd_feiticos_cura', 'Quantos curam'],
                    ['@USUARIO.qtd_feiticos_buff', 'Quantos aplicam buff'],
                    ['@USUARIO.qtd_feiticos_condicao', 'Quantos aplicam condição'],
                    ['@USUARIO.qtd_feiticos_elemento_fogo', 'Feitiços de fogo'],
                    ['@USUARIO.qtd_feiticos_elemento_frio', 'Feitiços de frio'],
                    ['@USUARIO.tem_feitico_pronto', '1 se ≥1 feitiço pronto'],
                    ['@USUARIO.tem_ultimo_feitico', '1 se houve último cast'],
                    ['@USUARIO.tem_feitico_fireball', '1 se conhece "fireball"'],
                    ['@USUARIO.tem_feitico_<id>', 'Predicado por ID do feitiço'],
                    ['@USUARIO.pe_minimo_feitico', 'Custo PE do feitiço mais barato'],
                    ['@USUARIO.pe_maximo_feitico', 'Custo PE do mais caro'],
                    ['@USUARIO.pe_por_rodada_sustentado', 'PE/rodada gasto em sustentados'],
                    ['@USUARIO.spell_attack_bonus', 'Bônus de ataque mágico'],
                    ['@USUARIO.qtd_buffs_ativos', 'Buffs ativos no usuário'],
                    ['@USUARIO.qtd_buffs_sustentados', 'Buffs que exigem sustentação'],
                    ['@USUARIO.tem_buff_bless', '1 se "bless" ativo'],
                    ['@USUARIO.tem_buff_<id>', 'Predicado por ID do buff'],
                    ['@USUARIO.au_concentrada', '1 se Aura concentrada'],
                    ['@USUARIO.absorcao_armada', '1 se Absorção pronta'],
                    ['@USUARIO.imbuir_armado', '1 se Imbuir pronto'],
                    ['@USUARIO.foco_destruicao', '1 se foco em Destruição'],
                    ['@USUARIO.foco_economia', '1 se foco em Economia'],
                    ['@USUARIO.foco_refino', '1 se foco em Refino'],
                    ['@USUARIO.tecnica_amaldicoada_definida', '1 se TA escolhida'],
                    ['@USUARIO.qtd_fundamentos_tecnica', 'Fundamentos da TA'],
                  ]},
                  { titulo: '⚔ Combate (Iniciativa)', cor: 'text-rose-300', itens: [
                    ['@USUARIO.em_combate', '1 se combate ativo'],
                    ['@USUARIO.eh_meu_turno', '1 se é o turno do usuário'],
                    ['@USUARIO.proximo_no_turno', '1 se será o próximo'],
                    ['@USUARIO.ultimo_no_turno', '1 se é o último da ordem'],
                    ['@USUARIO.numero_da_rodada', 'Rodada atual'],
                    ['@USUARIO.ordem_na_iniciativa', 'Posição (1 = primeiro)'],
                    ['@USUARIO.turnos_ate_meu', 'Turnos restantes até o seu'],
                    ['@USUARIO.iniciativa_bonus', 'Bônus de iniciativa'],
                    ['@USUARIO.iniciativa_rolagem', 'Valor rolado'],
                    ['@USUARIO.iniciativa_total', 'Bônus + rolagem'],
                    ['@USUARIO.qtd_participantes_combate', 'Total na cena'],
                    ['@USUARIO.metros_movidos_combate', 'Total movido no combate'],
                    ['@USUARIO.turno_cronometro_ativo', '1 se cronômetro rodando'],
                    ['@USUARIO.turno_duracao_seg', 'Duração configurada'],
                    ['@USUARIO.turno_segundos_restantes', 'Segundos restantes'],
                    ['@USUARIO.turno_pausado', '1 se pausado'],
                  ]},
                  { titulo: '🧮 Meta (Contadores/Flags)', cor: 'text-slate-300', itens: [
                    ['@USUARIO.qtd_contadores_omni', 'Contadores Omni ativos'],
                    ['@USUARIO.qtd_flags_omni', 'Flags Omni ativas'],
                  ]},
                  { titulo: 'Cena (Ambiente)', cor: 'text-violet-300', itens: [
                    ['@CENA.rodada', 'Rodada atual do combate'],
                    ['@CENA.distancia', 'Distância (m) Usuário → Alvo'],
                    ['@CENA.dt', 'DC / Dificuldade do Mestre'],
                    ['@CENA.hora', 'Hora atual (0-23)'],
                    ['@CENA.minuto', 'Minuto (0-59)'],
                    ['@CENA.segundo', 'Segundo (0-59)'],
                    ['@CENA.dia', 'Dia do mês'],
                    ['@CENA.mes', 'Mês (1-12)'],
                    ['@CENA.ano', 'Ano'],
                    ['@CENA.relogio_ativo', '1 se cronos ligado'],
                    ['@CENA.multiplicador_tempo', 'Velocidade do tempo'],
                    ['@CENA.timestamp_segundos', 'Timestamp epoch (s)'],
                    ['@CENA.eh_amanhecer', '1 entre 5h-7h'],
                    ['@CENA.eh_dia', '1 entre 7h-18h'],
                    ['@CENA.eh_anoitecer', '1 entre 18h-20h'],
                    ['@CENA.eh_noite', '1 entre 20h-5h'],
                    ['@CENA.eventos_hoje', 'Nº de eventos do calendário hoje'],
                    ['@CENA.qtd_tokens', 'Tokens no mapa'],
                    ['@CENA.qtd_aliados', 'Aliados em cena'],
                    ['@CENA.qtd_inimigos', 'Inimigos em cena'],
                    ['@CENA.token_x', 'Posição X do token (centralizada)'],
                    ['@CENA.token_y', 'Posição Y do token'],
                  ]},
                  { titulo: '🥋 Perícias da Ficha', cor: 'text-orange-300', itens: [
                    ['@USUARIO.pericia_atletismo', 'Atletismo (FOR)'],
                    ['@USUARIO.pericia_acrobacia', 'Acrobacia (DES)'],
                    ['@USUARIO.pericia_furtividade', 'Furtividade (DES)'],
                    ['@USUARIO.pericia_prestidigitacao', 'Prestidigitação (DES)'],
                    ['@USUARIO.pericia_feiticaria', 'Feitiçaria (INT)'],
                    ['@USUARIO.pericia_historia', 'História (INT)'],
                    ['@USUARIO.pericia_investigacao', 'Investigação (INT)'],
                    ['@USUARIO.pericia_oficio1', 'Ofício 1 (INT)'],
                    ['@USUARIO.pericia_oficio2', 'Ofício 2 (INT)'],
                    ['@USUARIO.pericia_oficio3', 'Ofício 3 (INT)'],
                    ['@USUARIO.pericia_tecnologia', 'Tecnologia (INT)'],
                    ['@USUARIO.pericia_teologia', 'Teologia (INT)'],
                    ['@USUARIO.pericia_direcao', 'Direção (SAB)'],
                    ['@USUARIO.pericia_intuicao', 'Intuição (SAB)'],
                    ['@USUARIO.pericia_medicina', 'Medicina (SAB)'],
                    ['@USUARIO.pericia_ocultismo', 'Ocultismo (SAB)'],
                    ['@USUARIO.pericia_percepcao', 'Percepção (SAB)'],
                    ['@USUARIO.pericia_sobrevivencia', 'Sobrevivência (SAB)'],
                    ['@USUARIO.pericia_enganacao', 'Enganação (PRE)'],
                    ['@USUARIO.pericia_intimidacao', 'Intimidação (PRE)'],
                    ['@USUARIO.pericia_performance', 'Performance (PRE)'],
                    ['@USUARIO.pericia_persuasao', 'Persuasão (PRE)'],
                  ]},
                ].map((cat) => (
                  <div key={cat.titulo}>
                    <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${cat.cor}`}>{cat.titulo}</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-xs">
                      {cat.itens.map(([k, d]) => (
                        <div
                          key={k}
                          className="flex items-stretch rounded border border-border/50 bg-background/40 hover:border-primary/60 transition-colors overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => inserir(k)}
                            title={onInserirFormula ? 'Inserir na fórmula em foco' : 'Copiar para área de transferência'}
                            className="flex-1 min-w-0 text-left px-2 py-1 hover:bg-primary/10 cursor-pointer"
                          >
                            <code className="text-primary font-mono">{k}</code>
                            <span className="text-muted-foreground ml-1.5">— {d}</span>
                          </button>
                          {onSelecionarRecurso && extrairChaveRecurso(k) && (
                            <button
                              type="button"
                              onClick={() => {
                                const chave = extrairChaveRecurso(k);
                                if (chave) onSelecionarRecurso(chave);
                              }}
                              title="Definir como Recurso Afetado do efeito atual"
                              className="px-2 border-l border-border/50 text-emerald-300 hover:bg-emerald-500/15 text-[10px] font-semibold shrink-0"
                            >
                              🎯 Alvo
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Funções matemáticas ------------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ③ Funções Matemáticas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <FuncCard fn="floor(x)" desc="Arredonda para baixo." ex="floor(7.8) = 7" />
                <FuncCard fn="ceil(x)" desc="Arredonda para cima." ex="ceil(7.2) = 8" />
                <FuncCard fn="round(x)" desc="Arredonda para o mais próximo." ex="round(7.5) = 8" />
                <FuncCard fn="min(a, b)" desc="Menor entre os valores." ex="min(@FOR, 5)" />
                <FuncCard fn="max(a, b)" desc="Maior entre os valores." ex="max(@DES, @FOR)" />
                <FuncCard fn="abs(x)" desc="Valor absoluto." ex="abs(-3) = 3" />
              </div>
            </section>

            {/* Notações de Dado ---------------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ④ Rolagem de Dados
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <FuncCard fn="XdY" desc="Rola X dados de Y faces." ex="2d6, 1d20" />
                <FuncCard fn="XdY!" desc="Explosão: re-rola e soma se sair max." ex="1d6! → pode passar de 6" />
                <FuncCard fn="XdYkhN" desc="Vantagem: mantém os N maiores." ex="2d20kh1" />
                <FuncCard fn="XdYklN" desc="Desvantagem: mantém os N menores." ex="2d20kl1" />
                <FuncCard fn="XdYrN" desc="Reroll de resultados ≤ N (uma vez)." ex="4d6r1" />
              </div>
            </section>

            {/* Exemplos práticos --------------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ⑤ Exemplos Práticos
              </h3>
              <ExemploCard onInsert={inserir}
                titulo="🩸 Dano por Sacrifício"
                formula="floor(@USUARIO.vida * 0.1)"
                explicacao="10% da vida atual de quem usa o item."
              />
              <ExemploCard onInsert={inserir}
                titulo="⚔ Golpe de Misericórdia"
                formula="@ALVO.vida / 2"
                explicacao="Causa dano igual à metade da vida atual do inimigo."
              />
              <ExemploCard onInsert={inserir}
                titulo="🔥 Bola de Fogo Escalável"
                formula="@INT + 2d6 + ceil(@NIVEL / 3)"
                explicacao="Atributo de Inteligência + 2d6 + bônus por nível arredondado para cima."
              />
              <ExemploCard onInsert={inserir}
                titulo="🛡 Barreira por Vontade"
                formula="@USUARIO.sab * @USUARIO.treino"
                explicacao="Sabedoria do usuário multiplicada pelo bônus de treinamento."
              />
              <ExemploCard onInsert={inserir}
                titulo="💀 Maldição de Equilíbrio"
                formula="abs(@USUARIO.vida - @ALVO.vida)"
                explicacao="Diferença absoluta entre a vida do usuário e do alvo."
              />
              <ExemploCard onInsert={inserir}
                titulo="🎯 Crítico com Vantagem"
                formula="2d20kh1 + @USUARIO.des"
                explicacao="Rola 2d20 e mantém o maior + Destreza."
              />
              <ExemploCard onInsert={inserir}
                titulo="✚ Cura Direta"
                formula="@ALVO.vida + 10"
                explicacao="Restaura 10 pontos de vida no alvo (use Ação: SOMAR e Recurso: vida)."
              />
              <ExemploCard onInsert={inserir}
                titulo="✚ Cura Percentual (20%)"
                formula="@ALVO.vida_max * 0.2"
                explicacao="Restaura 20% da vida máxima do alvo."
              />
              <ExemploCard onInsert={inserir}
                titulo="✦ Buff Fixo de Acerto"
                formula="@USUARIO.acerto + 5"
                explicacao="Define +5 fixo ao modificador de ataque do usuário (use Ação: DEFINIR e Recurso: acerto)."
              />
              <ExemploCard onInsert={inserir}
                titulo="✦ Vida Máx por Constituição"
                formula="@USUARIO.con * 3"
                explicacao="Aumenta Vida Máxima em 3× o atributo de Constituição."
              />
              <ExemploCard onInsert={inserir}
                titulo="🩸 Fúria do Ferido"
                formula="@USUARIO.for + (@USUARIO.vida_pct_abaixo_50 * 4)"
                explicacao="+4 de dano enquanto estiver Bloodied (vida ≤ 50%)."
              />
              <ExemploCard onInsert={inserir}
                titulo="🌑 Predador Noturno"
                formula="@USUARIO.des + (@CENA.eh_noite * 3)"
                explicacao="Ganha +3 de bônus quando a cena está à noite."
              />
              <ExemploCard onInsert={inserir}
                titulo="🎯 Tiro Certeiro à Distância"
                formula="@USUARIO.des + (@CENA.distancia <= @USUARIO.arma_principal_alcance_curto) * 2"
                explicacao="+2 dentro do alcance curto da arma equipada."
              />
              <ExemploCard onInsert={inserir}
                titulo="🪢 Flanqueio (apoio tático)"
                formula="2 * @USUARIO.flanqueado"
                explicacao="Aplica +2 só quando há ≥2 inimigos adjacentes ao usuário."
              />
              <ExemploCard onInsert={inserir}
                titulo="🤝 Ataque Coordenado"
                formula="min(@USUARIO.qtd_aliados_adjacentes, 3)"
                explicacao="Bônus de 1 por aliado adjacente, até +3."
              />
              <ExemploCard onInsert={inserir}
                titulo="🧠 Sobrecarga Concentrada"
                formula="-2 * @USUARIO.qtd_concentrando"
                explicacao="Penalidade por feitiço em concentração mantido."
              />
              <ExemploCard onInsert={inserir}
                titulo="💰 Bônus por Riqueza"
                formula="floor(@USUARIO.saldo_total / 1000)"
                explicacao="+1 a cada 1000 de saldo total (carteiras combinadas)."
              />
              <ExemploCard onInsert={inserir}
                titulo="🥋 Mestre de Arma (combo de chaves)"
                formula="@USUARIO.pericia_feiticaria + (@USUARIO.arma_grupo_espada * 2)"
                explicacao="Feitiçaria + 2 se a arma principal pertence ao grupo Espada."
              />
              <ExemploCard onInsert={inserir}
                titulo="🛡 Bônus de Cobertura"
                formula="@USUARIO.bonus_defesa_cobertura"
                explicacao="Lê diretamente o bônus dado pela cobertura ativa."
              />
              <ExemploCard onInsert={inserir}
                titulo="🔥 Especialista Pirocinético"
                formula="2 + @USUARIO.qtd_feiticos_elemento_fogo"
                explicacao="+1 por feitiço de fogo conhecido."
              />
              <ExemploCard onInsert={inserir}
                titulo="⏱️ Iniciativa Bruta"
                formula="@USUARIO.des + @USUARIO.iniciativa_bonus"
                explicacao="Para usar como Definir em iniciativa_total."
              />
              <ExemploCard onInsert={inserir}
                titulo="🏃 Travessia Difícil"
                formula="@USUARIO.desloc - (3 * @USUARIO.em_terreno_dificil)"
                explicacao="Reduz deslocamento em 3 quando em terreno difícil."
              />
              <ExemploCard onInsert={inserir}
                titulo="🎭 Maldição da Identidade Revelada"
                formula="(1 - @USUARIO.esta_oculto) * 2"
                explicacao="Penalidade enquanto NÃO está oculto."
              />
            </section>

            {/* Vantagem / Desvantagem ---------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ⑧ Vantagem & Desvantagem (Conceder)
              </h3>
              <p className="text-muted-foreground text-xs">
                As ações <code className="text-emerald-300">CONCEDER_VANTAGEM</code> e
                <code className="text-rose-300"> CONCEDER_DESVANTAGEM</code> aplicam modificadores
                de rolagem com <strong>escopo configurável</strong> (próximo ataque, próximo TR,
                até o fim do turno) e <strong>alvo segmentado</strong> (atributo, perícia, TR
                específico, ataques à distância, grupo de armas como "Machado", ou arma específica).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                <FuncCard fn="alvo: atributo:for" desc="Vantagem em rolagens de Força." ex="próximo dado de FOR" />
                <FuncCard fn="alvo: pericia:furtividade" desc="Vantagem na perícia escolhida." ex="próxima rolagem de furtividade" />
                <FuncCard fn="alvo: tr:reflexos" desc="Vantagem em TR de Reflexos." ex="próximo TR" />
                <FuncCard fn="alvo: ataque:distancia" desc="Vantagem em ataques à distância." ex="próximo ataque" />
                <FuncCard fn="alvo: arma_grupo:machado" desc="Vantagem com qualquer machado." ex="grupo de armas" />
                <FuncCard fn="alvo: arma:Espada Curta" desc="Vantagem com arma específica." ex="por nome de arma" />
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-muted-foreground">
                <span className="text-amber-400 font-semibold">⏳ Escopos:</span>{' '}
                <code>proximo_ataque</code>, <code>proximo_tr</code>, <code>proximo_dado</code>,
                {' '}<code>fim_do_turno</code>. Modificadores "próximo X" são consumidos no primeiro uso;
                "fim do turno" persiste até o final da rodada.
              </div>
            </section>

            {/* Resultados encadeados ----------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ⑥ Encadeamento de Efeitos (@RESULTADO_N)
              </h3>
              <p className="text-muted-foreground text-xs">
                Quando uma entidade tem <strong>vários efeitos</strong>, cada efeito posterior pode
                referenciar o resultado de um anterior usando <code>@RESULTADO_N</code> (1-indexado).
              </p>
              <ExemploCard onInsert={inserir}
                titulo="🩸 Adaga Vampírica (Lifesteal)"
                formula={`#1: 1d6 + @USUARIO.for   → ALVO (SUBTRAIR)\n#2: @RESULTADO_1 / 2     → USUARIO (SOMAR vida)`}
                explicacao="O efeito #1 causa dano. O efeito #2 cura o usuário em metade do dano causado."
              />
              <ExemploCard onInsert={inserir}
                titulo="⚡ Choque Encadeado"
                formula={`#1: 2d6                  → ALVO (SUBTRAIR)\n#2: floor(@RESULTADO_1 / 2) → ALVO (SUBTRAIR)`}
                explicacao="O segundo dano arca em metade do primeiro (dano em cadeia)."
              />
              <ExemploCard onInsert={inserir}
                titulo="💀 Execução (dobra se matou)"
                formula={`#1: 2d8 + @USUARIO.for         → ALVO (SUBTRAIR vida)\n#2: @RESULTADO_1 * (@ALVO.vida <= 0) → ALVO (SUBTRAIR vida)`}
                explicacao="Se o ataque #1 derrubou o alvo (vida ≤ 0), #2 aplica novamente o mesmo dano — clava final."
              />
              <ExemploCard onInsert={inserir}
                titulo="❄️ Cone de Gelo + Lento"
                formula={`#1: @USUARIO.int + 2d6              → ALVO (SUBTRAIR vida)\n#2: aplicar condição "lento" se @RESULTADO_1 > 10`}
                explicacao="Dano elemental no #1; se passou de 10, o gatilho do #2 (condicional no construtor) aplica Lento."
              />
              <ExemploCard onInsert={inserir}
                titulo="🌟 Overkill = Cura"
                formula={`#1: @USUARIO.int + 3d6                       → ALVO (SUBTRAIR vida)\n#2: max(0, @RESULTADO_1 - @ALVO.vida_max) → USUARIO (SOMAR vida)`}
                explicacao="Cura o usuário com o dano que excedeu a vida máxima do alvo."
              />
              <ExemploCard onInsert={inserir}
                titulo="🔁 Ricochete em Cadeia"
                formula={`#1: 2d6 + @USUARIO.des        → ALVO (SUBTRAIR)\n#2: floor(@RESULTADO_1 * 0.6) → ALVO2 (SUBTRAIR)\n#3: floor(@RESULTADO_2 * 0.6) → ALVO3 (SUBTRAIR)`}
                explicacao="Cada alvo subsequente recebe 60% do dano anterior."
              />
            </section>

            {/* Imunidade nativa ---------------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ⑨ Imunidade a Condições (Conceder)
              </h3>
              <p className="text-muted-foreground text-xs">
                A ação <code className="text-emerald-300">CONCEDER_IMUNIDADE</code> bloqueia condições
                <strong> na fonte</strong> — o <code>addCondition</code> nem persiste no personagem
                (não é "remover depois", é imunidade real). Use no campo <code>caminhoAlvo</code>:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                <FuncCard fn="todas" desc="Imune a TODAS as condições." ex="caminhoAlvo: todas" />
                <FuncCard fn="categoria:MENTAL" desc="Imune à categoria inteira." ex="FÍSICA, MENTAL, MOVIMENTO, SENSORIAL, INCAPACITAÇÃO, VULNERABILIDADE" />
                <FuncCard fn="condicao:atordoado" desc="Imune a uma condição específica." ex="condicao:envenenado" />
                <FuncCard fn="REMOVER_IMUNIDADE" desc="Retira o escopo concedido." ex="mesmo formato no caminhoAlvo" />
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-[11px] text-muted-foreground">
                <span className="text-emerald-400 font-semibold">Exemplo passivo:</span>{' '}
                Crie uma <em>Passiva</em> com gatilho <code>aoEquipar</code>, ação{' '}
                <code>Conceder Imunidade</code>, alvo <code>USUARIO</code> e{' '}
                <code>caminhoAlvo: categoria:MENTAL</code>. Enquanto o item estiver equipado, o
                portador não recebe Abalado, Amedrontado, Aterrorizado, Confuso nem Enfeitiçado.
              </div>
            </section>

            {/* Percentagens -------------------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.15em] text-primary/80 font-semibold border-b border-primary/30 pb-1">
                ⑦ Suporte a Percentagens
              </h3>
              <div className="text-xs text-muted-foreground space-y-1.5">
                <p>
                  Multiplique por um decimal para escalar valores. Atalhos úteis:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <span className="text-emerald-400 font-semibold">Aumentar 15%</span>:
                    {' '}<code className="font-mono">valor * 1.15</code>
                  </li>
                  <li>
                    <span className="text-destructive font-semibold">Reduzir 20%</span>:
                    {' '}<code className="font-mono">valor * 0.8</code>
                  </li>
                  <li>
                    <span className="text-emerald-400 font-semibold">Cura de 25% da vida máx.</span>:
                    {' '}<code className="font-mono">@ALVO.vida_max * 0.25</code>
                  </li>
                  <li>
                    <span className="text-destructive font-semibold">Dano = 10% da vida atual</span>:
                    {' '}<code className="font-mono">floor(@ALVO.vida * 0.1)</code>
                  </li>
                </ul>
              </div>
            </section>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  if (modo === 'flutuante') {
    return <PainelLateral aberto={aberto} onClose={onClose}>{Conteudo}</PainelLateral>;
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            📖 Bíblia de Fórmulas Omni-Engine
          </DialogTitle>
        </DialogHeader>
        {Conteudo}
      </DialogContent>
    </Dialog>
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
    if (e.button !== 0) return;
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
  }, [moverPainel]);

  if (!mounted || !aberto || typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      ref={panelRef}
      data-omni-helper
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="fixed w-[420px] max-w-[92vw] h-[80vh] max-h-[720px] flex flex-col rounded-lg border border-primary/30 bg-background/95 backdrop-blur-md shadow-2xl shadow-primary/20"
      style={{ zIndex: 10000, left: posicao.x, top: posicao.y, pointerEvents: 'auto' }}
    >
      <DragHandleBar onClose={onClose} onStartDrag={iniciarArraste} />
      <div className="flex-1 min-h-0 flex flex-col p-4 pt-2">{children}</div>
    </motion.div>,
    document.body,
  );
}

function DragHandleBar({ onClose, onStartDrag }: { onClose: () => void; onStartDrag: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onStartDrag}
      className="flex items-center justify-between gap-2 px-3 py-2 border-b border-primary/20 bg-primary/5 rounded-t-lg cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex items-center gap-2 text-primary text-sm font-semibold">
        <GripHorizontal className="h-4 w-4 opacity-70" />
        📖 Omni-Helper
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
        aria-label="Fechar Omni-Helper"
      >
        <X className="h-4 w-4" />
      </button>
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
          <div className="text-[11px] text-muted-foreground mt-0.5">{receita.descricao}</div>
        </div>
        {onAplicar && (
          <span className="text-[10px] uppercase tracking-wider text-primary font-semibold shrink-0">
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
      <div className="text-[11px] mt-1 opacity-90">{descricao}</div>
      <div className="text-[10px] mt-1.5 font-mono bg-background/50 px-1.5 py-0.5 rounded">
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
      <div className="text-[10px] mt-1 font-mono text-foreground/70">→ {ex}</div>
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
      <div className="text-[11px] text-muted-foreground mt-1">{explicacao}</div>
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
      <p className="text-[11px] text-muted-foreground">
        Digite no mini-terminal abaixo. Pressione <kbd className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 font-mono text-[10px]">Tab</kbd> para autocompletar / ciclar,
        {' '}<kbd className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 font-mono text-[10px]">↑ ↓</kbd> para navegar,
        {' '}<kbd className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 font-mono text-[10px]">Enter</kbd> aceita,
        {' '}<kbd className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 font-mono text-[10px]">Esc</kbd> fecha.
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
          className="block w-full resize-none bg-transparent text-violet-100 caret-violet-300 selection:bg-violet-500/30 placeholder:text-muted-foreground/40 font-mono text-[13px] leading-[1.5] border-0 focus:outline-none p-3 min-h-[3.5em]"
          style={{ fontFamily: 'JetBrains Mono, Courier New, monospace' }}
          placeholder="experimente digitar: somar pe… ou subtrair vida_pct…"
        />

        {sugestoes.length > 0 && (
          <div
            className="absolute left-3 top-full z-50 mt-1 max-h-64 w-80 overflow-auto rounded-md border border-violet-500/40 bg-zinc-950/95 shadow-xl shadow-violet-900/40 backdrop-blur"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-violet-300/70 border-b border-violet-500/20">
              "{prefixo}" · {sugestoes.length} sugestão(ões) · Tab cicla · Enter aceita
            </div>
            {sugestoes.map((s, i) => (
              <button
                key={s.valor + i}
                type="button"
                className={`block w-full text-left px-2 py-1 font-mono text-[12px] transition-colors ${
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
                <span className="ml-2 text-[10px] text-zinc-500">{s.categoria}</span>
                {s.hint && (
                  <div className="text-[10px] text-zinc-500 truncate">{s.hint}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mock visual estático (caso o usuário ainda não tenha digitado) ----- */}
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer hover:text-violet-300 transition-colors">
          📸 Ver exemplo visual do dropdown (estático)
        </summary>
        <div className="mt-2 relative rounded-md border border-violet-500/40 bg-zinc-950/80 p-3">
          <div className="font-mono text-[13px] leading-[1.5]" style={{ fontFamily: 'JetBrains Mono, Courier New, monospace' }}>
            <span className="text-violet-400 font-bold">somar</span>{' '}
            <span className="text-sky-300">treino</span>{' '}
            <span className="text-pink-400">*</span>{' '}
            <span className="text-amber-300">2</span>{' '}
            <span className="text-violet-400 font-bold">em</span>{' '}
            <span className="text-sky-300">vid</span>
            <span className="inline-block w-[2px] h-3 bg-violet-300 ml-0.5 align-middle animate-pulse" />
          </div>
          <div className="mt-2 w-80 rounded-md border border-violet-500/40 bg-zinc-950/95 shadow-xl shadow-violet-900/40">
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-violet-300/70 border-b border-violet-500/20">
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
                className={`block w-full text-left px-2 py-1 font-mono text-[12px] ${
                  s.sel ? 'bg-violet-500/30 text-violet-100' : 'text-zinc-200'
                }`}
              >
                <span className="text-violet-300">vid</span><span>{s.v.slice(3)}</span>
                <span className="ml-2 text-[10px] text-zinc-500">{s.cat}</span>
                <div className="text-[10px] text-zinc-500 truncate">{s.hint}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 italic">
            ↑ Após o <kbd className="px-1 rounded bg-violet-500/20 border border-violet-500/30 font-mono">Tab</kbd>, "<code>vid</code>" vira "<code className="text-violet-300">vida</code>" e o caret pula para o fim da palavra. Apertar Tab de novo cicla para "<code>vida_max</code>", e por aí vai.
          </div>
        </div>
      </details>

      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[11px] text-emerald-200">
        💡 No <strong>Construtor</strong> e no <strong>Modo Avançado</strong>, o autocomplete já está
        ativo em todos os campos de fórmula. Use os botões abaixo para inserir chaves prontas no terminal em foco.
      </div>
    </section>
  );
}

