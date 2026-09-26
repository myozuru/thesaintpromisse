# Ajuste circular de personagens no mapa

## Objetivo
Transformar imagens usadas como **Personagem** em tokens circulares ajustáveis, no estilo Owlbear, sem alterar mapas e objetos.

## Implementação
- Adicionar ao personagem do mapa configurações próprias de enquadramento: formato circular, zoom e deslocamento horizontal/vertical da imagem.
- Ao escolher **Personagem** no envio da imagem, criar um token quadrado de uma célula e abrir um editor visual com prévia circular.
- No editor, permitir arrastar a imagem dentro do círculo, ajustar o zoom e restaurar o enquadramento; confirmar ou cancelar sem perder a imagem original.
- Disponibilizar **Ajustar imagem** na barra da peça selecionada e no menu de contexto, para editar tokens já existentes.
- Renderizar e detectar cliques usando o círculo real do token, preservando movimento, colisões, nome, vida, visão e vínculo com ficha.
- Manter **Mapa** e **Objeto** retangulares; ao converter uma imagem existente para **Personagem**, aplicar o padrão circular e abrir o ajuste.
- Preservar as configurações em cenas, exportações e sincronização multiplayer usando os dados já sincronizados da entidade.

## Detalhes técnicos
- Estender a entidade do mapa com um enquadramento opcional `{ zoom, offsetX, offsetY }`; entidades antigas continuam válidas com valores padrão.
- Ajustar o desenho no canvas para usar recorte circular e imagem em modo de preenchimento, sem distorcer a proporção do PNG.
- Criar um diálogo focado de enquadramento usando os controles visuais existentes e atualizar a entidade apenas ao confirmar.
- Corrigir duplicação/cópia para preservar formato, enquadramento, vínculos e demais propriedades do token.

## Verificação
- Testes unitários do cálculo de recorte para PNG quadrado, retrato e paisagem, incluindo limites de zoom e deslocamento.
- Teste de criação, conversão, edição, cancelamento e persistência do token circular.
- Teste visual no mapa: inserir PNG como Personagem, reposicionar/zoom, mover a peça e reabrir o ajuste.
- Confirmar compilação limpa e ausência de erros na tela.
