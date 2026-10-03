# Guia de componentes — etapa 14

O guia abre na aba Componentes e apresenta os 303 componentes do contrato aprovado, cada um com função, papel e exemplo próprio. Uma segunda visão apresenta as 335 conversões históricas com composição, comando clicável e explicação individual. Busca aceita acentos e a paginação exibe 24 cartões por vez.

A fonte das descrições é a especificação aprovada, validada por SHA-256 pelo gerador `scripts/gerar-guia-componentes-omni.mjs`. Para regenerar, execute-o na raiz do projeto com o caminho desse arquivo como argumento.

Os exemplos passam individualmente pelo parser do terminal. Consultas de leitura não são destinos graváveis: exemplos de regras personalizadas de deslocamento usam explicitamente o contador `metros_taticos`, sem prometer modificar o mapa. O contador deve ser inicializado e vinculado à regra da mesa. Exemplos de Vigor Maldito distinguem cargas personalizadas de usos nativos. Percentuais usam escala 0–100. Nomes e IDs devem corresponder ao conteúdo da mesa.

Validação: 335 comandos sem erro de parsing, cobertura das 303 keys, busca e inserção no componente React, regressão de destinos e compatibilidade. A execução integrada com fichas e mapa permanece parte da etapa 15.
