# Cards de ações do inventário

Antes, `acoesAtivasDe` fornecia uma entrada para cada configuração em cada exemplar do inventário. Cinco entregas da mesma Katana geravam cinco cards da mesma ação; configurações idênticas duplicadas dentro do template também geravam repetições.

O painel agora agrupa ações equivalentes do mesmo template. Com múltiplos exemplares, o card permite escolher qual utilizar e prefere inicialmente um equipado. Usos do item, seleção de alvos e execução continuam associados à instância selecionada. Nenhum exemplar é apagado ou fundido no inventário. Armas de templates distintos e ações com regras distintas continuam separadas.

As ações usam o template atual do catálogo, com o snapshot do exemplar como alternativa. Edições e remoções de ações no construtor atualizam o painel sem entregar novamente a arma.

Os testes reproduzem cinco exemplares, verificam um único card e o consumo somente do exemplar escolhido, ações diferentes, configurações idênticas repetidas e alterações reativas do catálogo.
