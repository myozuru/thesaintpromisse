# Validação final — etapa 15

Data: 2026-10-03. Fonte aprovada: versão 3.0, SHA-256 `6a76f732640e80b4a9f613c17e9132ac134c3c565134e3ec285ebb33350f3956`.

## Resultado

As 15 etapas de implementação foram concluídas: contrato e catálogo; AST serializável; lexer; avaliação por componentes; integração com fórmulas e scripts; recursos e testes; equipamento e inventário; cena e turnos; magia e condições; eventos e histórico; escrita e custos; compatibilidade e persistência; construtor e autocomplete; guia individual; regressão integrada.

| Verificação | Resultado |
| --- | --- |
| Catálogo | 303 componentes, 335 conversões, 10 parâmetros, 81 aliases históricos; IDs únicos e todas as referências válidas |
| Regressão completa | 174 arquivos, 3.693 testes aprovados; execução em aproximadamente 35,5 segundos |
| TypeScript | `tsc --noEmit --pretty false`, sem erros |
| Build | `npm run build`, cliente e servidor compilados |
| Exemplos do guia | 335 comandos verificados individualmente pelo parser; cobertura documental das 303 keys |
| Reutilização de contexto | 1.000 avaliações de percentuais com resultado estável e sem diagnósticos |

Comando da regressão: `node_modules/.bin/vitest run --pool=threads --maxWorkers=4`. O conjunto completo inclui combate com stores reais em memória, mapa e UI em jsdom, além das regras puras. Não usa credenciais nem serviços de produção.

## Correções encontradas nesta etapa

- O executor conserva os dados compostos de cena e dano para operandos do construtor, incluindo árvores importadas. A cena informada pelo evento atualiza o contexto recebido da ficha.
- Fórmulas que recebem os campos `DANO_*` do executor também criam o contexto composto do golpe.
- Argumentos tipados como tipo de dano reconhecem nomes e códigos equivalentes (`fogo`, `chamas`, `DQ`). Essa normalização não transforma IDs de feitiços, nomes de contadores ou argumentos de outros tipos.
- Testes do guia e dicionário foram atualizados para a aba Componentes e as chaves canônicas atuais, preservando verificações de aliases e inserção.
- O catálogo e o documento de contratos deixam de apresentar a implementação como apenas planejamento.

## Alcance da validação

A cobertura sintática das 335 conversões e dos 335 exemplos é exaustiva. A cobertura de execução é feita por cenários de domínio, incluindo recursos limitados, percentuais, equipamento, coleções filtradas, turno, magia, cura e dano efetivos, contadores por fonte, custos, transferências, importação e construtor. Isso não significa que qualquer sequência arbitrária das 303 palavras tenha sentido: combinações incompatíveis são diagnosticadas, e consultas não recebem permissão de escrita automaticamente.

Os exemplos de deslocamento narrativo e cargas personalizadas do guia dependem dos contadores explicitamente descritos no próprio exemplo. Eles não substituem o orçamento nativo do mapa nem os usos nativos de habilidades.

Durante a preparação local, arquivos JS/JSX e modelos GLB ausentes na cópia foram restaurados após conferir seus hashes com os blobs da main. Já existiam no repositório e não entram como alterações desta etapa. O build conserva avisos de tamanho de chunks; os testes conservam um aviso de depreciação do import CJS de Three. Nenhum deles impediu os checks.
