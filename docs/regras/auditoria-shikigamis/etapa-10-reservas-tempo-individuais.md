# Etapa 10 — Reservas de tempo individuais

**Data:** 2026-10-10  
**Branch de entrega:** `main`  
**Escopo:** configurar, conceder, consumir e retirar reservas individuais de tempo das instâncias de invocação, integradas ao cronômetro de turno do dono.

## Regras cobertas

- A quantidade e a unidade são configuradas na criação da ficha. Sem configuração, a invocação concede zero segundos; valores precisam ser finitos e não negativos. Não há limite máximo fixo para a contribuição.
- Segundos, minutos e horas são convertidos diretamente. Turnos e rodadas equivalem a 6 segundos.
- Cada nova instância recebe um registro próprio, com IDs de instância e evento. A concessão é idempotente: repetir o mesmo evento não soma tempo outra vez. Uma nova invocação materializada recebe uma nova concessão.
- O tempo-base configurado para o turno é consumido antes das reservas individuais. Depois, as reservas são consumidas em ordem de criação (FIFO) e o saldo consumido fica na respectiva instância.
- Se a instância for invocada durante o turno do dono com o cronômetro ativo, sua contribuição entra no relógio corrente. Caso contrário, fica vinculada ao combate e entra no relógio do dono quando ele iniciar um turno.
- Dissipação voluntária retira a reserva da instância. No relógio corrente do dono, a retirada não reduz o saldo abaixo de 10 segundos; a parte que excederia esse piso é descartada. Fora do turno do dono, toda a reserva é cancelada para os turnos seguintes.
- Derrota definitiva converte a reserva restante em consolação e mantém o saldo até o fim do combate. Saldo não usado expira quando o combate termina.

## Implementação

- `src/lib/controlador/tempo.ts` centraliza conversão de unidades, criação do registro individual, alocação do consumo e formatação.
- `src/lib/invocacoes/schema.ts` adiciona o tipo explícito da contribuição; `estadoInvocacao.ts` aceita o registro ao materializar uma instância.
- `src/stores/useCombatStore.ts` integra o tempo-base e as reservas ao cronômetro, aplica consumo FIFO, grava saldos na instância, associa reservas pendentes ao combate e expira saldos no encerramento. O estado persistido anterior é migrado considerando todo o tempo salvo como tempo-base.
- `src/lib/controlador/mapa.ts` concede tempo ao invocar, respeita a idempotência, registra dissipação e preserva saldo após derrota.
- `CriadorShikigami.tsx` permite escolher unidade e quantidade na criação; `ControladorInvocacoesSection.tsx` mostra saldo e estado da reserva.
- `useMultiplayerSync.ts` inclui a identidade do combate e o estado do cronômetro na sincronização já existente.

## Evidência

- `src/test/controladorTempo.test.ts` cobre conversões, migração de estado persistido, idempotência, consumo do tempo-base antes da fila FIFO, piso de 10 segundos e criação de concessões por instância.
- `src/test/controladorMapa.test.ts` cobre concessão única durante a invocação, dissipação com piso e preservação após derrota.
- Testes focados: **8 arquivos, 99 testes aprovados**.
- Suíte completa: **242 arquivos, 5.076 testes aprovados**.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado.
- Os testes de regra usam stores locais e mocks; nenhuma chamada a Supabase foi necessária.

## Limites desta etapa

- As reservas são registradas e sincronizadas pelos stores atuais. A validação autoritativa do servidor, reconexão e disputa entre clientes pertencem à etapa 19.
- A economia independente de ações, recursos e recargas por invocação pertence à etapa 11. Invocar continua sendo Ação Livre por enquanto.
- Recuperação, perda permanente e demais decisões narrativas após a derrota pertencem à etapa 18.
