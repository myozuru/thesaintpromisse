# OMNI engine rules

- Reações OMNI: gatilhos listados em `GATILHOS_REACAO_IDS` (tipos.ts); efeitos de uma reação rodam sob `comReacaoEmCurso` (reacaoEmCurso.ts) para nunca abrir reações em cadeia.
- Sustentações OMNI podem gerar cargas (`gerar_cargas`) e ter limite de metros (`alcance_sustentacao_m`); ações que gastam esse contador se prendem à sustentação, e o Mestre confere a distância a cada movimento (src/lib/omni/vigiaSustentacao.ts) e no início do turno — assim invocações limitadas não viram ações livres infinitas.
- Efeitos OMNI contínuos presos ao alvo (cura todo turno, assistência de dano por tipo de ataque) ficam em `Character.omniEfeitosContinuos` e src/lib/omni/efeitosContinuos.ts; valem enquanto a sustentação de origem existir — assim somem sozinhos sem precisar de limpeza em cada caminho.
- OMNI 'Ação Completa' always costs the turn's Ação Comum + Ação Bônus (characters have 1 Comum); per-scene limits (`usos_por_cena`) live in `Character.omniUsosCena` keyed by combatId so they reset with each new combat.
- OMNI condition effects can last until the user's next turn start (`ate_inicio_turno_usuario` → `ActiveCondition.expiraNoInicioDoTurnoDe`), cleared by the combat turn-start hook; Suspenso blocks player token movement.
