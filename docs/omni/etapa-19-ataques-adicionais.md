# Etapa 19 — Ataques adicionais

## Auditoria

Os ataques adicionais identificados no código são Arremesso Rápido, Golpe Amplo, Arremesso Ágil e os ataques de Disparos Sincronizados. O construtor OMNI não possui uma ação que crie outra rolagem de ataque a partir de um evento; `aoAcertarAtaque` executa efeitos configurados, mas não agenda um ataque por conta própria. Reações de contra-ataque também usam `ignorarReacoes` ao resolver sua rolagem, evitando que uma reação abra outra cadeia de reações.

## Implementação

- `AttackContext.semRecursao` marca uma rolagem gerada por outra ação/ataque.
- Ataques secundários de Golpe Amplo, Arremesso Ágil, Disparos Sincronizados e o helper de ataque concedido recebem a marca.
- Arremesso Rápido marca a próxima rolagem como concedida, consome a marca após a resolução (inclusive cancelamento/erro) e não permite acionar Golpe Especial Amplo novamente nesse ataque.
- Efeitos que concedem bônus normais no acerto continuam processando; a trava é para criação de novos ataques adicionais.

## Evidências

- O teste do motor confirma que `semRecursao` é preservada no contexto.
- O teste em combate real de Arremesso Rápido confirma que o ataque extra causa dano e que a concessão é consumida ao concluir.
- O reset de uso por rodada de Arremesso Rápido já era verificado no teste de combate da habilidade.
- `npx vitest run src/test/especialistaNv4Combate.test.tsx src/test/omniReacoesAtivas.test.tsx -t "ataque extra acontece de verdade|preserva a barreira"`: 2 testes passaram.
- `npx tsc --noEmit` e `git diff --check` passaram.
