# Etapa 17 — Reações

## Contrato

Uma ocorrência interrompível abre uma janela única, pausa o relógio do turno e espera até 12 segundos por decisões locais ou remotas. Ao escolher uma reação manual, a resolução também tem um limite de 12 segundos. A janela só libera a ação pendente depois de aplicar cancelamento, bônus defensivo e efeitos escolhidos; a expiração continua a ação sem reação. Uma reação em resolução não cria uma nova janela recursiva sobre si mesma, e seu diálogo é fechado se a janela expirar.

## Caminhos cobertos

- Ataques comuns consultam reações antes do d20; um cancelamento encerra o ataque antes da rolagem. Bônus defensivos são incorporados à defesa recalculada do alvo.
- Conjurações e ações ativas de feitiço consultam os controladores remotos mesmo quando o inventário local não contém ofertas. Inventários pertencem às sessões dos perfis e só são descobertos pela sondagem.
- Ataques mágicos abrem a janela do alvo antes de definir acerto; os bônus defensivos retornados integram a resolução pendente.
- Reações configuradas executam sua ação antes de devolver cancelamento ou bônus. Custos e efeitos continuam sujeitos à validação da ação ativa.
- Feitiços com `actionType: 'reaction'` resolvem dentro da janela corrente sem abrir outra janela de conjuração ou ataque sobre a própria resposta.
- Relógio de combate é pausado enquanto a janela ou a resolução manual permanece aberta; expiração e encerramento limpam as pausas.

## Ajuste desta etapa

`SpellApplyDialog` não deve usar `ofertasReacaoAtiva(...).length` como pré-condição para abrir a janela. Esse teste só enxerga inventário local e ignorava o Mestre e os outros clientes. A janela agora é consultada diretamente; `abrirJanelaReacaoAtiva` encerra imediatamente quando não há oferta local nem destinatário remoto.

Uma reação de feitiço não dispara outra reação ao ser resolvida. Isso evita uma cadeia de janelas e mantém a ação original aguardando o efeito da reação atual.

## Evidência

- Teste novo verifica que uma conjuração de um perfil sem oferta local sonda o Mestre e só prossegue quando recebe a resposta remota de passar.
- Teste de reação manual do Mestre confirma que o feitiço é exibido, aplicado e devolve a resposta sem criar uma segunda janela.
- Testes de cancelamento pré-ataque, bônus defensivo, timeout, pausa do relógio, propriedade remota e movimento estão em `src/test/omniReacoesAtivas.test.tsx`.

## Limite

A atribuição de cancelamento em um feitiço manual não é inferida a partir da descrição textual. Ações OMNI configuradas carregam `cancelar_evento` e `defesa_bonus`; feitiços manuais aplicam os efeitos da ficha e a ação pendente os observa quando o estado replicado chega. Uma política explícita de interceptação/cancelamento para feitiços manuais exigiria campos próprios no modelo de feitiço.
