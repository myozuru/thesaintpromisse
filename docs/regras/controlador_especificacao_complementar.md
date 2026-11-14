# Controlador — Especificação complementar aprovada

**Data da decisão:** 2026-10-08  
**Status:** decisões de produto aprovadas pelo usuário; **não equivale a funcionalidades já implementadas**.  
**Fonte normativa atual:** [Enciclopédia Maldita — v1.1.1](./fonte-canonica-enciclopedia.md). O [TXT de invocações de 2026-10-08](./invocacoes_texto_original_2026-10-08.txt) fica preservado como registro histórico, não como fonte normativa.

## Prioridade e interpretação
- A Enciclopédia Maldita (F&M 2.5.2), versão de arquivo v1.1.1, fornece as regras-base atuais do livro e substitui a referência anterior à Enciclopédia Amaldiçoada v0.9.
- Este documento especifica decisões de implementação, personalização e exceções expressamente autorizadas pelo usuário.
- Uma decisão de produto aprovada pelo usuário continua sendo exceção somente quando especifica explicitamente uma regra diferente; nos demais casos, seguir a edição v1.1.1.
- Divergências entre funcionalidades existentes e estas decisões geram tarefas de correção; não devem ser tratadas como já resolvidas.
- Sempre que houver dúvida relevante de regra, comportamento ou design, **perguntar ao usuário antes de decidir**.
- Criador de Shikigamis: interface de **ficha completa**, com todos os campos em seções, não um assistente de etapas.

**Atualização de fonte em 2026-11-13:** os perfis padrão e as citações do pacote Dez Sombras foram atualizados para a edição v1.1.1. Não reutilizar páginas ou fichas da v0.9 sem conferência. As regras de Manipulação de Maldições estão referenciadas nas pp. 131–137 e na p. 232; elas complementam as decisões específicas da especialização Controlador.

## Decisões anteriores confirmadas
1. **Livro como referência, com liberdade de edição:** usar os valores e tabelas do livro como sugestões/padrões; permitir alterações livres.
2. **Motor único OMNI:** ações, efeitos, gatilhos, características e fórmulas dos Shikigamis usam o OMNI; ampliar o motor quando necessário em vez de duplicá-lo.
3. **Evolução decidida pelo Controlador:** o jogador escolhe como evoluir sua invocação, inclusive suas opções e distribuição, em vez de impor uma reconstrução fixa.
4. **Limites informativos:** mostrar avisos de divergência em relação ao livro, sem bloquear salvamento ou edição apenas por exceder valores recomendados; preservar validações técnicas e de segurança.
5. **Combate conforme a fonte:** substituir comportamentos provisórios conflitantes, especialmente comandos e movimentação, pelas regras da Enciclopédia Maldita v1.1.1 ou por exceções explicitamente aprovadas. O TXT antigo é apenas histórico.

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
**O Mestre decide a resolução da perda.** Chegar a 0 PV não remove a invocação permanentemente. A perda permanente só pode ser decidida quando os PV atingirem −100% dos PV máximos; essa consequência não é automática e depende da decisão do Mestre. Não excluir a ficha da biblioteca sem essa decisão.

### 6. Reações dos Shikigamis
Ao ocorrer gatilho válido de reação, abrir **prompt para o jogador Controlador**, pausando o combate/relógio durante a resolução. Integrar às janelas de reação do sistema em vez de criar uma lógica paralela. O Mestre conserva controle total conforme a decisão 7. As ofertas passam automaticamente quando o prazo termina.

### 7. Permissões do Mestre
O **Mestre possui controle e edição total sobre qualquer Shikigami**, independentemente de seu proprietário. Os jogadores controlam suas próprias invocações de acordo com as permissões usuais.


## Decisões adicionais de controle, autonomia e tempo — 2026-10-09

**Status:** especificação aprovada; a implementação existente precisa ser revisada e validada. Estas decisões complementam a fonte normativa v1.1.1; quando uma decisão aprovada especifica uma regra diferente, ela vale como personalização da campanha sem alterar a fonte.

