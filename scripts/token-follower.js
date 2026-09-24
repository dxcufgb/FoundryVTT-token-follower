/**
 * Dxcufgb's Token Follower (dxcufgbs-token-follower) - Foundry VTT V13
 *
 * Press the follow key (default F, or Ctrl+F if F is taken) with a token selected
 * and choose a token to follow. After every move of the leader the follower moves to
 * the square directly behind it (leader moves east -> follower stops west of it;
 * leader moves north-east -> follower stops south-west of it, and so on).
 * Press the key again with the follower selected to stop following.
 * If the leader is moved to another scene, the follower is moved there too.
 *
 * Follow state lives in a flag on the follower's TokenDocument:
 *   flags["dxcufgbs-token-follower"].leader = {
 *     sceneId, tokenId, actorId, name,   // who to follow
 *     userId,                            // who started the follow
 *     dir: { x, y }                      // last movement direction of the leader
 *   }
 *
 * API: game.modules.get("dxcufgbs-token-follower").api
 *   .follow(followerDoc, leaderDoc), .stop(followerDoc), .getFollowers(leaderDoc)
 */

const MODULE_ID = "dxcufgbs-token-follower";
const ACTION = "follow";
const SOCKET = `module.${MODULE_ID}`;
const TELEPORT_DELAY_MS = 750;

/** Last known top-left position per token id (fallback when the moveToken hook isn't used). */
const lastPos = new Map();
/** Token ids whose movement was already handled by the moveToken hook. */
const handledByMoveHook = new Set();

/* -------------------------------------------- */
/*  Init: keybinding and settings               */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.keybindings.register(MODULE_ID, ACTION, {
    name: "DXTF.Keybinding.Name",
    hint: "DXTF.Keybinding.Hint",
    editable: [{ key: "KeyF" }],
    onDown: () => {
      onFollowKey();
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  // Remembers (per user/browser) that the F / Ctrl+F check has been done.
  game.settings.register(MODULE_ID, "keyChecked", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });
});

Hooks.once("ready", async () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = { follow: startFollowing, stop: stopFollowing, getFollowers };

  game.socket.on(SOCKET, onSocket);
  await chooseDefaultKey();
});

/* -------------------------------------------- */
/*  Default key: F if free, otherwise Ctrl+F    */
/* -------------------------------------------- */

function sameModifiers(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every(m => b.includes(m));
}

/** Returns the id of another action bound to key+modifiers, or null. */
function findConflict(key, modifiers = []) {
  for (const actionId of game.keybindings.actions.keys()) {
    if (actionId === `${MODULE_ID}.${ACTION}`) continue;
    const dot = actionId.indexOf(".");
    const ns = actionId.slice(0, dot);
    const action = actionId.slice(dot + 1);
    let bindings = [];
    try { bindings = game.keybindings.get(ns, action) ?? []; } catch { continue; }
    if (bindings.some(b => b.key === key && sameModifiers(b.modifiers ?? [], modifiers))) return actionId;
  }
  return null;
}

async function chooseDefaultKey() {
  if (game.settings.get(MODULE_ID, "keyChecked")) return;
  try {
    const current = game.keybindings.get(MODULE_ID, ACTION) ?? [];
    const isDefault = current.length === 1 && current[0].key === "KeyF" && !(current[0].modifiers?.length);
    if (!isDefault) return;

    const conflict = findConflict("KeyF", []);
    if (!conflict) return;

    const KM = foundry.helpers?.interaction?.KeyboardManager ?? globalThis.KeyboardManager;
    const ctrl = KM?.MODIFIER_KEYS?.CONTROL ?? "Control";
    const actionName = game.i18n.localize(game.keybindings.actions.get(conflict)?.name ?? conflict);
    if (!findConflict("KeyF", [ctrl])) {
      await game.keybindings.set(MODULE_ID, ACTION, [{ key: "KeyF", modifiers: [ctrl] }]);
      ui.notifications.info(game.i18n.format("DXTF.Notify.Rebound", { action: actionName }));
    } else {
      await game.keybindings.set(MODULE_ID, ACTION, []);
      ui.notifications.warn(game.i18n.localize("DXTF.Notify.NoFreeKey"));
    }
  } catch (err) {
    console.error(`${MODULE_ID} | key check failed`, err);
  } finally {
    await game.settings.set(MODULE_ID, "keyChecked", true);
  }
}

/* -------------------------------------------- */
/*  Key press: start / stop following           */
/* -------------------------------------------- */

function getLeaderFlag(doc) {
  return doc?.getFlag(MODULE_ID, "leader") ?? null;
}

