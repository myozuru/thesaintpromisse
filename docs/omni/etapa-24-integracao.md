# Etapa 24 — integração e validação ponta a ponta

## Integrações validadas

- Fichas não renderiza conteúdo quando o papel de sessão está indefinido; o módulo de mapa também não abre uma ficha selecionada nesse estado.
- A visibilidade da lista de fichas é decidida por papel com falha fechada: Mestre recebe a mesa completa, Player recebe as fichas públicas de jogadores do próprio perfil e a consulta sem papel recebe uma lista vazia.
- O teste do contra-ataque agora posiciona o alvo dentro do alcance da Espada Curta. A ação era corretamente recusada fora do alcance; o cenário de teste anterior esperava dano a 3 m.
- O teste de conjuração aguarda a transição assíncrona para a etapa de ataque, evitando consultar o botão antes de a janela de reação terminar.
- A auditoria de responsividade separa `qtd_concentrando` das chaves implementadas, pois o modelo ainda não persiste concentração. O hint continua declarando a lacuna; concentração não é inferida de `lastSpellUsedId` ou de sustentação.
- O slice compartilhado `profiles` agora publica apenas `id`, `name`, `avatar` e `createdAt`. Senhas permanecem locais; payloads antigos que ainda tragam `password` não sobrescrevem a senha local nem importam uma senha remota.
- A migration `20261006020000_remove_profile_passwords_from_shared_snapshot.sql` remove o campo `password` do snapshot antigo já persistido na tabela compartilhada.

## Validação

- Suíte completa: 213 arquivos e 4.716 testes aprovados após a correção de sincronização de perfis.
- Testes focados de privacidade de perfis e privacidade de logs: 2 arquivos e 5 testes aprovados.
- Typecheck e revisão final do diff executados antes do commit.

## Privacidade de inimigos ainda não corrigida

O teste de papel protege o que os componentes exibem, mas não remove dados do navegador do Player. A sincronização ainda envia a fatia completa `characters` pelo broadcast compartilhado em `src/hooks/useMultiplayerSync.ts` e persiste fichas completas na linha pública autenticada `realtime_world`. Um usuário autenticado ainda pode ler CDs, bônus e campos privados diretamente do payload.

Para fechar essa exposição sem quebrar ataques e TRs executados nos clientes, ainda é necessário separar projeções públicas e dados completos do Mestre, mover a avaliação de combate que depende de valores secretos para um fluxo autorizado, aplicar a política no banco e remover/atualizar o servidor Socket.IO externo. A implementação desse servidor não está neste repositório. Portanto, **a Etapa 24 não certifica privacidade de NPCs** e a limitação da Etapa 22 continua aberta.

Também não houve aplicação da migration ao Supabase nem teste real de RLS neste ambiente: `supabase` CLI e `psql` não estão instalados.

## Outra fronteira de privacidade corrigida

Antes, `pickProfiles` devolvia objetos completos do armazenamento local. Como `PlayerProfile` contém a senha usada para proteger o perfil local, esse valor seguia para Socket.IO, broadcast e persistência em `realtime_world`. A projeção agora remove a senha em todos os emits derivados de `pickProfiles`; a recepção valida os campos públicos e preserva apenas a senha que já existia naquele navegador. A migration limpa o valor legado da linha `profiles` quando aplicada.

Esta correção não protege contra cópias antigas ainda retidas em memória por um servidor Socket.IO externo que não está neste repositório. A exposição principal de CD/bônus de inimigos pelo slice `characters` também permanece aberta e exige transporte privado mais resolução de combate autorizada.
