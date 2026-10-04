# Guia de componentes — etapa 14

O guia abre na aba Componentes e apresenta os 303 componentes do contrato aprovado, cada um com função, papel e exemplo próprio. Uma segunda visão apresenta as 335 conversões históricas com composição, comando clicável e explicação individual. Busca aceita acentos e a paginação exibe 24 cartões por vez.

A fonte das descrições é a especificação aprovada, validada por SHA-256 pelo gerador `scripts/gerar-guia-componentes-omni.mjs`. Para regenerar, execute-o na raiz do projeto com o caminho desse arquivo como argumento.

Os exemplos passam individualmente pelo parser do terminal. Consultas de leitura não são destinos graváveis: exemplos de regras personalizadas de deslocamento usam explicitamente o contador `metros_taticos`, sem prometer modificar o mapa. O contador deve ser inicializado e vinculado à regra da mesa. Exemplos de Vigor Maldito distinguem cargas personalizadas de usos nativos. Percentuais usam escala 0–100. Nomes e IDs devem corresponder ao conteúdo da mesa.

Validação: 335 comandos sem erro de parsing, cobertura das 303 keys, busca e inserção no componente React, regressão de destinos e compatibilidade. A execução integrada com fichas e mapa permanece parte da etapa 15.

## Revisão atual do guia — auditoria de 10 etapas

A [etapa 10 da auditoria](../omni-auditoria/etapa-10.md) supera os limites de validação mencionados acima. Os 335 exemplos agora são avaliados individualmente, além do parsing, e as abas históricas consultam a mesma fonte dos exemplos compostos. As revisões específicas são aplicadas pelo gerador a partir de `revisoes-guia.json` e `revisoes-componentes.json`, conservando a validação do SHA do documento original.

A aba Eventos contém 34 scripts completos com contexto e explicação próprios. A aba Ações distingue comandos de efeito de ataques e mostra quatro configurações completas do construtor. Perícias e TRs são bônus para a rolagem; o total precisa incluir o dado. Dano aplicado em vida é mitigado pelo motor e não deve descontar RD novamente na fórmula.

Exemplos com dados numa condição fazem uma comparação simples. Para registrar testes no HUD, resolver oposição e usar os graus de sucesso, configure a modalidade nativa da ação ativa. Bônus somados à ficha não ganham duração apenas porque a condição menciona próximo ataque ou enquanto um estado está ativo.
