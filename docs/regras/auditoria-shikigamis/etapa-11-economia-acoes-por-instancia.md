# Etapa 11 — economia de ações por Shikigami

**Data:** 10/10/2026  
**Status:** fundação implementada; execução geral de OMNI e reações completas continuam nas etapas próprias.

## Comportamento implementado

- A economia é armazenada em `InstanciaInvocacao`, vinculada ao ID da instância. Duas instâncias do mesmo modelo mantêm saldos separados.
- A criação permite configurar quantidade e reset independente para Ação Comum, Simples, Complexa, Movimento, Bônus, Livre e Reação. Os marcos disponíveis são início do turno do dono, início da rodada, início do combate e manual. Campo ausente significa sem reset automático.
- Ação Simples usa seu próprio saldo quando configurado; na ausência dele, usa Ação Bônus. Ação Complexa usa seu saldo quando configurado; na ausência dele, usa Ação Comum. Ataques sem categoria explícita são tratados como Ação Complexa.
- O reposicionamento atual gasta Ação Livre própria. Levantar uma invocação Caída gasta Ação de Movimento própria. Ataques gastam o saldo próprio configurado e não debitam `actionsCurrent`, `bonusActionsCurrent` nem créditos de comando do dono.
- O início do combate, da rodada e do turno do dono aplica somente os resets escolhidos na ficha. O registro do último evento impede o mesmo marco de restaurar o saldo duas vezes.
- Ações podem ter recarga estruturada em turnos do dono, rodadas ou reset manual. A recarga fica na instância e reduz no marco selecionado.
- A ficha permite configurar recursos próprios com saldo inicial, máximo e recuperação no turno do dono, rodada, combate ou manual. A materialização copia esses saldos para a instância; recuperação automática respeita o máximo.
- Cada ação pode definir se é manual ou exclusiva de evento automático, e distribuir débitos entre PE do dono e recursos da invocação. O executor valida todos os saldos antes de gastar qualquer um. A soma dos débitos de PE precisa corresponder ao custo total em PE. Débitos de outros recursos próprios são adicionais.
- Comandos podem receber `requestId`, persistido por instância para impedir replay do mesmo ID. Os últimos 200 IDs são mantidos.
- A HUD e o painel do dono exibem esses saldos sem misturá-los aos recursos do personagem; os resets marcados como manuais podem ser aplicados à instância pelo painel (concluído na Etapa 12).

## Regras preservadas

- Invocar continua sendo Ação Livre conforme a decisão já registrada.
- O alcance de posicionamento continua vindo da criação da ficha.
- Ação com custo sem origem configurada é recusada; o sistema não escolhe automaticamente entre dono e invocação.
- Uma ação marcada como evento automático não pode ser disparada pelo comando manual. A execução pelo OMNI será ligada na Etapa 16.

## Escopo que segue pendente

- Rolagens e execução geral das habilidades e ações OMNI continuam nas Etapas 13 e 15.
- Reações já têm saldo e reset por instância, mas a janela de reação, prompt e execução antes do dano continuam na Etapa 17.
- A verificação server-side, locks entre clientes e sincronização autoritativa permanecem na Etapa 20.

## Validação

- Testes direcionados: 4 arquivos, 66 testes aprovados, incluindo duas instâncias independentes, resets por escopo, recarga, recurso próprio, custo dividido e recusa sem débito parcial.
- Suíte completa: 243 arquivos, 5.085 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado.
