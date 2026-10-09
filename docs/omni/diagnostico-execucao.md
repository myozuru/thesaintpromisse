# Etapa 1 — diagnóstico de execução do catálogo natural

Base sondada: ba47360e0f166ae227a6470985b087a261a970c8. Sem mudanças no motor.

## Método e limites

O teste `src/test/omniNaturalInventoryAudit.test.ts` usa a ficha e os stores reais do harness `mesaReal`, isolados por entrada, com nuvem/socket falsos. Para cada nome simples do inventário, avalia fórmula legada, leitura direta, parsing de `somar 1 em <nome>` e tentativa de escrita ADICIONAR de valor 1. O arquivo `sondagem-runtime.json` registra os resultados individuais.

São 345 entradas: 337 sondadas como nomes simples e 8 modelos/comandos que exigem argumento e não foram executados como variáveis. Isso não valida a gramática natural nem todos os estados possíveis. Algumas consultas dependem de itens, tokens, eventos, habilidades e perícias ausentes desta ficha; retornar zero não prova ausência de suporte.

50 entradas tinham presença nominal no bag; 282 avaliações produziram algum diagnóstico de fórmula; 45 tentativas de escrita alteraram a ficha. Esses números não são totais de keys funcionais/defeituosas. O parser pode resolver aliases sem presença nominal. Mudanças auxiliares de updateCharacter (`passives`, `pendingLevelChoices`, `unlocksFreeUnarmed`) não comprovam alteração do recurso solicitado.

## Falhas e incompatibilidades confirmadas

| Caso | Observação | Consequência | Tratamento previsto |
|---|---|---|---|
| Nome inventado | `lerCaminhoOmni` mantém o fallback legado em 0; `consultarNatural` retorna `CHAVE_DESCONHECIDA` e `avaliarFormula` emite diagnóstico | Um consumidor que ignora diagnósticos pode transformar referência ausente em zero | Manter caminhos de consulta estritos; auditar cada consumidor antes de depender do fallback legado |
| `acoes_comuns`, `pe_temporario`, `bonus_acerto`, `margem_critico` | Sondagem histórica: o parser aceitava nomes sem destino executável | Parsing bem-sucedido não garantia efeito | `pe_temporario` recebeu caminho de escrita; `acoes_comuns`, `bonus_acerto` e `margem_critico` agora são rejeitados pelo parser natural (`fa43a80`) |
| `vida_temporaria` | Sondagem histórica: leitura funcionava, mas a escrita não encontrava o campo | Leitura e escrita não tinham equivalência uniforme | Alias gravável e teste de estado real adicionados; limite zero corrigido na etapa seguinte |
| `pericia_adestramento` | Writer cria entrada em omniSkillBonuses mesmo sem perícia canônica | Pode guardar bônus sem destinatário real no catálogo | Validar perícia contra registro real (12) |
| `contador_foco` | Fórmula lê 2; writer altera omniCounters | Suporte nominal legado existe | Preservar suporte e acrescentar ciclos/gastos nominais (11) |
| `vida_pct` | Fórmula retorna 55 para 17/31; escrita não modifica a ficha | Consulta funciona nessa fixture; writer já não aplica esse destino | Preservar leitura e rejeitar escrita com diagnóstico explícito (8) |
| Aliases de dano | Sondagem histórica não reconhecia `energia_amaldicoada` e `energia_reversa` | Alguns aliases aprovados não chegavam ao pipeline de dano | Corrigido no resolvedor de tipos em `a13bf84` |
| `bloqueio_total` | Escrita altera omniFlags, não cria RD numérica | Descrição do rascunho como redução fixa é incompatível | Descrever semântica real e separar de RD (8–9) |

## Verificação realizada

Comando: `OMNI_AUDIT_REPORT=1 npx vitest run src/test/omniNaturalInventoryAudit.test.ts src/test/omniComposicaoEscrita.test.ts src/test/omniKeysAudit.test.ts src/test/omniScriptCompatibility.test.ts`.

Resultado: 4 arquivos, 465 testes aprovados. Os testes novos verificam resultados da sondagem e comportamento legado; não afirmam que as lacunas estão corrigidas. Para regenerar o inventário estático, fornecer o TXT original ao script `scripts/auditar_catalogo_natural.py`; depois regenerar esta sondagem com a variável indicada.

## Complemento: oito modelos e comandos parametrizados

Os oito casos restantes receberam fixtures específicas em `omniNaturalInventoryAudit.test.ts`:

| Modelo | Resultado observado |
|---|---|
| contador_<nome> | Consome Rancor sem modificar Foco |
| flag_<nome> | Persiste flag e permite consulta da instância |
| rodadas_com_<id> | Nome do rascunho gera diagnóstico; não é alias validado |
| turnos_com_<id> | Nome do rascunho gera diagnóstico; não é alias validado |
| esta_sob_<id> | Nome do rascunho gera diagnóstico; tem_condicao_<id> é a consulta legada |
| aplicar <id> | Aplica Condenado via executor legado ao usuário explícito |
| remover <id> | Remove Condenado via executor legado |
| imune <id> | Concede imunidade nominal ao usuário |

