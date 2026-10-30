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

Requirements and more: see [Installation](https://github.com/dxcufgb/FoundryVTT-token-follower/wiki/Installation) in the wiki.

## Documentation

The full guide is in the [wiki](https://github.com/dxcufgb/FoundryVTT-token-follower/wiki):

- [Following a Token](https://github.com/dxcufgb/FoundryVTT-token-follower/wiki/Following-a-Token): start, stop, where the follower goes, other scenes
- [Settings](https://github.com/dxcufgb/FoundryVTT-token-follower/wiki/Settings): the follow key
- [API](https://github.com/dxcufgb/FoundryVTT-token-follower/wiki/API): for macro and module authors, and the stored flag

## Releasing

For the maintainer: **Actions → Release module → Run workflow**, type the version (for example `1.2.3`) and run it. The module is checked and packaged first; only then is the release `v1.2.3` published with `module.json` and `module.zip`. CI and releases come from [dxcufgb/foundry-module-ci](https://github.com/dxcufgb/foundry-module-ci), the same for every module.

## License

[MIT](LICENSE)
