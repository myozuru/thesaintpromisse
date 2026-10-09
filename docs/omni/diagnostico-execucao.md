# Etapa 1 — diagnóstico de execução do catálogo natural

Base sondada: ba47360e0f166ae227a6470985b087a261a970c8. Sem mudanças no motor.

## Método e limites

O teste `src/test/omniNaturalInventoryAudit.test.ts` usa a ficha e os stores reais do harness `mesaReal`, isolados por entrada, com nuvem/socket falsos. Para cada nome simples do inventário, avalia fórmula legada, leitura direta, parsing de `somar 1 em <nome>` e tentativa de escrita ADICIONAR de valor 1. O arquivo `sondagem-runtime.json` registra os resultados individuais.

São 345 entradas: 337 sondadas como nomes simples e 8 modelos/comandos que exigem argumento e não foram executados como variáveis. Isso não valida a gramática natural nem todos os estados possíveis. Algumas consultas dependem de itens, tokens, eventos, habilidades e perícias ausentes desta ficha; retornar zero não prova ausência de suporte.

50 entradas tinham presença nominal no bag; 282 avaliações produziram algum diagnóstico de fórmula; 45 tentativas de escrita alteraram a ficha. Esses números não são totais de keys funcionais/defeituosas. O parser pode resolver aliases sem presença nominal. Mudanças auxiliares de updateCharacter (`passives`, `pendingLevelChoices`, `unlocksFreeUnarmed`) não comprovam alteração do recurso solicitado.

## Falhas e incompatibilidades confirmadas

| Caso | Observação | Consequência | Tratamento previsto |
|---|---|---|---|
| Nome inventado | canonicalizarChave conserva o nome; lerCaminhoOmni retorna 0; writer informa aplicado 0 | Ausência fica indistinguível de saldo zero no acesso direto | Resolver estrito da nova linguagem, preservando adaptador legado (2–5) |
| `acoes_comuns`, `pe_temporario`, `bonus_acerto`, `margem_critico` | Parser legado aceita destino; tentativa ADICIONAR não altera campo do recurso | Parsing bem-sucedido não garante efeito | Resolver aliases/capacidades e validar destinos antes da ação (8–9) |
| `vida_temporaria` | Fórmula nesta ficha resolve 3; writer com esse nome não altera o recurso | Leitura e escrita não têm equivalência uniforme | Contrato de leitura/escrita explícito e teste com proteção (8) |
| `pericia_adestramento` | Writer cria entrada em omniSkillBonuses mesmo sem perícia canônica | Pode guardar bônus sem destinatário real no catálogo | Validar perícia contra registro real (12) |
| `contador_foco` | Fórmula lê 2; writer altera omniCounters | Suporte nominal legado existe | Preservar suporte e acrescentar ciclos/gastos nominais (11) |
| `vida_pct` | Fórmula retorna 55 para 17/31; escrita não modifica a ficha | Consulta funciona nessa fixture; writer já não aplica esse destino | Preservar leitura e rejeitar escrita com diagnóstico explícito (8) |
| Aliases de dano | corte → DCO e Energético → DE; energia_amaldicoada e energia_reversa ainda retornam undefined | Alguns aliases aprovados ainda não são interpretados | Registrar aliases explícitos no resolvedor de tipos (15) |
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

### Lacunas que seguem abertas

A correção de perícias e a dos aliases de dano não fecham as outras incompatibilidades da tabela deste documento. Continuam em investigação os destinos que o parser aceita sem efeito persistido, a equivalência de leitura/escrita de proteções, os diagnósticos explícitos para nomes desconhecidos e os limites de autorização no backend. A lista de 345 entradas permanece uma sondagem derivada do rascunho, não uma certificação exaustiva do catálogo efetivamente exposto pela versão atual.
