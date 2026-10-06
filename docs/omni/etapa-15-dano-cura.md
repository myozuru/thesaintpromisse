# Etapa 15 — Dano, cura e ocorrência consolidada

## O que foi corrigido

Ações ativas que combinam dano de arma com dano próprio da habilidade agora preservam os componentes como parcelas tipadas até a mitigação. Por exemplo, uma lâmina cortante que acrescenta dano de fogo testa cada parcela contra a RD, imunidade, resistência e vulnerabilidade do tipo correspondente. O resultado mitigado é somado antes de consumir escudo/PV.

As parcelas pertencem a uma única ocorrência: há uma passagem pelos gatilhos pré-dano, uma janela defensiva, um desconto combinado em proteções e um conjunto de eventos de dano. Efeitos antigos que reduzem o dano total continuam funcionando; quando alteram um golpe composto, o novo total é distribuído proporcionalmente entre suas parcelas, sem apagar seus tipos.

O contexto `@DANO.vida_perdida` expõe quantos PV foram realmente removidos após escudos e outras proteções. `@DANO.valor_final` continua informando o dano após RD, imunidade e resistência/vulnerabilidade, antes de absorção por escudo/PVT. Isso permite diferenciar dano resolvido de perda real de PV em passivas como Rancor.

O dano simples mantém o comportamento anterior e é tratado como uma única parcela. O cálculo de crítico da ação ativa continua multiplicando os dados pelo multiplicador efetivo da arma; valores fixos não são multiplicados. A rolagem base da arma permanece separada do dano extra da ação para evitar somar a arma duas vezes.

A cura foi revisada junto com as ações ativas: `applyHealing` limita PV ao máximo efetivo, registra apenas a quantidade realmente recuperada e emite eventos de cura somente quando houve recuperação. A cura direta de ações ativas continua usando esse caminho canônico; a recuperação de PE também é limitada ao máximo da ficha.

## Arquivos

- `src/lib/omni/contextoDano.ts`: contrato da parcela tipada.
- `src/lib/omni/acaoAtiva.ts`: separa dano da arma e dano adicional ao chamar o resolvedor.
- `src/stores/useCharacterStore.ts`: mitiga cada parcela, consolida o dano e aplica PV/escudo uma vez.
- `src/lib/omni/constantesDoSistema.ts`: documenta `@DANO.vida_perdida`.
- `src/test/omniDanoAuditoria.test.tsx` e `src/test/omniDamageContext.test.ts`: combate composto, uma ocorrência, perda real de PV e absorção por PVT.

## Validação

- Auditoria focada do fluxo de dano e cura: **188 testes passaram em 11 arquivos**.
- Casos atualizados do contexto, cobertura do catálogo e dano composto: **66 testes passaram em 3 arquivos**.
- `npx tsc --noEmit` passou.
- `git diff --check` passou.

O dano composto de ações ativas agora preserva os tipos configurados e da arma. A linguagem ainda não representa parcelas separadas em qualquer fórmula textual arbitrária; a expansão desse formato fica para as etapas de gramática/editor previstas no contrato.
