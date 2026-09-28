# Suavizar a rotação dos dados após impactos

## Objetivo
Evitar que o contato com a bandeja aplique uma rotação contrária forte, anulando visualmente o giro iniciado no lançamento.

## Alterações
- Reduzir o atrito excessivo do piso, mantendo aderência suficiente para o dado rolar sem deslizar artificialmente.
- Preservar a direção dominante do giro nos impactos fortes: a colisão ainda poderá alterar o eixo, mas não inverter ou zerar abruptamente a rotação.
- Não interferir no assentamento final; a estabilização será desligada em baixa velocidade para o dado conseguir parar normalmente.
- Adicionar testes para inversão, perda súbita de giro e fase final da rolagem.

## Validação
- Executar os testes de trajetória, drama e assentamento dos dados.
- Verificar compilação e abrir uma rolagem 3D na prévia para confirmar ausência de erros.

## Detalhes técnicos
A correção usará a velocidade angular do quadro anterior como referência. Após uma colisão, somente a componente que inverte ou perde energia de forma abrupta será suavizada, com limites proporcionais ao giro anterior.
