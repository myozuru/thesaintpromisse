# Etapa 13 — Armas e custos

## Resultado da auditoria

O fluxo de ações ativas já identifica itens limitados por `instanceId`, impede o uso de uma arma OMNI que não esteja empunhada e confirma que uma arma de duas mãos ocupa as duas mãos. Munição, cargas, PE/PV e tipo de ação são planejados e validados antes dos débitos. O uso da instância é debitado primeiro; se ele falhar, os outros recursos permanecem intactos. Reações com pagamento recusado são estornadas pelo fluxo de reação.

Adicionado um teste integrado de pagamento: uma ação que exige 10 PE, 5 PV, uma ação comum, três munições, um uso do item e uma carga falha quando há somente duas munições, sem alterar ficha, inventário ou contador.

## Limitação de identidade aberta

O saldo de munição ainda vive em `Character.weaponAmmo`, indexado pelo nome da arma, e `equipWeapons` persiste os slots da ficha pelos nomes principal/secundário. Consequentemente, duas cópias de mesmo nome não têm saldo de munição independente e não são selecionadas pela ficha por ID de instância. Os usos limitados de itens já usam `instanceId`, mas isso não migra o estado de recarga. Resolver essa parte exige uma migração coordenada do modelo da ficha, seleção de arma, interface de recarga e compatibilidade com munição legada; a etapa não será marcada como concluída enquanto essa identidade não for definida.

## Evidências

- `src/lib/omni/custosAtivos.ts`: planejamento e validação conjunta dos recursos.
- `src/lib/omni/acaoAtiva.ts`: validação da instância e pagamento antes da rolagem.
- `src/stores/useCharacterStore.ts`: regra de ocupação simultânea das duas mãos.
- `src/lib/recargaRapida.ts`: saldo de munição atualmente indexado por nome.
- Testes: `omniCustosAtivos.test.tsx`, `omniArmasMapa.test.tsx`, `omniEquipamentoAuditoria.test.tsx` e `omniAtivasAuditoria.test.tsx`.

Verificação focada: quatro arquivos de teste passaram (92 testes). O tipo de identidade da munição continua pendente para fechar esta etapa.
