import * as assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateStatus } from "dynohot/runtime/controller";
import { TestModule } from "./__fixtures__/module.js";

await test("dispose handlers should run bottom up", async () => {
	const main = new TestModule(() =>
		`let seen = false;
		import.meta.hot.accept();
		import.meta.hot.dispose(() => {
			assert.strictEqual(seen, true);
		});
		import.meta.hot.dispose(() => {
			seen = true;
		});`);
	await main.dispatch();
	main.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});

await test("dispose handlers should run even if invalidated", async () => {
	const main = new TestModule(() =>
		`import.meta.hot.accept(() => {
			import.meta.hot.invalidate();
		});
		import.meta.hot.dispose(() => {
			globalThis.seen = true;
		});`);
	await main.dispatch();
	main.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
	assert.strictEqual(main.global.seen, true);
});

await test("do not throw from dispose, alright", async () => {
	const main = new TestModule(() =>
		`import.meta.hot.accept();
		import.meta.hot.dispose(() => {
			throw new Error();
		});`);
	await main.dispatch();
	main.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.fatalError);
});
