# Entrega de equipamentos entre telas

A entrega do OMNI e do Catálogo cria uma instância em `useInventoryStore`. O slice `omniInventory` agora publica essas instâncias pelo canal da mesa, recebe alterações e salva/carrega o inventário em `realtime_world`. O cache local é preservado para uso offline.

A reconciliação usa `instanceId`, preserva entregas independentes e escolhe a versão mais recente de cada instância. Repetir uma mensagem não duplica a arma. Equipamento, usos, materialização e outras alterações diretas recebem uma versão. Remoções deixam registros persistentes para impedir que uma cópia antiga restaure itens excluídos.

Itens entregues antes desta correção podem ser recuperados abrindo novamente a mesa no navegador do Mestre onde foram entregues: o cache existente é reconciliado e publicado. Se aquele cache foi apagado e a entrega nunca foi sincronizada, será necessário entregar o item novamente.

Testes cobrem entrega entre telas simuladas, reconexão, mensagens repetidas, remoção, equipamento, usos, alterações diretas, cache legado e emissão/recebimento pelo hook real sem eco. A validação usa stores reais e uma nuvem offline; não acessa dados da mesa em produção.
