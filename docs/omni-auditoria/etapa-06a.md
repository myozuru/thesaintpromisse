# Etapa 6A — Disponibilidade de reações

Primeiro bloco da etapa 6 (gatilhos e reações). Não encerra a auditoria de emissores de eventos e observadores de estado.

## Erros corrigidos

- Armas guardadas ofereciam reações automáticas: agora precisam estar empunhadas, inclusive na mão secundária. Réplicas também precisam estar materializadas.
- O catálogo editado era ignorado em favor do snapshot antigo do inventário: ofertas usam a entidade atual.
- Soltar a arma ou editar a entidade depois de abrir uma janela deixava a oferta obsoleta executável: ambas as respostas, local e remota, revalidam a disponibilidade antes dos custos.
- Custos de munição consultavam somente armas nativas e podiam usar a arma principal para uma reação da secundária: usam a arma da entidade e o resolvedor que inclui armas OMNI.

## Validação

Testes de janela com stores reais cobrem inventário guardado, empunhar, soltar durante a oferta, atualização de catálogo e edição durante a oferta. Os casos anteriores de interrupção, alcance, recursos e encaminhamento entre perfis continuam na suíte.

## Pendências da etapa 6

Verificar emissão efetiva de todos os eventos publicados, contexto e dono de passivas visuais, dispatch de scripts em auras e rejeição de fórmulas inválidas nos observadores. Não há certificação de sessão multiplayer real neste bloco. Identidade de exemplares com o mesmo nome segue na etapa 9.
