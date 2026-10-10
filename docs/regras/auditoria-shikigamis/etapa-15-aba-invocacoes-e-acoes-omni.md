# Etapa 15 — Aba Invocações e ações OMNI

## Escopo desta entrega

- Criação e edição de ficha, biblioteca, aprovação e comandos de Shikigami ficam no módulo global **Invocações**, separado de **Fichas**.
- Jogadores acessam somente a ficha associada ao próprio perfil. O Mestre pode escolher qualquer personagem como controlador.
- A ficha pode vincular uma entidade e uma ação ativa do catálogo OMNI. O editor apresenta seletores pelo nome, sem exigir que a pessoa copie IDs.
- Ataques e Testes de Resistência OMNI de alvo único são resolvidos com a ficha, os atributos e a economia de ações do Shikigami. Para TR, a CD usa o atributo escolhido na ficha (Presença por padrão). O custo de PE fica associado a uma distribuição explícita entre controlador e recurso próprio.
- A referência é validada ao salvar e novamente ao executar. Entidade removida, ação inexistente e configuração incompatível retornam erro antes de gastar recursos ou ações.

## Limites registrados

O adaptador atual aceita apenas dano com fórmula fixa, alcance positivo, custo fixo e um alvo. Fórmulas de CD personalizadas no OMNI também são bloqueadas; use o atributo de CD da ficha do Shikigami. Reações, áreas, múltiplos alvos, custos dinâmicos, perícias/disputas, condições, movimentos, efeitos secundários, efeitos contínuos, assistência de dano e desfechos de TR ramificados permanecem bloqueados com motivo explícito. Esses efeitos ainda precisam de um executor OMNI com origem, seleção de alvos, duração e gatilhos próprios de uma instância de invocação.

## Verificação

- `src/test/controladorOmniInvocacao.test.ts`: adaptação de ataque, Teste de Resistência, bloqueio de efeitos ainda não suportados, referência quebrada e presença da aba para os dois papéis.
- `src/test/InvocacoesModule.test.tsx`: acesso por papel e renderização da aba fora da ficha.
- `src/test/controladorMapa.test.ts`: integração dos comandos de ataque e suporte com o controlador.
- `npx tsc --noEmit --pretty false`
- `npx vitest run src/test/controladorOmniInvocacao.test.ts src/test/InvocacoesModule.test.tsx src/test/controladorMapa.test.ts`
- `npm run build`
- Resultado desta rodada: 54 testes aprovados em 3 arquivos de teste.
