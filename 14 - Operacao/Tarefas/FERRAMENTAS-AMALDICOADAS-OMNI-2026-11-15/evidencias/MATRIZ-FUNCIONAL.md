# Ferramentas Amaldiçoadas — pacote e limites de resolução

Data: 2026-11-15. Regras narrativas completas fornecidas pelo Mestre ficam na descrição editável de cada entidade. O pacote inicializa preço em 0 e não define imagens; importação é responsabilidade do Mestre.

| Item | Caminho de combate existente | Ações resolvidas | Requer adjudicação/validação do Mestre |
|---|---|---|---|
| Seraphiel | Arma externa + ações OMNI do item | Punição, Proteção, Perseguição (até 3 alvos) e Prisão estão configuradas | O Sexto Julgamento não cabe no executor genérico atual (seis ataques, até três alvos, crítico por projétil); usar descrição e resolver manualmente. Limites de 1/rodada e interceptações da Prisão também exigem acompanhamento |
| Báculo Aetheris | `BaculoAetherisPanel` e `baculoAetherisCombat.ts`; preset OMNI atualizado | O painel especializado resolve as habilidades atuais com valores 8d8, 18d12, +11d8 e 8d12; OMNI conserva configurações legadas/ações genéricas | Ações legadas são filtradas para evitar segunda execução com custo/efeito divergente. Confirmar área/suspensão/transporte no mapa. Asas, Rajada e Julgamento têm lógica especializada, não representação genérica OMNI |
| Sagitta | Arma externa + ações OMNI | Constelação dispersa/convergida, Explosão Estelar e Sentença das Estrelas configuradas | Decreto do Zênite não tem configuração segura no executor (acerto crítico garantido com três tipos de dano e múltiplos efeitos); Cartografia através de estruturas e Equinócio também requerem julgamento manual |
| Raijin | Arma externa + ações OMNI | Dança, Contratempo/descarga, Execução e efeitos auxiliares configurados | Movimento sem Ataques de Oportunidade, salto do Sangue do Trovão e escala do atordoamento pela diferença da CD não são automatizados por completo |
| Ruína Esmeralda | Arma externa + ações OMNI | Miasma, Decomposição e dano de crítico configurados | O sistema não possui estado Corrosão/Deterioração persistente correspondente; TRs, dano por turno, cura reduzida e penalidades requerem adjudicação manual |
| Crepúsculo da Última Lua | Arma externa + ações OMNI | Dança, Ceifa, Reflexo e Cisão configurados | Lâmina de Retorno e condição “puxado nesta rodada” não são rastreadas automaticamente; conferir se o alcance do cone representa o arco descrito |
| Lança Vetorial Rubra | Painel próprio em `AttackPanel` + `lancaVetorial.ts`; preset atualizado | Marcas, Fratura, Avanço, Sentença e crítico são resolvidos no painel especializado | Não possui ações em `acoesAtivas` genéricas; no painel de ficha funciona, mas não aparece como ação genérica na PlayerActionBar. Confirmar a decisão de manter o crítico herdado da Sentença e 2 marcas no Avanço crítico |

## Uso

1. Master importa `Ferramentas Amaldiçoadas` pelo PresetsDialog uma vez.
2. Mestre edita a entidade: imagem, preço base, categorias aceitas/tags comerciais e descrição. `currencyId` é opcional e, se ausente, a loja usa sua própria moeda; a elegibilidade compara categorias configuradas ou `hiddenTags` do item com `acceptedTags` da loja.
3. Distribui pelo módulo OMNI ou adiciona à loja/baú. O inventário recebe uma cópia do item; edições posteriores do preset não alteram cópias já entregues.
4. Player equipa a arma para selecioná-la nos ataques; habilidades OMNI configuradas ficam disponíveis nos componentes de ações compatíveis. Aetheris e Lança conservam seus caminhos especializados em ficha. Descrições completas preservam as regras que ainda não têm resolução automática.

## Pontos pendentes para decisão do Mestre

- Sagitta não especifica alcance-base do arco; o modelo foi configurado como arco longo padrão de 36/72 m.
- Raijin declara simultaneamente Duas Mãos e Versátil; o motor aplica Duas Mãos quando ambas estão presentes.
- Lança: descrição nova não cita o multiplicador de crítico da Sentença; o motor existente dobra dano crítico, e Avanço aplica 2 marcas em crítico.
- Automatização completa dos efeitos persistentes, do Sexto Julgamento e do Decreto do Zênite precisa fase própria; descrição do item preserva as regras para adjudicação sem fingir que o motor já as aplica.
