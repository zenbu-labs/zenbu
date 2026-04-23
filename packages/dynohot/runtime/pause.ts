/**
 * Runtime file-watcher pause controls.
 *
 * Dynohot's `FileWatcher` normally fires module-reload callbacks as soon as
 * it sees a watched file's mtime change. Callers that perform MULTI-STEP
 * filesystem mutations (like a plugin-updater doing `git pull` + `pnpm
 * install`) need a window where those intermediate mtime changes don't
 * trigger hot-reloads — the running process's code and its node_modules
 * must stay in sync, and mid-flight reloads see a half-applied state.
 *
 * Usage:
 *
 *     import { pauseWatcherPath } from "dynohot/pause"
 *     const resume = pauseWatcherPath("/path/to/plugin/repo")
 *     try {
 *       // ...git pull, pnpm install, etc...
 *     } finally {
 *       resume()
 *     }
 *
 * Multiple overlapping pauses on the same prefix are reference-counted; a
 * path is unpaused only when every `resume()` function has been called.
 *
 * Semantics: while a path is paused, dynohot's dispatch STILL runs (so it
 * can track that the file's mtime has advanced), but callbacks DO NOT
 * fire. After resume, the next genuine mtime change fires callbacks as
 * normal. If the caller reverts the files back to their original content
 * (e.g. `git reset --hard`), dynohot's watcher will fire once the reverted
 * mtime differs from the absorbed one — giving the service a chance to
 * re-evaluate back to its pre-pause code.
 */

/**
 * The pause registry is stashed on `globalThis` under a well-known symbol
 * rather than as a module-level binding. Dynohot is often loaded through
 * multiple resolver paths in a single process (loader thread via
 * `module.register`, runtime via `hot:runtime?...` with cache-busting
 * query strings from tsx, etc.) and ESM treats each distinct URL as a
 * separate module instance with its own bindings. A plain
 * `const pauseCounts = new Map()` would yield multiple independent Maps —
 * one caller increments its copy, another caller's copy is still empty,
 * and the pause check silently returns `false`. Routing through the
 * single process-wide `globalThis` object dodges that entirely.
 */

const PAUSE_KEY = Symbol.for("dynohot.fileWatcher.pauseCounts");

function getPauseCounts(): Map<string, number> {
	const g = globalThis as Record<symbol, unknown>;
	let map = g[PAUSE_KEY] as Map<string, number> | undefined;
	if (!map) {
		map = new Map<string, number>();
		g[PAUSE_KEY] = map;
	}
	return map;
}

export function pauseWatcherPath(prefix: string): () => void {
	const pauseCounts = getPauseCounts();
	pauseCounts.set(prefix, (pauseCounts.get(prefix) ?? 0) + 1);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		const counts = getPauseCounts();
		const current = counts.get(prefix) ?? 0;
		if (current <= 1) {
			counts.delete(prefix);
		} else {
			counts.set(prefix, current - 1);
		}
	};
}

/** @internal Called by the file watcher to skip firing while paused. */
export function isWatcherPathPaused(absolutePath: string): boolean {
	const pauseCounts = getPauseCounts();
	if (pauseCounts.size === 0) return false;
	for (const prefix of pauseCounts.keys()) {
		if (
			absolutePath === prefix ||
			absolutePath.startsWith(prefix + "/")
		) {
			return true;
		}
	}
	return false;
}

/**
 * Registry of fs.watch-backed watchers that need to be `.close()`'d before
 * process exit. On macOS, `fs.watch` uses FSEvents.framework on a
 * background thread; if we `_exit(0)` (or skip shutdown hooks) while
 * watchers are still armed, FSEvents will try to dispatch events into a
 * dying V8 isolate → `napi_call_function` assertion → SIGABRT. Callers
 * (dynohot's FileWatcher, the kernel's zenbu-loader-hooks) register their
 * fs watchers here and the shell invokes `closeAllWatchers()` as part of
 * shutdown.
 */

const WATCHER_SET_KEY = Symbol.for("dynohot.fileWatcher.closables");

interface Closable {
	close(): void | Promise<void>;
}

function getClosables(): Set<Closable> {
	const g = globalThis as Record<symbol, unknown>;
	let set = g[WATCHER_SET_KEY] as Set<Closable> | undefined;
	if (!set) {
		set = new Set<Closable>();
		g[WATCHER_SET_KEY] = set;
	}
	return set;
}

/**
 * Register a closable (typically an `fs.FSWatcher`) for shutdown cleanup.
 * Returns a de-registration function — call it when the watcher is
 * closed normally, so the shutdown list doesn't grow unbounded.
 */
export function registerWatcherClosable(watcher: Closable): () => void {
	const set = getClosables();
	set.add(watcher);
	return () => {
		set.delete(watcher);
	};
}

/**
 * Close every registered watcher. Call this synchronously immediately
 * before a hard process exit so FSEvents stops dispatching before the V8
 * isolate dies.
 */
export async function closeAllWatchers(): Promise<void> {
	const set = getClosables();
	const all = [...set];
	set.clear();
	await Promise.allSettled(all.map((w) => {
		try { return w.close(); } catch { return; }
	}));
}
