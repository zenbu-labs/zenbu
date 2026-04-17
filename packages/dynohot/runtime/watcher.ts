import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { debounceAsync } from "./utility.js";

// Q: Why don't you use chokidar?
// A: https://github.com/paulmillr/chokidar#persistence
// """
//     If set to false when using fsevents to watch, no more events will be emitted after ready, even if
//     the process continues to run.
// """
// I guess there is no way to unref?

// This is the same approach TypeScript takes via `createUseFsEventsOnParentDirectoryWatchFile`
interface DirectoryWatcher {
	callbacksByFile: Map<string, CallbacksByFile>;
	watcher: fs.FSWatcher;
}

interface CallbacksByFile {
	callbacks: Set<() => void>;
	dispatch: () => Promise<void>;
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
			const holder = {
				callbacksByFile,
				watcher: fs.watch(directory, { persistent: false }, (type, fileName) => {
					if (fileName !== null) {
						const callbacks = callbacksByFile.get(fileName);
						void callbacks?.dispatch();
					}
				}),
			};
			holder.watcher.unref();
			this.watchers.set(directory, holder);
			return holder;
		})();
		// Initialize by-file callback holder
		const byFile = directoryWatcher.callbacksByFile.get(fileName) ?? function() {
			let stat: fs.Stats | null = null;
			const callbacks = new Set<() => void>();
			const dispatch = debounceAsync(async () => {
				const nextStat = await fsPromises.stat(path).catch(() => null);
				const previousStat = stat;
				stat = nextStat ?? previousStat;
				if (!previousStat || !nextStat) {
					return;
				}
				if (previousStat.mtimeMs === nextStat.mtimeMs) {
					return;
				}
				for (const callback of callbacks) {
					callback();
				}
			});
			void dispatch();
			const byFile = { callbacks, dispatch };
			directoryWatcher.callbacksByFile.set(fileName, byFile);
			return byFile;
		}();
		byFile.callbacks.add(callback);
		return () => {
			byFile.callbacks.delete(callback);
			if (byFile.callbacks.size === 0) {
				this.watchers.delete(directory);
				directoryWatcher.watcher.close();
			}
		};
	}
}
