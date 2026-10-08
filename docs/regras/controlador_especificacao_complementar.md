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
