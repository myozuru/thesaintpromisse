# Corrigir encerramento real dos dados 3D

## Objetivo
Fazer cada dado encerrar a própria simulação física de forma confiável, manter a face final visível e só então concluir o pedido de teste.

## Implementação
- Substituir o resultado aleatório do temporizador por uma finalização física controlada no próprio dado.
- Detectar repouso pelo estado real do motor e também por velocidade baixa contínua, com limites separados para movimento e rotação.
- Se um dado permanecer em microquiques por tempo excessivo, aumentar progressivamente o amortecimento e estabilizá-lo na posição física atual; o valor continuará vindo da face realmente voltada para cima.
- Garantir que cada dado finalize uma única vez e que a bandeja só conclua quando todos os dados da jogada atual tiverem parado.
- Impedir callbacks de uma jogada antiga de resolverem a próxima jogada.

## Validação
- Criar testes determinísticos para repouso, microquiques, limite máximo e finalização única.
- Rodar os testes focados e a suíte relacionada aos pedidos de teste.
- Abrir a bandeja no navegador, lançar os dados e confirmar visualmente que param, mostram o resultado e saem de “Rolando…”.
