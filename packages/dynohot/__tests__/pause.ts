import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
	closeAllWatchers,
	isWatcherPathPaused,
	pauseWatcherPath,
	registerWatcherClosable,
} from "#dynohot/runtime/pause";

const PAUSE_KEY = Symbol.for("dynohot.fileWatcher.pauseCounts");
const CLOSABLES_KEY = Symbol.for("dynohot.fileWatcher.closables");

function clearGlobals() {
	const g = globalThis as Record<symbol, unknown>;
	delete g[PAUSE_KEY];
	delete g[CLOSABLES_KEY];
}

await test("pauseWatcherPath registers and releases a single prefix", () => {
	clearGlobals();
	assert.equal(isWatcherPathPaused("/repo/foo"), false);
	const release = pauseWatcherPath("/repo");
	assert.equal(isWatcherPathPaused("/repo"), true);
	assert.equal(isWatcherPathPaused("/repo/foo"), true);
	assert.equal(isWatcherPathPaused("/repo/foo/bar.ts"), true);
	assert.equal(isWatcherPathPaused("/repository"), false, "must not match sibling prefixes");
	assert.equal(isWatcherPathPaused("/other"), false);
	release();
	assert.equal(isWatcherPathPaused("/repo/foo"), false);
});

await test("pauseWatcherPath is reference-counted across overlapping pauses", () => {
	clearGlobals();
	const a = pauseWatcherPath("/repo");
	const b = pauseWatcherPath("/repo");
	a();
	assert.equal(
		isWatcherPathPaused("/repo/foo"),
		true,
		"second outstanding pause should keep the path paused",
	);
	b();
	assert.equal(isWatcherPathPaused("/repo/foo"), false);
});

await test("release function is idempotent", () => {
	clearGlobals();
	const release = pauseWatcherPath("/repo");
	release();
	release(); // double-release must not underflow into negative counts
	assert.equal(isWatcherPathPaused("/repo/foo"), false);
	const second = pauseWatcherPath("/repo");
	assert.equal(isWatcherPathPaused("/repo/foo"), true);
	second();
});

await test("multiple distinct prefixes are isolated", () => {
	clearGlobals();
	const releaseA = pauseWatcherPath("/a");
	const releaseB = pauseWatcherPath("/b");
	assert.equal(isWatcherPathPaused("/a/x"), true);
	assert.equal(isWatcherPathPaused("/b/x"), true);
	releaseA();
	assert.equal(isWatcherPathPaused("/a/x"), false);
	assert.equal(isWatcherPathPaused("/b/x"), true);
	releaseB();
});

await test("pause registry is shared via globalThis Symbol.for", () => {
	clearGlobals();
	const release = pauseWatcherPath("/repo");
	const map = (globalThis as Record<symbol, unknown>)[PAUSE_KEY] as
		| Map<string, number>
		| undefined;
	assert.ok(map instanceof Map, "global pause map must be present");
	assert.equal(map.get("/repo"), 1);
	release();
	const after = (globalThis as Record<symbol, unknown>)[PAUSE_KEY] as
		| Map<string, number>
		| undefined;
	assert.equal(
		after?.get("/repo"),
		undefined,
		"prefix entry must be deleted when count hits zero",
	);
});

await test("registerWatcherClosable + closeAllWatchers", async () => {
	clearGlobals();
	let aClosed = 0;
	let bClosed = 0;
	const a = { close: () => { aClosed++; } };
	const b = { close: () => { bClosed++; } };
	registerWatcherClosable(a);
	registerWatcherClosable(b);
	await closeAllWatchers();
	assert.equal(aClosed, 1);
	assert.equal(bClosed, 1);
	await closeAllWatchers(); // set was cleared, second call is a no-op
	assert.equal(aClosed, 1);
	assert.equal(bClosed, 1);
});

await test("registerWatcherClosable returns a deregister fn", async () => {
	clearGlobals();
	let closed = 0;
	const watcher = { close: () => { closed++; } };
	const dereg = registerWatcherClosable(watcher);
	dereg();
	await closeAllWatchers();
	assert.equal(closed, 0, "deregistered watchers must not be closed");
});

await test("closeAllWatchers swallows individual close throws", async () => {
	clearGlobals();
	let aClosed = 0;
	let cClosed = 0;
	const a = { close: () => { aClosed++; } };
	const b = { close: () => { throw new Error("nope"); } };
	const c = { close: () => { cClosed++; } };
	registerWatcherClosable(a);
	registerWatcherClosable(b);
	registerWatcherClosable(c);
	await closeAllWatchers();
	assert.equal(aClosed, 1);
	assert.equal(cClosed, 1);
});

await test("closables registry is shared via globalThis Symbol.for", async () => {
	clearGlobals();
	const watcher = { close: () => {} };
	registerWatcherClosable(watcher);
	const set = (globalThis as Record<symbol, unknown>)[CLOSABLES_KEY] as
		| Set<unknown>
		| undefined;
	assert.ok(set instanceof Set, "global closable set must be present");
	assert.ok(set.has(watcher));
	await closeAllWatchers();
});
