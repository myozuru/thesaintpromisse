# Contadores nos equipamentos

Os cards das mãos principal/secundária no painel de ataque e dos equipamentos OMNI equipados na ficha mostram os contadores referenciados nas fórmulas, condições, ações de contador ou custos da entidade. Uma passiva pode mostrar Rancor mesmo sem ação ativa; o saldo inicial aparece como zero.

O saldo vem de `Character.omniCounters` e acompanha suas atualizações. A associação usa a entidade atual do catálogo, com o exemplar do inventário como alternativa. O mostrador não cria um reservatório por arma: duas armas que usam o mesmo nome consultam o mesmo contador do portador. Contadores do alvo e recursos internos não associados ao equipamento ficam fora do mostrador.

Abrir um badge apresenta as parcelas existentes em `<nome>__fonte__<id>`, identificando os personagens pelo nome quando disponíveis. Sem parcelas registradas, informa a ausência desse detalhamento. Não reconstrói contribuições a partir do total e não altera cargas nem consome recursos.

Validação automatizada: associação de passivas/custos/ações, exclusão de referências ao alvo, nomes literais, saldo zero, atualização reativa, origens e ausência de mutações ao abrir o badge.
