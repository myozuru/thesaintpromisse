# Etapa 17 — Reações de Shikigami

**Status:** implementada e validada em testes locais; os testes usam stores e transporte simulados, sem conexão com Supabase.

## Entrega

- Uma reação da ficha vincula uma ação OMNI existente da categoria **Reação**. O esquema valida o vínculo e o motor confirma que a configuração, a versão aprovada, o alvo e os custos continuam válidos no momento de executar.
- Cada instância ativa tem uma reserva independente de reação. Fichas que já possuem uma reação vinculada começam com 1 uso por turno, salvo limite configurado; o padrão de recuperação é o início do turno do dono.
- Ofertas só aparecem para invocações aprovadas, ativas, vivas e visíveis no mapa, dentro do alcance e com reação e recursos disponíveis. O alvo é único e fica identificado no prompt.
- A oferta é enviada ao perfil do Controlador pela janela de reação existente. O Mestre também consegue vê-la e resolvê-la. O ID da oferta é estável entre as sessões para que uma reação executada pelo jogador não permaneça duplicada para o Mestre.
- Aceitar ou passar uma oferta de Shikigami não expira automaticamente. A ação e o cronômetro aguardam a decisão; o Mestre pode continuar sem reação. Ofertas comuns de itens mantêm o prazo de 12 segundos.
- Os gatilhos **sofrer dano** e **causar dano** são processados antes de PV e Escudo serem debitados. Aceitar uma reação pode cancelar o evento ou aplicar seus bônus apenas se o ataque reativo acertar; passar ou errar deixa o evento seguir.
- O custo de ação/reação é debitado da instância. PE e recursos do dono só são gastos quando a ficha configura explicitamente esses débitos. Efeitos produzidos pela reação não abrem uma cadeia recursiva.

## Escopo suportado nesta etapa

A execução reativa de Shikigami aceita uma ação OMNI de ataque, com um alvo único, alcance fixo, custo fixo e dano configurado. Efeitos OMNI adicionais, áreas, alvos múltiplos, custos dinâmicos e reações que dependem de uma resposta de Teste de Resistência ainda são recusados pela validação. O fluxo geral de reações OMNI de itens e de feitiços continua separado.

## Verificação

- Testes focados cobrem janela local antes do dano, pausa e retomada, passagem sem custo, reação do Mestre, economia própria da instância, oferta remota sem expiração, deduplicação entre sessões e não recursão.
- Testes executados sem serviços externos: `src/test/controladorEconomiaAcoes.test.ts`, `src/test/controladorOmniInvocacao.test.ts` e `src/test/omniReacoesAtivas.test.tsx`.
- `npm run build` concluiu. `npx tsc --noEmit --pretty false` ainda aponta dois erros preexistentes em `src/test/omniSpellDamageContext.test.tsx` (linhas 140 e 156), fora desta etapa.
