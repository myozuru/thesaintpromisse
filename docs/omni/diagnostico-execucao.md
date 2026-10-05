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

## Estado da etapa 1

Contrato, inventário de 345 entradas e sondagem individual legada publicados. Ainda falta certificar contexto/semântica com fixtures específicas, escrita via executor além desta ponte, catálogo composto, permissões backend e decisões de ordem de modificadores/medição espacial. Não encerrar etapa 1 nem anunciar 345 entradas executáveis com base nesta sondagem.
