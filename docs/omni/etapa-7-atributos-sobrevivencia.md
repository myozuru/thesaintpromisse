# Etapa 7 — atributos e sobrevivência

Estado: consultas numéricas dos atributos e estados vitais conferidas com os valores já expostos pela ficha e pelo resolvedor OMNI.

## Lacuna encontrada e corrigida

`projetarPersonagemParaOmni` projetava `hpMax`/`peMax` brutos, embora a ficha já mantenha `hpMaxEffective`/`peMaxEffective` e os auxiliares compartilhados `shownHpMax`/`shownPeMax` usem esses tetos em outros painéis. Assim, `vida_max`, `vida_faltante`, `vida_pct` e `pe_max` podiam discordar do valor efetivo exibido.

O resolvedor agora chama `shownHpMax` e `shownPeMax`, os mesmos auxiliares usados por partes da interface. Não soma passivas nem itens uma segunda vez nem altera o valor do atributo. Quando o teto efetivo não existe, os auxiliares preservam o fallback atual do projeto.

## Contrato verificado

- Os seis atributos (Força, Destreza, Constituição, Inteligência, Sabedoria e Presença) são consultados pelo caminho canônico do `projetarPersonagemParaOmni`. A ponte não aplica fórmula nova de modificador; o resultado inclui o que a ficha atual já resolve para o atributo.
- PV atuais vêm de `hpCurrent`; o teto de PV vem de `shownHpMax`. PE atuais vêm de `peCurrent`; o teto de PE vem de `shownPeMax`.
- `vida_pct` e `vida_faltante` derivam do teto projetado e tratam teto zero sem divisão por zero.
- Exaustão, fome, Morrendo, Morto e Inconsciente continuam lendo seus campos e a lógica existentes no resolvedor: `exhaustionLevel`, `hunger`, `dying`, condição de morte por exaustão 6 e `unconsciousFromExhaustion`. Esta etapa não redefine quando esses estados ocorrem.
- A consulta continua somente leitura, exige um papel de ficha explícito e passa pelo callback obrigatório de autorização. Alias não registrado continua sendo erro.

## Validação

`omniConsultasNaturais.test.ts` cobre os seis atributos, aliases e a leitura lado a lado com a projeção oficial. Também fixa os casos dos tetos efetivos (48 PV e 13 PE com valores-base diferentes), vida faltante/percentual e estados de sobrevivência. A integração de regras de escrita e mitigação permanece nas etapas posteriores.
