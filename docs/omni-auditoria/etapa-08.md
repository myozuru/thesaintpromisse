# Etapa 8 — Ações ativas, custos e convergência de efeitos

Base: main `3935f691798fb96c97fba00be3e87dbca6ffd18a`.

## Erros confirmados e corrigidos

1. custoPE legado transformava referência inexistente, erro aritmético ou sintaxe inválida em zero. Agora exige resultado finito, não negativo e determinístico. Mantém o arredondamento legado; custos novos continuam arredondando para cima. Previews não usam RNG aleatório.
2. CD e condição legada de margem crítica não validavam diagnósticos. Agora são verificadas antes de pagar e não aceitam dados aleatórios. Tipos de ação/teste/TR/efeito, condição aplicada, duração e opções de desfecho inválidos também bloqueiam o uso.
3. dano_extra de desfechos de TR era avaliado apenas depois do pagamento. Todos os ramos são validados previamente, inclusive os que não seriam escolhidos naquela rolagem.
4. Saldo/mínimo de cargas, munição, usos e pools não finitos podiam passar comparações. Agora são rejeitados; cargas/usos/munição exigem inteiros seguros. PE temporário conserva prioridade; PV sacrificial continua usando vida real e deixa ao menos 1 PV.
5. REDUZIR_CUSTO em PE era ignorado pelas ações ativas. O plano e a cobrança inicial passam a aplicar o redutor genérico e seu piso. Custo zero não é aumentado pelo piso; redutor inválido bloqueia a ação.
6. Após esperar seleção de destino ou reação, ação podia conservar contexto de arma e conjunto de alvos antigos. Antes de pagar, refaz a seleção com o ponto/direção da área confirmada, relê fichas, valida recursos/alcance/destinos e rejeita arma ou conjunto de alvos alterados. Arma de origem deve estar empunhada. Se o conjunto da área mudar, pede novo uso em vez de atingir alvos antigos.
7. Duplo uso concorrente podia disputar o seletor e cobrar ações sobrepostas. Uma trava local por personagem conserva uma execução pendente; é liberada ao concluir, cancelar ou falhar. A configuração é copiada na declaração para não mudar enquanto o usuário escolhe o destino.
8. Um 1 natural com total suficiente para uma CD baixa era falha crítica na classificação, mas sucesso na supressão de dano. Ambos agora usam o mesmo grau.
9. Buff ignorava dano na validação, mas tentava processar fórmulas de dano na execução. Agora não planeja/rola dano irrelevante nem dano herdado da arma.
10. ARMA.DANO herdava dados do modelo, ignorando a fórmula personalizada do exemplar. Agora usa a fórmula OMNI quando presente; ARMA.DADOS/PASSO derivam do plano de dados, sem rolar na validação.
11. Disputa de perícia ignorava bônus passivos dos equipamentos. Agora soma os modificadores equipados usados pelo bridge; preserva empate a favor do defensor.
12. Sustentação exigia condição apenas nos efeitos padrão e recusava condições configuradas em graus de TR. Agora considera esses ramos. Sem nenhuma condição vinculada ainda ativa, encerra antes de cobrar manutenção. Só registra condições efetivamente aceitas na ficha.
13. APLICAR_CONDICAO visual criava apenas metadata no runtime. Agora também usa addCondition na ficha, com identidade da origem, bloqueio de imunidade e vínculo exclusivo à instância do runtime. Remover/dissipar/expirar o efeito remove somente essa instância. REMOVER_CONDICAO também remove condições criadas por outros caminhos; todas limpa a ficha atingida e seus registros de condição.
14. Dicionário visual omitira condições oficiais da ficha, incluindo Caído. Inclui todas as condições oficiais, preserva entradas legadas e oferece Todas em remoção. Sangrando converge para Sangramento ao aplicar/remover. Duração visual dinâmica é avaliada corretamente; condições visuais continuam expirando pela timeline do runtime (rodada/turno = 6 segundos).
15. SOMAR/SUBTRAIR visual em vida perdia a identidade da origem e o tipo de dano. Agora propaga esse contexto aos métodos centrais de dano/cura.

## Validação

`omniAtivasAuditoria.test.tsx`: 41 novos casos nas stores reais, com nuvem/socket simulados. Incluem pagamento inválido, arredondamento, PE temporário, redutor, CD/ramo/condição/crítico inválidos, cargas corrompidas, seleção pendente, arma trocada, alvo removido, área alterada, configuração modificada, duplo uso/cancelamento, TR natural 1, buff sem dano, arma personalizada, equipamento em disputa, sustentação órfã, condição visual, origem, imunidade, expiração exclusiva, alias e catálogo completo.

Suíte completa: 189 arquivos, 4.041 testes aprovados. TypeScript e build de produção aprovados.

## Limites e etapas restantes

- A trava é por personagem nesta sessão. Não equivale a transação distribuída de ficha/inventário; conflito entre clientes, autorização, identidade de exemplares iguais e persistência são escopo da etapa 9. Esta etapa não certifica uma campanha online real.
- Validação antes do pagamento não torna erros após rolagem gratuitos: ações aceitas continuam pagando antes dos dados, incluindo ataques que erram. Alterações do alvo posteriores ao pagamento pertencem à resolução em andamento.
- Pontos e disponibilidade dos movimentos são revalidados antes de pagar e ao aplicar. Não reserva destinos do mapa durante a rolagem; um obstáculo criado depois pode impedir o deslocamento.
- Condições visuais novas vinculam ficha e runtime. Registros antigos sem conditionInstanceId não são migrados automaticamente para condições na ficha. A poda também limpa runtime vinculado a condição já purificada; não inventa vínculo para efeitos antigos.
- Redutor genérico cobre PE inicial da ação. Regras nativas específicas de técnicas, descontos por círculo e manutenção têm caminhos próprios; não se presume que todos foram migrados para esse plano. PV sacrificial não é convertido em dano mitigável.
- Nenhuma variável genérica foi renomeada. Foram completadas opções de condições e preservados aliases.
- Restam 2 etapas: 9 (persistência, identidade e multiplayer) e 10 (guia e verificação final).
