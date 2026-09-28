<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project architecture

- Keep the TP Fichas experience client-rendered inside the TanStack `/` route because its stores, 3D dice, audio, and local persistence depend on browser APIs.
- Cloud clients must use only this workspace's environment configuration; without it, use the offline stub so the copy cannot reach another project's data.

- Multiplayer syncs through `realtime_world`; `realtime_assets` stores images, and `tempTemplates` shares temporary-sheet templates while local persistence remains an offline cache.
- Accounts use nick+password; Master lives in user_roles. Rolls/wallets use exact profiles. Test requests overlay the workspace; their 3D tray is centered.
- Map sync: throttle `entity-patch` moves (~8/s), glide receivers, save positions after 1.5s, and reserve full-map broadcasts for structural changes; fresh positions win merges.
- Multiplayer flows are tested with the in-memory fake table (src/test/helpers/fakeMesa.ts) plus pure receive rules (e.g. reduceAmizadeMessage) — simulates several screens in under 1s instead of opening two browser sessions.
- Habilidades de Suporte por nível ficam em módulos próprios (suporteNivel2.ts, suporteNivel6.ts) com UI em SuporteNivel*Sections.tsx; bônus fixos em rolagens usam grantFlatBonus/consumeFlatBonusFor de rollAdvantage.ts (mods com `bonus` não contam como vantagem).
- Prompt flows use the real-store jsdom harness in `src/test/helpers/mesaReal.ts`; it mocks cloud/socket and verifies real UI clicks quickly.
- Token framing stays in `Entity.tokenCrop` across circular/free formats for scene and multiplayer persistence.
- Character sync merges per sheet by `_syncAt` last-edit stamps (src/lib/charSyncStamps.ts) — stale cloud/other-screen copies must never overwrite newer HP/PE edits.
- Dice uses one scene, smooth camera/aspect, upright final faces, matching visual/physical bounds, ref-driven proximity visuals, and warmed shared labels/audio before rolls.
