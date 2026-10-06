# Etapa 24 — integração e validação ponta a ponta

## Integrações validadas

- Fichas não renderiza conteúdo quando o papel de sessão está indefinido; o módulo de mapa também não abre uma ficha selecionada nesse estado.
- A visibilidade da lista de fichas é decidida por papel com falha fechada: Mestre recebe a mesa completa, Player recebe as fichas públicas de jogadores do próprio perfil e a consulta sem papel recebe uma lista vazia.
- O teste do contra-ataque agora posiciona o alvo dentro do alcance da Espada Curta. A ação era corretamente recusada fora do alcance; o cenário de teste anterior esperava dano a 3 m.
- O teste de conjuração aguarda a transição assíncrona para a etapa de ataque, evitando consultar o botão antes de a janela de reação terminar.
- A auditoria de responsividade separa `qtd_concentrando` das chaves implementadas, pois o modelo ainda não persiste concentração. O hint continua declarando a lacuna; concentração não é inferida de `lastSpellUsedId` ou de sustentação.

## Validação

- Suíte completa: 212 arquivos e 4.713 testes aprovados.
- Cobertura focada de visibilidade, reações, chaves novas e contexto de dano: 4 arquivos e 66 testes aprovados.
- Typecheck e revisão final do diff executados antes do commit.

## Privacidade de inimigos ainda não corrigida

O teste de papel protege o que os componentes exibem, mas não remove dados do navegador do Player. A sincronização ainda envia a fatia completa `characters` pelo broadcast compartilhado em `src/hooks/useMultiplayerSync.ts` e persiste fichas completas na linha pública autenticada `realtime_world`. Um usuário autenticado ainda pode ler CDs, bônus e campos privados diretamente do payload.

Para fechar essa exposição sem quebrar ataques e TRs executados nos clientes, ainda é necessário separar projeções públicas e dados completos do Mestre, mover a avaliação de combate que depende de valores secretos para um fluxo autorizado, aplicar a política no banco e remover/atualizar o servidor Socket.IO externo. A implementação desse servidor não está neste repositório. Portanto, **a Etapa 24 não certifica privacidade de NPCs** e a limitação da Etapa 22 continua aberta.

Também não houve aplicação da migration ao Supabase nem teste real de RLS neste ambiente: `supabase` CLI e `psql` não estão instalados.
