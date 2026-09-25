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

- Multiplayer syncs via Lovable Cloud: live changes use a realtime broadcast channel, and each slice is persisted in `realtime_world` (images in `realtime_assets`) so late joiners load the table state — no Socket.IO server needed.
