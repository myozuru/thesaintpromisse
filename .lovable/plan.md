# Corrigir travamento dos dados 3D por cliques rápidos

## Objetivo
Impedir que cliques repetidos iniciem lançamentos concorrentes e garantir que a bandeja nunca fique presa sem poder rolar ou fechar.

## Alterações
- Tornar o comando de lançar atômico: o primeiro clique muda imediatamente o estado; os seguintes são ignorados.
- Identificar cada rodada dentro da bandeja para que resultados atrasados não afetem a rodada seguinte.
- Liberar o fechamento como recuperação segura: ao fechar uma rolagem pendente, cancelar apenas aquela rodada e permitir novas rolagens.
- Limpar estados locais da bandeja ao trocar, concluir ou cancelar um pedido.
- Preservar o resultado vindo da orientação física final do dado.

## Verificação
- Testar vários cliques síncronos no botão e nos dados, comprovando um único lançamento.
- Testar fechar durante preparação e durante rolagem, depois abrir e rolar novamente.
- Rodar os testes de encerramento físico e verificar a compilação da prévia.
