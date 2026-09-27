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
- Accounts use nick+password mapped to a synthetic email (nick@tpfichas.local, auto-confirm); Master is a row in user_roles (first account auto-claims it) so role never comes from local storage.
- Map sync: piece moves travel as throttled `entity-patch` broadcasts (~8/s) and glide on receivers; the full map is only rebroadcast for structural changes (positions-only changes save to the cloud after 1.5s), and incoming full maps are merged so fresh local or live-patched positions win — this keeps movement smooth under the realtime message limit.
- Multiplayer flows are tested with the in-memory fake table (src/test/helpers/fakeMesa.ts) plus pure receive rules (e.g. reduceAmizadeMessage) — simulates several screens in under 1s instead of opening two browser sessions.
- Habilidades de Suporte por nível ficam em módulos próprios (suporteNivel2.ts, suporteNivel6.ts) com UI em SuporteNivel*Sections.tsx; bônus fixos em rolagens usam grantFlatBonus/consumeFlatBonusFor de rollAdvantage.ts (mods com `bonus` não contam como vantagem).
- Prompt flows use the real-store jsdom harness in `src/test/helpers/mesaReal.ts`; it mocks cloud/socket and verifies real UI clicks quickly.
- Token framing stays in `Entity.tokenCrop` across circular/free formats for scene and multiplayer persistence.
- Character sync merges per sheet by `_syncAt` last-edit stamps (src/lib/charSyncStamps.ts) — stale cloud/other-screen copies must never overwrite newer HP/PE edits.
- 3D dice results come from the final physical orientation; micro-bounces are damped and bodies sleep instead of using timeout RNG.
