# Rolagem 3D ampliada e foco cinematográfico

## Objetivo
Dar mais percurso aos dados e permitir que o Mestre escolha uma apresentação cinematográfica para rolagens individuais dos jogadores.

## Alterações
- Ampliar o piso, os limites físicos e o enquadramento padrão da bandeja para comportar trajetórias maiores.
- Sortear uma borda de origem a cada rodada e lançar cada dado em direção à borda oposta, distribuindo vários dados sem usar sempre o mesmo ponto.
- Adicionar ao pedido do Mestre a opção **Foco no dado** e sincronizá-la com o pedido do jogador.
- Durante um pedido com foco, acompanhar suavemente o único dado com a câmera; ao parar, aproximar a câmera da face superior.
- Para exatamente um dado, manter o dado final visível e mostrar os bônus abaixo dele; para dois ou mais, preservar o resultado numérico atual.
- Cobrir a direção dos lançamentos e a nova opção com testes, mantendo o comportamento atual quando o foco estiver desligado.

## Detalhes técnicos
- A posição do corpo físico será exposta ao controle de câmera sem atualizar a interface a cada quadro.
- A câmera usará interpolação independente da taxa de quadros e controles manuais ficarão desativados durante o foco.
- O resultado continuará vindo da orientação física final; a apresentação não altera bônus, CD ou sucesso/falha.