### 8. Duas formas de controle individual
Cada Shikigami deve permitir **ambas as interfaces**: (a) selecionar seu token e assumir o controle pela HUD própria da invocação; (b) selecioná-lo e enviar comandos pela HUD do Controlador. O controle e a seleção são individuais por Shikigami, mesmo quando vários pertencem ao mesmo jogador.

### 9. Tempo configurável e relógio global
A ficha de criação de **cada Shikigami** deve oferecer um campo livre para definir seu tempo. O Mestre aprova a ficha conforme seu julgamento; o aplicativo não impõe um teto numérico de regra. No combate, há **um único relógio global compartilhado**: não existe prioridade nem consumo de relógios individuais, e quando o relógio global termina, termina o tempo de todos os Shikigamis ativos.

**Regra confirmada em 2026-10-11 — valor do tempo:** cada Shikigami recebe o tempo escolhido na criação, sem valor padrão e sem limite máximo geral imposto pelo aplicativo. O Mestre aprova a ficha conforme seu julgamento.

**Regra confirmada em 2026-10-09 — momento do acréscimo:** o tempo adicional de um Shikigami é acrescido **no instante em que ele é invocado**, não automaticamente no começo de cada turno e não somente quando recebe um comando.

**Regra confirmada em 2026-10-11 — tempo compartilhado:** a invocação adiciona seu tempo configurado ao relógio global ao ser materializada. Depois do acréscimo, todos compartilham o mesmo saldo e a mesma expiração; não há relógios independentes nem prioridade por Shikigami. Os registros por instância servem para identificar/idempotizar acréscimos e retirar a parte restante em uma dissipação voluntária. O tempo global decorrido é distribuído proporcionalmente entre o tempo-base e os acréscimos ativos, sem FIFO.

**Regra confirmada em 2026-10-11 — dissipação voluntária:** quando a invocação é dissipada por escolha do Controlador ou Mestre, retirar do relógio global o tempo restante associado àquela invocação. Se essa retirada levaria o saldo abaixo de 10 segundos, o relógio fica em 10 segundos. Não retirar tempo já consumido.

**Reinvocação conforme o texto-base e as decisões do usuário:** após dissipação voluntária, o Controlador pode trazer o Shikigami de volta sem pagar o custo de PE novamente, mantendo os PV que tinha ao ser dissipado. Após dissipação forçada a 0 PV, uma nova invocação cobra o custo de PE configurado; o Shikigami materializa com 0 PV e Caído, e um descanso longo restaura 100% dos PV. Cada nova materialização acrescenta novamente ao relógio global o tempo configurado na ficha. Em qualquer caso, o Shikigami espera seu próximo turno na iniciativa para agir.

**Regra confirmada em 2026-10-11 — 0 PV e derrota:** chegar a **0 PV não causa perda permanente**. A ficha continua no catálogo e pode ser invocada com 0 PV; materializa Caída. Ao atingir **−100% dos PV máximos** (por exemplo, −20 PV para uma invocação com PV máximo 20), o Mestre precisa decidir antes de permitir nova materialização. A perda permanente não ocorre automaticamente. A duração e os efeitos da incapacitação ainda serão definidos; não inventar uma duração provisória.

**Regra confirmada em 2026-10-11 — recuperação:** a invocação recupera **100% dos PV após um descanso longo**. O tratamento de cura parcial, retorno à ação e duração da incapacitação fica pendente de revisão; não aplicar a regra anterior de levantar com Ação de Movimento até essa revisão.

**Regra confirmada em 2026-10-11 — tempo após derrota:** ao atingir −100% dos PV máximos, não descontar do relógio global o tempo já adicionado por aquela invocação. Registrar o evento separado da dissipação voluntária; a decisão sobre perda permanente continua exclusiva do Mestre.

**Regra confirmada em 2026-10-11 — Hordas:** uma Horda adiciona tempo como **uma única entidade** ao relógio global, sem cronômetros por integrante. A Horda compartilha um total geral de PV; não há uma vida separada para cada integrante.

**Pendências:** duração/efeitos da incapacitação; valor adicional de PE para integrante de Primeiro Grau sob líder Especial; implementação e interações de Hordas (incluindo perda de membros, dano em área, tamanho e fim do combate). O limite de Hordas ativas é arredondado para baixo. Invocar continua como Ação Livre.

