# Etapa 25 — privacidade de fichas e autoridade de combate

## Diagnóstico confirmado

A fatia `characters` transmite o array completo de fichas. `pickCharacters` em
`src/hooks/useMultiplayerSync.ts` retorna `s.characters`, e o hook envia esse
array tanto no snapshot inicial quanto em cada alteração. A mesma fatia é
persistida em `realtime_world` e transmitida pelo Socket.IO externo. A filtragem
de `charactersVisibleToRole` controla a lista exibida no módulo Fichas, mas não
remove os dados do estado global nem do transporte.

O vazamento inclui mais que os campos mostrados em uma tela. A interface
`Character` possui valores de combate como `ca`, `baseDC`, `specDC`, bônus de
ataque e CD, atributos, perícias, resistências, imunidades, passivas,
habilidades, feitiços, itens equipados, buffs, condições e vários campos
internos de progressão. A ficha também contém conteúdo editorial como `notes`,
votos e escolhas. Não existe ainda uma classificação central que defina quais
campos de cada categoria são públicos durante a cena.

## Dependências que impedem apenas redigir a ficha

- `CharacterCard.tsx` resolve ataques lendo a defesa do alvo e recalculando
  contribuições de passivas, itens, buffs e condições no cliente. O caminho de
  ataque inclui a leitura de `target.ca` nas rotinas de acerto.
- `SpellApplyDialog.tsx` também lê a defesa do alvo ao aplicar ataques de
  feitiços.
- O combate e vários efeitos OMNI leem fichas do `useCharacterStore` local para
  calcular efeitos e atualizar PV, condições e recursos.
- `useTestRequestStore` e `TestRequestOverlay` implementam o fluxo Mestre →
  jogador para testes solicitados. Não implementam o fluxo jogador → Mestre
  para submeter uma ação e receber um resultado autorizado.
- `src/server.ts` é a entrada SSR do TanStack Start. Não contém o servidor
  Socket.IO, regras de autorização de eventos ou resolvedor de combate. O
  processo externo que hoje retransmite `state:update` não está neste
  repositório.

Portanto, retirar `ca`, CDs e bônus do payload de jogador sem antes mudar a
resolução de ataques faria o jogador comparar o d20 contra dados incompletos ou
zerados. Esconder somente esses valores na interface deixaria o vazamento
disponível no estado e no tráfego de rede.

## Contrato necessário para a correção

1. Definir projeções por audiência: ficha completa no cliente Mestre; ficha
   pública de jogador para a mesa; ficha do jogador dono com seus próprios
   dados privados; e dados públicos mínimos de inimigos/NPCs para mapa e
   combate. IDs, PV atual e outros campos públicos precisam ter regra explícita.
2. Mover o cálculo de acerto, TR, dano, mitigação, condições, consumo de
   recursos e efeitos OMNI que dependem de dados secretos para uma autoridade
   confiável. O cliente envia uma intenção validável (ator, ação, alvo e
   escolhas); recebe o resultado e as alterações públicas, nunca o valor
   secreto usado na resolução.
3. Autorizar no servidor a identidade do ator, papel, posse da ficha, turno,
   alcance, custos e alvo. Campos de papel enviados pelo cliente não podem
   conceder permissão.
4. Separar persistência pública e privada, incluindo RLS para leitura e
   escrita; migrar a cópia antiga de `characters`; validar permissões reais de
   PLAYER e MASTER com testes contra Supabase.
5. Atualizar o servidor Socket.IO externo para rejeitar gravações diretas de
   estado completo por jogadores e retransmitir somente projeções permitidas.
6. Cobrir reconexão, snapshots antigos, corrida de edições, timeout da
   solicitação, desconexão do Mestre e compatibilidade offline antes de
   considerar a privacidade fechada.

## Ordem de implementação recomendada

1. Aprovar a lista pública/privada de campos e a regra de acesso a fichas de
   jogadores.
2. Implementar o protocolo de intenção/resultado e a resolução autoritativa no
   servidor disponível para a aplicação.
3. Migrar ataques comuns, ataques de feitiço, TRs e reações para esse protocolo;
   depois cobrir OMNI e efeitos automáticos.
4. Separar slices, aplicar RLS e substituir o snapshot público legado por
   projeções.
5. Testar mesa com dois clientes Player e um Mestre, inspeção de payloads,
   autorização negativa e regressões de combate.

## Limite desta etapa

Esta etapa é o diagnóstico da fronteira de fichas. Nenhum campo de `Character`
foi removido do transporte porque os cálculos atuais dependem deles no cliente.
O fechamento da falha exige alterar ou disponibilizar o serviço Socket.IO que
autoriza a resolução; apenas mudanças neste frontend não conseguem manter os
resultados corretos e esconder com segurança os valores usados pelo cálculo.