async function onFollowKey() {
  const controlled = canvas.tokens?.controlled?.map(t => t.document) ?? [];
  if (!controlled.length) {
    ui.notifications.warn(game.i18n.localize("DXTF.Notify.NoToken"));
    return;
  }

  // Any selected token that is following -> stop them.
  const following = controlled.filter(d => getLeaderFlag(d));
  if (following.length) {
    for (const doc of following) await stopFollowing(doc);
    return;
  }

  const followers = controlled.filter(d => d.isOwner);
  if (!followers.length) return;

  const leader = await pickLeader(followers);
  if (!leader) return;
  for (const doc of followers) await startFollowing(doc, leader);
}

async function pickLeader(followers) {
  const scene = canvas.scene;
  const excluded = new Set(followers.map(d => d.id));
  const ref = followers[0];
  const refCenter = centerOf(ref, scene);

  const candidates = scene.tokens
    .filter(t => !excluded.has(t.id))
    .filter(t => game.user.isGM || canPlayerPick(t))
    .map(t => {
      const c = centerOf(t, scene);
      const distSquares = Math.round(Math.hypot(c.x - refCenter.x, c.y - refCenter.y) / scene.grid.size);
      return { doc: t, dist: distSquares };
    })
    .sort((a, b) => a.dist - b.dist);

  if (!candidates.length) {
    ui.notifications.warn(game.i18n.localize("DXTF.Dialog.None"));
    return null;
  }

  const name = followers.length === 1 ? ref.name : followers.map(f => f.name).join(", ");
  const rows = candidates.map((c, i) => `
    <label class="dxtf-option">
      <input type="radio" name="leader" value="${c.doc.id}" ${i === 0 ? "checked" : ""}>
      <img src="${escapeHTML(c.doc.texture?.src)}" alt="">
      <span class="dxtf-name">${escapeHTML(c.doc.name)}</span>
      <span class="dxtf-dist">${c.dist} sq</span>
    </label>`).join("");

  const content = `
    <p>${game.i18n.format("DXTF.Dialog.Intro", { name: escapeHTML(name) })}</p>
    <div class="dxtf-list">${rows}</div>`;

  let leaderId = null;
  try {
    leaderId = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("DXTF.Dialog.Title"), icon: "fa-solid fa-shoe-prints" },
      classes: ["dxtf-dialog"],
      content,
      rejectClose: false,
      ok: {
        label: game.i18n.localize("DXTF.Dialog.Follow"),
        icon: "fa-solid fa-person-walking-arrow-right",
        callback: (event, button) => button.form.elements.leader?.value ?? null
      }
    });
  } catch {
    return null;
  }
  return leaderId ? scene.tokens.get(leaderId) : null;
}

/**
 * Non-GM users may only pick tokens that are friendly and that they can
 * currently see on the canvas (not hidden, not outside their vision).
 */
function canPlayerPick(tokenDoc) {
  if (tokenDoc.hidden) return false;
  if (tokenDoc.disposition !== CONST.TOKEN_DISPOSITIONS.FRIENDLY) return false;
  return tokenDoc.object?.visible === true;
}

/* -------------------------------------------- */
/*  Follow state                                */
/* -------------------------------------------- */

/** True if `candidate` (directly or through a chain) follows `doc`. */
function isFollowingChain(candidate, doc) {
  const seen = new Set();
  let current = candidate;
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    const f = getLeaderFlag(current);
    if (!f) return false;
    if (f.tokenId === doc.id && f.sceneId === doc.parent?.id) return true;
    current = game.scenes.get(f.sceneId)?.tokens.get(f.tokenId);
  }
  return false;
}

async function startFollowing(follower, leader) {
  if (!follower || !leader || follower === leader) return;
  if (isFollowingChain(leader, follower)) {
    ui.notifications.warn(game.i18n.format("DXTF.Notify.Loop", { leader: leader.name, follower: follower.name }));
    return;
  }

  // Direction "leader came from the follower's side", so the follower ends up on its own side.
  const scene = leader.parent;
  const lc = centerOf(leader, scene);
  const fc = centerOf(follower, scene);
  const dir = snapDirection(lc.x - fc.x, lc.y - fc.y) ?? { x: 0, y: 1 };

  await follower.setFlag(MODULE_ID, "leader", {
    sceneId: scene.id,
    tokenId: leader.id,
    actorId: leader.actorId ?? null,
    name: leader.name,
    userId: game.user.id,
    dir
  });
  ui.notifications.info(game.i18n.format("DXTF.Notify.Started", { follower: follower.name, leader: leader.name }));

  await moveBehind(follower, { x: leader.x, y: leader.y, width: leader.width, height: leader.height, elevation: leader.elevation }, dir);
}

