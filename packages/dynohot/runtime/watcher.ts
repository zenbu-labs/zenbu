import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { subscribe, type AsyncSubscription } from "@parcel/watcher";
import { isWatcherPathPaused, registerWatcherClosable } from "./pause.js";
import { debounceAsync } from "./utility.js";

// Q: Why @parcel/watcher instead of node:fs.watch?
// A: Node's fs.watch on macOS is a thin wrapper over FSEvents and has
// documented reliability holes: it drops events or delivers
// `filename=null` for atomic rename-replace (the pattern git uses, and
// many editors use for atomic saves). Result: editing a file via
// `git pull` — or any rename-replace — silently skipped the watcher
// and dynohot never reloaded. @parcel/watcher is the native FSEvents
// wrapper VSCode, Vite, Parcel, Tailwind's JIT, etc. all use. It
// normalizes OS events into clean { type, path } batches with no
// null-filename drops and correct rename-replace handling.

interface DirectoryWatcher {
	callbacksByFile: Map<string, CallbacksByFile>;
	closable: Closable;
}

interface CallbacksByFile {
	callbacks: Set<() => void>;
	dispatch: () => Promise<void>;
}

interface Closable {
	close(): void;
}

/** @internal */
export class FileWatcher {
	private readonly watchers = new Map<string, DirectoryWatcher>();

	watch(url: string, callback: () => void) {
		if (!url.startsWith("file://")) {
			return;
		}
		const path = fileURLToPath(url);
		const fileName = basename(path);
		const directory = dirname(path);
		// Initialize directory watcher
		const directoryWatcher = this.watchers.get(directory) ?? (() => {
			const callbacksByFile = new Map<string, CallbacksByFile>();
			// `subscribe` is recursive; filter to direct children of
			// `directory` so semantics match the previous fs.watch(dir).
			let subscription: AsyncSubscription | null = null;
			let closed = false;
			void subscribe(directory, (err, events) => {
				if (err) return;
				for (const event of events) {
					if (dirname(event.path) !== directory) continue;
					const byFile = callbacksByFile.get(basename(event.path));
					if (byFile) void byFile.dispatch();
				}
			}).then((sub) => {
				if (closed) void sub.unsubscribe().catch(() => {});
				else subscription = sub;
			}).catch((err: unknown) => {
				console.error(`[dynohot] watch failed for ${directory}:`, err);
			});
			const closable: Closable = {
				close: () => {
					closed = true;
					if (subscription) return subscription.unsubscribe().catch(() => {});
				},
			};
			// Track for process-wide shutdown — see `pause.ts`.
			const deregister = registerWatcherClosable(closable);
			const holder: DirectoryWatcher & { deregister: () => void } = {
				callbacksByFile,
				closable,
				deregister,
			};
			this.watchers.set(directory, holder);
			return holder;
		})();
		// Initialize by-file callback holder
		const byFile = directoryWatcher.callbacksByFile.get(fileName) ?? function() {
			const callbacks = new Set<() => void>();
			const dispatch = debounceAsync(async () => {
				// If a caller has paused this path (e.g. during git
				// pull + pnpm install), suppress callbacks until resume.
				if (isWatcherPathPaused(path)) return;
				for (const callback of callbacks) {
					callback();
				}
			});
			const byFile = { callbacks, dispatch };
			directoryWatcher.callbacksByFile.set(fileName, byFile);
			return byFile;
		}();
		byFile.callbacks.add(callback);
		return () => {
			byFile.callbacks.delete(callback);
			if (byFile.callbacks.size === 0) {
				directoryWatcher.callbacksByFile.delete(fileName);
				if (directoryWatcher.callbacksByFile.size === 0) {
					this.watchers.delete(directory);
					directoryWatcher.closable.close();
					(directoryWatcher as DirectoryWatcher & {
						deregister?: () => void;
					}).deregister?.();
				}
			}
		};
	}
}
