# Especialista em Combate — Progressão e Habilidades de 2º nível

Uma etapa por vez: implementar, testar em combate real (peças no mapa, cliques reais, casos válidos e inválidos, dentro e fora do alcance) e só então seguir.

## Etapa 1 — Conferir a progressão geral
- Em todo nível a partir do 2º: escolher uma Habilidade de Especialista **ou** um Talento no lugar dela.
- Uma Aptidão Amaldiçoada a cada nível ganho.
- Nível 10: Mestre em uma perícia escolhida.
- Bônus de treinamento +1 nos níveis 5, 9, 13 e 17.
- Pré-requisitos das habilidades bloqueiam a escolha quando não são atendidos.
- Se algo já existir, apenas corrijo o que divergir.

## Etapa 2 — Arremessos Potentes
- Armas de arremesso sobem um passo de dado (d4→d6→d8→d10→d12).
- No começo do turno, botão "Gastar 1 PE": até o fim do turno, os arremessos ignoram RD igual ao bônus de treinamento (aplicado de fato na vida do alvo).
- Testes: arremesso com e sem ativação, arma não arremessável sem bônus, PE insuficiente, alvo fora do alcance.

## Etapa 3 — Arsenal Cíclico
- Uma vez por rodada, sacar ou trocar item como ação livre.
- Depois de atacar com uma categoria de arma e trocar para outra categoria nesta rodada ou na próxima: +1 dado de dano da arma trocada até o fim do próximo turno.
- Testes: troca de categoria diferente (ganha), mesma categoria (não ganha), segunda troca livre na rodada (bloqueada), bônus expirando no tempo certo.

## Etapa 4 — Assumir Postura
- Aprende 1 postura ao obter; mais uma nos níveis 8 e 16.
- Entrar é ação bônus; dura 1 minuto (10 rodadas) ou até ser derrubado, incapacitado ou trocar; usos = bônus de treinamento (recarga no descanso longo).
- Sol: +2 acerto, +1 dado de dano, −4 Defesa.
- Lua: +3 Defesa, Andar/Desengajar como ação livre, reação para reduzir dano pelo nível de personagem; −4 acerto e sem atributo no dano.
- Terra: imune a movimento forçado, + treinamento em Fortitude, PV temporários = nível no começo do turno.
- Dragão: inimigos a 1,5 m do alvo fazem TR de Fortitude (CD de Especialização) ou sofrem metade do dano — automático.
- Fortuna: em ataques e resistências, d20 ≤ bônus de treinamento pode ser rerrolado (fica o maior), até metade do treinamento por rodada, uma vez por dado.
- Devastação (nível 6): acertos no mesmo alvo acumulam +1 acerto e ignoram 2 RD, até treinamento / dobro dele; trocar de alvo zera.
- Tempestade (nível 10): acerto força TR de Fortitude ou derruba; alvo já caído que falha fica imóvel até seu próximo turno — automático.
- Céu (nível 12): alcance dobrado, 2 Pontos de Preparo temporários por turno, +2 em perícias.
- Cada postura testada em combate com peças, incluindo pré-requisitos de nível e fim da postura.

## Detalhes técnicos
- Módulos próprios por habilidade (ex.: `arremessosPotentes.ts`, `arsenalCiclico.ts`, `posturas.ts`) com UI na barra de combate/painel de Ataque, seguindo o padrão de `combateEstilos.ts` e `golpeEspecial.ts`.
- Categoria de arma: verificar se as armas já têm categoria; se não houver, perguntar antes de criar uma.
- Testes com o ambiente de mesa real em jsdom (cliques reais, peças no mapa) mais testes de regras puras.
- Relatar ao fim de cada etapa e pedir confirmação antes da próxima.
