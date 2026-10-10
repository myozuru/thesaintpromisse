# Etapa 14 — auxílio, cura, bônus e características

**Data:** 10/10/2026

**Status:** implementada e validada localmente.

## Escopo entregue

- A ficha do Shikigami configura ações estruturadas de cura, Defesa, Acerto, dano adicional e redução de dano. O comando valida turno, ação própria, custo configurado, recarga, alvo aliado e alcance antes de resolver.
- A cura segue as tabelas por grau, usa Sabedoria ou Presença como escolha da ficha e permite os graus e dados definidos para alvos múltiplos. Com Energia Reversa do Controlador ou do Shikigami, recupera PV reais e exige custo de exatamente 2 PE. Sem essa capacidade, concede PVT; em invocações, os PVT são armazenados na instância e absorvem dano antes dos PV.
- Cura real de um Shikigami Caído não o levanta. Ele permanece Caído até usar a própria Ação de Movimento para levantar.
- Bônus de Defesa e Acerto, dano adicional e RD seguem as tabelas do livro. Defesa e RD duram uma rodada; Acerto e dano adicional são consumidos no próximo ataque. Esses efeitos funcionam em fichas de personagem e em outras invocações.
- O contador de múltiplos auxílios é individual da instância e considera os usos de auxílio com bônus feitos na rodada, mesmo quando os efeitos mudam. Aplica a penalidade própria da tabela: −1 para Defesa/Acerto/RD e −2 níveis para dano adicional, respeitando os mínimos publicados.
- A Defesa temporária é refletida no token. Efeitos ativos expiram no fim da rodada correspondente ou quando o combate termina.
- Características estruturadas podem aumentar PV máximo, conceder bônus em uma perícia específica ou reduzir um tipo de dano. Características equivalentes não acumulam; a ficha mostra o valor efetivo por grau.
- Os testes usam as stores reais com adaptadores em memória e não precisam de Supabase, contas ou serviços remotos.

## Limites conhecidos

- O livro multiplica por 1,5 os bônus de Defesa e Acerto quando a ação vira Complexa; o exemplo de Terceiro Grau dá resultado inteiro, mas a tabela também produz frações em outros graus. A ficha e o motor exigem Ação Simples/Bônus para esses dois efeitos até a mesa definir o arredondamento.
- A escala de Horda para cura, bônus, dano adicional e RD ainda não está modelada nas fichas do Controlador.
- Características condicionais continuam descritivas. O editor operacionaliza somente PV máximo, bônus de perícia e RD por tipo; os gatilhos das demais características e ações OMNI seguem para a integração própria do OMNI.

## Validação

- `npx vitest run`: 249 arquivos e 5.121 testes aprovados, incluindo `controladorMapa.test.ts` e `controladorSuporte.test.ts`.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado.
- `git diff --check`: aprovado.
