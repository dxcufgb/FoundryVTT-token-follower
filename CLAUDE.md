# Dxcufgb's Token Follower

FoundryVTT v13 module (id `dxcufgbs-token-follower`, the install folder must have the same name), system-agnostic.
Press the follow key with a token selected, pick another token, and the selected token follows behind it, also
across scenes. No build step, no npm dependencies, no module dependencies.

## Layout
- `scripts/token-follower.js` – the whole module: keybinding (F, or Ctrl+F if F is taken), the leader dialog, the
  follow flag on the follower's TokenDocument (`flags["dxcufgbs-token-follower"].leader`), moving behind the leader
  (`moveToken` hook, `updateToken` fallback), the move to another scene (`checkTeleport`, GM only) and the `pull`
  socket message, and the `api` (documented in the header comment).
- `scripts/debug-recorder.js` – optional integration with Dxcufgb's Debug Recorder (`dxcufgbs-debug-recorder`, not a
  dependency): `registerDebugRecorder(MODULE_ID, snapshot)` (called at `ready`; connects on the recorder's
  `dxcufgbs-debug-recorder.ready` hook or its `api` already being there, registers once) and `crumb(key, data)`
  (no-op unless recording, never throws). The snapshot is `debugSnapshot` in `token-follower.js`; breadcrumb keys are
  `area.action`. `errorName(err)` gives an error's type for a breadcrumb, never its message.
- `.github/workflows/ci.yml` / `release.yml` – thin callers of `dxcufgb/foundry-module-ci`; identical in every
  module, do not edit here.

## Invariants
- Socket messages come from any client: nothing in the payload is trusted, and only a GM may pull another user's view.
- Token moves are done by one client only (`isResponsibleFor`, or the GM who moved the leader in ghost mode).
- A token can't follow its own follower (`isFollowingChain`).
- The debug-recorder integration is optional: without the recorder the module works exactly the same. Snapshot and
  breadcrumb data must never contain names, free text, image paths or URLs: no token, actor, user or scene names
  (also not the leader `name` stored in the flag), no ids, only counts, booleans, numbers and the module's own enums.
  A player's snapshot counts only the followers that player owns.

## Conventions
- `MODULE_ID` must equal `id` in `module.json`; every visible setting needs a Name and Hint in `lang/en.json`. UI
  strings are under `DXTF.*`.
- User-facing documentation lives in the GitHub wiki; the README only has the badges, the Workshop banner, a short
  install guide and links to the wiki.
