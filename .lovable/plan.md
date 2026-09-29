# Especialista em Combate — Repertório do Especialista (um estilo por vez)

O arquivo traz a habilidade de nível 1 **Repertório do Especialista**: o personagem escolhe 1 entre 8 Estilos de Combate. Faremos uma base comum e depois cada estilo em sua própria etapa, com teste em jogo real ao fim de cada uma.

## Etapa 0 — Base comum
- Escolha obrigatória do estilo na criação do personagem (nível 1) e visível na ficha.
- Aparece também na barra de combate (aba própria do Especialista) com o estilo ativo e seus bônus atuais.
- O talento geral "Adepto de Combate" (que já existe e pede um estilo) passa a usar a mesma lista, escalando pelo nível do personagem.
- Escala comum: bônus que "aumentam nos níveis 4, 8, 12 e 16" calculados automaticamente pelo nível.

## Etapas por estilo
1. **Defensivo** — Defesa +2, +1 nos níveis 4/8/12/16 (total +6 no 16). Passivo, somado à Defesa exibida e usada no combate.
2. **Duelista** — com arma de uma mão e a outra livre: acerto +1 (+1 nos níveis 8/16), dano +2 (+1 nos níveis 4/8/12/16). Aplicado só se a condição de mãos for verdadeira.
3. **Distante** — armas à distância: mesmos números do Duelista. Integra com o alcance de armas já existente.
4. **Arremessador** — armas de arremesso: dano +2 (+1 nos níveis 4/8/12/16) e sacar a arma como parte do ataque (sem custo de ação).
5. **Duplo** — lutando com duas armas: soma o atributo no dano da segunda arma e dano +1 (+1 nos níveis 4/8/12/16).
6. **Massivo** — arma em duas mãos ou pesada: dados de dano com 1 ou 2 são rolados de novo (uma vez, fica o novo) e dano +1 (+1 nos níveis 4/8/12/16).
7. **Protetor** — reação: quando inimigo ataca aliado a até 1,5 m de você, impõe desvantagem; também concede vantagem no TR de aliado a até 1,5 m. Prompt para o jogador na hora do ataque/TR.
8. **Interceptador** — reação: aliado dentro do seu alcance recebe ataque, reduz dano em 1d10 + FOR/DES/SAB (dados: 2 no 4, 3 no 8, 4 no 12, 5 no 16). Usa o alcance da arma empunhada.

## Pontos a confirmar em cada etapa (perguntarei antes de aplicar)
- Defensivo: "Defesa" = CA da ficha?
- Duelista/Distante: escudo na outra mão conta como "mão livre"? (proposta: não)
- Interceptador: qual atributo — o atributo-chave escolhido ou escolha na hora?
- Protetor/Interceptador: consomem a reação da rodada; uma vez por rodada.
- Massivo: vale também para dados extras de dano (críticos, habilidades)?

## Verificação obrigatória por etapa
- Testes automáticos dos números por nível (1, 4, 8, 12, 16) e das condições (mão livre, arma pesada, arremesso etc.).
- Teste em jogo real: ficha de Especialista no mapa, habilidade acessível na barra de combate, rolagens mostrando o bônus no log.
- Estilos de reação e alcance (Protetor 1,5 m, Interceptador pelo alcance da arma): peças no mapa dentro e fora da distância, confirmando que só funciona dentro.
- Nenhum estilo afeta outras especializações.

## Detalhes técnicos
- Novo módulo de regras próprio do Especialista (estilo, escala por nível, condições de empunhadura), seguindo o padrão dos módulos do Suporte; UI em seções próprias.
- Bônus fixos usam o mecanismo existente de bônus planos em rolagens; distâncias usam os cálculos de alcance/metros já existentes.
- Reações de Protetor/Interceptador reutilizam o fluxo de prompts multiplayer e são testadas com a mesa simulada e com o harness real de cliques.
