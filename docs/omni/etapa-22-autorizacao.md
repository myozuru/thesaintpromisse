# Etapa 22 — autorização e dados ocultos

## Corrigido nesta etapa

- Nova migration retira de `anon` leitura e escrita em `realtime_world` e `realtime_assets`. A mesa passa a exigir sessão autenticada, que já é requisito de entrada (`AuthScreen`).
- A função `has_role` permite consultar o próprio papel; somente quem já é Mestre pode consultar papéis de outras contas. Execução foi retirada de `PUBLIC` e `anon` e concedida a `authenticated`.

## Lacuna de privacidade que permanece aberta

O estado da campanha ainda usa uma única tabela compartilhada sem `campaign_id`, e a fatia `characters` serializa fichas de jogadores e inimigos no mesmo JSON. Qualquer conta autenticada pode ler a fatia inteira. Portanto, esta migration fecha o acesso anônimo e a enumeração de papéis, mas **não protege ainda CDs, bônus e demais dados de inimigos contra outro usuário autenticado**.

Para corrigir essa exposição com segurança, a sincronização precisa separar dados públicos e dados privados do Mestre, aplicar RLS à tabela privada e mesclar as versões sem permitir que o snapshot público sobrescreva os dados completos do Mestre. O contrato atual não permite ocultar campos dentro de uma linha JSON via RLS. Essa integração continua pendente e deve ser validada na etapa 24 antes de declarar os dados ocultos protegidos.

## Validação

- Migration revisada estaticamente; `supabase` CLI e `psql` não estão instalados neste workspace, portanto não houve execução contra um Postgres local.
- O projeto não contém testes de integração para RLS/autenticação; a confirmação final depende de aplicar a migration no Supabase e testar anon, player e master.
