import * as assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateStatus } from "dynohot/runtime/controller";
import { TestModule } from "./__fixtures__/module.js";

// Caused by a missing call to `isInvalidated`
await test("invalidate should work", async () => {
	const main = new TestModule(() =>
		`import.meta.hot.accept();
		globalThis.invalidate = () => import.meta.hot.invalidate();`);
	await main.dispatch();
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	main.global.invalidate();
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});
