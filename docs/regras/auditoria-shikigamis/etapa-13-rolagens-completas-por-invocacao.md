# Etapa 13 — rolagens completas por invocação

**Data:** 10/10/2026

**Status:** implementada e validada localmente.

## Escopo entregue

- Ataques manuais usam os atributos do Shikigami, metade do nível do Controlador, o bônus de treinamento configurado para corpo a corpo ou distância e os bônus explícitos da ficha/ação. Ataques corpo a corpo e à distância usam a Defesa correspondente do alvo.
- Um 1 natural erra. A margem e o multiplicador de crítico são configuráveis por ação; o crítico multiplica apenas os dados, mantendo bônus fixos uma vez. A bandeja 3D rola o d20 e todos os grupos de dano.
- O dano soma o modificador do atributo relevante; em Grau Especial, o padrão é o dobro. A ficha pode trocar o atributo ou sobrescrever o multiplicador para uma regra própria.
- O dano acertado é enviado à ficha correta por `applyDamage`, preservando resistências, RD, escudos, gatilhos e reações já existentes.
- Ações podem solicitar um Teste de Resistência do alvo. A CD segue a regra do livro: 10 + metade do nível do Controlador (mínimo 1) + modificador do atributo escolhido na ficha do Shikigami. O pedido guarda o perfil destinatário e segue o fluxo existente de testes. Depois do resultado, a tela do Mestre resolve o dano integral na falha, nenhum dano no sucesso ou metade do dano quando configurado.
- O editor aceita fórmulas com vários grupos, como `2d12+1d6+3`, e valida a fórmula, o TR, o atributo da CD e as regras de crítico antes de salvar.
- O painel do Controlador permite rolar perícias canônicas nas quais o Shikigami é treinado, com atributo-base de Inteligência ou Sabedoria, metade do nível e treinamento da própria invocação. A rolagem não usa bônus, rerrolagens ou recursos do dono.
- Fichas legadas com `tipo: ataque` continuam entrando no fluxo de ataque. Dados ausentes de atributos são tratados como valor 10 para o cálculo do modificador.

## Validação sem Supabase

Os testes usam as stores e os adaptadores em memória do projeto. Eles exercitam cálculo de bônus, falha/acerto/crítico, CD e roteamento do pedido de TR, rolagem de perícia, fórmula de dano e alteração de PV no alvo correto. Nenhum teste precisa de conta, banco Supabase ou serviço remoto.

## Limites conhecidos

- A resolução final de dano após TR roda na tela do Mestre e usa o estado sincronizado já existente. Locks autoritativos e prevenção de duplicidade entre várias telas do Mestre permanecem na Etapa 20.
- Perícias retornam a rolagem total e são registradas no log; a definição de CD e efeito contextual continua com a mesa.
- Ações OMNI/referências OMNI, efeitos de suporte e execução autônoma seguem para as Etapas 14–16. As janelas completas de reação seguem para a Etapa 17.
- O comando manual escolhe fichas de personagem no mapa como alvos. Invocações, objetos e alvos de área ainda não são resolvidos por este fluxo.

## Validação

- Testes direcionados: 3 arquivos, 53 testes aprovados.
- Suíte completa: 247 arquivos, 5.108 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado.
- `git diff --check`: aprovado.
