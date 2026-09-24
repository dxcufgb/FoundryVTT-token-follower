# Dxcufgb's Token Follower

Press a key (default F, or Ctrl+F if F is taken) with a token selected, pick another token, and the selected token will follow behind it, including across scenes.

**Foundry VTT:** v13

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/Dxcufgb/dxcufgbs-token-follower/releases/latest/download/module.json
```

## Features

Lets a token follow another token.

- Select your token and press the **follow key** (default **F**; if F is already used by something else it becomes **Ctrl+F**). Pick the token to follow in the dialog.
- Players can only pick player-owned tokens they can currently see; GMs can pick any token.
- After every move the follower steps into the square **behind** the leader: leader moves east, the follower ends up west of it; leader moves north-east, the follower ends up south-west, and so on.
- If the leader goes to another scene (teleport region, Stairways, ...), the follower is moved there too and its owners' view follows.
- Press the key again with the follower selected to stop following.

## Settings

- The key is set under **Configure Controls → Dxcufgb's Token Follower**.
- Moving a follower to another scene needs a GM to be logged in.

## License

[MIT](LICENSE)
