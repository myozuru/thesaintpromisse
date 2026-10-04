# Etapa 7 — Mapa, alvos, áreas, movimento e zonas

Base: main `939b560f3159864ae85a7db364ed3eb7fc7d2f9f`. Não altera os nomes das keys.

## Falhas corrigidas

1. Auras usavam posições abstratas sem integrar as peças do mapa. Agora leem peças explicitamente vinculadas, convertem pixels em metros pela grade e usam a origem confirmada durante uma prévia pendente. O painel espacial também atualiza a peça ao mover.
2. Mover a origem da aura só verificava a própria ficha. Agora compara todos os membros, incluindo entradas e saídas de terceiros. O conjunto é salvo antes do dispatch, sem sobrescrever outros efeitos criados durante a execução. Cache de auras vinculadas inclui a cena.
3. Prévia de arraste/rollback podia aplicar efeitos de terreno antes da aceitação. Essas mutações não executam gameplay. A confirmação entrega a trajetória aceita; recepção remota valida cena, vínculo explícito e coordenadas. O mesmo ID recebido por dois transportes só é aplicado uma vez.
4. Reações OMNI reconstruíam uma linha reta mesmo quando o arraste registrava curva. Agora recebem a trilha real; linha amostrada é apenas fallback sem trilha. O orçamento de movimento cobra a distância efetivamente percorrida.
5. Zonas dependiam de amostras espaçadas, perdendo faixas finas. Retângulos rotacionados e elipses usam interseção analítica. A entrada dispara uma vez por zona na confirmação; teleporte só verifica o destino. Fim de turno usa a posição confirmada, não a prévia.
6. Condições de zona com variável inexistente podiam avaliar como zero e produzir comparação verdadeira. Diagnósticos invalidam a condição. Duração inválida/inativa não aplica efeitos.
7. Zonas não identificavam seu autor. Campo opcional sourceCharId e seletor de origem permitem USUARIO = autor e ALVO = atingido. Sem autor, dano/condição ambiental não inventam atacante. Cada efeito relê o estado atual do destinatário.
8. Efeito dirigido a ALVO trocava também a identidade de USUARIO na avaliação da fórmula. Agora o destino não muda o contexto do portador; ALVO continua fornecido separadamente.
9. Alvos legados com alcance positivo podiam executar sem peças para medir. Agora exigem origem e destino no mapa. Alcance não finito/negativo e teto com referências inválidas ou dados são rejeitados. Alvos repetidos são deduplicados antes da contagem; área respeita camadas visíveis.
10. Áreas avaliavam somente nove pontos da peça. Círculo pequeno contido em peça grande e linha fina cruzando bordas podiam não atingir. Agora usa interseções de polígonos, retângulos rotacionados e elipses, incluindo tangência. Dimensões inválidas não selecionam peças.
11. Hit-test de cone aceitava pontos além da base desenhada. Ambos os cones agora respeitam a geometria renderizada.

## Validação

23 novos casos: 22 em omniEspacialAuditoria.test.tsx e 1 interação real em omniReacoesAtivas.test.tsx. Cobrem áreas pequenas, cruzamento de borda, elipse/tangência, cones, alcance inválido/sem mapa, teto inválido, deduplicação, prévia/cancelamento, curva, teleporte, confirmação duplicada/cena incorreta, fórmulas com origem, zonas finas, duração inválida e aura movida pelo dono. A interação de reação abre a janela pelo caminho intermediário, cancela e verifica rollback sem gasto de movimento.

Suíte: 188 arquivos, 4.000 testes aprovados. TypeScript e build de produção aprovados.

## Limites e continuidade

- O protocolo reutiliza entity-patch com confirmação adicional; não certifica campanha online real. Autorização, ordenação de mensagens antigas, persistência e múltiplas sessões autoritativas pertencem à etapa 9. Clientes antigos sem a confirmação precisam ser atualizados.
- A trajetória real é usada no arraste de combate. Movimento manual fora de combate e comandos diretos sem trilha usam os extremos. Reações nativas de oportunidade têm detector próprio; esta correção de trajetória cobre as reações configuráveis OMNI.
- Zonas usam o centro da peça para entrada/permanência; áreas instantâneas consideram sua superfície. Teleporte não atravessa zonas intermediárias.
- Identidade com várias peças da mesma ficha e duplicação entre aura vinculada/runtime seguem para a etapa 9. Alcance zero mantém a semântica atual de ausência de limite.
- Revalidação de custos/efeitos após esperas e convergência entre configurações seguem na etapa 8. Esta etapa não certifica todos os fluxos nativos específicos do aplicativo.
- Restam 3 etapas: 8 (ações, custos e efeitos), 9 (persistência e multiplayer), 10 (guia e verificação final).
