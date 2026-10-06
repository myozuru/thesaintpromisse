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

## Fila autenticada implementada

`src/lib/combat/actionRequests.functions.ts` acrescenta Server Functions
protegidas por `requireSupabaseAuth` para registrar a intenção, consultar o
resultado do próprio solicitante, listar pendências, reivindicar com lease de
90 segundos e publicar resultado público. Papel MASTER é consultado pelo RPC
`has_role` usando a sessão autenticada, não o valor do Zustand.

A migration `20261006040000_combat_action_requests.sql` cria a fila com
idempotência por solicitante/requestId, expiração de dois minutos e RLS. O
cliente autenticado pode ler apenas suas solicitações; o Mestre pode ler a
fila; clientes não podem inserir nem atualizar diretamente. Somente as Server
Functions usam service role para as transições. Uma reivindicação expirada pode
ser recuperada, e dois Mestres não reivindicam simultaneamente a mesma linha.
O resultado armazenado é validado pelo schema público estrito.

## Limite e sequência

Este contrato ainda não foi ligado às interfaces de ataque, feitiço, reações ou
OMNI. A fila é apenas uma caixa de entrada autenticada: submeter uma intenção
não cobra recursos nem altera ficha. Ela **não valida ainda a propriedade do
ator**, porque a tabela compartilhada `characters` permite gravações de
qualquer conta autenticada. Até existir um vínculo de posse protegido por RLS,
uma intenção não pode ser executada automaticamente só por estar na fila. A
interface do Mestre também ainda não reivindica nem apresenta essas solicitações.
Role no Zustand, `profileId` fornecido pelo cliente e campos de ficha enviados
no request nunca são autoridade.

O app já contém `createServerFn`, `requireSupabaseAuth` e o cliente administrativo
server-only. As funções permitem manter o Socket.IO externo como transporte de
eventos públicos, sem depender dele para autenticar a fila. Antes de ligar a
execução de ações, a migração de propriedade e RLS precisa impedir que jogadores
substituam a linha global `characters` usada como fonte de verdade.

## Validação

`combatActionProtocol.test.ts` cobre aceitação de uma intenção válida, recusa de
rolagem/bônus/dano/custos enviados pelo cliente, limite de coordenadas, alvos e
escolhas duplicados, resultado público permitido e recusa de defesa/CD no
resultado. Typecheck cobre as Server Functions. A migration ainda precisa ser
aplicada e testada contra Supabase real. Este canal não declara o combate como
autoritativo até que propriedade, interface de Mestre e aplicação atômica do
resultado público estejam integradas.
