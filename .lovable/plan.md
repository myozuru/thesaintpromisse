# Janela flutuante de testes e bandeja central

## Objetivo
Permitir que o Mestre solicite testes sem sair do mapa e tornar a rolagem recebida pelo jogador mais clara e centralizada.

## Alterações
- Fazer o botão **R** abrir e fechar uma janela de pedidos independente da aba atual.
- Criar dois modos para essa janela: flutuante e arrastável, ou lateral no canto superior esquerdo, sempre abaixo do relógio e sobre o restante da tela.
- Adaptar o formulário e o histórico para uma largura menor, preservando seleção múltipla, CD, opções ocultas, nota, envio e acompanhamento.
- No pedido recebido pelo jogador, reservar o centro da tela para a bandeja 3D real e posicionar as informações e ações ao redor dela.
- Centralizar a bandeja global enquanto ela estiver atendendo ao pedido, sem alterar a física, fila ou cálculo do resultado.

## Verificação
- Confirmar que o mapa continua visível e utilizável atrás da janela do Mestre nos dois modos.
- Confirmar arraste, encaixe lateral, troca de modo, fechamento e reabertura pelo botão **R**.
- Confirmar que o jogador inicia a rolagem no pedido e interage com os dados no centro da tela.
- Rodar os testes relacionados a pedidos/dados e verificar a prévia em largura desktop e móvel.
