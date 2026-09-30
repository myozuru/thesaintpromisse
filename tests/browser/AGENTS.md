# Browser checks

- Dice zoom centering is checked by a real browser roll plus a large-to-compact tray resize: `python tests/browser/dice_zoom_center.py` against `/dice-lab`; the conditional probe compares the die's projected pixel position with the live tray center.
- Browser HUD checks use dev-only window hooks (__charStore, __mapStore, __combatStore, __profileStore) and block cloud writes/sockets in Playwright; the throwaway test sheet exists only in that browser and vanishes on close — never touches real campaign data.
