# OMNI — Etapa 2: contratos semânticos

Base auditada: `main` em `5c64d259c28cd11fd465adeba7a419a23fdc2559`.

## Escopo verificado

O inventário estrutural encontrou 391 IDs únicos no dicionário: 371 entradas estáticas e 20 modelos dinâmicos. A suíte compara a leitura do parser com valores conhecidos no contexto declarado para 671 referências estáticas: 300 em `USUARIO`, 300 em `ALVO` e 71 sem escopo de ficha. Os 20 modelos dinâmicos também são instanciados com valores esperados em ambos os escopos, totalizando 40 exemplos de contrato.

Além do dicionário, os testes exercitam os 172 atalhos do parser nas formas `@USUARIO`, `@ALVO` e sem escopo; os 54 aliases centralizados; e os 137 aliases de gatilho. Os valores de `USUARIO` e `ALVO` nos fixtures são diferentes para que uma leitura do sujeito errado não passe por coincidência.

Para eventos, cada um dos 34 gatilhos canônicos é enviado pelo `eventBus` e deve produzir uma mutação observável. Cada alias precisa resolver ao mesmo gatilho canônico e ao mesmo evento natural. Um nome não registrado deve continuar sem mapeamento.

As 38 primitivas seguem cobertas pela suíte existente. Esta etapa acrescenta verificações de resultado para as primitivas de redução de custo de feitiço e seus filtros (`REDUZIR_PE`, `ESCOPO_FEITICO`, `ESCOPO_NIVEL`, `ESCOPO_TIPO`, `ESCOPO_NOME` e `LIMPAR_REDUTOR_PE`), verificando o estado persistido e o custo efetivamente calculado.

## Defeitos encontrados e corrigidos

1. `exaustao_nivel` era traduzido pelo atalho do parser para `EXAUSTAO_NIVEL`, enquanto o mapa central de aliases o canonizava como `exaustao`. O parser agora aponta para `EXAUSTAO`; o teste percorre todos os atalhos e aliases para detectar divergências semelhantes.
2. Em um bloco com várias ações, a próxima ação reutilizava a ficha capturada antes da primeira mutação. Isso fazia os filtros `ESCOPO_*` lerem um estado antigo após `REDUZIR_PE`. O executor atualiza as fichas de usuário e alvo a partir do store antes de cada ação. Os testes confirmam o filtro persistido e o custo final do feitiço.

## Evidência local

- Suíte de catálogo, aliases e chaves: 16 arquivos, 781 testes aprovados.
- Primitivas: `src/test/omniAllActions.test.ts`, 90 testes aprovados.
- Eventos e despacho no barramento: `src/test/omniEventosAuditoria.test.tsx`, 44 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `git diff --check`: aprovado.
- O inventário estrutural também não encontrou IDs duplicados, conflitos de aliases de gatilho, componentes sem card, primitivas sem `case` ou entradas do dicionário sem card/alias.

## Limites desta etapa

Esses testes certificam a resolução das chaves e aliases em fixtures, o despacho local dos eventos e os efeitos exercitados pelas ações. Eles não demonstram que toda composição narrativa possível tem a intenção correta, nem cobrem uma sessão real com dois clientes conectados. A validação de autenticação, políticas RLS e sincronização Supabase entre contas continua pendente; precisa de uma sessão com contas de jogador e Mestre. Os números do inventário são contagens estruturais, não uma afirmação de que cada combinação arbitrária de regras foi testada.
