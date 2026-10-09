# Controlador — Especificação complementar aprovada

**Data da decisão:** 2026-10-08  
**Status:** decisões de produto aprovadas pelo usuário; **não equivale a funcionalidades já implementadas**.  
**Fonte normativa preservada, sem alterações:** [Invocações — TXT original](./invocacoes_texto_original_2026-10-08.txt).

## Prioridade e interpretação
- O TXT original permanece intacto e fornece as regras-base do livro.
- Este documento especifica decisões de implementação, personalização e exceções expressamente autorizadas pelo usuário.
- Divergências entre funcionalidades existentes e estas decisões geram tarefas de correção; não devem ser tratadas como já resolvidas.
- Sempre que houver dúvida relevante de regra, comportamento ou design, **perguntar ao usuário antes de decidir**.
- Criador de Shikigamis: interface de **ficha completa**, com todos os campos em seções, não um assistente de etapas.

## Decisões anteriores confirmadas
1. **Livro como referência, com liberdade de edição:** usar os valores e tabelas do livro como sugestões/padrões; permitir alterações livres.
2. **Motor único OMNI:** ações, efeitos, gatilhos, características e fórmulas dos Shikigamis usam o OMNI; ampliar o motor quando necessário em vez de duplicá-lo.
3. **Evolução decidida pelo Controlador:** o jogador escolhe como evoluir sua invocação, inclusive suas opções e distribuição, em vez de impor uma reconstrução fixa.
4. **Limites informativos:** mostrar avisos de divergência em relação ao livro, sem bloquear salvamento ou edição apenas por exceder valores recomendados; preservar validações técnicas e de segurança.
5. **Combate conforme a fonte:** substituir comportamentos provisórios conflitantes, especialmente comandos e movimentação, pelas regras do TXT ou por exceções explicitamente aprovadas.

## Sete esclarecimentos adicionais aprovados
### 1. Alternância automática/manual por campo
Cada campo derivado da ficha deve oferecer um controle explícito para alternar entre **valor calculado automaticamente** e **valor manual**. Ao utilizar o modo manual, preservar o valor inserido, sem sobrescrevê-lo silenciosamente pelo cálculo automático. A alternância deve ser independente por campo.

### 2. Evolução e recálculo
Ao subir de nível ou evoluir, atualizar automaticamente os **valores derivados em modo automático**, preservando atributos e escolhas feitas pelo Controlador. Os valores em modo manual permanecem sob controle do jogador. As escolhas de evolução continuam livres.

### 3. Independência e automações
Permitir **automações de combate configuradas no OMNI**, além das que ocorrerem fora do combate. Sua execução deve respeitar a validação do motor e as regras de custo, turno, comandos, gatilhos e segurança aplicáveis; detalhes ainda não especificados devem ser esclarecidos com o usuário.

### 4. Capacidades totalmente personalizadas
Permitir ações e características personalizadas com as keys, fórmulas, condições e gatilhos do OMNI, sem restrições artificiais do editor além das validações técnicas e da segurança do motor. Limites do livro são exibidos como avisos, salvo quando o usuário determinar uma proibição específica.

### 5. Recuperação e perda de invocações
**A resolução da perda é decisão do Controlador ou do Mestre**, não uma remoção definitiva automática. Quando uma invocação chegar a 0 PV ou ocorrer situação com risco de perda, o sistema deve permitir a decisão do responsável. Não excluir permanentemente a entrada da biblioteca sem escolha explícita.

### 6. Reações dos Shikigamis
Ao ocorrer gatilho válido de reação, abrir **prompt para o jogador Controlador**, pausando o combate/relógio durante a resolução. Integrar às janelas de reação do sistema em vez de criar uma lógica paralela. O Mestre conserva controle total conforme a decisão 7.

### 7. Permissões do Mestre
O **Mestre possui controle e edição total sobre qualquer Shikigami**, independentemente de seu proprietário. Os jogadores controlam suas próprias invocações de acordo com as permissões usuais.


## Decisões adicionais de controle, autonomia e tempo — 2026-10-09

**Status:** especificação aprovada; a implementação existente precisa ser revisada e validada. Estas decisões são complementares ao TXT original e, em caso de diferença, representam uma personalização solicitada pelo usuário, sem alterar a fonte.

### 8. Duas formas de controle individual
Cada Shikigami deve permitir **ambas as interfaces**: (a) selecionar seu token e assumir o controle pela HUD própria da invocação; (b) selecioná-lo e enviar comandos pela HUD do Controlador. O controle e a seleção são individuais por Shikigami, mesmo quando vários pertencem ao mesmo jogador.

