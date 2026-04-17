/* eslint-disable @typescript-eslint/restrict-template-expressions */
import * as assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateStatus } from "dynohot/runtime/controller";
import { TestModule } from "./__fixtures__/module.js";

await test("dynamic import with error throws", async () => {
	const main = new TestModule(() =>
		`const module = await import(${error});`);
	const error = new TestModule(() =>
		"throw new Error()");
	await assert.rejects(main.dispatch());
});

await test("lazy dynamic import with error is recoverable", async () => {
	const main = new TestModule(() =>
		`const module = import(${error});
		await module.catch(() => {});
		import.meta.hot.accept(${error});`);
	const error = new TestModule(() =>
		"throw new Error()");
	await main.dispatch();
	error.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});
