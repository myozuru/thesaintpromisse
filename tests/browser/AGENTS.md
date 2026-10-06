# Browser checks

- Dice zoom centering is checked by a real browser roll plus a large-to-compact tray resize: `python tests/browser/dice_zoom_center.py` against `/dice-lab`; the conditional probe compares the die's projected pixel position with the live tray center.
- Browser HUD checks use dev-only window hooks (__charStore, __mapStore, __combatStore, __profileStore) and block cloud writes/sockets in Playwright; the throwaway test sheet exists only in that browser and vanishes on close — never touches real campaign data.
- HUD do Especialista: `python tests/browser/hud_especialista.py` cria fichas/peças/combate só no navegador (gravações bloqueadas), rola ataque+dano e checa PE, vida do alvo e flanco dentro/fora/furtivo.
- HUD nível 4 (Armas Escolhidas + Arremesso Rápido): `python tests/browser/hud_especialista_nv4.py` cria ficha/peças temporárias, bloqueia gravações e confere seção, PE, ação bônus, banner e dano real.
- HUD nível 4 parte B (Técnicas de Avanço, Buscar Oportunidade, Compensar Erro): `python tests/browser/hud_especialista_nv4b.py` — escolha no mapa é resolvida pelo store (`resolveAoEPlacement`).
- HUD nível 4 parte C (Preparo Imediato, Recarga Rápida, Uso Rápido): `python tests/browser/hud_especialista_nv4c.py` — prompt na iniciativa, disparo da ação preparada, munição por ataque, recarga e item adicional por 1 PE, tudo com gravações bloqueadas.
- HUD nível 4 parte D (Guarda Estudada, Espírito de Luta): `python tests/browser/hud_especialista_nv4d.py` — rola o TR escolhido (+2 no log), ativa o Espírito de Luta (1 PE, PV temporários, botão trava) e confere a nota "+2 no acerto" no ataque real. A Defesa não é exibida na HUD (oculta por design); o bônus de Defesa é coberto pelos testes automatizados.
- Réplicas materializáveis: `python tests/browser/replicas_materializar.py` cria ficha/réplica só no navegador, materializa, ataca, sustenta, deixa desfazer e solta a arma.
- Chaves genéricas do OMNI (gatilho "aliado sofre dano" com distância, contador com teto por aliado, consumo em dano, condicao_rodadas): `python tests/browser/omni_contadores.py` — passivas/fichas/peças só no navegador, gravações bloqueadas.
- Ações ativas OMNI (TR ramificado, puxão, condição, consumo de cargas): `python tests/browser/acoes_ativas.py` cria ficha/item só no navegador e usa Vingança Agulhada e Corte da Injustiça pelo painel de ataque.
- Reações em testes do Mestre: `python tests/browser/omni_reacoes_testes.py` — pedido de TR com "quem força o teste", reação dá bônus, anula (sucesso garantido) ou passa; sem origem não abre.
