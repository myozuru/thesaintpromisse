# Etapa 09 — Máquina de estados de PV, Caído e derrota

**Data:** 2026-10-10
**Branch de entrega:** `main`
**Escopo:** transições de PV das instâncias de invocação no mapa.

## Regras cobertas

- A instância continua no mapa e como alvo quando chega a 0 PV.
- PV negativos são preservados na instância. A derrota definitiva ocorre em PV igual ou inferior a `-PV máximo`.
- Ao ser derrotada, o token sai do mapa, mas a instância e a ficha de catálogo permanecem registradas para resolução posterior.
- Cura não levanta automaticamente uma instância que já estava Caída. Levantar exige PV acima de 0 e consome uma Ação de Movimento configurada na economia da própria instância.
- Uma instância Caída que ainda está no mapa continua ocupando o limite de invocações simultâneas.
- Dissipação voluntária e derrota permanecem estados distintos.

## Implementação

- `src/lib/controlador/estadoInvocacao.ts` contém as transições puras e valida cada resultado com `InstanciaInvocacaoSchema`.
- `src/lib/controlador/mapa.ts` integra dano, cura, levantamento, dissipação e persistência da instância no personagem dono. A barra de PV do modelo continua não negativa; PV negativos e estado de combate ficam na instância separada.
- `src/stores/useMapStore.ts` registra o estado visual do token. `src/components/mapa/MapaModule.tsx` mostra “Caído” no mapa.
- `src/components/fichas/ControladorInvocacoesSection.tsx` exibe o estado, oferece levantamento quando há saldo próprio de Movimento e impede apagar uma ficha ainda aguardando resolução da derrota.
- `src/types/index.ts` acrescenta `instanciasInvocacao` ao registro persistente do personagem, sem misturar estado de combate com aprovação/aquisição.

## Evidência

- `src/test/controladorMapa.test.ts` cobre 0 PV, PV negativos, limiar exato de derrota, cura com PV negativo, ausência de levantamento automático, gasto da Ação de Movimento própria, limite simultâneo e repetição idempotente depois da derrota.
- Testes do Controlador: **6 arquivos, 85 testes aprovados**.
- Suíte completa: **241 arquivos, 5.065 testes aprovados**.
- `tsc --noEmit`: aprovado.
- `npm run build`: aprovado.
- Os testes usam stores locais e mocks do projeto; nenhuma chamada a Supabase foi necessária.

## Limites desta etapa

- O pipeline genérico de dano/cura de fichas e OMNI ainda precisa reconhecer instâncias de Shikigami como alvos; a API de cura desta etapa já aplica a transição corretamente, e sua conexão às habilidades pertence às etapas de rolagem e suporte.
- A recarga/reset da economia individual será integrada na etapa 11. Sem saldo próprio configurado, o levantamento é recusado.
- Resolução narrativa da derrota, reinvocação e recuperação pertencem à etapa 18. Autorização de servidor, reconexão e segurança multiplayer pertencem à etapa 19.
