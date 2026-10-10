# Etapa 18 — Recuperação, reinvocação, perda e Hordas

**Status:** em andamento. Este commit cobre a validação da dissipação voluntária. Não declara a etapa concluída.

## Implementado nesta parte

- Em combate, a dissipação voluntária só passa no turno do dono.
- Uma invocação não pode ser dissipada voluntariamente na rodada em que foi chamada.
- Invocações Caídas ainda podem ser recolhidas quando os demais requisitos forem atendidos.
- A causa `dissipacao_voluntaria` fica registrada na instância preservada.
- Uma instância derrotada continua aguardando resolução; a dissipação voluntária não a remove nem substitui essa decisão.

## Regras já presentes na main

- PV em 0 ou abaixo, mas acima de −PV máximo, mantém a invocação Caída no mapa e selecionável como alvo.
- Cura acima de 0 PV não a levanta automaticamente; levantar gasta Ação de Movimento própria.
- Ao alcançar −PV máximo, o token sai do mapa e a instância é registrada como derrotada. A ficha permanece na biblioteca e o saldo de tempo restante é preservado.
- A invocação pode ter uma posição de invocação configurada na ficha; a seleção no mapa valida esse alcance.

## Dependências ainda abertas

- A consequência e o registro da decisão manual após derrota (recuperar ou declarar perda permanente), inclusive quando Controlador e Mestre discordarem.
- Reinvocação: cobrança de PE, recuperação do PV da instância, novo grant ou saldo de tempo existente e política de reinício de ações.
- Hordas: arredondamento do limite de metade das invocações ativas; valor adicional de PE para membro de Primeiro Grau sob líder Especial; interação entre reservas de tempo dos membros; aplicação a Hordas das regras personalizadas de −PV máximo e preservação de tempo.
- O sistema não cria nem materializa Hordas até essas regras serem definidas. As regras do livro que já são determinadas podem ser implementadas sem alterar o TXT original.

## Verificação

- `src/test/controladorDissipacaoVoluntaria.test.ts` testa turno do dono, rodada de criação, estado Caído, derrota e dissipação fora de combate.
- Testes locais sem conexão com Supabase.
