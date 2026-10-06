# Etapa 27 — protocolo de intenção e resultado de combate

## Contrato implementado

`src/lib/combat/actionProtocol.ts` define um protocolo versionado e validado
com Zod para uma intenção do jogador e o resultado público correspondente.
Uma intenção contém apenas ID da ficha que age, tipo/ID da ação, cópia de item
opcional, alvos, ponto do mapa e escolhas explícitas.

O schema é estrito: rejeita campos adicionais, rolagens fornecidas pelo cliente,
bônus, dano, custos, CD e Defesa do alvo. Também limita quantidades, valida
coordenadas finitas, IDs duplicados e escolhas repetidas.

O resultado público transmite somente rolagem observável, desfecho por alvo,
dano e condições visíveis, ou um código de recusa. Seu schema também rejeita CD,
Defesa e qualquer campo que não esteja na allowlist. O resolvedor confiável
continua mantendo os valores usados para decidir acerto/TR no contexto privado.

## Limite e sequência

Este contrato ainda não foi ligado às interfaces de ataque, feitiço, reações ou
OMNI. A fila e o resolvedor só devem ser ativados depois que a etapa de
persistência/autoria puder validar que a identidade autenticada é dona do ator,
e que o cliente MASTER/serviço confiável lê a ficha privada. A role no Zustand,
`profileId` fornecido no request e campos de ficha enviados pelo cliente nunca
são autoridade.

O app já contém `createServerFn`, `requireSupabaseAuth` e o cliente administrativo
server-only, então o canal de intenção pode ser servido por TanStack Start e
Supabase. Isso permite manter o Socket.IO externo como transporte de eventos
públicos sem depender dele para autenticar ou resolver ações. Antes da
integração, a migração de propriedade e RLS precisa impedir que jogadores
substituam a linha global `characters` usada como fonte de verdade.

## Validação

`combatActionProtocol.test.ts` cobre aceitação de uma intenção válida, recusa de
rolagem/bônus/dano/custos enviados pelo cliente, limite de coordenadas, alvos e
escolhas duplicados, resultado público permitido e recusa de defesa/CD no
resultado. Este arquivo define o limite de dados; não declara o combate como
autoritativo até que os pontos acima sejam integrados.
