# Modelos temporários compartilhados

## Objetivo
Fazer os modelos de fichas temporárias aparecerem para todos os participantes e em qualquer aparelho conectado à mesma mesa, sem perder os modelos já salvos neste navegador.

## Implementação
- Incluir os modelos temporários como uma parte própria do estado compartilhado já usado pela mesa.
- Carregar os modelos salvos na nuvem ao entrar e receber criações, renomeações e exclusões em tempo real.
- Na primeira conexão, mesclar modelos locais antigos com os modelos da nuvem pelo identificador, preservando ambos e publicando o resultado combinado.
- Manter o armazenamento local apenas como cópia de segurança para uso offline; a nuvem passa a ser a fonte compartilhada.
- Restringir criação, renomeação e exclusão de modelos à interface do Mestre, como já ocorre hoje.

## Validação
- Testar criação, edição e exclusão propagadas entre duas mesas simuladas.
- Testar a migração de um modelo local antigo junto de modelos já existentes na nuvem, sem duplicar ou apagar dados.
- Testar que um modelo recebido pode ser aplicado a uma ficha temporária.
- Rodar a suíte relevante e confirmar que a aplicação continua compilando sem erros.

## Detalhes técnicos
- Reutilizar `realtime_world` e o canal de atualizações já existente, com uma nova fatia `tempTemplates`.
- Não é necessária uma nova tabela nem alteração estrutural no banco.