### 10. Economia de ações independente
Cada Shikigami terá **seu próprio conjunto de ações e recursos**, definidos na sua ficha no momento da criação, em vez de compartilhar as quantidades de ações do jogador. Eles são entidades autônomas em combate, funcionando quase como personagens individuais, mas mantendo vínculo com o proprietário e com o relógio global conforme a decisão anterior.

**Regra confirmada em 2026-10-11 — entrada na iniciativa:** depois de materializado, o Shikigami espera seu próximo turno na ordem de iniciativa para agir; não recebe uma ação imediata no momento da invocação.



**Revisão obrigatória:** a implementação provisória que debita `actionsCurrent` e `bonusActionsCurrent` do Controlador para ações da invocação não atende a esta decisão; revisar antes de afirmar que o combate está concluído.

### 11. Autonomia configurada individualmente
A autonomia é uma configuração **por Shikigami**, definida na sua própria ficha, inclusive o **custo dos comandos**. Deve permitir comportamentos e ações automáticas em combate por meio do motor OMNI, respeitando sua validação e segurança. Não impor o mesmo conjunto de regras de autonomia a todas as invocações.

**Regra confirmada em 2026-10-11 — confirmação do jogador:** toda ação proposta ou acionada pela autonomia exige confirmação do jogador antes de ser executada.

**Pormenores ainda não definidos:** quais custos são permitidos e como são pagos. Não executar uma ação autônoma sem a confirmação do jogador.

### 12. Identidade e gestão separadas
Cada Shikigami deve ter identidade visual, imagem/token, ficha, HUD e indicadores próprios de PV, ações e tempo, distinguíveis dos personagens jogadores. Suas rolagens, habilidades, reações e estado devem ser rastreados por invocação, sem confundirem seus valores com os do dono. O Mestre conserva edição e controle total (decisão 7).

### 13. Prazo e controle das reações — 2026-10-11
- Toda reação tem prazo padrão de **12 segundos** e passa automaticamente ao terminar.
- O Mestre pode acrescentar segundos ou pausar e retomar **todas as reações ativas** a qualquer momento.
- Esses controles ficam disponíveis somente para o Mestre. A pausa conserva o tempo restante; ao retomar, a contagem continua desse saldo.

## Novas verificações de aceitação
- [ ] Seleção e controle por HUD de invocação e por HUD do Controlador.
- [ ] Campo configurável de tempo extra na criação de cada Shikigami.
- [ ] Acrescentar o tempo configurado ao relógio global ao invocar, sem duplicar o evento; todos compartilham o saldo e terminam quando esse relógio chega a zero, sem relógio independente ou FIFO por Shikigami.
- [ ] Na dissipação voluntária, descontar a parte restante atribuída à invocação pelo consumo proporcional e respeitar o piso de 10 segundos.
- [x] Manter a ficha invocável no catálogo com 0 PV; ela materializa Caída. O Mestre decide a derrota, e um descanso longo restaura 100% dos PV. A duração/efeitos da incapacitação continuam pendentes.
- [x] Perda permanente só após atingir −100% dos PV máximos e sempre por decisão do Mestre.
- [ ] Criar Horda com uma contribuição única ao relógio global e um total geral de PV para a entidade inteira; o limite de Hordas é metade do limite em campo, arredondado para baixo.
- [ ] Preservar o tempo restante no relógio global após derrota definitiva.
- [ ] Recursos e ações separados por invocação e independentes do saldo de ações do dono.
- [ ] Autonomia e custos próprios configuráveis por invocação no OMNI.
- [ ] Imagem, token, HUD, PV, rolagens e estados individualizados.
- [ ] Testes de duas ou mais invocações simultâneas, inclusive relógio, comandos, economia e sincronização.

## Acesso universal ao criador de Shikigamis — 2026-10-09

**Decisão do usuário:** a seção de criação deve estar disponível para **todas as especializações**, não apenas Controladores. O acesso ao editor não significa aquisição gratuita no jogo: seguem válidas as condições da fonte normativa atual.