## Autorização versionada

A migration `20260925235722_afacf0c1-767e-4f01-b1e7-0a5871ad75f8.sql` concede INSERT/UPDATE de realtime_world e realtime_assets a anon/authenticated com políticas permissivas (`USING (true)`/`WITH CHECK (true)`). As outras migrations versionadas criam perfis e user_roles, mas não substituem essas políticas por verificação de Mestre nas tabelas compartilhadas.

Portanto, a restrição backend aprovada é um requisito ainda não satisfeito pelas migrations examinadas. Não foi consultado o banco em produção. A etapa 22 precisa tratar a arquitetura de sincronização e autorização; simplesmente confiar na role enviada pelo cliente ou bloquear toda escrita PLAYER não é solução, pois jogadores precisam persistir alterações permitidas de suas fichas.

## Estado das entregas

Etapa 1 concluída no escopo de contrato e diagnóstico: 345 entradas classificadas, nomes simples sondados e oito modelos examinados, com lacunas e responsáveis registrados. Isso não certifica 345 entradas executáveis. Validação semântica de todos os cenários e implementação das lacunas pertencem às etapas responsáveis e à integração final.

Etapa 2 concluída no escopo da base de contexto e consultas: `contextoNatural.ts` e `consultasNaturais.ts` conectam papéis explícitos ao resolvedor da ficha. A gramática textual e os produtores de eventos serão integrados nas etapas 3–6; o terminal e o combate atuais mantêm os caminhos legados. Detalhes em etapa-2-contexto.md.

Validação desta entrega: 5 arquivos, 483 testes aprovados. Inclui os oito casos parametrizados e testes do novo contexto para vítima/atacante distintos, token ambíguo ou divergente, ausência de alvo, exclusão do próprio usuário da relação de outro aliado e isolamento dos gastos.

## Revalidação na main atual — 2026-10-09

O workspace foi alinhado à `main` remota em `3e57b76aaf7e4ef9fcacd08067baa1f05a460e49`. A sondagem acima é histórica e não representa, sozinha, o estado completo dessa revisão.

### Incompatibilidade de perícias corrigida

A revalidação encontrou dois defeitos no caminho de escrita de perícias:

- `aplicarEfeitoNoPersonagem` aceitava qualquer nome `pericia_<x>` e podia gravar, por exemplo, `adestramento` em `omniSkillBonuses`, embora essa perícia não exista no catálogo.
- `validarDestinoEscritaNatural` consultava `RECURSOS_SUPORTADOS`, que não incluía nenhuma das 22 perícias oficiais, e por isso rejeitava destinos válidos.

O executor agora restringe a escrita às chaves derivadas de `SISTEMA_PERICIAS` e o catálogo de destinos inclui essas 22 chaves. Os testes confirmam a escrita em Atletismo, a validação de todas as 22 perícias e a rejeição de `pericia_adestramento` sem alteração da ficha.

Validação após a correção: `npx tsc --noEmit` concluiu sem erros; os dois arquivos focados passaram (28 testes); a suíte OMNI passou em 104 arquivos (3.320 testes). A correção foi publicada na `main` em `2e6c8ec`.

### Aliases canônicos de dano corrigidos

O catálogo oficial associa `energia_reversa` a `DNR` e `energia_amaldicoada` a `DE`; também define `dano_na_alma`, `luz` e `trevas` como aliases de `DAL`, `DR` e `DN`. O resolvedor reconhecia os rótulos apresentados pela ficha, mas deixava alguns desses nomes fora da tabela de aliases. Agora todos os nomes canônicos e aliases definidos no contrato são resolvidos, inclusive com sublinhado. Testes de integração confirmam que os aliases de energia chegam ao pipeline de dano como `DNR` e `DE`.

Validação depois desta etapa: 3 arquivos focados, 92 testes aprovados; suíte OMNI em 104 arquivos, 3.333 testes aprovados; `npx tsc --noEmit` sem erros.

### PV temporários sem teto base corrigidos

O caminho natural `somar N em vida_temp` gravava em `escCurrent`, mas o executor aplicava sempre `escMax` como teto. Com `escMax = 0`, a escrita retornava zero, embora ações e magias concedam PV temporários nesse mesmo estado da ficha. Agora o executor interpreta zero como ausência de teto base configurado; um `escMax` positivo continua limitando a escrita. O saldo segue sendo o mesmo que o resolvedor expõe em `VIDA_TEMP` e continua sendo absorvido antes dos PV normais. Os aliases `vida_temporaria` e `pe_temporario` também são verificados na leitura após a escrita.

