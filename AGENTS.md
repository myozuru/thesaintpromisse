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
- Habilidades de Suporte por nível ficam em módulos próprios (suporteNivel2.ts, suporteNivel6.ts) com UI em SuporteNivel*Sections.tsx; bônus fixos em rolagens usam grantFlatBonus/consumeFlatBonusFor de rollAdvantage.ts (mods com `bonus` não contam como vantagem).
- Token framing stays in `Entity.tokenCrop` across circular/free formats for scene and multiplayer persistence.
- Boss portrait framing stays in `Boss.retratoZoom/retratoX/retratoY` and must render consistently in the sheet, gallery, and world-map marker.
- Character sync merges per sheet by `_syncAt` last-edit stamps (src/lib/charSyncStamps.ts) — stale cloud/other-screen copies must never overwrite newer HP/PE edits.
- Dice keeps one scene while resizing; cinematic camera targets the live die and smooths only distance/FOV. Final face is upright. Drama alters vertical bounce only; armed bodies launch in batches.
- Attack damage is applied to the target automatically via `applyDamage(..., { attackerId, rdIgnore })`; RD-ignoring abilities pass `rdIgnore` instead of only logging — abilities like Penetrante/Arremessos Potentes/Dragão need the real damage taken.
