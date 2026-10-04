# Auditoria OMNI — etapa 4 de 10

Base revisada: `9bc86b516784faba157a2feaf2501ce7b7c40ae0`.
Escopo: resolução de armas para as keys novas e antigas, metadados, estado de equipamento e derivação de bônus passivos.

## Erros reproduzidos e corrigidos

| ID | Erro | Correção |
| --- | --- | --- |
| D01 | O painel reconhecia armas OMNI renomeadas, mas as keys consultavam somente o catálogo padrão. | Dados compostos, flags legadas e grupos de arma usam o resolvedor do inventário OMNI, com a entidade atual do catálogo e fallback ao exemplar. |
| D02 | O resolvedor de armas ignorava a margem de crítico configurada na entidade. | `margem_critico arma_principal` e a key legada correspondente usam o valor configurado, também disponibilizado à arma resolvida pelo painel. |
| D03 | Alcances como `4.5/13.5` viravam `4/13`; números incompletos, como `4xyz`, eram aceitos parcialmente. | Conversão numérica integral, preservando frações e rejeitando entradas incompletas/não finitas/negativas. Espaços do item também preservam valores fracionários válidos. |
| D04 | As keys de alcance corpo a corpo diziam sempre 1,5 m, inclusive para armas Estendidas. | A consulta do alcance base usa a mesma função da arma no mapa: 3 m para Estendida. Não inclui bônus circunstanciais do personagem. |
| D05 | Uma arma sem modelo era sempre tratada como corpo a corpo do grupo Espada; propriedades simples declaradas por tags eram ignoradas. | Tags válidas de distância/arremesso, grupo e propriedades sem parâmetros passam para a arma resolvida. Modelos existentes continuam fornecendo suas propriedades parametrizadas. |
| D06 | Efeitos passivos de `deslocamento` viravam bônus de esquiva; a forma curta `desloc` não gerava movimento. | Ambos geram bônus de deslocamento. O modificador de equipamento, o cálculo de movimento e o aviso de equipar recebem esse recurso corretamente. |
| D07 | Efeitos com gatilho eram somados como bônus permanentes, e condições eram ignoradas. | Gatilhos não viram bônus contínuos; efeitos contínuos respeitam a condição. Fórmulas com diagnóstico não concedem bônus usando o fallback numérico. A mesma separação foi aplicada aos bônus contínuos de TR. |
| D08 | A consulta `quantidade itens equipados` não acompanhava a arma selecionada nas mãos e podia receber campos booleanos ausentes. | Armas usam a empunhadura; outros itens usam seu estado de equipamento. Campos booleanos são explícitos. Na consulta de um template com várias cópias, o exemplar equipado tem preferência. |

## Evidências e limites dos testes

Novo arquivo: `src/test/omniEquipamentoAuditoria.test.tsx`, com sete testes.

- **Interface real:** selecionar Dente Lunar no painel de ataque, consultar propriedades/grupo/crítico e quantidade de itens equipados; clicar Guardar e verificar a mudança para desarmado e zero equipados. A arma foi criada a partir de uma Adaga e recebeu nome e margem próprios.
- **Metadados:** alcance fracionário, número incompleto e edição da entidade no catálogo após a aquisição do exemplar.
- **Consultas de arma:** alcance Estendido da Lança e arma sem modelo com tags de distância, grupo Arco e propriedade Leve.
- **Equipamento real no store:** equipar botas com efeito de deslocamento, verificar movimento 9 + 3 = 12 m e ausência de bônus de esquiva; conferir o rótulo no aviso de equipar. Esse caso testa store/ponte/cálculo, não um arraste no mapa.
- **Bônus contínuos:** amuleto de defesa condicionado à vida, condição falsa, referência inexistente e efeito de acerto que não deve virar bônus permanente.

Os casos foram reproduzidos antes das correções. Os testes de propriedades/bonificações são complementares à interação pelo painel; não equivalem a executar toda habilidade narrativa.

Mantidos os testes existentes de duas mãos e bloqueio da secundária, ações apenas enquanto empunhada, seleção no alcance, soltar/recolher itens com usos preservados, contextos de arma, bônus de perícias/TR e sincronização do inventário.

## Validação

Suíte completa: **185 arquivos e 3.934 testes passaram**. TypeScript e build concluídos.

## Compatibilidade e pendências

- Nenhuma key pública foi renomeada. As consultas compostas e aliases legados continuam disponíveis.
- A resolução de armas usa o modelo como fonte das propriedades parametrizadas. Tags sem valor não inventam capacidade de Recarga, dado Fatal/Mortal ou requisito de Pesada.
- Dano-base personalizado, conversão de tipo, multiplicadores e aplicação final do ataque serão revisados na etapa 5. Resolver a margem configurada não certifica todos os cálculos de crítico.
- `alcance arma_principal` expressa o alcance base da arma. Bônus pessoais de alcance e validação espacial completa pertencem à etapa 7.
- A derivação de deslocamento chega ao modificador de equipamento. A leitura de velocidade/orçamento em todos os contextos, a propagação de movimento de passivas vinculadas e o arraste do mapa permanecem na etapa 7.
- A seleção de armas ainda usa nomes nas mãos. Várias cópias idênticas e duas armas de uma mão com o mesmo nome exigem revisão de identidade: o nome, sozinho, não distingue os exemplares nem toda configuração de empunhadura. Esta mudança mantém a seleção de um exemplar por nome já usada pelos gatilhos; não introduz IDs nas mãos. Esse ponto fica registrado para a revisão de identidade/persistência na etapa 9.
- As notificações e duração dos bônus disparados por eventos continuam na etapa 6. Esta correção separa esses efeitos da soma permanente de equipamento.
- Os testes usam stores reais com nuvem/socket falsos. Não houve teste manual em uma campanha online nem certificação de duas sessões reais.

## Reprodução

```sh
npx vitest run src/test/omniEquipamentoAuditoria.test.tsx src/test/omniBridgeE2E.test.ts src/test/omniArmasMapa.test.tsx src/test/omniComposicaoEquipamento.test.ts
npx vitest run
npx tsc --noEmit
npm run build
```

Etapa 4 concluída dentro desse escopo. Próxima: ataques e dano. Faltam 6 etapas.
