# Etapa 2 — representação estruturada

`src/lib/omni/componentes/composicao.ts` define um formato JSON versionado.
Os componentes são IDs independentes da especificação, publicados em `ids.ts`.
O usuário continua escrevendo nomes simples; o JSON é representação interna.

Uma referência tem contexto, árvore de consulta e proveniência opcional.
Seleção, operação, filtro, qualificação, vínculo, comparação e literal são nós
distintos. IDs, nomes, grupos, moedas, tipos/fontes de dano, números e medidas
são argumentos tipados, preservados integralmente.

Exemplo estrutural: `quantidade buffs sustentados` é a operação `quantidade`
sobre o filtro `sustentados` aplicado à seleção `buffs`. Trocar o filtro não
exige recriar a seleção ou a operação. `arma_principal leve` conserva a seleção
de equipamento e o teste de propriedade em nós separados.

Perfis legados preservam as diferenças de sustentados, grupos de arma e
proficiência de escudo registradas na etapa 1. Eles são metadados internos e
não palavras exigidas do autor. Alias, origem e ID de conversão também podem
ser preservados sem alterar o contexto.

O validador desta etapa confere formato, componentes, argumentos, medidas,
finitude, campos previstos e ciclos. Não avalia regras nem autoriza combinações
sem contrato. Essa validação semântica pertence ao avaliador da etapa 4.
Criação e leitura produzem dados JSON; criação copia a árvore recebida para
que alterações posteriores do chamador não modifiquem a referência.

O schema legado de entidades permanece utilizável. A integração e migração
dos campos estruturados será feita nas etapas seguintes; a estrutura nova
nesta entrega ainda não modifica a avaliação de fórmulas da interface.
