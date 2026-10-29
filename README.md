# Dxcufgb's Token Follower

[![Foundry v13](https://img.shields.io/github/v/release/dxcufgb/FoundryVTT-token-follower?label=Foundry%20v13&logo=foundryvirtualtabletop&color=ff6400)](https://github.com/dxcufgb/FoundryVTT-token-follower/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/dxcufgb/FoundryVTT-token-follower/module.zip?label=downloads&color=blue)](https://github.com/dxcufgb/FoundryVTT-token-follower/releases)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/dxcufgb)\
[![CI](https://img.shields.io/github/actions/workflow/status/dxcufgb/FoundryVTT-token-follower/ci.yml?branch=main&label=CI)](https://github.com/dxcufgb/FoundryVTT-token-follower/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/dxcufgb/FoundryVTT-token-follower)](LICENSE)

<a href="https://dxcufgb.github.io/FVTT-dev-showcase/"><img src="https://dxcufgb.github.io/FVTT-dev-showcase/assets/img/workshop-badge.png" alt="Dxcufgb's Workshop: every Foundry VTT project, video and changelog in one place" width="650"></a>

Press a key (default F, or Ctrl+F if F is taken) with a token selected, pick another token, and the selected token will follow behind it, including across scenes.

**Foundry VTT:** v13

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-token-follower/releases/latest/download/module.json
```

## Features

Lets a token follow another token.

- Select your token and press the **follow key** (default **F**; if F is already used by something else it becomes **Ctrl+F**). Pick the token to follow in the dialog (nearest first).
- Select several tokens to make them all follow the same leader.
- Players can only pick friendly tokens they can currently see; GMs can pick any token. The same rule applies when another module starts a follow through this module's API.
- After every move the follower steps into the square **behind** the leader: leader moves east, the follower ends up west of it; leader moves north-east, the follower ends up south-west, and so on.
- If that square is taken or on the other side of a wall (e.g. the leader stops against a wall), the follower takes the nearest free square next to the leader on the leader's side of the wall.
- If a GM moves the leader with unconstrained movement ("ghost mode"), the follower also moves unconstrained, through walls, and still ends up next to the leader on the leader's side of any wall.
- If the leader goes to another scene (teleport region, Stairways, ...), the follower is moved there too and the view of its owners who were looking at the old scene follows. Only a GM can switch other users' view this way.
- A token can't follow its own follower (A follows B, B follows A), also not through a longer chain.
- A locked follower token doesn't move after its leader on the scene.
- Press the key again with the follower selected to stop following.

## Settings

- The key is set under **Configure Controls → Dxcufgb's Token Follower → Follow / stop following**. Players can use it too.
- Moving a follower to another scene needs a GM to be logged in.

## API

```js
const api = game.modules.get("dxcufgbs-token-follower").api;
await api.follow(followerDoc, leaderDoc); // followerDoc starts following leaderDoc and moves next to it
await api.stop(followerDoc);              // followerDoc stops following (nothing happens if it isn't following)
api.getFollowers(leaderDoc);              // array of the TokenDocuments on leaderDoc's scene that follow it
```

- All three take **TokenDocuments** (`token.document`), not canvas tokens.
- `follow` uses the same rules as the follow key: a player can only follow a friendly token they can currently see on their canvas; a GM can follow any token. A token can't follow its own follower. If a rule blocks it, the user gets a notification and nothing changes. The user calling it must own the follower token (the flag below is written as that user), and both tokens must be on the same scene.
- `follow` and `stop` show the same "is now following" / "stopped following" notifications as the key. After `follow`, the module keeps moving the follower by itself, as described under Features.
- The module calls no hooks of its own. A follow starting or stopping is an `updateToken` change to the flag below.

**From another module**

The API is set in the `ready` hook, so use it after `ready` (for example when your code reacts to the user), not while your module loads. Make the integration optional:

```js
// Make the selected token follow your target.
const mod = game.modules.get("dxcufgbs-token-follower");
const api = mod?.active ? mod.api : null;
const follower = canvas.tokens.controlled[0]?.document;
const leader = game.user.targets.first()?.document;
if (api && follower && leader) await api.follow(follower, leader);
```

Add `{ "id": "dxcufgbs-token-follower", "type": "module" }` to `relationships.recommends` in your `module.json`.

**Data**

- `flags["dxcufgbs-token-follower"].leader` on the follower's TokenDocument, while it follows: `{ sceneId, tokenId, actorId, name, userId, dir: { x, y } }`. That is the leader's scene and token id, its actor id and name (used to find the leader again after a scene change), the user who started the follow, and the leader's last movement direction (`x` and `y` are -1, 0 or 1). Read it with `doc.getFlag("dxcufgbs-token-follower", "leader")`; start and stop through the API, not by writing the flag.
- When a follower is moved to another scene, its token is created on the new scene with the same id and the old token is deleted.

## License

[MIT](LICENSE)

## Releasing

For the maintainer: **Actions → Release module → Run workflow**, type the version (for example `1.2.3`) and run it. The module is checked and packaged first; only then is the release `v1.2.3` published with `module.json` and `module.zip`. CI and releases come from [dxcufgb/foundry-module-ci](https://github.com/dxcufgb/foundry-module-ci), the same for every module.