Um teste de regressão primeiro reproduziu a falha (`aplicado: 0`) e, após a correção, verifica concessão sem teto, leitura pelo resolvedor, absorção de dano sem perda de PV e respeito a um teto positivo.

Validação desta etapa: suíte OMNI em 104 arquivos, 3.339 testes aprovados; `npx tsc --noEmit` sem erros; `git diff --check` limpo.

### Passivas contínuas agora rejeitam referências inválidas

`derivarPassivasContinuas` consumia apenas o número retornado por `avaliarFormula`. Assim, `@USUARIO.chave_inexistente + 4` podia virar uma redução de PE igual a 4 apesar do diagnóstico de referência ausente. O mesmo caminho também derivava bônus para `pericia_adestramento`, nome que não consta nas 22 perícias da ficha.

O seletor agora descarta condições e fórmulas com diagnóstico ou resultado não finito e só gera bônus para perícias presentes em `SISTEMA_PERICIAS`. O teste E2E confirma que uma condição desconhecida cujo resultado parcial seria verdadeiro não ativa a passiva, que fórmula parcial não concede bônus/redução e que uma perícia inexistente não produz bônus derivado.

Validação desta etapa: suíte OMNI em 104 arquivos, 3.340 testes aprovados; teste E2E da ponte após ampliar as asserções: 73 testes aprovados; `npx tsc --noEmit` sem erros; `git diff --check` limpo.

### Bônus de perícias em equipamentos limitados ao catálogo

`selectOmniModifiers` aceitava qualquer nome em `bonusEquipado.pericias` e `bonusEquipadoFormula.pericias`. Um item de teste gerou `adestramento: 6` (bônus fixo 3 + `@TREINO` 3), embora `adestramento` não seja uma das 22 perícias oficiais. O seletor agora normaliza a chave e só deriva bônus quando ela consta em `SISTEMA_PERICIAS`; os campos fixo e de fórmula seguem a mesma validação.

Validação desta etapa: suíte OMNI em 104 arquivos, 3.341 testes aprovados; E2E da ponte: 74 testes aprovados; `npx tsc --noEmit` e `git diff --check` sem erros.

### Lacunas que seguem abertas

O caminho direto legado `lerCaminhoOmni` ainda retorna zero para nomes desconhecidos por compatibilidade; consultas naturais estritas e o avaliador de fórmulas já oferecem erro/diagnóstico. Ainda falta auditar todos os consumidores que recebem esse diagnóstico, revisar a autorização no backend e certificar comportamento de ponta a ponta para gatilhos, ações e variáveis do catálogo. A lista histórica de 345 entradas continua sendo uma sondagem derivada do rascunho; ela não certifica todas as keys da versão atual.

### Destinos de escrita validados na revisão atual

Base desta rodada: `a13bf84` na `main` remota. A etapa conectou a validação do destino ao `parseOmniScript`: palavras sem caminho de execução, como `acoes_comuns`, `bonus_acerto` e `margem_critico`, agora retornam erro de destino em vez de criar um efeito que terminaria com `aplicado: 0`.

Os destinos usados por exemplos existentes que tinham leitura mas não uma escrita persistente ganharam caminhos concretos:

- `acerto` grava em `customHitBonus`, que é a variável de Acerto genérica/customizada já exposta pelo resolvedor; os três modos normais de ataque continuam usando seus cálculos próprios.
- `atencao` grava no campo `attention`, aceitando valores assinados.
- Os cinco TRs (`astucia`, `fortitude`, `integridade`, `reflexos`, `vontade`, inclusive aliases `tr.`/`tr_`) alteram apenas `savingThrows.value`, sem apagar treinamento ou maestria e permitindo penalidades negativas.
- `empolgacao` grava no nível do Lutador, limitado a 0–5. `empolgacao_nivel` e `empolgacao_level` são normalizados para escrita, preservando o alias de leitura legado.
- `deslocamento`/`desloc` alteram `movement`, o valor base consumido pelo orçamento de movimento; o caminho de bônus de equipamento continua separado.
- `usos_restantes` grava na instância identificada de inventário, respeita o teto e compartilha o mesmo executor entre ficha, gatilhos e watchers. Se o próprio script consumiu usos, o consumo automático do item não desconta outra carga.

Validação: a suíte focada passou em 6 arquivos (880 testes); a suíte completa OMNI passou em 104 arquivos (3.338 testes); `npx tsc --noEmit` terminou sem erros. Os testes cobrem mudanças no estado real da ficha/inventário, aliases, limites, penalidades negativas, acionamento por watcher/gatilho e evitam o segundo consumo automático.

Este avanço fecha os destinos identificados nesta rodada. Não certifica cada variável de leitura, gatilho e ação do catálogo de ponta a ponta; a auditoria comportamental completa continua aberta.