async function stopFollowing(follower) {
  if (!getLeaderFlag(follower)) return;
  await follower.unsetFlag(MODULE_ID, "leader");
  ui.notifications.info(game.i18n.format("DXTF.Notify.Stopped", { follower: follower.name }));
}

/** All tokens on the leader's scene that follow the leader. */
function getFollowers(leader) {
  const scene = leader?.parent;
  if (!scene) return [];
  return scene.tokens.filter(t => {
    const f = getLeaderFlag(t);
    return f && f.sceneId === scene.id && f.tokenId === leader.id;
  });
}

/** The single client that should move this follower. */
function isResponsibleFor(follower) {
  const f = getLeaderFlag(follower);
  const starter = f?.userId ? game.users.get(f.userId) : null;
  if (starter?.active && follower.testUserPermission(starter, "OWNER")) return starter.isSelf;

  // Otherwise: first active non-GM owner, then the active GM.
  const owner = game.users.find(u => u.active && !u.isGM && follower.testUserPermission(u, "OWNER"));
  if (owner) return owner.isSelf;
  return game.users.activeGM?.isSelf ?? false;
}

/* -------------------------------------------- */
/*  Geometry                                    */
/* -------------------------------------------- */

function gridSize(scene) {
  const g = scene.grid;
  return { w: g.sizeX ?? g.size, h: g.sizeY ?? g.size };
}

function centerOf(doc, scene, pos = doc) {
  const { w, h } = gridSize(scene);
  return { x: pos.x + (doc.width * w) / 2, y: pos.y + (doc.height * h) / 2 };
}

/** Snap a movement vector to one of 8 directions. Returns {x,y} in {-1,0,1} or null. */
function snapDirection(dx, dy) {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const angle = octant * (Math.PI / 4);
  return { x: Math.round(Math.cos(angle)), y: Math.round(Math.sin(angle)) };
}

/**
 * Top-left position for the follower so it sits directly behind the leader.
 * @param leader  {x, y, width, height} in scene pixels / grid units
 * @param dir     leader's movement direction {x,y} in {-1,0,1}
 */
function behindPosition(scene, leader, follower, dir) {
  const { w, h } = gridSize(scene);
  const lw = leader.width * w, lh = leader.height * h;
  const fw = follower.width * w, fh = follower.height * h;

  let x;
  if (dir.x > 0) x = leader.x - fw;
  else if (dir.x < 0) x = leader.x + lw;
  else x = leader.x + (lw - fw) / 2;

  let y;
  if (dir.y > 0) y = leader.y - fh;
  else if (dir.y < 0) y = leader.y + lh;
  else y = leader.y + (lh - fh) / 2;

  return snapPosition(scene, { x, y }, fw, fh);
}

function snapPosition(scene, pos, fw, fh) {
  const grid = scene.grid;
  const T = CONST.GRID_TYPES;
  const M = CONST.GRID_SNAPPING_MODES;
  try {
    if (grid.type === T.GRIDLESS) return pos;
    if (grid.type === T.SQUARE) return grid.getSnappedPoint(pos, { mode: M.TOP_LEFT_VERTEX });
    // Hex: snap the center to a hex center.
    const c = grid.getSnappedPoint({ x: pos.x + fw / 2, y: pos.y + fh / 2 }, { mode: M.CENTER });
    return { x: c.x - fw / 2, y: c.y - fh / 2 };
  } catch {
    return pos;
  }
}

async function moveBehind(follower, leaderPos, dir) {
  if (follower.locked) return;
  const scene = follower.parent;
  const target = behindPosition(scene, leaderPos, follower, dir);
  const update = {};
  if (Math.round(target.x) !== Math.round(follower.x)) update.x = Math.round(target.x);
  if (Math.round(target.y) !== Math.round(follower.y)) update.y = Math.round(target.y);
  if (leaderPos.elevation !== undefined && leaderPos.elevation !== follower.elevation) update.elevation = leaderPos.elevation;

  const f = getLeaderFlag(follower);
  if (f && (f.dir?.x !== dir.x || f.dir?.y !== dir.y)) {
    update[`flags.${MODULE_ID}.leader.dir`] = dir;
  }
  if (!Object.keys(update).length) return;
  await follower.update(update, { [MODULE_ID]: true });
}

/* -------------------------------------------- */
/*  Leader movement                             */
/* -------------------------------------------- */

