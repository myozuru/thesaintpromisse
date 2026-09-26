# Formato e moldura dos personagens no mapa

## Objetivo
Permitir alternar cada personagem entre token circular e imagem livre, mantendo o enquadramento já configurado, e adicionar uma moldura temática aos tokens circulares.

## Alterações
- Adicionar no editor de imagem uma opção clara para ativar ou desativar o formato circular.
- Quando circular, manter o recorte com zoom e posição e desenhar uma moldura dupla discreta, compatível com o visual escuro do mapa.
- Quando livre, restaurar o formato retangular e a proporção original da imagem, sem perder o enquadramento circular caso ele seja reativado.
- Disponibilizar o ajuste pelo botão flutuante e pelo menu de contexto para ambos os formatos.
- Persistir e sincronizar a escolha junto da entidade, como já ocorre com o enquadramento.

## Verificação
- Testar cálculo, alternância de formato, preservação do enquadramento e desenho da moldura.
- Confirmar compilação e ausência de erros no mapa.