### 9. Cronômetro individual e relógio global
A ficha de criação de **cada Shikigami** deve oferecer um campo configurável de **tempo adicional**. No combate, o tempo de cada Shikigami deve **ser acrescido ao relógio global do jogador Controlador**, em vez de funcionar como um relógio isolado independente do cronômetro principal. Deve existir identificação visual da contribuição e/ou uso de tempo de cada invocação, evitando confundir o tempo dos diferentes Shikigamis.

**Regra confirmada em 2026-10-09 — momento do acréscimo:** o tempo adicional de um Shikigami é acrescido **no instante em que ele é invocado**, não automaticamente no começo de cada turno e não somente quando recebe um comando.

**Regra confirmada em 2026-10-09 — reservas individuais:** cada Shikigami tem **sua própria reserva de tempo identificável**, definida na criação da ficha. As reservas individuais **contribuem para o relógio global do jogador Controlador**, que recebe o acréscimo ao invocar cada criatura. A interface deve permitir acompanhar de qual Shikigami veio cada contribuição, evitando dupla contabilização de um mesmo evento de invocação.

**Ainda precisa de esclarecimento, não presumir valores nem comportamento:** unidade, limite e valor inicial do tempo configurável; tratamento da reserva quando o Shikigami é dissipado, derrotado, reinvocado ou quando o combate termina; eventual simultaneidade das ações; regras detalhadas para debitar as reservas individuais durante a execução. Consultar o usuário antes de implementar esses aspectos.

### 10. Economia de ações independente
Cada Shikigami terá **seu próprio conjunto de ações e recursos**, definidos na sua ficha no momento da criação, em vez de compartilhar as quantidades de ações do jogador. Eles são entidades autônomas em combate, funcionando quase como personagens individuais, mas mantendo vínculo com o proprietário e com o relógio global conforme a decisão anterior.

**Revisão obrigatória:** a implementação provisória que debita `actionsCurrent` e `bonusActionsCurrent` do Controlador para ações da invocação não atende a esta decisão; revisar antes de afirmar que o combate está concluído.

### 11. Autonomia configurada individualmente
A autonomia é uma configuração **por Shikigami**, definida na sua própria ficha, inclusive o **custo dos comandos**. Deve permitir comportamentos e ações automáticas em combate por meio do motor OMNI, respeitando sua validação e segurança. Não impor o mesmo conjunto de regras de autonomia a todas as invocações.

**Pormenores ainda não definidos:** quais custos são permitidos, como são pagos e quais gatilhos OMNI podem operar sem intervenção do Controlador. Perguntar antes de escolher defaults de regra.

### 12. Identidade e gestão separadas
Cada Shikigami deve ter identidade visual, imagem/token, ficha, HUD e indicadores próprios de PV, ações e tempo, distinguíveis dos personagens jogadores. Suas rolagens, habilidades, reações e estado devem ser rastreados por invocação, sem confundirem seus valores com os do dono. O Mestre conserva edição e controle total (decisão 7).

## Novas verificações de aceitação
- [ ] Seleção e controle por HUD de invocação e por HUD do Controlador.
- [ ] Campo configurável de tempo extra na criação de cada Shikigami.
- [ ] Soma verificável dos tempos individuais ao relógio global do jogador, disparada ao invocar cada Shikigami, sem duplicação.
- [ ] Reservas de tempo distintas e identificáveis na HUD, contribuindo para o relógio global.
- [ ] Recursos e ações separados por invocação e independentes do saldo de ações do dono.
- [ ] Autonomia e custos próprios configuráveis por invocação no OMNI.
- [ ] Imagem, token, HUD, PV, rolagens e estados individualizados.
- [ ] Testes de duas ou mais invocações simultâneas, inclusive relógio, comandos, economia e sincronização.

## Checklist de implementação — pendente de validação funcional
- [ ] Campos da ficha de criação e edição com alternância automática/manual individual.
- [ ] Recálculo de PV, Defesa e outros valores derivados, respeitando o modo manual.
- [ ] Avisos não bloqueantes de orçamento de atributos, limites de ações e custos do livro.
- [ ] Integração real de ações/características e automações ao executor OMNI.
- [ ] Adequação dos comandos/movimentação às regras e exceções aprovadas.
- [ ] Resolução manual da perda, evitando exclusão irreversível automática.
- [ ] Prompts de reação ao jogador com pausa do relógio.
- [ ] Permissões de edição/controle de qualquer invocação para o Mestre.
- [ ] Testes automatizados e validação em navegador dos fluxos finais.

**Nota:** marcar itens somente depois de implementação e testes verificáveis. O TXT original não deve ser alterado para acomodar estas decisões.
