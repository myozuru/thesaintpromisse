# Etapa 6 — Gatilhos, disponibilidade e observadores

Conclui o escopo desta etapa após o bloco 6A. Base: main `632779489063c0be8a33d4005cec00fbb2058e90`.

## Erros confirmados e correções

1. Passivas visuais de ALVO recebiam eventos de USUARIO e executavam na ficha errada. Agora o barramento consulta somente as fontes do portador do evento. Efeitos persistentes com targetCharId pertencem ao alvo; sourceCharId é usado quando não há portador explícito.
2. incluirPassivas disparava modelos de catálogo sem vínculo real. Modelos avulsos não executam automaticamente. Eventos globais de relógio são entregues às fichas, incluindo seus scripts e vínculos reais.
3. Blocos visuais de armas empunhadas/equipamentos eram ignorados na varredura normal. Disponibilidade passa a ser compartilhada entre barramento, scripts e observadores: equipamentos usados, armas empunhadas, réplicas materializadas e passivas/talentos/auras vinculados.
4. Eventos de aura executavam apenas gatilhos visuais. Agora executam também scripts de terminal da entidade específica, sem disparar outras auras do mesmo portador. Raios dinâmicos inválidos são rejeitados.
5. Referências inválidas viravam zero em observadores e fórmulas visuais. Agora invalidam a avaliação. Não aplicam efeitos nem consomem usos do observador. Dado de seleção inválido não cai na branch zero.
6. Percentuais em vida_atual/hp/pv usavam máximos inexistentes. São relacionados ao máximo do pool; percentBase explícito continua disponível.
7. Observadores ignoravam armas empunhadas sem isEquipped e entidades vinculadas fora do inventário. Agora usam as mesmas fontes disponíveis que os scripts.
8. Equipar e sofrer dano no mesmo tick podia perder o primeiro disparo. Novos snapshots são inicializados imediatamente; a configuração não dispara efeitos.
9. Debounce de ficha descartava quedas seguidas de recuperação no mesmo tick. A fila conserva cada estado, avalia a travessia e suas condições no estado registrado e mantém visíveis as mutações produzidas durante a execução. As cadeias assíncronas conservam seus limites.
10. aoCurar e aoAplicarCondicao não eram emitidos pela origem. Cura aceita healerId opcional, e ActiveCondition aceita sourceCharId opcional. As rotas OMNI/feitiço que conhecem a origem passam IDs explícitos. Cura zero, condição bloqueada e ficha inexistente não geram esses eventos.
11. Gatilhos de talento, aptidão e especialização não tinham emissores nos métodos de uso/ativação auditados. Agora são emitidos após sucesso. Desligar uma aura não é ativar; erros de recursos/usos não emitem sucesso.
12. Conjuração por ação ativa OMNI abria reações, mas não emitia aoConjurarFeitico. Agora emite depois de validar e pagar, uma vez por ação. Ações ativas de talento também emitem aoUsarTalento.
13. aoMover não era emitido nas rotas auditadas. Agora sai após confirmação de movimento e movimento OMNI efetivo. Prévia, cancelamento, movimento bloqueado e distância zero não emitem.
14. Equipar no inventário não emitia aoEquipar. Agora faz dispatch exclusivo da instância equipada; repetir o mesmo slot é idempotente e não reativa outros itens equipados.

## Mapa de emissão dos 34 eventos

A tabela identifica rotas centrais existentes ou corrigidas, não uma certificação de cada botão e habilidade específica do projeto.

