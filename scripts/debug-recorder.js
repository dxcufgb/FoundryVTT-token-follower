/**
 * Optional integration with Dxcufgb's Debug Recorder (module id `dxcufgbs-debug-recorder`), a GM-run recorder that
 * collects debugging data from the dxcufgb modules into a file for bug reports. Not a dependency: without the
 * recorder (or while it isn't recording) everything here does nothing, and nothing the recorder does can break
 * following (every call into it is wrapped).
 *
 * The recorder announces itself with the hook `dxcufgbs-debug-recorder.ready` (its API as the argument) and also
 * keeps the API at `game.modules.get("dxcufgbs-debug-recorder").api`, so the order the modules load in doesn't
 * matter: whichever comes first registers, and only once.
 *
 * Snapshot and breadcrumb data are counts, booleans, numbers and this module's own enums only: never names, free
 * text, image paths or URLs.
 */

const RECORDER_ID = "dxcufgbs-debug-recorder";

/** This module's id (given by registerDebugRecorder, so this file needs no import from the entry script). */
let moduleId = null;
/** The recorder API this module registered with (null until then). */
let recorder = null;
/** The recorder API from its ready hook. */
let announced = null;
/** Builds this module's snapshot (set by registerDebugRecorder). */
let snapshotFn = null;

function recorderApi() {
  return announced ?? game.modules?.get(RECORDER_ID)?.api ?? null;
}

/** The snapshot handed to the recorder; a failure is reported in the snapshot instead of thrown. */
function snapshot() {
  try {
    return snapshotFn?.() ?? {};
  } catch (err) {
    return { snapshotError: errorName(err) };
  }
}

/** Registers with the recorder once, as soon as both the recorder and the snapshot function are there. */
function connect() {
  const rec = recorderApi();
  if (recorder || !moduleId || !snapshotFn || typeof rec?.register !== "function") return;
  try {
    rec.register(moduleId, { snapshot });
    recorder = rec;
  } catch (err) {
    console.warn(`${moduleId} | Debug Recorder registration failed`, err);
  }
}

Hooks.once(`${RECORDER_ID}.ready`, rec => {
  announced = rec ?? null;
  connect();
});
// Fallback: the recorder was ready before this module's code ran.
Hooks.once("ready", connect);

/**
 * Registers this module with the recorder (now if it is already there, otherwise when it announces itself).
 * @param {string} id               this module's id (MODULE_ID)
 * @param {() => object} fn         returns plain JSON data describing the module's runtime state
 */
export function registerDebugRecorder(id, fn) {
  moduleId = id;
  snapshotFn = fn;
  connect();
}

/**
 * Leaves a breadcrumb in the recording. Does nothing unless the recorder is installed and recording.
 * @param {string} key                     dot-namespaced, e.g. "follow.start"
 * @param {object|() => object} [data]     a small flat object; a function is only called while recording
 */
export function crumb(key, data) {
  if (!recorder) return;
  try {
    if (!recorder.isRecording?.()) return;
    recorder.breadcrumb(moduleId, key, typeof data === "function" ? data() : data);
  } catch {
    // A recorder problem must never break following.
  }
}

/** The error's type ("TypeError", …) for a breadcrumb: never its message, which can hold names. */
export function errorName(err) {
  return typeof err?.name === "string" ? err.name : "Error";
}
