# Ajuste do foco cinematográfico e resultado compacto

## O que será ajustado

- Aproximar mais a câmera enquanto o dado está em movimento, mantendo espaço suficiente para acompanhar seus quiques.
- Aplicar um segundo zoom bem mais fechado quando o dado assentar, centralizando a face resultante.
- Evitar que a bandeja e o dado sejam recriados durante a transição para o resultado, preservando posição e sincronização.
- Contrair o resultado para uma área realmente compacta, dimensionada ao dado, com bônus, total, resultado e ação de fechar organizados abaixo.
- Remover informações duplicadas e sobreposições entre a bandeja, o resultado e os controles.

## Detalhes técnicos

- Manter uma única instância da cena 3D durante rolagem e resultado cinematográfico.
- Separar o estado visual da cena do estado sincronizado do pedido, evitando desmontagem ao resolver a rolagem.
- Ajustar distância, altura, alvo e interpolação da câmera para os estados “em movimento” e “assentado”.
- Tornar a contração externa independente das coordenadas físicas do dado, para que o canvas reduza sem deslocar a face focada.
- Validar a rolagem e o resultado em tela larga e móvel, além dos testes relacionados.