| Evento | Rota central auditada |
| --- | --- |
| aoEquipar | InventoryStore.equipItem; dispatch exclusivo; botão de teste do runtime continua disponível |
| noInicioDoTurno | CombatStore.nextTurn |
| noFimDoTurno | CombatStore.nextTurn |
| aoAcertarAtaque | resultadoAtaque/notificarResultadoAtaque |
| aoErrarAtaque | resultadoAtaque/notificarResultadoAtaque |
| aoSofrerDano | CharacterStore.applyDamage |
| aoCausarDano | CharacterStore.applyDamage com attackerId |
| aoConjurarFeitico | SpellApplyDialog; ação ativa OMNI de feitiço |
| aoMover | PendingMoveOverlay confirmado; movimentosAtivos efetivo |
| aoEntrarEmAura | auras/recalcularAuras, visual e terminal exclusivos |
| aoSairDaAura | auras/recalcularAuras, visual e terminal exclusivos |
| aoAvancarRelogio | GlobalClockTicker; dispatch global por portador |
| aoCurar | CharacterStore.applyHealing com healerId conhecido |
| aoReceberCura | CharacterStore.applyHealing com recuperação efetiva de PV |
| aoMorrer | CharacterStore.applyDamage após queda a zero |
| aoAplicarCondicao | CharacterStore.addCondition com sourceCharId conhecido |
| aoReceberCondicao | CharacterStore.addCondition após validação de imunidade |
| aoUsarTalento | consumeTalentUse validado; ação ativa OMNI de talento |
| aoAtivarAptidao | activateAuraAptitude e toggleAuraAptitude ao ligar |
| aoAtivarHabilidadeSpec | activateSpecAbility, incluindo Economia de Energia |
| aoIniciarRodadaCombate | CombatStore.startCombat/nextTurn |
| aoFinalizarRodadaCombate | CombatStore.nextTurn |
| aoIniciarCombate | CombatStore.startCombat |
| aoFinalizarCombate | CombatStore.endCombat |
| aoDescansar | CharacterStore.shortRest/longRest |
| aoVendar | CharacterStore, alteração da venda |
| aoDescobrir | CharacterStore, remoção da venda |
| aoAtualizarContador | atualizacaoContadores, somente após mudança real |
| aoAliadoSofrerDano | observadores, sujeito ferido aliado |
| aoInimigoSofrerDano | observadores, sujeito ferido inimigo |
| aoAliadoCausarDano | observadores, sujeito atacante aliado |
| aoInimigoCausarDano | observadores, sujeito atacante inimigo |
| aoAliadoMorrer | observadores, sujeito caído aliado |
| aoInimigoMorrer | observadores, sujeito caído inimigo |

## Validação

`omniEventosAuditoria.test.tsx` usa stores reais em jsdom e nuvem falsa. Cobre isolamento do portador, ausência de vínculo, runtime aplicado a terceiros, relógio, arma visual empunhada, equipamento idempotente, percentuais, referências inválidas, consumo de usos, primeiro dano imediato, travessias no mesmo tick, passiva vinculada, dado inválido, cura/condição com origem, movimento real, conjuração, talento, especialização e ativar/desativar aptidão. Regressões anteriores continuam na suíte completa.

Suíte completa: 187 arquivos, 3.977 testes aprovados (29 novos casos). TypeScript e build de produção aprovados.

## Limites e próximas etapas

- A tabela não promete que todo código nativo que altera HP/condições diretamente tenha sido migrado para os métodos centrais. Identidade ausente não é inferida por nomes. Curas antigas sem healerId ainda geram apenas aoReceberCura.
- aoEquipar aqui cobre equipItem e teste explícito. A troca de arma por nome e os vínculos de ficha têm ciclo próprio; não passam automaticamente a ser equipItem.
- Geometria/integração das posições de mapa e aura, mover a origem da aura e zonas persistentes pertencem à etapa 7; este bloco verifica dispatch de entrada/saída nas posições espaciais fornecidas.
- Primitiva visual APLICAR_CONDICAO usa efeito do runtime; não equivale por si só a addCondition na ficha. Convergência dos efeitos é verificada na etapa 8.
- UI específica que não usa os métodos centrais de uso/ativação não recebe uma garantia de emissão nesta etapa. Não há certificação de campanha online ou sessão multiplayer real.
- Identidade de exemplares com o mesmo nome e execução duplicada entre sessões continuam no escopo da etapa 9.
- Restam etapas 7 (mapa/alvos/zonas), 8 (ações/efeitos/custos), 9 (persistência/multiplayer) e 10 (guia/checagem final).
