# Etapa 15 — Aba Invocações e ações OMNI

## Escopo desta entrega

- Criação e edição de ficha, biblioteca, aprovação e comandos de Shikigami ficam no módulo global **Invocações**, separado de **Fichas**.
- Jogadores acessam somente a ficha associada ao próprio perfil. O Mestre pode escolher qualquer personagem como controlador.
- A ficha pode vincular uma entidade e uma ação ativa do catálogo OMNI. O editor apresenta seletores pelo nome, sem exigir que a pessoa copie IDs.
- Ataques e Testes de Resistência OMNI de alvo único ou múltiplo são resolvidos com a ficha, os atributos e a economia de ações do Shikigami. Ações múltiplas exigem um limite inteiro fixo e validam todos os alvos antes de cobrar PE ou ação; o custo é cobrado uma vez por comando. Para TR, a CD usa o atributo escolhido na ficha (Presença por padrão). O custo de PE fica associado a uma distribuição explícita entre controlador e recurso próprio.
- A referência é validada ao salvar e novamente ao executar. Entidade removida, ação inexistente e configuração incompatível retornam erro antes de gastar recursos ou ações.

## Limites registrados

O adaptador aceita dano com fórmula fixa, alcance positivo e custo fixo. Ações múltiplas precisam declarar um limite fixo inteiro; fórmulas dinâmicas para esse limite ainda não são aceitas. A seleção valida mapa, filtro e alcance de todos os alvos antes de debitar recursos. Fórmulas de CD personalizadas no OMNI também são bloqueadas; use o atributo de CD da ficha do Shikigami. Reações, áreas, custos dinâmicos, perícias/disputas, condições, movimentos, efeitos secundários, efeitos contínuos, assistência de dano e desfechos de TR ramificados permanecem bloqueados com motivo explícito. Esses efeitos ainda precisam de um executor OMNI com origem, seleção de alvos, duração e gatilhos próprios de uma instância de invocação.

## Verificação

- `src/test/controladorOmniInvocacao.test.ts`: adaptação de ataque, Teste de Resistência, bloqueio de efeitos ainda não suportados, referência quebrada e presença da aba para os dois papéis.
- `src/test/InvocacoesModule.test.tsx`: acesso por papel e renderização da aba fora da ficha.
- `src/test/controladorMapa.test.ts`: integração dos comandos de ataque e suporte, inclusive TR múltiplo com débito único e rejeição de alvo fora de alcance sem gasto.
- `npx tsc --noEmit --pretty false`
- `npx vitest run src/test/controladorOmniInvocacao.test.ts src/test/InvocacoesModule.test.tsx src/test/controladorMapa.test.ts`
- `npm run build`
- Resultado desta rodada: 56 testes aprovados em 3 arquivos de teste.
