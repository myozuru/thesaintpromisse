# Auditoria OMNI — etapa 1 de 10

Base revisada: `130cae82b13643db8c08c214561748ee02f5bd07`.

Esta etapa inventaria declarações, aliases, guia e referências de produção. Não certifica o funcionamento das keys pela interface. Uma referência no código, um case no executor ou um exemplo no guia não equivale a um fluxo validado. Nenhuma regra de jogo foi alterada nesta etapa.

## Inventário atual

| Registro | Quantidade | O que representa |
| --- | ---: | --- |
| Componentes independentes | 303 | IDs de autoria de `componentes/ids.ts` |
| Cards de componentes | 303 | Entradas do guia de componentes |
| Correspondências documentadas | 305 | Conversões de referências para composição; não é o universo de combinações possíveis |
| Exemplos de composição | 335 | Receitas/documentação; não são 335 novas keys |
| Entradas legadas do dicionário | 345 | IDs distintos; inclui formas equivalentes e padrões dinâmicos |
| Cards do guia legado | 335 | Aliases agrupados explicam a diferença em relação às 345 entradas |
| Aliases no mapa central de keys | 42 | Entradas de `LEGACY_TO_CANONICAL`; não inclui todos os aliases de outros registros |
| Atalhos do parser | 172 | Registro `ATALHOS_PT_BR`; inclui nomes que se sobrepõem aos aliases centrais |
| Aliases do contexto DANO | 2 | Registro específico de leitura do dano |
| Aliases de recurso na escrita | 1 | Registro específico do terminal |
| Gatilhos canônicos | 34 | Eventos registrados |
| Aliases de gatilhos | 137 | Grafias aceitas que apontam aos 34 eventos |
| Ações primitivas | 38 | Operações registradas no construtor visual |

Essas contagens não devem ser somadas. Um componente pode participar de muitas composições; nomes livres de contadores e parâmetros de condições/itens não formam uma lista finita de keys.

O arquivo `etapa-01-inventario.json` contém cada componente, cada correspondência, cada variável legada, os aliases centrais, os atalhos do parser e aliases de escrita/dano, os 34 gatilhos com suas referências e as 38 primitivas. Todos permanecem com validação funcional pendente nas respectivas etapas.

## Verificações estruturais realizadas

- Os 303 componentes têm cards; nenhum card aponta a componente inexistente.
- Não há IDs de componentes repetidos.
- Todas as 345 entradas legadas aparecem no guia como card ou alias.
- Não foram encontrados aliases de gatilhos apontando a dois eventos diferentes.
- As 38 primitivas têm um case no executor. A existência do case não comprova o resultado da ação.

## Lacunas encontradas

### A01 — seis gatilhos sem referência operacional localizada

| Evento canônico | Lacuna de integração | Etapa para reproduzir/corrigir |
| --- | --- | --- |
| `aoMover` | Cadastrado e aceito pelo parser; não foi localizada emissão automática pelo movimento do jogo | 6 e 7 |
| `aoCurar` | `applyHealing` emite `aoReceberCura` para a vítima, mas não informa/dispara o evento de quem curou | 6 e 8 |
| `aoAplicarCondicao` | Há emissão de `aoReceberCondicao`; não foi localizada emissão para quem aplicou a condição | 6 e 8 |
| `aoUsarTalento` | Não foi localizada emissão conectada ao uso de talento | 6 |
| `aoAtivarAptidao` | Não foi localizada emissão conectada à ativação de aptidão | 6 |
| `aoAtivarHabilidadeSpec` | Não foi localizada emissão conectada à ativação de habilidade de especialização | 6 |

Confirmado nesta etapa: os registros e a ausência de referências operacionais literais/por constante nos arquivos de produção. Não foi realizado teste de interface para cada evento. Invocação manual/macro não conta como conexão automática. O plano é reproduzir cada ação pela interface e implementar a emissão com usuário/alvo corretos, uma vez por evento, respeitando a cadeia OMNI.

### A02 — eventos de aura usam um caminho que não executa scripts do terminal

`auras.ts` chama diretamente `executarGatilho(ent, 'aoEntrarEmAura'/'aoSairDaAura', ...)`. Esse executor lê apenas `entidade.gatilhos`. Os scripts do terminal ficam em `combatData.effectsActive/effectsPassive` e são executados pela ponte `triggerEfeitos.ts`, que não é chamada nesse caminho.

A diferença entre os dois executores está confirmada no código. Ainda é necessário reproduzir entrada/saída pela movimentação real na etapa 6/7, incluindo dono da aura, alvo, saída quando o dono se move e ausência de duplicação entre blocos visuais e scripts.

### A03 — atualização de contador tem comportamentos diferentes conforme o editor

A primitiva visual de contador em `executor.ts` emite `aoAtualizarContador`. A escrita de contador do terminal em `aplicarEfeito.ts` atualiza a ficha e retorna sem emitir esse evento; o chamador `triggerEfeitos.ts` também não o emite.

O desvio de caminhos está confirmado no código. O teste funcional e a correção ficam nas etapas 3/6: criar um contador e uma habilidade que observa sua atualização, executar via terminal e construtor, conferir valor anterior/novo e impedir recursão infinita.

### A04 — origem do teto por fonte precisa de verificação semântica

`triggerEfeitos.ts` usa `opts.alvoId` como origem do contador. No evento `aoSofrerDano`, ALVO é o atacante; nos observadores de dano de aliado, ALVO é a vítima. Assim, a mesma escrita com `por_fonte` pode agrupar por pessoas diferentes dependendo do evento.

Este item é um candidato a erro de semântica, não uma falha funcional reproduzida nesta etapa. A etapa 3 deve definir explicitamente a origem de cada evento, preservando compatibilidade de regras que realmente pretendem contar por atacante.

## Evidência e reprodução do inventário

Executar na raiz do projeto:

```sh
node scripts/auditar-catalogo-omni.cjs 130cae82b13643db8c08c214561748ee02f5bd07
```

O comando usa TypeScript local para carregar os registros e pesquisa arquivos de produção, excluindo testes e declarações do catálogo. Gera o JSON sem chamar nuvem, socket ou serviços externos. Seu código de saída só acusa inconsistências estruturais de componentes, aliases e primitivas; ausência de conexão automática é registrada para investigação funcional, não ocultada pelo resultado do comando.

## Continuidade

- Etapa 1 concluída: inventário e triagem estrutural.
- Etapa 2: parser, fórmulas e diagnósticos, verificando diferenças entre referências legadas e compostas.
- Etapas 3–9: reprodução e correção por domínio, sempre pelo fluxo real relevante.
- Etapa 10: exemplos do guia e relatório de validação, distinguindo aprovado, corrigido, não testado e limitado por contexto.

As lacunas acima permanecem abertas; este commit não afirma que elas foram corrigidas.