async function onLeaderMoved(leader, from, to) {
  const followers = getFollowers(leader).filter(isResponsibleFor);
  if (!followers.length) return;
  const dir = snapDirection(to.x - from.x, to.y - from.y);
  if (!dir) return;

  const leaderPos = { x: to.x, y: to.y, width: leader.width, height: leader.height, elevation: to.elevation ?? leader.elevation };
  for (const follower of followers) {
    try {
      await moveBehind(follower, leaderPos, dir);
    } catch (err) {
      console.error(`${MODULE_ID} | could not move follower ${follower.name}`, err);
    }
  }
}

// V13 movement hook: gives origin and destination (and the waypoints passed).
Hooks.on("moveToken", (doc, movement) => {
  try {
    handledByMoveHook.add(doc.id);
    setTimeout(() => handledByMoveHook.delete(doc.id), 250);

    const dest = movement?.destination ?? { x: doc.x, y: doc.y, elevation: doc.elevation };
    // Use the last straight segment so a path that turns ends with the right facing.
    const waypoints = movement?.passed?.waypoints ?? [];
    let from = movement?.origin ?? lastPos.get(doc.id);
    if (waypoints.length >= 2) from = waypoints[waypoints.length - 2];
    else if (waypoints.length === 1 && movement?.origin) from = movement.origin;

    lastPos.set(doc.id, { x: dest.x, y: dest.y });
    if (from) onLeaderMoved(doc, from, dest);
  } catch (err) {
    console.error(`${MODULE_ID} | moveToken`, err);
  }
});

// Fallback in case moveToken isn't fired for some kind of update.
Hooks.on("updateToken", (doc, changes) => {
  if (!("x" in changes) && !("y" in changes)) return;
  const prev = lastPos.get(doc.id);
  setTimeout(() => {
    if (handledByMoveHook.has(doc.id)) return;
    lastPos.set(doc.id, { x: doc.x, y: doc.y });
    if (prev) onLeaderMoved(doc, prev, { x: doc.x, y: doc.y, elevation: doc.elevation });
  }, 50);
});

Hooks.on("canvasReady", () => {
  for (const t of canvas.scene?.tokens ?? []) lastPos.set(t.id, { x: t.x, y: t.y });
});

Hooks.on("createToken", doc => {
  lastPos.set(doc.id, { x: doc.x, y: doc.y });
  if (game.users.activeGM?.isSelf) setTimeout(() => checkTeleport(doc), TELEPORT_DELAY_MS);
});

/* -------------------------------------------- */
/*  Leader changed scene                        */
/* -------------------------------------------- */

/**
 * A token was created. If it is the same creature as a leader whose token has
 * disappeared from another scene, the leader was moved: bring its followers along.
 */
async function checkTeleport(newLeader) {
  const newScene = newLeader.parent;
  if (!newScene || !newScene.tokens.get(newLeader.id)) return;

  for (const scene of game.scenes) {
    if (scene.id === newScene.id) continue;
    for (const follower of scene.tokens) {
      const f = getLeaderFlag(follower);
      if (!f) continue;
      if (f.name !== newLeader.name) continue;
      if ((f.actorId ?? null) !== (newLeader.actorId ?? null)) continue;
      const oldLeader = game.scenes.get(f.sceneId)?.tokens.get(f.tokenId);
      if (oldLeader) continue; // leader is still where it was
      try {
        await teleportFollower(follower, newLeader, f);
      } catch (err) {
        console.error(`${MODULE_ID} | could not move ${follower.name} to ${newScene.name}`, err);
      }
    }
  }
}

async function teleportFollower(follower, leader, flag) {
  const oldScene = follower.parent;
  const newScene = leader.parent;
  const dir = flag.dir ?? { x: 0, y: 1 };

  const data = follower.toObject();
  const pos = behindPosition(newScene, leader, follower, dir);
  data.x = Math.round(pos.x);
  data.y = Math.round(pos.y);
  data.elevation = leader.elevation;
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.leader`, {
    ...flag,
    sceneId: newScene.id,
    tokenId: leader.id
  });

  const owners = game.users.filter(u =>
    !u.isGM && u.active && follower.testUserPermission(u, "OWNER") && u.viewedScene === oldScene.id
  );

  await newScene.createEmbeddedDocuments("Token", [data], { keepId: true, [MODULE_ID]: true });
  await follower.delete({ [MODULE_ID]: true });

  if (owners.length) {
    game.socket.emit(SOCKET, { type: "pull", sceneId: newScene.id, userIds: owners.map(u => u.id) });
  }
}

function onSocket(data) {
  if (data?.type !== "pull" || !data.userIds?.includes(game.user.id)) return;
  game.scenes.get(data.sceneId)?.view();
}

/* -------------------------------------------- */

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
