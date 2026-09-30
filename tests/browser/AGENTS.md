# Browser checks

- Dice zoom centering is checked by a real browser roll plus a large-to-compact tray resize: `python tests/browser/dice_zoom_center.py` against `/dice-lab`; the conditional probe compares the die's projected pixel position with the live tray center.
- Browser HUD checks use dev-only window hooks (__charStore, __mapStore, __combatStore, __profileStore) and block cloud writes/sockets in Playwright; the throwaway test sheet exists only in that browser and vanishes on close — never touches real campaign data.
- HUD do Especialista: `python tests/browser/hud_especialista.py` cria fichas/peças/combate só no navegador (gravações bloqueadas), rola ataque+dano e checa PE, vida do alvo e flanco dentro/fora/furtivo.
- HUD nível 4 (Armas Escolhidas + Arremesso Rápido): `python tests/browser/hud_especialista_nv4.py` cria ficha/peças temporárias, bloqueia gravações e confere seção, PE, ação bônus, banner e dano real.
- HUD nível 4 parte B (Técnicas de Avanço, Buscar Oportunidade, Compensar Erro): `python tests/browser/hud_especialista_nv4b.py` — escolha no mapa é resolvida pelo store (`resolveAoEPlacement`).
