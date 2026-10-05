# Etapa 2 — contexto e consultas explícitas

Estado: base de contexto e ponte de consultas concluídas. A gramática textual e a conexão dos produtores de eventos com o novo contexto são entregas das etapas 3–6. Não habilita frases naturais no terminal nem substitui os caminhos legados.

## Implementação

- `contextoNatural.ts`: execução identificada, papéis usuario/alvo/atacante/vitima separados, origem por IDs, token explícito e mapa nominal de cargas gastas.
- `consultasNaturais.ts`: recebe referências estruturadas com sujeito, consulta o resolvedor real da ficha e devolve resultado discriminado (`ok` ou diagnóstico). Não usa fallback silencioso de leitura direta.
- Recursos canônicos usam o personagem projetado; um contador com nome `vida` não pode substituir a consulta de PV. Contadores e flags são lidos nos seus namespaces.
- Falta de alvo/ficha/token, divergência entre token e ficha, chave desconhecida, ausência de gasto nominal e distância indisponível são resultados de erro distintos de zero.
- Consultas de terceiros exigem decisão explícita de `podeConsultar`. Isso é uma fronteira de API, não substitui RLS ou regras de acesso do backend.
- Distância exige medidor da cena, chamado com os tokens explícitos. Não infere posição de outro token, não escolhe primeiro token e não inventa métrica espacial.
- A lista legada de recursos da ficha delimita os nomes candidatos. Um nome registrado ainda pode ser indisponível no resolvedor; nesse caso retorna diagnóstico, não certificação de suporte.

## Integração e limites

O futuro parser compila uma referência como sujeito mais chave, por exemplo `{tipo: 'recurso', papel: 'vitima', chave: 'vida'}`. O adaptador da cena fornece fichas, tokens, acesso e medidor; a ponte não acessa informação oculta por conta própria nem escolhe alvo.

Não se usa `usuarioId`/`alvoId` do eventBus para inferir automaticamente atacante/vítima: esses IDs mudam de significado conforme o produtor legado. Os produtores serão adaptados explicitamente na etapa 6.

Os valores de fichas e permissões são entradas da consulta. O chamador precisa obter a versão adequada ao momento de resolução; captura na declaração versus atualização após reação será definida em cada fluxo responsável. Este módulo não cobra custos, não registra pagamentos na persistência e não aplica dano.

## Validação

Comando: `npx vitest run src/test/omniConsultasNaturais.test.ts src/test/omniContextoNatural.test.ts src/test/omniNaturalInventoryAudit.test.ts src/test/omniScriptCompatibility.test.ts`.

Resultado: 60 testes em 4 arquivos aprovados. Cobertura inclui usuários/vítimas/atacantes distintos, ausência de alvo, tokens ambíguos ou divergentes, consultas não autorizadas, soma de atributo existente, saldo zero, chave inventada, namespace de contador e gasto explícito zero.

TypeScript: permanece com os quatro erros preexistentes em SpellApplyDialog.tsx e useReactionStore.ts; sem erros novos nos módulos desta entrega.