- **Controlador:** obtém 2 invocações no nível 1 e mais 1 a cada 3 níveis (níveis 4, 7, 10, 13, 16, 19...). Invocações adicionais dependem de Interlúdio.
- **Demais personagens:** podem construir/obter invocações por Interlúdio, conforme as regras de talismãs e Corpos Amaldiçoados. O trecho fornecido não fixa um limite numérico geral para invocações conhecidas por outros personagens; não inventar esse número.
- **Em campo:** por padrão, qualquer personagem mantém **1 invocação simultânea**. Controladores ampliam esse limite pela habilidade **Treinamento em Controle**, de acordo com o valor efetivo da habilidade.
- **Acesso a grau:** a progressão automática de graus (quarto grau nos níveis 1–4, terceiro a partir de 5 etc.) está especificada no texto para **Controladores**. Para outros, a criação via Interlúdio tem regras próprias fora do trecho disponível. Não aplicar automaticamente a tabela de acesso do Controlador a personagens de outra especialização.
- **Personalização:** limites do livro devem ser exibidos como avisos, conforme a decisão anterior do usuário. A interface e o sistema devem distinguir **criar uma ficha de invocação** de **ter adquirido aquela invocação no jogo**, evitando que a edição signifique aquisição gratuita.
- **Trabalho pendente:** integrar confirmação de aquisição/Interlúdio, Treinamento em Controle real, propriedades de talismã, edição pelo Mestre, verificações de posse e testes de multiplayer. Não marcar como implementado só por exibir a aba.

## Aprovação obrigatória pelo Mestre — 2026-10-09

**Decisão confirmada:** todos os personagens podem criar e editar a ficha de uma invocação, mas a aquisição para uso no jogo exige **aprovação explícita do Mestre**. Criar ou salvar não equivale a obter o Shikigami.

- Novos registros feitos por jogadores começam **pendentes de aprovação** e não podem ser invocados enquanto pendentes ou rejeitados.
- O Mestre tem botões de **Aprovar** e **Rejeitar**; quando o Mestre registra diretamente a invocação, ela pode entrar aprovada.
- Invocações antigas sem campo de aprovação são tratadas como legado já adquirido para não retirar criaturas existentes sem uma migração confirmada.
- A aprovação deve ser verificada na lógica de materialização, além da interface.
- A aprovação reconhece a aquisição; permanece necessária a aplicação de limites de campo, custos de PE e regras próprias de Interlúdio, quando aplicáveis.
- **Regra confirmada em 2026-10-11:** qualquer alteração em uma ficha já aprovada cria uma nova revisão que precisa de nova aprovação antes de a revisão alterada ser usada.
- **Pendente para revisão de segurança:** autorização reforçada por identidade/perfil no backend multiplayer, trilha de auditoria e revisão de edição após aprovação. A checagem de papel no cliente não constitui autorização confiável por si só.

## Checklist de implementação — pendente de validação funcional
- [ ] Campos da ficha de criação e edição com alternância automática/manual individual.
- [ ] Recálculo de PV, Defesa e outros valores derivados, respeitando o modo manual.
- [ ] Avisos não bloqueantes de orçamento de atributos, limites de ações e custos do livro.
- [ ] Integração real de ações/características e automações ao executor OMNI.
- [ ] Adequação dos comandos/movimentação às regras e exceções aprovadas.
- [ ] Resolução de derrota pelo Mestre e restauração de 100% dos PV no descanso longo, sem decidir ainda a duração da incapacitação.
- [ ] Prompts de reação ao jogador com pausa do relógio.
- [ ] Passagem automática de toda reação após 12 segundos e controles globais de prazo exclusivos do Mestre.
- [ ] Permissões de edição/controle de qualquer invocação para o Mestre.
- [ ] Nova aprovação do Mestre após cada alteração de uma ficha já aprovada.
- [ ] Testes automatizados e validação em navegador dos fluxos finais.

**Nota:** marcar itens somente depois de implementação e verificação. A fonte v1.1.1 e o TXT histórico não devem ser alterados para acomodar estas decisões.

## Base canônica para Manipulação de Maldições — v1.1.1

