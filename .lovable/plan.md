# Economia, Lojas NPC e Mural de Quests

Implementação em 3 partes, cada uma testada no navegador (mapa real, Mestre e jogador) antes de seguir.

## Parte 1 — Comércio no OMNI e categorias de estabelecimento
- No OMNI (armas/itens): preço de venda + **moeda** (lista das moedas existentes).
- **Categorias de estabelecimento** (Ferreiro, Armeiro, Alquimista, Padaria, Taverna, Joalheiro, Mercado Negro, Antiquário, Geral...) com botão para o Mestre **criar novas categorias**.
- Cada item marca as categorias que **aceitam** comprá-lo; cada loja tem uma ou mais categorias. Espada não vende na padaria.
- A regra anti-revenda continua valendo.

## Parte 2 — Lojas como NPCs no mapa + Pechincha
- O Mestre vincula uma loja a um token/NPC do mapa.
- O jogador clica no NPC: a loja só abre se ele estiver **a até 1,5 m**. Se estiver longe, aparece "Aproxime-se".
- **Pechincha** (configurada por mercador, invisível ao jogador):
  - CD secreta própria por mercador e perícia aceita (Persuasão, Enganação, Intimidação ou outras que o Mestre marcar).
  - Faixas de resultado: falha crítica (preço sobe e o mercador fica irritado), falha (sem desconto), sucesso (desconto padrão), sucesso por 5+ (desconto maior), crítico (desconto máximo).
  - Percentuais de cada faixa configuráveis pelo Mestre.
  - Limite de tentativas por jogador e por dia do mundo, reiniciado pelo relógio do jogo.
  - Humor do mercador (amigável/neutro/hostil) altera a CD.
  - Funciona para comprar (desconto) e vender (o mercador paga mais).
  - A rolagem usa os dados reais. O jogador vê só o resultado ("O mercador cede 15%"), nunca a CD.

## Parte 3 — Mural de Quests
- **Quest de mural**: boss, evento ou item do OMNI como alvo. Tem descrição, recompensa (dinheiro + itens do OMNI) e o que o jogador verá ao aceitar (usa os controles de revelar que já existem).
- **Tempo limite no mundo do RPG** (dias/horas do relógio do jogo, opcional). Quando o prazo acaba, a quest fica "Expirada". O cartaz mostra o tempo restante no calendário do jogo.
- **Murais pré-programados** no mapa (token clicável). O jogador abre o mural a até 1,5 m e aceita a quest, liberando para ele o que o Mestre definiu.
- **Cartazes visuais**: quadro de cortiça com alfinetes. Os jogadores clicam e arrastam os cartazes, que ficam levemente inclinados ao soltar. A posição é sincronizada com todos.
- **Ícones**: caveira (boss), ?, espada, escudo, poção, baú, coroa, olho, chama, moeda, mapa, estrela, pegada.
- **Máscara "?"**: o cartaz mostra só descrição e recompensa. O Mestre escolhe se revela o objetivo real depois ou se ele continua sempre como "?".
- **Conclusão**: o Mestre tem o botão "Concluíram a missão" na quest aceita. O dinheiro é dividido igualmente entre os jogadores participantes e cai na carteira de cada um (o resto da divisão fica com o primeiro). Os itens de recompensa caem no chão ao lado de um jogador, sem duplicar. Se falharem, há o botão "Falharam".
- Status: Disponível, Aceita, Concluída, Falhou, Expirada. Tudo sincroniza no multiplayer.

## Detalhes técnicos
- Lojas, categorias, murais e quests passam a ser sincronizados pelo canal multiplayer existente, em fatias novas. O armazenamento local fica como cache.
- A CD de pechincha e as quests mascaradas são filtradas antes de chegar ao jogador.
- Prazo calculado com o relógio global (`toTimelineSeconds`); a expiração é checada pelo ticker do relógio.
- O pagamento usa as transações do `useMoneyStore`, com origem "Recompensa de quest". O drop reaproveita o fluxo de itens no chão.
- Testes unitários: divisão igual, prazo/expiração, categorias aceitas, faixas de pechincha e limite de tentativas. Scripts Playwright para loja por proximidade, pechincha, mural e conclusão.
