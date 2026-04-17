/* eslint-disable @typescript-eslint/restrict-template-expressions */
import * as assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateStatus } from "dynohot/runtime/controller";
import { TestModule } from "./__fixtures__/module.js";

await test("removing module node should work", async () => {
	const main = new TestModule(() =>
		`import {} from ${child};
		import.meta.hot.accept(${child});`);
	const child = new TestModule(() =>
		`import {} from ${previousChild}`);
	const previousChild = new TestModule(() =>
		"import.meta.hot.prune(() => globalThis.seen = true);");
	await main.dispatch();
	child.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
	assert.strictEqual(main.global.seen, true);
});

await test("dispose and prune runs together", async () => {
	const main = new TestModule(() =>
		`import ${child};
		import.meta.hot.accept();`);
	const child = new TestModule(() =>
		`globalThis.seen = 0;
		import.meta.hot.dispose(() => {
			assert.strictEqual(++seen, 4);
		});
		import.meta.hot.prune(() => {
			assert.strictEqual(++seen, 3);
		});
		import.meta.hot.dispose(() => {
			assert.strictEqual(++seen, 2);
		});
		import.meta.hot.prune(() => {
			assert.strictEqual(++seen, 1);
		});`);
	await main.dispatch();
	main.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
	assert.strictEqual(main.global.seen, 4);
});