Esta seção registra o ponto de partida para o controle de várias maldições em campo. As exceções aprovadas neste documento continuam válidas nos pontos em que especificam uma regra própria; nos demais, usar a regra publicada.

- **Absorção e ficha (p. 131):** normalmente exige derrotar a maldição em combate direto; uma maldição até dois Graus abaixo pode ser absorvida sem combate. Absorver usa Ação de Movimento ou Reação, a até 9 m. A maldição fica no Grau em que foi capturada. Ao adaptar a ficha, atributos, Defesa e deslocamento são mantidos; PV são recalculados como os de um Shikigami do mesmo Grau, com a base dobrada. Ações e características são adaptadas diretamente, sem o limite normal de Shikigamis; Dots não são adaptados e feitiços passam a ser ações.
- **Invocações (p. 132):** Rápida é Ação Bônus, até 9 m em espaço desocupado, até quatro maldições e metade do custo de invocação. Explosiva é Ação Completa, invoca quantidade igual ao bônus de treinamento pelo dobro do custo e permite comandá-las imediatamente. Emergencial é Ação Completa, custa cinco vezes o custo de invocação e concede PV temporários iguais ao total pago; dano que exceder esses PV passa à maldição.
- **Opções para ampliar controle (pp. 133–134):** Disparo de Maldições (2 PE, 4d8 perfurante; pode sacrificar duas maldições de 4º Grau para +2d8); Invocação Reativa (usa Reação e paga outra invocação); Invocação Distante (até 3 m); Cobertura de Maldições (uma de tamanho Grande ou maior dá Cobertura Leve); Invocação Persistente (+2 em Constituição para uma maldição); Auxiliar Invocativo (uma maldição de 3º/4º Grau a até 24 m permanece em campo e executa a ordem); Ação Amaldiçoada (Ação Bônus somente para invocar); Invocação Destrutiva (+2 níveis de dano); Invocação Protetora (Reação para evitar ataque, pagando o custo da invocação).
- **Técnicas de sacrifício (pp. 135–137):** Uzumaki (12 PE, Ação Bônus, toque) exige e consome ao menos quatro maldições de 3º/4º Grau; acerto causa 16d10 de Energia e ignora até 8 RD. Técnica Máxima (20 PE, Ação Completa, alcance 48 m, raio de 18 m) causa dano por maldição sacrificada: 4º +1d12; 3º +2d12; 2º +3d12; 1º +4d12; Especial +5d12, no máximo uma com Técnica Inata. Alvos fazem TR de Reflexos, sofrendo dano total na falha ou metade no sucesso; a técnica ignora imunidade, resistência e redução e transforma a área em terreno difícil. Extração Espiral (p. 137) converte características e ações de uma maldição sacrificada em efeitos temporários: maldições de 1º Grau viram efeitos equivalentes a Feitiços de Nível 4, e maldições Especiais a Nível 5. Ações complexas viram ações comuns, ações simples viram ações bônus, e habilidades viram passivas conforme o limite de nível. O efeito pode ser usado uma vez; ao ativar ou descarregar, perde-se permanentemente a maldição extraída. Técnicas Máximas não podem ser extraídas.
- **Libertação e morte do usuário (p. 232):** libertação voluntária de maldições de 1º Grau ou Especial ocorre apenas em Interlúdio, custa o dobro do custo original e não pode ser desfeita; a maldição passa a agir por instinto. Se o usuário morrer após chegar a 0 PV, todas as maldições armazenadas são libertadas. Maldições de 4º, 3º e 2º Graus formam uma Horda; as de 1º Grau restantes coordenam-se taticamente sob espíritos de Grau maior.
- **Fuga dos Coelhos (pp. 81–82):** é uma Horda oficial com crescimento periódico, líder, regras de dispersão e até seis coelhos individuais de 1 PV. Essas regras específicas prevalecem para essa forma; o relógio permanece uma única contribuição da Horda conforme a decisão de produto aprovada.

Custos, requisitos e ações são parte do texto canônico, mas não significam que o aplicativo já os automatize. Enquanto não houver estado de combate adequado, crescimento de Horda, transferência de dano, consumo de maldições e adaptação de fichas ficam explicitamente manuais.
