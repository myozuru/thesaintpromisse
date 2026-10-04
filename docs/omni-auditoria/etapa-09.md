# Auditoria OMNI — etapa 9 de 10

Base revisada: `5c10bfd54d6082be6f9a93908f304d6073a8a111`.

Escopo executado: persistência no cliente, identidade de exemplares e recepção de estados multiplayer. Nenhuma key foi renomeada. A revisão encontrou falhas reais e corrigiu as descritas abaixo. A implementação e os testes locais desta etapa estão concluídos; a garantia de concorrência distribuída continua pendente de trabalho no servidor.

## Falhas corrigidas

| Caminho | Problema encontrado | Resultado da correção |
| --- | --- | --- |
| Catálogo, runtime e posições OMNI | Recepção substituía o dicionário inteiro; hidratação favorecia o local sem comparar versões | União por registro, versão, desempate determinístico e exclusões persistentes. Ausência no pacote não apaga registros independentes. |
| Remoção e recarga da página | Uma cópia antiga podia ressuscitar registros removidos | Tombstones persistidos e transmitidos com o snapshot. Inventário mantém exclusão definitiva da instância; catálogo/runtime/posição podem receber uma versão explicitamente posterior à exclusão. |
| Gravação na nuvem | Snapshot parcial podia substituir registros já existentes | União com a leitura corrente antes do upsert, também na hidratação. Isso reduz perda sequencial; NÃO equivale a transação atômica. |
| Recepção de fichas e relógio/combate | Resultado recebido podia executar automações novamente | Contexto explícito de recepção. Watcher atualiza seu baseline sem aplicar efeitos; listener de zonas não repete um turno recebido. |
| Auras e relógio | Jogadores podiam recalcular efeitos globais; a mesma aura vinculada e no runtime duplicava entradas | Execução automática nessas rotas fica com o Mestre. Aura usa uma origem por entidade/dono; vínculo tem prioridade. Membership de aura vinculada é persistido localmente por cena e runtime conserva cena no metadata. |
| Passivas vinculadas | Vínculo repetido da mesma entidade/instância duplicava fontes | Coleta deduplica a identidade do vínculo. |
| Duas armas com o mesmo nome | Caminhos escolhiam exemplares por ordens distintas | Seleção automática comum: equipado primeiro, aquisição mais antiga, ID como desempate. Ataque, gatilhos, reação e descarte consultam a mesma escolha. |
| Ação ativa escolhida no card | Estatísticas da primeira arma podiam ser usadas para outra cópia selecionada | Prévia e resolução usam o ID escolhido, validam dono e entidade antes/depois de esperar. Seletor de exemplares continua disponível. |
| Snapshot do inventário | Objetos aninhados eram compartilhados com o template | Aquisição clona profundamente a entidade, incluindo usos e tags comerciais. |
| Reentrega de item | Mesmo ID podia reiniciar cargas; colisão podia sobrescrever instância | Repetir entrega ao mesmo dono/entidade retorna a instância existente; colisão e recriação de ID removido são recusadas. |
| Usos | Consumo negativo/fracionário ou estado corrompido podia aumentar/invalidar cargas | Rejeita custos não inteiros, negativos e não finitos; recusa contagem limitada corrompida. |
| Movimento confirmado | Outra mensagem antiga com ID diferente podia desfazer posição/repetir efeitos | Checkpoint de versão e ID na peça, persistido no mapa. Mensagem duplicada ou anterior é recusada antes de mover ou entregar eventos. |
| Prévia de arraste | Patch atrasado podia sobrescrever posição final | Timestamp capturado por peça quando enfileirada; recepção compara com a confirmação. Flush tardio não transforma a prévia velha em nova. |
| Movimento recebido pelo Mestre | Supressão da recepção podia bloquear envio dos efeitos gerados pelo movimento aceito | Supressão cobre atualização do mapa; é liberada antes da execução dos listeners da confirmação, permitindo publicar os resultados. |
| Tokens e seleção | Ordem das peças mudava token escolhido; outro token da mesma ficha podia contornar a seleção | Preferência por vínculo explícito da ficha e desempate estável. Seleção exige o token canônico visível na camada válida; rejeita peça carregada e limite de alvos inválido. |

## Validação executada

`src/test/omniSyncAuditoria.test.tsx`: 44 novos testes. Usa mesa em memória com várias telas para a união de estados, e stores reais em jsdom para inventário, runtime, cache, watchers, auras, relógio e movimento. Nuvem/socket são simulados, sem tráfego de campanha.

Cobertura inclui registros independentes, entrega duplicada, versões fora de ordem, desempate, JSON/reload, exclusões, protocolo legado, payload inválido, versão monotônica, ausência de redatação remota, snapshot profundo, identidade e transferência, colisão, consumo inválido, exemplar explícito, vínculos duplicados, watcher remoto, aura duplicada, execução por papel, checkpoint e prévia antiga.

Ajustado o teste do Interceptador para concluir o carregamento do executor antes de aplicar dano. Isso removeu as duas rejeições de import que apareciam depois do teardown; não foi ignorado erro do aplicativo.

Resultado final: **190 arquivos e 4.085 testes aprovados, sem rejeições assíncronas não tratadas. TypeScript (`tsc --noEmit`) e build de produção aprovados.** Avisos existentes de bundle/storage do ambiente de teste não foram tratados como falhas funcionais.

## Compatibilidade e limites que permanecem

1. Os dicionários transmitidos passam a usar `omni-sync.v1`, com `records` e `deleted`. A recepção nova lê o formato legado; clientes antigos não entendem necessariamente o novo envelope. Atualizar/recarregar todas as telas da mesa antes de misturar sessões. Prévia/confirmacão sem versão não pode sobrescrever peça que já tem checkpoint novo.
2. Versões com timestamps e desempate dão convergência por registro, não soma de operações concorrentes. Dois clientes gastando cargas da mesma ficha/exemplar simultaneamente ainda precisam de transação no servidor. O padrão leitura + merge + upsert não é atômico: gravações simultâneas podem competir.
3. Dois Mestres, inclusive duas abas do mesmo Mestre, ainda podem executar automações globais. Restringir a PLAYER versus MASTER não elege um único líder. Resolver isso exige lease/autoridade no servidor, não apenas uma flag do cliente.
4. Restrições de papel e propriedade nesta alteração são regras do cliente. Não certificam autorização de remetentes, RLS ou autenticação do transporte. Não foi realizada campanha online com contas distintas, queda/reconexão ou teste do backend em produção.
5. Tombstones precisam ser conservados para barrar snapshots antigos. Compactação segura exige uma política de retenção coordenada; removê-los por um limite arbitrário reabre a ressuscitação de registros.
6. Fichas legadas guardam nomes de armas. A escolha automática é agora consistente, mas não representa dois IDs independentes de empunhadura. Migração completa de mãos para IDs e semântica de duas cópias com o mesmo nome requer esquema próprio.
7. Cache de aura vinculada é local. Impede reentrada por recarga nessa tela, mas não constitui transferência de liderança entre Mestres. Validação dos envelopes cobre identidade, timestamps e campos estruturais usados; não substitui validação completa de regras no servidor.

## Próxima etapa

Resta **1 etapa planejada: etapa 10, guia e verificação final**. Ela deve documentar os comportamentos reais, reconciliar exemplos com o motor e registrar explicitamente as pendências acima. O fim da auditoria local não deve ser apresentado como garantia de execução única ou transação distribuída.
