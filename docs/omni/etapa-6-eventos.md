# Etapa 6 — mapeamento dos eventos naturais

Estado: mapeador declarativo implementado e coberto por testes. Não executa regras nem conecta os produtores do combate ao compilador natural.

## Contrato entregue

`eventosNaturais.ts` mapeia átomos de evento aceitos para `GatilhoId` já existente em `gatilhoAliases.ts`. Não cria novos gatilhos. O resultado preserva filtros explícitos:

- `sujeito`: usuário, outro aliado ou outro inimigo;
- `agressor`: aliado ou inimigo, quando especificado;
- `raioMetros`: alcance escrito no evento;
- `acerto`: crítico, quando pedido;
- `tipoAtaque`: corpo a corpo ou à distância.

Exemplo: `quando aliado até 4.5m sofrer dano de inimigo` vira `aoAliadoSofrerDano` com sujeito `outro_aliado`, agressor `inimigo` e raio 4,5m. O aliado não inclui o próprio usuário. Nomes ou sentidos que não tenham mapeamento seguro produzem erro com intervalo da fonte, em vez de escolher um gatilho aproximado.

Eventos repetidos com o mesmo ID e filtros dentro da condição de uma regra são deduplicados no descritor compilado. Isso impede duplicidade de configuração idêntica, mas não é uma garantia de execução única por ataque.

## Fora do escopo desta etapa

- Os produtores legados ainda não emitem um envelope unificado com atacante, vítima, origem, relações e ID estável da ocorrência.
- O barramento não recebeu uma chave de idempotência; uma ocorrência duplicada emitida duas vezes ainda pode chegar duas vezes aos observadores.
- Filtros espaciais e relações são metadados do mapeador; ainda não são avaliados contra o mapa nesta etapa.
- O parser/compilador não executa esses eventos em habilidades; a integração ocorre em etapas posteriores.

Esses pontos permanecem como requisito da integração de runtime (etapa 24). O contrato já proíbe contar dano mitigado a zero como perda real de PV e exige uma única ocorrência por golpe com parcelas tipadas; esta etapa não muda esse pipeline.

## Validação

`npx vitest run src/test/omniEventosNaturais.test.ts src/test/omniGramaticaNatural.test.ts src/test/omniLexerNatural.test.ts src/test/omniContextoNatural.test.ts` — 4 arquivos, 42 testes aprovados. Casos cobrem relações e papéis, raio, crítico, categoria de ataque, aliases naturais para IDs existentes, deduplicação declarativa, separação entre estado e evento e rejeição de eventos sem mapeamento.
